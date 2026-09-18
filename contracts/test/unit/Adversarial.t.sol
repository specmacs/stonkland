// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixtures, IMintableERC20} from "../Fixtures.sol";
import {Distributor} from "../../src/Distributor.sol";
import {
    MockFeeOnTransferERC20, MockBlocklistERC20, MockShortfallERC20
} from "../mocks/MockERC20.sol";
import {MockReentrantERC20} from "../mocks/MockReentrantClaimer.sol";

/// @notice A reward asset that takes a cut on every transfer. The books must follow the
///         tokens that arrived, not the number that was asked for.
contract FeeOnTransferRewardTest is Fixtures {
    function _deployRewardAsset(uint8) internal override returns (address) {
        return address(new MockFeeOnTransferERC20(1_000)); // 10%
    }

    function test_depositIsAccountedOnTheMeasuredDelta() public {
        uint256 id = mintCard(alice, 0);
        uint256 received = depositReward(0, 100e18);

        assertEq(received, 90e18, "the asset took its cut on the way in");
        assertEq(poolDeposited(0), 90e18, "books follow what arrived");
        assertEq(pending(0, id), 90e18);
    }

    function test_claimIsAccountedOnTheMeasuredDelta() public {
        mintCard(alice, 0);
        depositReward(0, 100e18); // 90e18 lands

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);

        // 10% is taken again on the way out. Alice holds 81; the pool records 90 claimed,
        // which is what actually left the distributor.
        assertEq(rewardBalance(0, alice), 81e18);
        assertEq(poolClaimed(0), 90e18);
        assertLe(poolClaimed(0), poolDeposited(0), "solvency survives a fee-on-transfer asset");
    }
}

/// @notice An asset that quietly delivers less than it was asked for and still returns true.
contract ShortfallRewardTest is Fixtures {
    function _deployRewardAsset(uint8) internal override returns (address) {
        return address(new MockShortfallERC20(2_500)); // delivers 75%
    }

    function test_theShortfallStaysOwedRatherThanVanishing() public {
        mintCard(alice, 0);
        depositReward(0, 100e18);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);

        assertEq(rewardBalance(0, alice), 75e18);
        assertEq(poolClaimed(0), 75e18, "only what actually left is recorded as claimed");
        assertEq(credited(0, alice), 25e18, "the undelivered quarter is still owed");
        assertLe(poolClaimed(0), poolDeposited(0));
    }
}

/// @notice An issuer that can freeze a holder -- the case an equity-linked reward asset
///         actually presents.
contract BlocklistRewardTest is Fixtures {
    function _deployRewardAsset(uint8) internal override returns (address) {
        return address(new MockBlocklistERC20());
    }

    function test_aFrozenHolderKeepsTheCreditAndTheClaimRevertsCleanly() public {
        mintCard(alice, 0);
        depositReward(0, 100e18);

        MockBlocklistERC20(rewardAsset[0]).setBlocked(alice, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MockBlocklistERC20.Blocked.selector, alice));
        distributor.claimQuarter(EDITION, 0, 0, 0);

        // The revert took the whole call with it, so nothing was consumed.
        assertEq(rewardBalance(0, alice), 0);
        assertEq(poolClaimed(0), 0);
        assertEq(credited(0, alice), 0, "settlement rolled back too");
        assertEq(pending(0, alice == address(0) ? 0 : 1), 100e18, "still accrued on the card");

        // And it pays out in full once the freeze lifts.
        MockBlocklistERC20(rewardAsset[0]).setBlocked(alice, false);
        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        assertEq(rewardBalance(0, alice), 100e18);
    }

    function test_aFrozenDistributorCannotBeDepositedInto() public {
        mintCard(alice, 0);
        MockBlocklistERC20(rewardAsset[0]).setBlocked(address(distributor), true);

        // Fails closed: the deposit reverts rather than crediting tokens that never arrived.
        IMintableERC20(rewardAsset[0]).mint(revenueVault, 100e18);
        vm.startPrank(revenueVault);
        IMintableERC20(rewardAsset[0]).approve(address(distributor), 100e18);
        vm.expectRevert();
        distributor.deposit(EDITION, rewardAsset[0], 0, 100e18);
        vm.stopPrank();
        assertEq(poolDeposited(0), 0);
    }
}

/// @notice A reward asset that calls back into the distributor mid-transfer.
contract ReentrancyTest is Fixtures {
    function _deployRewardAsset(uint8) internal override returns (address) {
        return address(new MockReentrantERC20());
    }

    function test_reentrantClaimIsRejectedAndPaysNothingTwice() public {
        mintCard(alice, 0);
        depositReward(0, 100e18);

        MockReentrantERC20 asset = MockReentrantERC20(rewardAsset[0]);
        asset.arm(address(distributor), EDITION, 0);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);

        assertTrue(asset.reenterAttempted(), "the callback did fire");
        assertFalse(asset.reenterSucceeded(), "and it was rejected");
        assertEq(rewardBalance(0, alice), 100e18, "paid exactly once");
        assertEq(poolClaimed(0), 100e18);
        assertLe(poolClaimed(0), poolDeposited(0));
    }

    function test_ledgerIsZeroedBeforeTheTransfer() public {
        mintCard(alice, 0);
        depositReward(0, 100e18);
        MockReentrantERC20 asset = MockReentrantERC20(rewardAsset[0]);
        asset.arm(address(distributor), EDITION, 0);

        vm.prank(alice);
        distributor.claimQuarter(EDITION, 0, 0, 0);
        assertEq(credited(0, alice), 0);
    }
}
