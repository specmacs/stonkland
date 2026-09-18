// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A trading venue that accrues fees to a recipient and hands them over on demand.
/// @dev    Deliberately minimal, because the venue is not settled yet. Whatever it turns
///         out to be, the one thing that matters is that `claimFees` is callable by
///         anyone: a venue that lets only an operator sweep makes that operator's cadence
///         the liveness ceiling for every holder's rewards.
interface IFeeSource {
    function claimFees() external;
}
