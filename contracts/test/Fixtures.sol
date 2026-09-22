// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Token} from "../src/Token.sol";
import {PropertyNFT} from "../src/PropertyNFT.sol";
import {Distributor} from "../src/Distributor.sol";
import {EditionRegistry} from "../src/EditionRegistry.sol";
import {TransferHook} from "../src/TransferHook.sol";
import {Minter} from "../src/Minter.sol";
import {ProgressionManager} from "../src/ProgressionManager.sol";
import {ProgressionLib} from "../src/libraries/ProgressionLib.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Deploys and wires the founding edition the way the runbook does, so every test
///         runs against the same shape the deployment script produces.
contract Fixtures is Test {
    uint256 internal constant EDITION = 1;
    uint16 internal constant MULTIPLIER_BPS = 12_500; // 1.25x
    uint8 internal constant QUARTERS = 4;
    uint16 internal constant QUARTER_CAP = 100;
    uint256 internal constant MINT_BURN = 100_000e18;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal revenueVault = makeAddr("revenueVault");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    Token internal token;
    PropertyNFT internal nft;
    Distributor internal distributor;
    EditionRegistry internal registry;
    TransferHook internal hook;
    Minter internal minter;
    ProgressionManager internal manager;

    /// @dev One reward asset per quarter. Subclasses override `_deployRewardAsset` to
    ///      swap in an asset that misbehaves in a specific, named way.
    address[QUARTERS] internal rewardAsset;

    function setUp() public virtual {
        token = new Token("StonkTown", "TOWN", owner);

        distributor = new Distributor(revenueVault, owner);
        registry = new EditionRegistry(address(distributor), owner);
        vm.prank(owner);
        distributor.setRegistry(address(registry));

        nft = new PropertyNFT("StonkTown Property Card", "CARD", MULTIPLIER_BPS, owner);
        hook = new TransferHook(address(nft), address(distributor), EDITION);
        minter = new Minter(address(token), address(nft), owner);
        manager =
            new ProgressionManager(address(token), address(nft), address(distributor), EDITION, owner);

        vm.startPrank(owner);
        nft.linkSettlementHook(address(hook));
        nft.linkMinter(address(minter));
        nft.linkProgressionManager(address(manager));

        address[][] memory assetsByQuarter = new address[][](QUARTERS);
        for (uint8 q; q < QUARTERS; ++q) {
            rewardAsset[q] = _deployRewardAsset(q);
            address[] memory one = new address[](1);
            one[0] = rewardAsset[q];
            assetsByQuarter[q] = one;
        }
        registry.registerEdition(EDITION, address(nft), address(hook), MULTIPLIER_BPS, assetsByQuarter);

        minter.unpause(); // launch
        vm.stopPrank();
    }

    /// @dev A plain, well-behaved ERC-20 unless a subclass says otherwise.
    function _deployRewardAsset(uint8 q) internal virtual returns (address) {
        return address(
            new MockERC20(string.concat("Reward", vm.toString(q)), string.concat("RW", vm.toString(q)), 18)
        );
    }

    // --- helpers ----------------------------------------------------------------------

    function fund(address to, uint256 amount) internal {
        vm.prank(owner);
        token.transfer(to, amount);
    }

    /// @notice Mint one card in `quarter` for `to`, funding and approving as needed.
    function mintCard(address to, uint8 quarter) internal returns (uint256 tokenId) {
        fund(to, MINT_BURN);
        vm.startPrank(to);
        token.approve(address(minter), MINT_BURN);
        tokenId = minter.mint(quarter);
        vm.stopPrank();
    }

    /// @notice Build `tokenId` up one level for its current owner.
    function build(address who, uint256 tokenId) internal {
        (,, uint256 cost) = nft.nextUpgrade(tokenId);
        fund(who, cost);
        vm.startPrank(who);
        token.approve(address(manager), cost);
        manager.build(tokenId);
        vm.stopPrank();
    }

    function buildTo(address who, uint256 tokenId, uint8 targetLevel) internal {
        while (nft.levelOf(tokenId) < targetLevel) {
            build(who, tokenId);
        }
    }

    /// @notice Push `amount` of quarter `q`'s reward asset through the distributor the way
    ///         the revenue vault does.
    /// @notice Push `amount` of quarter `q`'s reward asset through the distributor the way
    ///         the revenue vault does. Returns what the distributor actually recorded.
    function depositReward(uint8 q, uint256 amount) internal returns (uint256 received) {
        IMintableERC20 asset = IMintableERC20(rewardAsset[q]);
        asset.mint(revenueVault, amount);
        vm.startPrank(revenueVault);
        asset.approve(address(distributor), amount);
        received = distributor.deposit(EDITION, rewardAsset[q], q, amount);
        vm.stopPrank();
    }

    function credited(uint8 q, address wallet) internal view returns (uint256) {
        return distributor.creditedOf(EDITION, rewardAsset[q], q, wallet);
    }

    function pending(uint8 q, uint256 tokenId) internal view returns (uint256) {
        return distributor.pendingOf(EDITION, rewardAsset[q], q, tokenId, nft.weightOf(tokenId));
    }

    function rewardBalance(uint8 q, address who) internal view returns (uint256) {
        return IMintableERC20(rewardAsset[q]).balanceOf(who);
    }

    function poolDeposited(uint8 q) internal view returns (uint256) {
        return distributor.totalDeposited(EDITION, rewardAsset[q], q);
    }

    function poolClaimed(uint8 q) internal view returns (uint256) {
        return distributor.totalClaimed(EDITION, rewardAsset[q], q);
    }

    function expectedWeight(uint8 level) internal pure returns (uint16) {
        return ProgressionLib.weightFor(level, MULTIPLIER_BPS);
    }
}
