// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IWETH9} from "./interfaces/IWETH9.sol";
import {IAcquisitionAdapter} from "./interfaces/IAcquisitionAdapter.sol";
import {IEditionRegistry} from "./interfaces/IEditionRegistry.sol";
import {IDistributor} from "./interfaces/IDistributor.sol";
import {AllocationController} from "./AllocationController.sol";

/// @title RevenueVault
/// @notice Holds WETH on its way to becoming reward assets, and decides whose it is.
///
/// @dev Two steps, both open to anyone.
///
///      `allocate` divides fresh WETH between editions in proportion to each edition's
///      total weight, then between that edition's quarters on its frozen allocation. The
///      founding edition's 1.25x is already baked into its stored weights, so nothing
///      here reapplies it.
///
///      `processQuarter` converts one quarter's WETH into that quarter's own assets and
///      deposits them. Each quarter converts on its own, so a route that fails leaves
///      exactly one quarter's WETH pending and touches nothing else.
///
///      The pot is shared upstream and the buying is per-edition: an edition-1 holder can
///      never be paid in an edition-3 asset, and a dead asset in a later edition cannot
///      reach back into this one.
contract RevenueVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWETH9 public immutable weth;

    IDistributor public distributor;
    IEditionRegistry public registry;

    /// @notice May act while the vault is paused, for incident recovery. When the vault is
    ///         not paused, both entry points are open to everyone and this role is idle.
    address public processor;

    mapping(uint256 edition => AllocationController) public allocatorOf;
    mapping(uint256 edition => mapping(uint8 quarter => uint256)) public pendingWeth;
    mapping(uint256 edition => mapping(uint8 quarter => mapping(address asset => IAcquisitionAdapter)))
        public adapterFor;

    /// @notice Sum of every `pendingWeth` entry, so fresh arrivals can be measured.
    uint256 public totalPendingWeth;

    event Allocated(uint256 fresh, uint256 assigned, uint256 protocolWeight);
    event QuarterAllocated(uint256 indexed edition, uint8 indexed quarter, uint256 amount);
    event Processed(
        uint256 indexed edition, uint8 indexed quarter, address indexed asset, uint256 spent, uint256 received
    );
    event AdapterSet(uint256 indexed edition, uint8 indexed quarter, address indexed asset, address adapter);
    event AllocatorLinked(uint256 indexed edition, address allocator);
    event ProcessorSet(address indexed processor);
    event Linked(string what, address target);

    error ZeroAddress();
    error AlreadyLinked();
    error NotProcessorWhilePaused();
    error NothingToAllocate();
    error NoWeightYet();
    error NothingPending();
    error AdapterNotSet(uint256 edition, uint8 quarter, address asset);
    error AdapterAssetMismatch(address expected, address actual);
    error AdapterInputMismatch(address expected, address actual);
    error AssetNotInQuarter(address asset);
    error MinOutLengthMismatch(uint256 expected, uint256 actual);
    error NothingReceived();

    constructor(address weth_, address owner_) Ownable(owner_) {
        if (weth_ == address(0)) revert ZeroAddress();
        weth = IWETH9(weth_);
    }

    /// @notice Accept native value so a venue paying in ETH is never stranded.
    receive() external payable {}

    // --- links ------------------------------------------------------------------------

    function linkDistributor(address distributor_) external onlyOwner {
        if (address(distributor) != address(0)) revert AlreadyLinked();
        if (distributor_ == address(0)) revert ZeroAddress();
        distributor = IDistributor(distributor_);
        emit Linked("distributor", distributor_);
    }

    function linkRegistry(address registry_) external onlyOwner {
        if (address(registry) != address(0)) revert AlreadyLinked();
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IEditionRegistry(registry_);
        emit Linked("registry", registry_);
    }

    /// @notice Attach an edition's frozen quarter allocation. Once per edition.
    function linkAllocator(uint256 edition, address allocator) external onlyOwner {
        if (address(allocatorOf[edition]) != address(0)) revert AlreadyLinked();
        if (allocator == address(0)) revert ZeroAddress();
        allocatorOf[edition] = AllocationController(allocator);
        emit AllocatorLinked(edition, allocator);
    }

    function setProcessor(address processor_) external onlyOwner {
        processor = processor_;
        emit ProcessorSet(processor_);
    }

    /// @notice Point a quarter's asset at a route.
    /// @dev    Swappable on purpose: the route is the riskiest moving part in the system
    ///         and has to be replaceable without migrating any accounting. What it cannot
    ///         do is change which asset holders end up with -- the adapter is checked
    ///         against the registry's frozen asset list before it is accepted.
    function setAdapter(uint256 edition, uint8 quarter, address asset, address adapter)
        external
        onlyOwner
    {
        address[] memory assets = registry.quarterAssets(edition, quarter);
        bool found;
        for (uint256 i; i < assets.length; ++i) {
            if (assets[i] == asset) {
                found = true;
                break;
            }
        }
        if (!found) revert AssetNotInQuarter(asset);

        if (adapter != address(0)) {
            address adapterAsset = IAcquisitionAdapter(adapter).asset();
            if (adapterAsset != asset) revert AdapterAssetMismatch(asset, adapterAsset);
            address adapterInput = IAcquisitionAdapter(adapter).inputToken();
            if (adapterInput != address(weth)) revert AdapterInputMismatch(address(weth), adapterInput);
        }

        adapterFor[edition][quarter][asset] = IAcquisitionAdapter(adapter);
        emit AdapterSet(edition, quarter, asset, adapter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- pipeline ---------------------------------------------------------------------

    /// @notice Value here that no quarter has claimed yet.
    /// @dev    Counts native balance as well as WETH, because `allocate` wraps whatever
    ///         native is held before it divides anything. Reporting WETH alone made this
    ///         view disagree with the function it describes: value paid in as ETH read as
    ///         nothing waiting, while `allocate` would have processed it. A view that says
    ///         an action has nothing to do, when it does, is worse than no view at all --
    ///         an interface will disable the control on the strength of it.
    function unallocated() public view returns (uint256) {
        uint256 balance = weth.balanceOf(address(this)) + address(this).balance;
        return balance > totalPendingWeth ? balance - totalPendingWeth : 0;
    }

    /// @notice Divide fresh WETH between editions by weight, then between quarters.
    function allocate() external nonReentrant returns (uint256 assigned) {
        _requireOperable();

        uint256 native = address(this).balance;
        if (native != 0) weth.deposit{value: native}();

        uint256 fresh = unallocated();
        if (fresh == 0) revert NothingToAllocate();

        uint256 protocolWeight = distributor.protocolWeight();
        // Nothing exists to divide this between yet. It waits rather than going anywhere.
        if (protocolWeight == 0) revert NoWeightYet();

        uint256[] memory ids = registry.editionIds();
        for (uint256 i; i < ids.length; ++i) {
            uint256 edition = ids[i];
            uint256 editionShare = (fresh * distributor.editionWeight(edition)) / protocolWeight;
            if (editionShare == 0) continue;

            uint256[] memory parts = allocatorOf[edition].split(editionShare);
            for (uint8 q; q < parts.length; ++q) {
                if (parts[q] == 0) continue;
                pendingWeth[edition][q] += parts[q];
                emit QuarterAllocated(edition, q, parts[q]);
            }
            assigned += editionShare;
        }

        // Whatever truncation left over stays unallocated and is picked up next time,
        // rather than being nudged onto whichever edition happens to be last in the list.
        totalPendingWeth += assigned;
        emit Allocated(fresh, assigned, protocolWeight);
    }

    /// @notice Convert one quarter's WETH into its own assets and deposit them.
    /// @param  minOuts one minimum per asset in the quarter, in registry order. These can
    ///         only tighten the adapter's own oracle floor, never loosen it.
    function processQuarter(uint256 edition, uint8 quarter, uint256[] calldata minOuts, uint256 deadline)
        external
        nonReentrant
        returns (uint256[] memory received)
    {
        _requireOperable();

        uint256 amount = pendingWeth[edition][quarter];
        if (amount == 0) revert NothingPending();

        address[] memory assets = registry.quarterAssets(edition, quarter);
        if (minOuts.length != assets.length) revert MinOutLengthMismatch(assets.length, minOuts.length);

        pendingWeth[edition][quarter] = 0;
        totalPendingWeth -= amount;

        received = new uint256[](assets.length);
        uint256 perAsset = amount / assets.length;
        uint256 spentSoFar;

        for (uint256 i; i < assets.length; ++i) {
            uint256 portion = (i == assets.length - 1) ? amount - spentSoFar : perAsset;
            spentSoFar += portion;
            if (portion == 0) continue;
            received[i] = _convertAndDeposit(edition, quarter, assets[i], portion, minOuts[i], deadline);
        }
    }

    /// @dev One asset's leg of a quarter's conversion, split out to keep the stack shallow.
    function _convertAndDeposit(
        uint256 edition,
        uint8 quarter,
        address asset,
        uint256 portion,
        uint256 minOut,
        uint256 deadline
    ) private returns (uint256 deposited) {
        IAcquisitionAdapter adapter = adapterFor[edition][quarter][asset];
        if (address(adapter) == address(0)) revert AdapterNotSet(edition, quarter, asset);

        IERC20(address(weth)).safeTransfer(address(adapter), portion);
        uint256 out = adapter.convert(portion, minOut, deadline, address(this));
        if (out == 0) revert NothingReceived();

        IERC20(asset).forceApprove(address(distributor), out);
        deposited = distributor.deposit(edition, asset, quarter, out);
        IERC20(asset).forceApprove(address(distributor), 0);

        emit Processed(edition, quarter, asset, portion, deposited);
    }

    // --- views ------------------------------------------------------------------------

    /// @notice What a quarter is holding, waiting to be converted.
    function quarterPending(uint256 edition, uint8 quarter) external view returns (uint256) {
        return pendingWeth[edition][quarter];
    }

    /// @notice True when both pipeline entry points are open to anyone right now.
    function operableByAnyone() external view returns (bool) {
        return !paused();
    }

    /// @dev Open to everyone while running. While paused, only the processor, and only so
    ///      an incident can be worked through -- not so anyone can be made to wait in the
    ///      normal course of things.
    function _requireOperable() private view {
        if (paused() && msg.sender != processor) revert NotProcessorWhilePaused();
    }
}
