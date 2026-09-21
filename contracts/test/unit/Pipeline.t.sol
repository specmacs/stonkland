// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StreamVault} from "../../src/StreamVault.sol";
import {FeeRouter} from "../../src/FeeRouter.sol";
import {AllocationController} from "../../src/AllocationController.sol";
import {RoyaltyRouter} from "../../src/RoyaltyRouter.sol";
import {UniswapV3Adapter} from "../../src/adapters/UniswapV3Adapter.sol";
import {OracleGuard} from "../../src/libraries/OracleGuard.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {
    MockWETH, MockAggregator, MockSwapRouter, RefusingTreasury, RevertingFeeEscrow, MockFeeEscrow
} from "../mocks/MockVenue.sol";

contract AllocationControllerTest is Test {
    function test_quartersAreTwentyFivePercentEachAndFrozen() public {
        uint16[] memory bps = new uint16[](4);
        for (uint256 i; i < 4; ++i) {
            bps[i] = 2_500;
        }
        AllocationController a = new AllocationController(bps);

        assertEq(a.quarterCount(), 4);
        for (uint8 q; q < 4; ++q) {
            assertEq(a.allocationBps(q), 2_500);
        }
        // There is no setter of any kind on this contract.
        (bool ok,) = address(a).call(abi.encodeWithSignature("setAllocation(uint8,uint16)", 0, 9999));
        assertFalse(ok);
    }

    function test_rejectsAnAllocationThatDoesNotSumToFull() public {
        uint16[] memory bps = new uint16[](4);
        bps[0] = 2_500;
        bps[1] = 2_500;
        bps[2] = 2_500;
        bps[3] = 2_400;
        vm.expectRevert(abi.encodeWithSelector(AllocationController.AllocationMustSumToFull.selector, 9_900));
        new AllocationController(bps);
    }

    function test_splitAlwaysAddsBackUpToTheWhole(uint96 total) public {
        uint16[] memory bps = new uint16[](4);
        for (uint256 i; i < 4; ++i) {
            bps[i] = 2_500;
        }
        AllocationController a = new AllocationController(bps);
        uint256[] memory parts = a.split(total);
        uint256 sum;
        for (uint256 i; i < parts.length; ++i) {
            sum += parts[i];
        }
        assertEq(sum, total, "no value is created or lost in the split");
    }
}

contract StreamVaultTest is Test {
    MockWETH internal weth;
    StreamVault internal vault;
    address internal revenueVault = makeAddr("revenueVault");
    address internal funder = makeAddr("funder");

    function setUp() public {
        weth = new MockWETH();
        vault = new StreamVault(address(weth), revenueVault);
        vm.deal(funder, 1_000 ether);
    }

    function _send(uint256 amount) internal {
        vm.startPrank(funder);
        weth.deposit{value: amount}();
        weth.transfer(address(vault), amount);
        vm.stopPrank();
    }

    function test_fundMeasuresWhatArrivedRatherThanTrustingACaller() public {
        _send(300 ether);
        uint256 funded = vault.fund();
        assertEq(funded, 300 ether, "measured from the balance, not named by the caller");
        assertEq(vault.periodFinish(), block.timestamp + 300);
    }

    function test_aStrangerCannotInflateTheRateAgainstFundsThatAreNotHere() public {
        _send(300 ether);
        vault.fund();
        // A second call with nothing new to pick up has nothing to do.
        vm.expectRevert(StreamVault.NothingToFund.selector);
        vault.fund();
    }

    function test_maturesLinearlyOverThreeHundredSeconds() public {
        _send(300 ether);
        vault.fund();

        assertEq(vault.releasable(), 0);
        vm.warp(block.timestamp + 150);
        assertApproxEqAbs(vault.releasable(), 150 ether, 1e6);
        vm.warp(block.timestamp + 150);
        assertApproxEqAbs(vault.releasable(), 300 ether, 1e6);
        vm.warp(block.timestamp + 10_000);
        assertApproxEqAbs(vault.releasable(), 300 ether, 1e6, "never more than was funded");
    }

    function test_releaseIsPermissionlessAndPushesToTheRevenueVault() public {
        _send(300 ether);
        vault.fund();
        vm.warp(block.timestamp + 300);

        vm.prank(makeAddr("anyone"));
        uint256 released = vault.release();
        assertApproxEqAbs(released, 300 ether, 1e6);
        assertEq(weth.balanceOf(revenueVault), released);
    }

    function test_refundingCarriesTheUnmaturedRemainderForward() public {
        _send(300 ether);
        vault.fund();
        vm.warp(block.timestamp + 150); // half matured

        _send(300 ether);
        vault.fund();

        // 150 banked, 150 carried plus 300 new streaming over a fresh window.
        assertApproxEqAbs(vault.releasable(), 150 ether, 1e6);
        vm.warp(block.timestamp + 300);
        assertApproxEqAbs(vault.releasable(), 600 ether, 1e6, "nothing was stranded");
    }

    function test_releaseNeverExceedsTheBalance() public {
        _send(300 ether);
        vault.fund();
        vm.warp(block.timestamp + 1_000);
        vault.release();
        assertLe(weth.balanceOf(revenueVault), 300 ether);
        assertEq(vault.release(), 0, "nothing left to push");
    }
}

contract FeeRouterTest is Test {
    MockWETH internal weth;
    StreamVault internal streamVault;
    FeeRouter internal router;
    RefusingTreasury internal treasury;
    address internal revenueVault = makeAddr("revenueVault");

    function setUp() public {
        weth = new MockWETH();
        streamVault = new StreamVault(address(weth), revenueVault);
        treasury = new RefusingTreasury();
        router = new FeeRouter(address(weth), address(treasury), address(streamVault), address(0));
    }

    function test_splitIsFixedAtOneThirdTwoThirds() public {
        assertEq(router.TREASURY_BPS(), 3_333);
        assertEq(router.REWARDS_BPS(), 6_667);
        assertEq(router.TREASURY_BPS() + router.REWARDS_BPS(), 10_000);

        // No setter exists for either leg or for the treasury address.
        (bool ok,) = address(router).call(abi.encodeWithSignature("setTreasuryBps(uint16)", 9_000));
        assertFalse(ok);
        (ok,) = address(router).call(abi.encodeWithSignature("setTreasury(address)", address(1)));
        assertFalse(ok);
    }

    function test_distributeIsPermissionlessAndSplitsOnFixedTerms() public {
        treasury.setAccepting(true);
        vm.deal(address(router), 10 ether);

        vm.prank(makeAddr("anyone"));
        (uint256 toRewards, uint256 toTreasury) = router.distribute();

        assertEq(toTreasury, (10 ether * 3_333) / 10_000);
        assertEq(toRewards, 10 ether - toTreasury);
        assertEq(weth.balanceOf(address(streamVault)), toRewards);
        assertEq(address(treasury).balance, toTreasury);
    }

    function test_aTreasuryThatRefusesPaymentCannotBlockTheRewardsLeg() public {
        treasury.setAccepting(false);
        vm.deal(address(router), 10 ether);

        (uint256 toRewards, uint256 toTreasury) = router.distribute();

        // The rewards leg went through in full.
        assertEq(weth.balanceOf(address(streamVault)), toRewards);
        assertGt(streamVault.unmatured(), 0);
        // The treasury's share is recorded as owed, not lost.
        assertEq(router.treasuryLiability(), toTreasury);
        assertEq(address(treasury).balance, 0);

        // And anyone can settle it once the treasury will take it.
        treasury.setAccepting(true);
        vm.prank(makeAddr("anyone"));
        uint256 paid = router.flushTreasury();
        assertEq(paid, toTreasury);
        assertEq(router.treasuryLiability(), 0);
        assertEq(address(treasury).balance, toTreasury);
    }

    function test_anOutstandingLiabilityIsNotRedistributed() public {
        treasury.setAccepting(false);
        vm.deal(address(router), 10 ether);
        router.distribute();
        uint256 owed = router.treasuryLiability();

        // A second sweep must split only the new money, never the treasury's held share.
        vm.deal(address(router), 10 ether);
        (uint256 toRewards2,) = router.distribute();
        assertEq(toRewards2, 10 ether - (10 ether * 3_333) / 10_000);
        assertEq(router.treasuryLiability(), owed * 2);
    }

    function test_aBrokenVenueDoesNotBlockDistributingWhatIsAlreadyHere() public {
        RevertingFeeEscrow escrow = new RevertingFeeEscrow();
        FeeRouter r =
            new FeeRouter(address(weth), address(treasury), address(streamVault), address(escrow));
        treasury.setAccepting(true);
        vm.deal(address(r), 10 ether);

        (uint256 toRewards,) = r.distribute();
        assertGt(toRewards, 0, "the failed claim was stepped over, not fatal");
    }

    /// @dev The venue credits this router and anyone pulls it through. This is the whole
    ///      reason the loop stays permissionless despite the venue naming one recipient.
    function test_anyoneCanPullTheVenuesFeesThroughTheRouter() public {
        MockFeeEscrow escrow = new MockFeeEscrow(weth);
        FeeRouter r =
            new FeeRouter(address(weth), address(treasury), address(streamVault), address(escrow));
        treasury.setAccepting(true);

        // The venue credits the router, exactly as a launch with the router named as its
        // fee recipient would.
        vm.deal(address(this), 10 ether);
        escrow.credit{value: 10 ether}(address(r));
        assertEq(escrow.balanceOf(address(r)), 10 ether);
        assertEq(r.distributable(), 0, "nothing has been pulled through yet");

        // A stranger triggers it, and the money lands where the split says.
        vm.prank(makeAddr("a passer-by"));
        (uint256 toRewards, uint256 toTreasury) = r.distribute();

        assertEq(toTreasury, (10 ether * 3_333) / 10_000);
        assertEq(toRewards, 10 ether - toTreasury);
        assertEq(weth.balanceOf(address(streamVault)), toRewards);
        assertEq(escrow.balanceOf(address(r)), 0, "the escrow was emptied");
    }

    function test_distributeWithNothingToDoIsANoOp() public {
        (uint256 a, uint256 b) = router.distribute();
        assertEq(a, 0);
        assertEq(b, 0);
    }
}

contract RoyaltyRouterTest is Test {
    MockWETH internal weth;
    RoyaltyRouter internal royalty;
    address internal revenueVault = makeAddr("revenueVault");

    function setUp() public {
        weth = new MockWETH();
        royalty = new RoyaltyRouter(address(weth), revenueVault);
    }

    function test_nativeRoyaltiesAreWrappedAndForwardedByAnyone() public {
        vm.deal(address(royalty), 3 ether);
        assertEq(royalty.pending(), 3 ether);

        vm.prank(makeAddr("anyone"));
        uint256 amount = royalty.forward();

        assertEq(amount, 3 ether);
        assertEq(weth.balanceOf(revenueVault), 3 ether);
    }

    function test_hasNoOwnerAndNoWithdrawal() public {
        (bool ok,) = address(royalty).call(abi.encodeWithSignature("owner()"));
        assertFalse(ok);
        (ok,) = address(royalty).call(abi.encodeWithSignature("withdraw(address,uint256)", address(1), 1));
        assertFalse(ok);
    }
}
