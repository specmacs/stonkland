// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The seam around the riskiest thing this protocol does: trading.
/// @dev    Isolated so a route can be replaced without touching a line of accounting. An
///         adapter can change how an asset is bought. It can never change which asset
///         holders receive -- that is fixed in the edition registry, and the vault checks
///         an adapter against it before wiring one in.
interface IAcquisitionAdapter {
    /// @notice The asset this adapter acquires. Immutable.
    function asset() external view returns (address);

    /// @notice The input asset this adapter spends. Immutable.
    function inputToken() external view returns (address);

    /// @notice Oracle-implied output for `amountIn`, ignoring venue liquidity.
    function expectedOut(uint256 amountIn) external view returns (uint256);

    /// @notice The floor this adapter will refuse to trade below, oracle-derived.
    function floorOut(uint256 amountIn) external view returns (uint256);

    /// @notice Spend exactly `amountIn`, already transferred in, and send the proceeds to
    ///         `recipient`. Reverts on anything unexpected.
    function convert(uint256 amountIn, uint256 minOut, uint256 deadline, address recipient)
        external
        returns (uint256 received);
}
