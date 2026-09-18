// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IWETH9} from "./interfaces/IWETH9.sol";
import {IFeeSource} from "./interfaces/IFeeSource.sol";
import {StreamVault} from "./StreamVault.sol";

/// @title FeeRouter
/// @notice Where trading fees enter the protocol and get split.
///
/// @dev The split is a pair of constants. There is no setter, no owner and no role that
///      can change where the money goes, which is the point: a fee split that an operator
///      can move is not a split, it is a promise.
///
///      Ordering inside `distribute` is deliberate. The rewards leg is funded first and
///      the treasury leg second, because the treasury is an address this protocol does
///      not control and a treasury that refuses payment must not be able to hold holders'
///      rewards hostage. A refused payment becomes a recorded liability that anyone can
///      retry later.
contract FeeRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Treasury share, in basis points.
    uint16 public constant TREASURY_BPS = 3_333;

    /// @notice Rewards share, in basis points.
    uint16 public constant REWARDS_BPS = 6_667;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    IWETH9 public immutable weth;
    address public immutable treasury;
    StreamVault public immutable streamVault;

    /// @notice A venue-specific fee claim, if the venue needs one. May be unset.
    IFeeSource public immutable feeSource;

    /// @notice Treasury money that has been split off but not yet delivered.
    uint256 public treasuryLiability;

    event Distributed(uint256 total, uint256 toRewards, uint256 toTreasury);
    event TreasuryPaid(uint256 amount);
    event TreasuryPaymentDeferred(uint256 amount, uint256 outstanding);
    event FeeClaimFailed();

    error ZeroAddress();
    error BadSplit();

    constructor(address weth_, address treasury_, address streamVault_, address feeSource_) {
        if (weth_ == address(0) || treasury_ == address(0) || streamVault_ == address(0)) {
            revert ZeroAddress();
        }
        if (TREASURY_BPS + REWARDS_BPS != BPS_DENOMINATOR) revert BadSplit();
        weth = IWETH9(weth_);
        treasury = treasury_;
        streamVault = StreamVault(streamVault_);
        feeSource = IFeeSource(feeSource_); // may legitimately be the zero address
    }

    /// @notice Accept native fees from a venue that pays in ETH.
    receive() external payable {}

    /// @notice What `distribute` would work with right now.
    function distributable() public view returns (uint256) {
        uint256 held = weth.balanceOf(address(this)) + address(this).balance;
        return held > treasuryLiability ? held - treasuryLiability : 0;
    }

    /// @notice Claim whatever has accrued, split it, and move both legs. Open to anyone:
    ///         no operator stands between a trade and a holder's reward.
    function distribute() external nonReentrant returns (uint256 toRewards, uint256 toTreasury) {
        // A venue that cannot be swept right now must not block distributing what is
        // already here, so a failed claim is noted and stepped over.
        if (address(feeSource) != address(0)) {
            try feeSource.claimFees() {}
            catch {
                emit FeeClaimFailed();
            }
        }

        uint256 native = address(this).balance;
        if (native != 0) weth.deposit{value: native}();

        uint256 available = distributable();
        if (available == 0) return (0, 0);

        toTreasury = (available * TREASURY_BPS) / BPS_DENOMINATOR;
        toRewards = available - toTreasury;

        // Rewards first, unconditionally. The vault measures what arrived rather than
        // taking our word for it, so the transfer has to land before the call.
        if (toRewards != 0) {
            IERC20(address(weth)).safeTransfer(address(streamVault), toRewards);
            streamVault.fund();
        }

        if (toTreasury != 0) {
            treasuryLiability += toTreasury;
            _tryPayTreasury();
        }

        emit Distributed(available, toRewards, toTreasury);
    }

    /// @notice Retry a treasury payment that was refused earlier. Open to anyone.
    function flushTreasury() external nonReentrant returns (uint256 paid) {
        return _tryPayTreasury();
    }

    /// @dev Soft-fails. The treasury is paid in native value, which is the one leg of
    ///      this pipeline that can be refused by its recipient. A refusal leaves the
    ///      liability on the books, re-wraps the funds, and is invisible to every other
    ///      part of the protocol -- the rewards leg has already gone by this point.
    function _tryPayTreasury() private returns (uint256 paid) {
        uint256 owed = treasuryLiability;
        if (owed == 0) return 0;

        uint256 balance = weth.balanceOf(address(this));
        if (balance < owed) owed = balance;
        if (owed == 0) return 0;

        weth.withdraw(owed);
        (bool ok,) = treasury.call{value: owed}("");

        if (!ok) {
            // Put it back the way it was and leave it owed.
            weth.deposit{value: owed}();
            emit TreasuryPaymentDeferred(owed, treasuryLiability);
            return 0;
        }

        treasuryLiability -= owed;
        emit TreasuryPaid(owed);
        return owed;
    }
}
