// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A card holder that an asset can be made to refuse paying.
/// @dev    Stands in for the real obstructions: a contract with no way to handle a token,
///         or a holder some asset has blocklisted. The push must route around it, and the
///         credit must survive so the ordinary claim still works once it clears.
contract RejectingHolder {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
