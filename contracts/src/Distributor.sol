// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IDistributor} from "./interfaces/IDistributor.sol";
import {IEditionRegistry} from "./interfaces/IEditionRegistry.sol";
import {IPropertyNFT, Property} from "./interfaces/IPropertyNFT.sol";

/// @title Distributor
/// @notice Reward accounting for every edition. Holds the reward assets and decides, by
///         weight, who is owed what.
///
/// @dev The collection is never iterated. Each `(edition, asset, quarter)` pool carries a
///      running accumulator of reward-per-unit-weight; a card's entitlement is the
///      distance between that accumulator and the card's own checkpoint, times its weight.
///      Depositing is O(1) no matter how many cards exist.
///
///      Two numbers per wallet, and they behave differently:
///        * pending  -- accrued on a card, still attached to the card
///        * credited -- settled to a wallet, a ledger entry that stays with the wallet
///      Selling a card settles its pending to the seller. Credited never moves with a
///      sale. No marketplace will explain that, so the interface has to.
///
///      Every division truncates. The remainder stays in the contract as dust and is
///      never topped up by minting a replacement, because there is nothing here that can
///      mint anything.
contract Distributor is IDistributor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Fixed-point scale for the per-weight accumulator.
    uint256 public constant ACC_SCALE = 1e36;

    /// @notice The only address that may deposit rewards. Set once, at construction.
    address public immutable revenueVault;

    IEditionRegistry public registry;
    address public immutable registrar;

    struct Pool {
        uint256 accumulator; // reward per unit weight, scaled by ACC_SCALE
        uint256 deposited; // everything ever received, measured
        uint256 claimed; // everything ever paid out, measured
        uint256 reserve; // received while the quarter had no weight to divide it by
    }

    /// @notice edition => quarter => summed weight of every card in it
    mapping(uint256 => mapping(uint8 => uint256)) public quarterWeight;
    /// @notice edition => summed weight across all its quarters
    mapping(uint256 => uint256) public editionWeight;
    /// @notice summed weight across every registered edition
    uint256 public protocolWeight;

    mapping(uint256 => mapping(address => mapping(uint8 => Pool))) private _pool;
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) private _checkpoint;
    mapping(uint256 => mapping(address => mapping(uint8 => mapping(address => uint256)))) private
        _credited;

    event Deposited(
        uint256 indexed edition, address indexed asset, uint8 indexed quarter, uint256 received, uint256 accumulator
    );
    event Reserved(uint256 indexed edition, address indexed asset, uint8 indexed quarter, uint256 amount);
    event Settled(
        uint256 indexed edition, uint256 indexed tokenId, address indexed owner, address asset, uint256 amount
    );
    event Claimed(
        uint256 indexed edition, address indexed asset, uint8 indexed quarter, address wallet, uint256 amount
    );
    /// @notice A range of a quarter was settled and paid without its owners asking.
    event QuarterPushed(
        uint256 indexed edition, uint8 indexed quarter, uint256 fromId, uint256 toId, bool complete
    );
    /// @notice One recipient could not be paid during a push. Their credit is untouched.
    event PushSkipped(
        uint256 indexed edition, address indexed asset, uint8 indexed quarter, address wallet, uint256 owed
    );
    event WeightChanged(uint256 indexed edition, uint8 indexed quarter, uint256 quarterTotal, uint256 editionTotal);
    event RegistrySet(address registry);

    error NotRevenueVault();
    error NotHook();
    error NotRegistrar();
    error RegistryAlreadySet();
    error ZeroAddress();
    error NothingReceived();
    error UnknownEdition(uint256 edition);
    error WeightUnderflow();

    modifier onlyHook(uint256 edition) {
        _requireHook(edition);
        _;
    }

    constructor(address revenueVault_, address registrar_) {
        if (revenueVault_ == address(0) || registrar_ == address(0)) revert ZeroAddress();
        revenueVault = revenueVault_;
        registrar = registrar_;
    }

    /// @dev The registry needs this contract's address at its own construction, so the
    ///      link is completed one way round afterwards. Once only, and never again.
    function setRegistry(address registry_) external {
        if (msg.sender != registrar) revert NotRegistrar();
        if (address(registry) != address(0)) revert RegistryAlreadySet();
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IEditionRegistry(registry_);
        emit RegistrySet(registry_);
    }

    // --- settlement -------------------------------------------------------------------
    // Arithmetic only. No token movement, no external calls, bounded loops. This code sits
    // in the path of a card transfer that nobody can pause, so it must not be able to fail.

    /// @notice Open a freshly minted card's books at the current accumulator, so it shares
    ///         only in deposits that arrive after it exists.
    function onMint(uint256 edition, uint256 tokenId, uint8 quarter, uint16 weight)
        external
        onlyHook(edition)
    {
        address[] memory assets = registry.quarterAssets(edition, quarter);
        for (uint256 i; i < assets.length; ++i) {
            _checkpoint[edition][assets[i]][tokenId] = _pool[edition][assets[i]][quarter].accumulator;
        }
        _addWeight(edition, quarter, weight);
    }

    /// @notice Move everything accrued on `tokenId` onto `owner`'s ledger.
    function settleToken(uint256 edition, uint256 tokenId, uint8 quarter, uint16 weight, address owner)
        external
        onlyHook(edition)
    {
        _settle(edition, tokenId, quarter, weight, owner);
    }

    /// @notice Apply a card's weight change to the running totals.
    /// @dev    Callers reach this only after the card has already been settled at its old
    ///         weight, because the collection calls the hook in that order and the hook is
    ///         the only address accepted here.
    function onWeightChange(uint256 edition, uint8 quarter, uint16 oldWeight, uint16 newWeight)
        external
        onlyHook(edition)
    {
        if (newWeight >= oldWeight) {
            _addWeight(edition, quarter, newWeight - oldWeight);
        } else {
            _subWeight(edition, quarter, oldWeight - newWeight);
        }
    }

    /// @notice Settle named cards to their current owners. Open to anyone: it can only
    ///         move a card's accrual onto the ledger of whoever actually owns it.
    function settleTokens(uint256 edition, uint256[] calldata tokenIds) external {
        IPropertyNFT nft = IPropertyNFT(_requireEdition(edition));
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            Property memory p = nft.propertyOf(tokenId);
            _settle(edition, tokenId, p.quarter, p.weight, nft.ownerOf(tokenId));
        }
    }

    // --- deposits ---------------------------------------------------------------------

    /// @notice Take `amount` of `asset` from the revenue vault into a quarter's pool.
    /// @dev    Accounted on the measured balance delta, not on what was asked for: a
    ///         reward asset may take a cut on transfer, and the books follow the tokens
    ///         that actually arrived.
    function deposit(uint256 edition, address asset, uint8 quarter, uint256 amount)
        external
        nonReentrant
        returns (uint256 received)
    {
        if (msg.sender != revenueVault) revert NotRevenueVault();

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        received = IERC20(asset).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert NothingReceived();

        Pool storage p = _pool[edition][asset][quarter];
        p.deposited += received;

        uint256 weight = quarterWeight[edition][quarter];
        if (weight == 0) {
            // Nothing to divide by. A quarter with no cards holds its share as a reserve
            // rather than handing it to the other quarters.
            p.reserve += received;
            emit Reserved(edition, asset, quarter, received);
        } else {
            uint256 distributable = received + p.reserve;
            p.reserve = 0;
            p.accumulator += (distributable * ACC_SCALE) / weight;
            emit Deposited(edition, asset, quarter, received, p.accumulator);
        }
    }

    // --- claims -----------------------------------------------------------------------

    /// @notice Settle the caller's cards in `quarter` and pay out everything owed.
    /// @dev    This genuinely claims: it settles before it pays. The scan is bounded, and
    ///         when the bound stops it short the return values say exactly how far it got
    ///         so the interface can show what is left rather than implying nothing is.
    /// @param  cursor index into the caller's holdings to resume from
    /// @param  maxScan how many of the caller's cards to look at, 0 for all of them
    /// @return nextCursor index to pass in next time
    /// @return complete true when the scan reached the end of the caller's holdings
    /// @return assets the quarter's reward assets
    /// @return paid amount of each asset actually transferred out
    function claimQuarter(uint256 edition, uint8 quarter, uint256 cursor, uint256 maxScan)
        external
        nonReentrant
        returns (uint256 nextCursor, bool complete, address[] memory assets, uint256[] memory paid)
    {
        IPropertyNFT nft = IPropertyNFT(_requireEdition(edition));

        uint256 balance = nft.balanceOf(msg.sender);
        uint256 end = (maxScan == 0) ? balance : cursor + maxScan;
        if (end > balance) end = balance;

        for (uint256 i = cursor; i < end; ++i) {
            uint256 tokenId = nft.tokenOfOwnerByIndex(msg.sender, i);
            Property memory p = nft.propertyOf(tokenId);
            if (p.quarter != quarter) continue;
            _settle(edition, tokenId, quarter, p.weight, msg.sender);
        }

        nextCursor = end;
        complete = end >= balance;

        assets = registry.quarterAssets(edition, quarter);
        paid = new uint256[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            paid[i] = _payout(edition, assets[i], quarter, msg.sender);
        }
    }

    /// @notice Pay out only what is already on the caller's ledger, settling nothing.
    /// @dev    Named for what it does. Anything still accruing on a card is untouched by
    ///         this call; `claimQuarter` is the one that sweeps.
    /// @notice Settle and pay every card in `quarter`, so owners are not required to act.
    /// @dev    Walks token ids directly rather than an owner's enumeration, which is what
    ///         makes this possible at all: a quarter's ids are contiguous and assigned in
    ///         order, so the set that exists is known without iterating anything.
    ///
    ///         Bounded and resumable. `limit` caps the work per call and `nextId` carries
    ///         the position forward, so a quarter can be pushed in as many transactions as
    ///         the gas limit requires and nothing is ever half-settled.
    ///
    ///         A recipient whose transfer fails is skipped rather than reverting the batch.
    ///         One address that cannot receive an asset -- a contract with no fallback, a
    ///         holder a token has blocklisted -- must not be able to stop everyone else
    ///         being paid. The credit stays theirs and `claimQuarter` still works for them.
    ///
    ///         Open to anyone. Whoever calls it pays the gas to pay other people, which is
    ///         expected to be the project itself on a schedule; the point is that nobody
    ///         has to wait for that to happen, and nobody's rewards depend on it happening.
    function pushQuarter(uint256 edition, uint8 quarter, uint256 fromId, uint256 limit)
        external
        nonReentrant
        returns (uint256 nextId, bool complete)
    {
        IPropertyNFT nft = IPropertyNFT(_requireEdition(edition));
        uint256 start;
        uint256 endId;
        {
            // Ids are handed out in order, so everything minted in this quarter sits in
            // [firstId, firstId + minted).
            uint256 firstId = uint256(quarter) * nft.QUARTER_CAP() + 1;
            endId = firstId + nft.mintedInQuarter(quarter);
            start = fromId < firstId ? firstId : fromId;
        }

        uint256 stop = (limit == 0) ? endId : start + limit;
        if (stop > endId) stop = endId;

        for (uint256 tokenId = start; tokenId < stop; ++tokenId) {
            _pushOne(edition, quarter, tokenId, nft);
        }

        nextId = stop;
        complete = stop >= endId;
        emit QuarterPushed(edition, quarter, start, stop, complete);
    }

    /// @dev One card's share of the push, in its own frame so the caller keeps its stack.
    function _pushOne(uint256 edition, uint8 quarter, uint256 tokenId, IPropertyNFT nft) private {
        address owner = nft.ownerOf(tokenId);
        _settle(edition, tokenId, quarter, nft.propertyOf(tokenId).weight, owner);

        address[] memory assets = registry.quarterAssets(edition, quarter);
        for (uint256 i; i < assets.length; ++i) {
            _tryPayout(edition, assets[i], quarter, owner);
        }
    }

    function claimCredited(uint256 edition, uint8 quarter)
        external
        nonReentrant
        returns (address[] memory assets, uint256[] memory paid)
    {
        assets = registry.quarterAssets(edition, quarter);
        paid = new uint256[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            paid[i] = _payout(edition, assets[i], quarter, msg.sender);
        }
    }

    // --- views ------------------------------------------------------------------------

    function poolOf(uint256 edition, address asset, uint8 quarter) external view returns (Pool memory) {
        return _pool[edition][asset][quarter];
    }

    function accumulatorOf(uint256 edition, address asset, uint8 quarter) external view returns (uint256) {
        return _pool[edition][asset][quarter].accumulator;
    }

    function totalDeposited(uint256 edition, address asset, uint8 quarter) external view returns (uint256) {
        return _pool[edition][asset][quarter].deposited;
    }

    function totalClaimed(uint256 edition, address asset, uint8 quarter) external view returns (uint256) {
        return _pool[edition][asset][quarter].claimed;
    }

    function reserveOf(uint256 edition, address asset, uint8 quarter) external view returns (uint256) {
        return _pool[edition][asset][quarter].reserve;
    }

    function checkpointOf(uint256 edition, address asset, uint256 tokenId) external view returns (uint256) {
        return _checkpoint[edition][asset][tokenId];
    }

    function creditedOf(uint256 edition, address asset, uint8 quarter, address wallet)
        external
        view
        returns (uint256)
    {
        return _credited[edition][asset][quarter][wallet];
    }

    /// @notice What `tokenId` has accrued in `asset` but not yet had settled.
    function pendingOf(uint256 edition, address asset, uint8 quarter, uint256 tokenId, uint16 weight)
        public
        view
        returns (uint256)
    {
        uint256 acc = _pool[edition][asset][quarter].accumulator;
        uint256 cp = _checkpoint[edition][asset][tokenId];
        if (acc <= cp) return 0;
        return (uint256(weight) * (acc - cp)) / ACC_SCALE;
    }

    /// @notice Pending for one card across every asset serving its quarter.
    function pendingForToken(uint256 edition, uint256 tokenId)
        external
        view
        returns (address[] memory assets, uint256[] memory amounts)
    {
        IPropertyNFT nft = IPropertyNFT(_requireEdition(edition));
        Property memory p = nft.propertyOf(tokenId);
        assets = registry.quarterAssets(edition, p.quarter);
        amounts = new uint256[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            amounts[i] = pendingOf(edition, assets[i], p.quarter, tokenId, p.weight);
        }
    }

    // --- internals --------------------------------------------------------------------

    function _settle(uint256 edition, uint256 tokenId, uint8 quarter, uint16 weight, address owner)
        private
    {
        address[] memory assets = registry.quarterAssets(edition, quarter);
        for (uint256 i; i < assets.length; ++i) {
            address asset = assets[i];
            uint256 acc = _pool[edition][asset][quarter].accumulator;
            uint256 cp = _checkpoint[edition][asset][tokenId];
            if (acc == cp) continue;
            // The accumulator only ever rises, so a checkpoint set to it never falls.
            uint256 owed = (uint256(weight) * (acc - cp)) / ACC_SCALE;
            _checkpoint[edition][asset][tokenId] = acc;
            if (owed != 0) {
                _credited[edition][asset][quarter][owner] += owed;
                emit Settled(edition, tokenId, owner, asset, owed);
            }
        }
    }

    /// @dev `_payout` with the transfer's failure caught instead of propagated. Used only
    ///      by the push, where one recipient reverting would deny payment to everyone
    ///      after them in the batch. The credit is restored on failure, so nothing is lost
    ///      -- the owner is simply not paid this round and can claim whenever they like.
    function _tryPayout(uint256 edition, address asset, uint8 quarter, address to) private {
        uint256 owed = _credited[edition][asset][quarter][to];
        if (owed == 0) return;

        _credited[edition][asset][quarter][to] = 0;

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        try IERC20(asset).transfer(to, owed) {
            uint256 sent = balanceBefore - IERC20(asset).balanceOf(address(this));
            if (sent < owed) {
                unchecked {
                    _credited[edition][asset][quarter][to] = owed - sent;
                }
            }
            if (sent != 0) {
                _pool[edition][asset][quarter].claimed += sent;
                emit Claimed(edition, asset, quarter, to, sent);
            }
        } catch {
            // Put it back exactly as it was. This owner is skipped, not charged.
            _credited[edition][asset][quarter][to] = owed;
            emit PushSkipped(edition, asset, quarter, to, owed);
        }
    }

    function _payout(uint256 edition, address asset, uint8 quarter, address to)
        private
        returns (uint256 sent)
    {
        uint256 owed = _credited[edition][asset][quarter][to];
        if (owed == 0) return 0;

        // Zeroed before the transfer, so a reentrant claim finds an empty ledger.
        _credited[edition][asset][quarter][to] = 0;

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        // Reverts, and takes the whole claim with it, if the asset refuses the transfer --
        // a blocklisted holder keeps the credit rather than burning it on a failed send.
        IERC20(asset).safeTransfer(to, owed);
        sent = balanceBefore - IERC20(asset).balanceOf(address(this));

        if (sent < owed) {
            // The asset delivered less than it was asked for. The shortfall stays owed.
            unchecked {
                _credited[edition][asset][quarter][to] = owed - sent;
            }
        }
        _pool[edition][asset][quarter].claimed += sent;
        emit Claimed(edition, asset, quarter, to, sent);
    }

    function _addWeight(uint256 edition, uint8 quarter, uint256 delta) private {
        if (delta == 0) return;
        quarterWeight[edition][quarter] += delta;
        editionWeight[edition] += delta;
        protocolWeight += delta;
        emit WeightChanged(edition, quarter, quarterWeight[edition][quarter], editionWeight[edition]);
    }

    function _subWeight(uint256 edition, uint8 quarter, uint256 delta) private {
        if (delta == 0) return;
        if (quarterWeight[edition][quarter] < delta || protocolWeight < delta) revert WeightUnderflow();
        quarterWeight[edition][quarter] -= delta;
        editionWeight[edition] -= delta;
        protocolWeight -= delta;
        emit WeightChanged(edition, quarter, quarterWeight[edition][quarter], editionWeight[edition]);
    }

    function _requireHook(uint256 edition) private view {
        if (msg.sender != registry.hookOf(edition)) revert NotHook();
    }

    function _requireEdition(uint256 edition) private view returns (address nft) {
        nft = registry.nftOf(edition);
        if (nft == address(0)) revert UnknownEdition(edition);
    }
}
