// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixtures} from "../Fixtures.sol";
import {PropertyNFT} from "../../src/PropertyNFT.sol";
import {TransferHook} from "../../src/TransferHook.sol";
import {Minter} from "../../src/Minter.sol";
import {ProgressionManager} from "../../src/ProgressionManager.sol";
import {EditionRegistry} from "../../src/EditionRegistry.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @notice The shared pot, the per-edition buying, and the dilution that comes with it.
/// @dev    None of this can be retrofitted, so it is exercised from the first edition on.
contract EditionsTest is Fixtures {
    uint256 internal constant EDITION_TWO = 2;

    PropertyNFT internal nft2;
    TransferHook internal hook2;
    Minter internal minter2;
    ProgressionManager internal manager2;
    MockERC20[4] internal assets2;

    /// @dev A later edition with no multiplier: a plain 1.0x collection.
    function _registerEditionTwo() internal {
        nft2 = new PropertyNFT("Second Edition Card", "CARD2", 10_000, owner);
        hook2 = new TransferHook(address(nft2), address(distributor), EDITION_TWO);
        minter2 = new Minter(address(token), address(nft2), owner);
        manager2 = new ProgressionManager(
            address(token), address(nft2), address(distributor), EDITION_TWO, owner
        );

        vm.startPrank(owner);
        nft2.linkSettlementHook(address(hook2));
        nft2.linkMinter(address(minter2));
        nft2.linkProgressionManager(address(manager2));

        address[][] memory assetsByQuarter = new address[][](4);
        for (uint8 q; q < 4; ++q) {
            assets2[q] = new MockERC20("SecondAsset", "SA", 18);
            address[] memory one = new address[](1);
            one[0] = address(assets2[q]);
            assetsByQuarter[q] = one;
        }
        registry.registerEdition(EDITION_TWO, address(nft2), address(hook2), 10_000, assetsByQuarter);
        minter2.unpause();
        vm.stopPrank();
    }

    function _mintInEditionTwo(address who, uint8 quarter) internal returns (uint256 id) {
        fund(who, MINT_BURN);
        vm.startPrank(who);
        token.approve(address(minter2), MINT_BURN);
        id = minter2.mint(quarter);
        vm.stopPrank();
    }

    function test_registeringAnEditionIsTheOneDiscretionaryPower() public {
        _registerEditionTwo();
        assertTrue(registry.isRegistered(EDITION_TWO));
        assertEq(registry.editionCount(), 2);

        // And it cannot be undone or edited afterwards.
        address[][] memory assetsByQuarter = new address[][](4);
        for (uint8 q; q < 4; ++q) {
            address[] memory one = new address[](1);
            one[0] = address(assets2[q]);
            assetsByQuarter[q] = one;
        }
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(EditionRegistry.AlreadyRegistered.selector, EDITION_TWO));
        registry.registerEdition(EDITION_TWO, address(nft2), address(hook2), 10_000, assetsByQuarter);

        // Nobody but the owner can register one at all.
        vm.prank(alice);
        vm.expectRevert();
        registry.registerEdition(3, address(nft2), address(hook2), 10_000, assetsByQuarter);
    }

    function test_aNewEditionDilutesEveryExistingCard() public {
        mintCard(alice, 0);
        assertEq(distributor.protocolWeight(), 125);
        assertEq(distributor.editionWeight(EDITION), 125);

        // Edition 1 takes the whole pot while it is alone.
        assertEq(distributor.editionWeight(EDITION) * 10_000 / distributor.protocolWeight(), 10_000);

        _registerEditionTwo();
        _mintInEditionTwo(bob, 0);

        // A card was added elsewhere and edition 1's share of future fees fell, without a
        // single thing about alice's card changing. This is the mechanism, not a bug.
        assertEq(distributor.editionWeight(EDITION), 125);
        assertEq(distributor.editionWeight(EDITION_TWO), 100);
        assertEq(distributor.protocolWeight(), 225);
    }

    function test_theFoundingMultiplierMakesItFallTwentyFivePercentSlower() public {
        // One House in each edition: identical cards, identical levels.
        mintCard(alice, 0);
        _registerEditionTwo();
        _mintInEditionTwo(bob, 0);

        uint256 one = distributor.editionWeight(EDITION);
        uint256 two = distributor.editionWeight(EDITION_TWO);

        assertEq(one, 125, "founding edition stores 1.25x");
        assertEq(two, 100, "a later edition at 1.0x");
        assertEq(one * 10_000 / two, 12_500, "exactly 25% more weight for the same card");
    }

    function test_holdersOnlyEverReceiveTheirOwnEditionsAssets() public {
        uint256 a = mintCard(alice, 0);
        _registerEditionTwo();
        uint256 b = _mintInEditionTwo(bob, 0);

        // Each edition's portion buys only that edition's own assets.
        depositReward(0, 100e18); // edition 1, quarter 0

        assets2[0].mint(revenueVault, 80e18);
        vm.startPrank(revenueVault);
        assets2[0].approve(address(distributor), 80e18);
        distributor.deposit(EDITION_TWO, address(assets2[0]), 0, 80e18);
        vm.stopPrank();

        // Alice's card accrues in edition 1's asset, bob's in edition 2's. Note that both
        // cards are id 1: ids restart per edition, so only the edition key tells them apart.
        assertEq(a, b);
        assertEq(pending(0, a), 100e18);
        assertEq(distributor.pendingOf(EDITION_TWO, address(assets2[0]), 0, b, 100), 80e18);

        // Claiming is where it counts. Each wallet is paid in its own edition's asset and
        // comes away with nothing from the other, because a claim walks the holdings of
        // that edition's collection and bob holds none of edition 1's.
        vm.startPrank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        distributor.claimQuarter(EDITION_TWO, 0, 0, 0);
        vm.stopPrank();
        assertEq(rewardBalance(0, alice), 100e18);
        assertEq(assets2[0].balanceOf(alice), 0, "never an asset from an edition she does not hold");

        vm.startPrank(bob);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        distributor.claimQuarter(EDITION_TWO, 0, 0, 0);
        vm.stopPrank();
        assertEq(assets2[0].balanceOf(bob), 80e18);
        assertEq(rewardBalance(0, bob), 0);
    }

    function test_theSameTokenIdInTwoEditionsKeepsSeparateBooks() public {
        // Ids restart at 1 in every edition, so the accounting key has to carry the
        // edition or two unrelated cards would share one checkpoint.
        uint256 a = mintCard(alice, 0);
        _registerEditionTwo();
        uint256 b = _mintInEditionTwo(bob, 0);
        assertEq(a, b, "the same id in both editions");

        depositReward(0, 100e18);

        assertEq(distributor.checkpointOf(EDITION, rewardAsset[0], a), 0);
        assertEq(
            distributor.checkpointOf(EDITION_TWO, address(assets2[0]), b),
            0,
            "edition 2's books were not moved by edition 1's deposit"
        );
        assertEq(distributor.totalDeposited(EDITION_TWO, address(assets2[0]), 0), 0);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        assertGt(distributor.checkpointOf(EDITION, rewardAsset[0], a), 0);
        assertEq(
            distributor.checkpointOf(EDITION_TWO, address(assets2[0]), b),
            0,
            "and alice's claim did not touch bob's card that shares its id"
        );
    }

    function test_aDeadAssetInALaterEditionCannotReachBackIntoThisOne() public {
        uint256 a = mintCard(alice, 0);
        _registerEditionTwo();
        _mintInEditionTwo(bob, 0);

        depositReward(0, 100e18);

        // Edition 2's asset never gets deposited at all -- delisted, frozen, whatever.
        assertEq(distributor.totalDeposited(EDITION_TWO, address(assets2[0]), 0), 0);

        // Edition 1 is entirely unaffected.
        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        assertEq(rewardBalance(0, alice), 100e18);
        assertEq(pending(0, a), 0);
    }

    function test_anEditionsAssetSetHasNoSetter() public {
        _registerEditionTwo();
        address[] memory before = registry.quarterAssets(EDITION_TWO, 0);
        assertEq(before.length, 1);

        (bool ok,) = address(registry).call(
            abi.encodeWithSignature("setQuarterAssets(uint256,uint8,address[])", EDITION_TWO, 0, before)
        );
        assertFalse(ok, "adding an asset requires a new edition, visible to everyone");
    }

    function test_theHookOfOneEditionCannotSettleAnother() public {
        mintCard(alice, 0);
        _registerEditionTwo();

        // Edition 2's hook has no authority over edition 1's books.
        vm.prank(address(hook2));
        vm.expectRevert();
        distributor.settleToken(EDITION, 1, 0, 125, alice);
    }
}
