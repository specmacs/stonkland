// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The seam between the card collection and reward accounting.
/// @dev    Implementations must be arithmetic-only: no external token movement, no
///         unbounded loops, nothing that can revert under adversarial conditions. A hook
///         that can revert is a hook that can brick card transfers, and card transfers
///         are explicitly not pausable by anyone.
interface ISettlementHook {
    /// @notice Called after a card is created, once its state is readable.
    function onMint(uint256 tokenId, address to) external;

    /// @notice Called before ownership moves, while `from` is still the owner of record.
    function onBeforeTransfer(uint256 tokenId, address from, address to) external;

    /// @notice Called before a card's weight changes, while the old weight still stands.
    function onBeforeWeightChange(uint256 tokenId) external;

    /// @notice Called after a card's weight changes, with the delta to apply to totals.
    function onAfterWeightChange(uint256 tokenId, uint16 oldWeight, uint16 newWeight) external;
}
