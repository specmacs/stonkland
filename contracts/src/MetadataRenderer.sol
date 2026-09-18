// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IMetadataRenderer} from "./interfaces/IMetadataRenderer.sol";
import {Property} from "./interfaces/IPropertyNFT.sol";
import {ProgressionLib} from "./libraries/ProgressionLib.sol";

/// @title MetadataRenderer
/// @notice Turns a card's state into metadata. Presentation, and nothing else.
/// @dev    Receives a copy of the card's state and returns a string. It holds no card
///         state, is handed no authority, and has no path back into the collection --
///         swapping it changes how a card looks and nothing about what it is worth.
contract MetadataRenderer is IMetadataRenderer, Ownable {
    using Strings for uint256;

    string public collectionName;
    string public imageBaseURI;
    string public externalBaseURI;

    event BaseURIsUpdated(string image, string external_);

    constructor(string memory collectionName_, string memory imageBaseURI_, string memory externalBaseURI_, address owner_)
        Ownable(owner_)
    {
        collectionName = collectionName_;
        imageBaseURI = imageBaseURI_;
        externalBaseURI = externalBaseURI_;
    }

    function setBaseURIs(string calldata image, string calldata external_) external onlyOwner {
        imageBaseURI = image;
        externalBaseURI = external_;
        emit BaseURIsUpdated(image, external_);
    }

    /// @inheritdoc IMetadataRenderer
    function tokenURI(uint256 tokenId, Property calldata data) external view returns (string memory) {
        string memory form = ProgressionLib.formName(data.level);
        // Quarters are zero-indexed on-chain and one-indexed everywhere a person reads them.
        string memory quarter = (uint256(data.quarter) + 1).toString();

        string memory json = string.concat(
            '{"name":"',
            collectionName,
            " #",
            tokenId.toString(),
            '","description":"A property card. Its Yield Weight sets its relative share of rewards actually deposited into its quarter. No fixed rate, no projected return, and no guarantee that any rewards will be deposited.","image":"',
            imageBaseURI,
            uint256(data.level).toString(),
            '.png","external_url":"',
            externalBaseURI,
            tokenId.toString(),
            '","attributes":[',
            _attributes(data, form, quarter),
            "]}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _attributes(Property calldata data, string memory form, string memory quarter)
        private
        pure
        returns (string memory)
    {
        return string.concat(
            '{"trait_type":"Quarter","value":"Quarter ',
            quarter,
            '"},{"trait_type":"Form","value":"',
            form,
            '"},{"trait_type":"Level","value":',
            uint256(data.level).toString(),
            ',"max_value":5},{"trait_type":"Yield Weight","value":',
            uint256(data.weight).toString(),
            '},{"trait_type":"Lifetime Burn","value":',
            (data.burned / 1e18).toString(),
            "}"
        );
    }
}
