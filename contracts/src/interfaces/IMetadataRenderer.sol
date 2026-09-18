// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Property} from "./IPropertyNFT.sol";

/// @notice Presentation only. A renderer is handed a copy of the card's state and can
///         return any string it likes; it has no way to write back.
interface IMetadataRenderer {
    function tokenURI(uint256 tokenId, Property calldata data) external view returns (string memory);
}
