// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A pull-based fee escrow: it credits balances and lets each recipient come and
///         take theirs, rather than pushing payments out.
///
/// @dev This is the shape the launch venue actually uses, and it is a good shape. A push
///      model has to succeed for every recipient at once, so one recipient that cannot
///      accept a transfer stops everybody's. A pull model has no such failure.
///
///      Both claims pay `msg.sender`. That is what makes the whole reward loop
///      permissionless despite the venue having a named recipient: the fee router is
///      registered as that recipient, anyone may call the router, and the router is what
///      calls this. No operator sits between a trade and a holder's reward.
interface IFeeEscrow {
    /// @notice Send the caller's credited native balance to the caller.
    function claim() external;

    /// @notice Send the caller's credited balance of `token` to the caller.
    function claimToken(address token) external;

    /// @notice Native balance credited to `account`.
    function balanceOf(address account) external view returns (uint256);
}
