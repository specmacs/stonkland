// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWETH9} from "./interfaces/IWETH9.sol";

/// @title StreamVault
/// @notice Spreads each fee sweep over a short window instead of letting it land in one
///         moment.
///
/// @dev Without this, a large sweep would be captured entirely by whoever happened to
///      hold the most weight in the block it arrived -- which rewards watching the
///      mempool rather than holding a card. A 300-second stream makes that race not worth
///      running.
///
///      Funding restarts the window and carries any unmatured remainder into it, so fees
///      are never stranded. Releasing is open to anyone; there is no operator here whose
///      absence could stop rewards moving.
contract StreamVault {
    using SafeERC20 for IWETH9;

    /// @notice Length of a stream, in seconds.
    uint256 public constant EPOCH = 300;

    uint256 private constant RATE_SCALE = 1e18;

    IWETH9 public immutable weth;

    /// @notice Where matured funds go. Immutable.
    address public immutable revenueVault;

    uint256 public ratePerSecond; // scaled by RATE_SCALE
    uint256 public periodFinish;
    uint256 public lastAccrual;
    uint256 public matured; // accrued, waiting to be pushed on

    event Funded(uint256 amount, uint256 carriedOver, uint256 ratePerSecond, uint256 periodFinish);
    event Released(address indexed caller, uint256 amount);

    error ZeroAddress();
    error NothingToFund();

    constructor(address weth_, address revenueVault_) {
        if (weth_ == address(0) || revenueVault_ == address(0)) revert ZeroAddress();
        weth = IWETH9(weth_);
        revenueVault = revenueVault_;
        lastAccrual = block.timestamp;
        periodFinish = block.timestamp;
    }

    /// @notice Everything matured up to now, including what is already banked.
    function releasable() public view returns (uint256) {
        return matured + _accruedSinceLastUpdate();
    }

    /// @notice Funds still inside the current window.
    function unmatured() public view returns (uint256) {
        if (block.timestamp >= periodFinish) return 0;
        return ((periodFinish - block.timestamp) * ratePerSecond) / RATE_SCALE;
    }

    /// @notice WETH sitting here that no stream has claimed yet.
    function unaccounted() public view returns (uint256) {
        uint256 balance = weth.balanceOf(address(this));
        uint256 accounted = matured + unmatured();
        return balance > accounted ? balance - accounted : 0;
    }

    /// @notice Start a new window over everything that has arrived since the last one,
    ///         carrying any unmatured remainder into it.
    /// @dev    Takes no amount. The figure is measured from this contract's own balance,
    ///         so a caller cannot name a number larger than what actually turned up and
    ///         inflate the rate against funds that are not here.
    function fund() external returns (uint256 amount) {
        _accrue();

        amount = unaccounted();
        if (amount == 0) revert NothingToFund();

        uint256 carried = unmatured();
        uint256 total = amount + carried;

        ratePerSecond = (total * RATE_SCALE) / EPOCH;
        lastAccrual = block.timestamp;
        periodFinish = block.timestamp + EPOCH;

        emit Funded(amount, carried, ratePerSecond, periodFinish);
    }

    /// @notice Push everything matured on to the revenue vault. Open to anyone.
    function release() external returns (uint256 amount) {
        _accrue();
        amount = matured;
        if (amount == 0) return 0;

        // Rate arithmetic truncates in the protocol's favour, but a clamp on the way out
        // means a rounding overshoot can never try to send funds that are not here.
        uint256 balance = weth.balanceOf(address(this));
        if (amount > balance) amount = balance;

        matured -= amount;
        weth.safeTransfer(revenueVault, amount);
        emit Released(msg.sender, amount);
    }

    function _accrue() private {
        uint256 accrued = _accruedSinceLastUpdate();
        if (accrued != 0) matured += accrued;
        lastAccrual = block.timestamp;
    }

    function _accruedSinceLastUpdate() private view returns (uint256) {
        uint256 end = block.timestamp < periodFinish ? block.timestamp : periodFinish;
        if (end <= lastAccrual) return 0;
        return ((end - lastAccrual) * ratePerSecond) / RATE_SCALE;
    }
}
