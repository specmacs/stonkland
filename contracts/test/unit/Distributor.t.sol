// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixtures, IMintableERC20} from "../Fixtures.sol";
import {Distributor} from "../../src/Distributor.sol";

/// @notice The accounting the whole protocol rests on.
contract DistributorTest is Fixtures {
    function test_depositSplitsByWeightWithinTheQuarter() public {
        uint256 a = mintCard(alice, 0); // House, weight 125
        uint256 b = mintCard(bob, 0);
        buildTo(bob, b, 5); // Landmark, weight 625

        assertEq(nft.weightOf(a), 125);
        assertEq(nft.weightOf(b), 625);
        assertEq(distributor.quarterWeight(EDITION, 0), 750);

        depositReward(0, 750e18);

        // A Landmark is five Houses, so it takes five sixths of the same deposit.
        assertEq(pending(0, a), 125e18);
        assertEq(pending(0, b), 625e18);
    }

    function test_weightOnlyMattersRelativeToTheQuarter() public {
        uint256 a = mintCard(alice, 0);
        depositReward(0, 100e18);
        assertEq(pending(0, a), 100e18, "sole card takes the whole deposit");

        // Somebody else builds. Alice's weight has not changed, but her share has fallen.
        uint256 b = mintCard(bob, 0);
        buildTo(bob, b, 5);
        depositReward(0, 750e18);
        assertEq(pending(0, a), 100e18 + 125e18);
        assertEq(pending(0, b), 625e18);
    }

    function test_quartersAreIsolated() public {
        uint256 a = mintCard(alice, 0);
        uint256 b = mintCard(bob, 1);

        depositReward(0, 100e18);

        assertEq(pending(0, a), 100e18);
        assertEq(pending(1, b), 0, "a deposit in one quarter changes nothing in another");
        assertEq(distributor.totalDeposited(EDITION, rewardAsset[1], 1), 0);
        assertEq(distributor.accumulatorOf(EDITION, rewardAsset[1], 1), 0);
    }

    function test_aQuarterWithNoCardsReservesItsShare() public {
        depositReward(2, 500e18);
        assertEq(distributor.reserveOf(EDITION, rewardAsset[2], 2), 500e18);
        assertEq(distributor.accumulatorOf(EDITION, rewardAsset[2], 2), 0);
        assertEq(poolDeposited(2), 500e18, "still counted as deposited");

        // The reserve is released to the first card that shows up, not to other quarters.
        uint256 id = mintCard(alice, 2);
        assertEq(pending(2, id), 0, "not yet -- the reserve flushes on the next deposit");
        depositReward(2, 100e18);
        assertEq(pending(2, id), 600e18, "reserve plus the new deposit");
        assertEq(distributor.reserveOf(EDITION, rewardAsset[2], 2), 0);
    }

    function test_aNewCardSharesOnlyInLaterDeposits() public {
        uint256 a = mintCard(alice, 0);
        depositReward(0, 100e18);

        uint256 b = mintCard(bob, 0);
        assertEq(pending(0, b), 0, "a card cannot reach backwards into an earlier deposit");

        depositReward(0, 250e18);
        assertEq(pending(0, a), 100e18 + 125e18);
        assertEq(pending(0, b), 125e18);
    }

    // --- settlement on sale -----------------------------------------------------------

    function test_sellingSettlesPendingToTheSellerAndResetsTheBuyer() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);
        assertEq(pending(0, id), 100e18);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);

        assertEq(credited(0, alice), 100e18, "settled to the seller during the transfer");
        assertEq(credited(0, bob), 0);
        assertEq(pending(0, id), 0, "the buyer starts from here");

        depositReward(0, 50e18);
        assertEq(pending(0, id), 50e18, "buyer shares only in what arrives afterwards");
        assertEq(credited(0, alice), 100e18, "seller's ledger is untouched by later deposits");
    }

    function test_creditedStaysWithTheWalletAndDoesNotTransferWithTheCard() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);

        // This is the sentence the listing UI has to carry: the credit is a wallet ledger
        // entry, not part of the card, and no marketplace will explain it.
        assertEq(credited(0, alice), 100e18);
        assertEq(credited(0, bob), 0);

        vm.prank(bob);
        distributor.claimCredited(EDITION, 0);
        assertEq(rewardBalance(0, bob), 0, "the buyer cannot claim the seller's credit");

        vm.prank(alice);
        distributor.claimCredited(EDITION, 0);
        assertEq(rewardBalance(0, alice), 100e18);
    }

    // --- settlement on build ----------------------------------------------------------

    function test_buildCannotApplyTheHigherWeightToAnEarlierDeposit() public {
        uint256 a = mintCard(alice, 0);
        uint256 b = mintCard(bob, 0);
        depositReward(0, 250e18); // 125/125 split

        buildTo(alice, a, 5); // alice jumps to weight 625

        assertEq(credited(0, alice), 125e18, "settled at the old weight before the burn");
        assertEq(pending(0, a), 0);

        depositReward(0, 750e18); // now 625/125 of 750
        assertEq(pending(0, a), 625e18);
        assertEq(pending(0, b), 250e18 / 2 + 125e18);
    }

    function test_buildAndDepositInTheSameBlock() public {
        uint256 a = mintCard(alice, 0);
        uint256 b = mintCard(bob, 0);

        uint256 blockNow = block.number;
        depositReward(0, 250e18);
        buildTo(alice, a, 2); // weight 125 -> 200, same block
        depositReward(0, 325e18);
        assertEq(block.number, blockNow, "all three in one block");

        // First deposit split at 125/125, second at 200/125.
        assertEq(credited(0, alice) + pending(0, a), 125e18 + 200e18);
        assertEq(pending(0, b), 125e18 + 125e18);
    }

    function test_transferAndDepositInTheSameBlockCreditExactlyOneParty() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);
        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        depositReward(0, 60e18);

        uint256 aliceTotal = credited(0, alice);
        uint256 bobTotal = credited(0, bob) + pending(0, id);
        assertEq(aliceTotal, 100e18);
        assertEq(bobTotal, 60e18);
        assertEq(aliceTotal + bobTotal, 160e18, "no double credit and nothing lost");
    }

    function test_transferThenBuildInTheSameBlock() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        buildTo(bob, id, 3);
        depositReward(0, 312e18);

        assertEq(credited(0, alice), 100e18, "seller keeps what accrued under her");
        assertEq(pending(0, id), 312e18, "buyer accrues at the weight he paid for");
    }

    function test_buildThenTransferInTheSameBlock() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);
        buildTo(alice, id, 3);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);

        assertEq(credited(0, alice), 100e18);
        assertEq(credited(0, bob), 0);
        depositReward(0, 312e18);
        assertEq(pending(0, id), 312e18);
    }

    // --- claiming ---------------------------------------------------------------------

    function test_claimQuarterSettlesBeforeItPays() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);

        // Nothing has been credited yet -- it is all still pending on the card.
        assertEq(credited(0, alice), 0);
        assertEq(pending(0, id), 100e18);

        vm.prank(alice);
        (uint256 nextCursor, bool complete,, uint256[] memory paid) =
            distributor.claimQuarter(EDITION, 0, 0, 0);

        assertEq(paid[0], 100e18, "a claim that only paid pre-credited balances would pay zero");
        assertEq(rewardBalance(0, alice), 100e18);
        assertTrue(complete);
        assertEq(nextCursor, 1);
        assertEq(poolClaimed(0), 100e18);
    }

    function test_claimCreditedDoesNotSweepPending() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);

        vm.prank(alice);
        distributor.claimCredited(EDITION, 0);
        assertEq(rewardBalance(0, alice), 0, "named for what it does: credited only");
        assertEq(pending(0, id), 100e18, "still on the card");
    }

    function test_boundedClaimReportsExactlyWhatRemains() public {
        // Alice holds six cards in quarter 0: three primary, three bought.
        fund(alice, MINT_BURN * 3);
        vm.startPrank(alice);
        token.approve(address(minter), type(uint256).max);
        minter.mintBatch(0, 3);
        vm.stopPrank();
        for (uint256 i; i < 3; ++i) {
            uint256 bought = mintCard(address(uint160(0x3000 + i)), 0);
            vm.prank(address(uint160(0x3000 + i)));
            nft.transferFrom(address(uint160(0x3000 + i)), alice, bought);
        }
        assertEq(nft.balanceOf(alice), 6);

        depositReward(0, 600e18); // 6 equal houses, 100e18 each

        vm.prank(alice);
        (uint256 cursor, bool complete,, uint256[] memory paid) =
            distributor.claimQuarter(EDITION, 0, 0, 2);
        assertEq(cursor, 2);
        assertFalse(complete, "the bound stopped it short and it says so");
        assertEq(paid[0], 200e18, "only the two cards it reached");

        vm.prank(alice);
        (cursor, complete,, paid) = distributor.claimQuarter(EDITION, 0, cursor, 10);
        assertTrue(complete);
        assertEq(paid[0], 400e18);
        assertEq(rewardBalance(0, alice), 600e18, "everything, across two bounded passes");
    }

    function test_settleTokensIsPermissionlessAndCreditsTheOwner() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 100e18);

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        vm.prank(carol); // a stranger
        distributor.settleTokens(EDITION, ids);

        assertEq(credited(0, alice), 100e18, "credited to the owner, not the caller");
        assertEq(credited(0, carol), 0);
    }

    function test_claimingTwicePaysNothingTheSecondTime() public {
        mintCard(alice, 0);
        depositReward(0, 100e18);

        vm.startPrank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        (,,, uint256[] memory paid) = distributor.claimQuarter(EDITION, 0, 0, 0);
        vm.stopPrank();
        assertEq(paid[0], 0);
        assertEq(rewardBalance(0, alice), 100e18);
    }

    // --- access control ---------------------------------------------------------------

    function test_onlyTheRevenueVaultCanDeposit() public {
        IMintableERC20 asset = IMintableERC20(rewardAsset[0]);
        asset.mint(alice, 1e18);
        vm.startPrank(alice);
        asset.approve(address(distributor), 1e18);
        vm.expectRevert(Distributor.NotRevenueVault.selector);
        distributor.deposit(EDITION, rewardAsset[0], 0, 1e18);
        vm.stopPrank();
    }

    function test_onlyTheHookCanSettleOrMoveWeight() public {
        uint256 id = mintCard(alice, 0);
        vm.startPrank(alice);
        vm.expectRevert(Distributor.NotHook.selector);
        distributor.settleToken(EDITION, id, 0, 125, alice);
        vm.expectRevert(Distributor.NotHook.selector);
        distributor.onWeightChange(EDITION, 0, 125, 625);
        vm.expectRevert(Distributor.NotHook.selector);
        distributor.onMint(EDITION, 999, 0, 625);
        vm.stopPrank();
    }

    function test_registryLinkIsOneTimeOnly() public {
        vm.prank(owner);
        vm.expectRevert(Distributor.RegistryAlreadySet.selector);
        distributor.setRegistry(address(0xdead));
    }

    // --- solvency ---------------------------------------------------------------------

    function test_claimedNeverExceedsDeposited() public {
        uint256 a = mintCard(alice, 0);
        uint256 b = mintCard(bob, 0);
        buildTo(alice, a, 4);
        buildTo(bob, b, 2);

        depositReward(0, 12_345_678_901_234_567_891);
        depositReward(0, 7);
        depositReward(0, 1e18);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        vm.prank(bob);
        distributor.claimQuarter(EDITION, 0, 0, 0);

        assertLe(poolClaimed(0), poolDeposited(0), "solvency");
        assertEq(rewardBalance(0, alice) + rewardBalance(0, bob), poolClaimed(0));
        // Truncation dust stays in the contract; nothing mints a replacement for it.
        assertGe(rewardBalance(0, address(distributor)), poolDeposited(0) - poolClaimed(0));
        assertEq(pending(0, a) + pending(0, b), 0);
    }

    function test_dustFromTruncationStaysInTheContract() public {
        // A 1e36 accumulator is precise enough that a single card divides any amount
        // exactly. Dust needs weights that do not divide the deposit between them.
        uint256 a = mintCard(alice, 0); // 125
        uint256 b = mintCard(bob, 0);
        buildTo(bob, b, 5); // 625, total quarter weight 750

        depositReward(0, 7); // 7/750 apiece: 1 wei and 5 wei, one left over

        assertEq(pending(0, a), 1);
        assertEq(pending(0, b), 5);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        vm.prank(bob);
        distributor.claimQuarter(EDITION, 0, 0, 0);

        assertEq(poolClaimed(0), 6);
        assertLe(poolClaimed(0), poolDeposited(0), "solvency holds through the truncation");
        assertEq(
            rewardBalance(0, address(distributor)), 1, "the residual wei stays put, unmintable"
        );
    }

    function test_precisionHoldsForASingleCard() public {
        uint256 id = mintCard(alice, 0);
        depositReward(0, 1); // one wei, one card, nothing lost
        assertEq(pending(0, id), 1);
    }

    function test_checkpointNeverDecreases() public {
        uint256 id = mintCard(alice, 0);
        uint256 cp0 = distributor.checkpointOf(EDITION, rewardAsset[0], id);

        depositReward(0, 100e18);
        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        uint256 cp1 = distributor.checkpointOf(EDITION, rewardAsset[0], id);
        assertGe(cp1, cp0);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        uint256 cp2 = distributor.checkpointOf(EDITION, rewardAsset[0], id);
        assertGe(cp2, cp1);

        buildTo(bob, id, 3);
        assertGe(distributor.checkpointOf(EDITION, rewardAsset[0], id), cp2);
    }
}
