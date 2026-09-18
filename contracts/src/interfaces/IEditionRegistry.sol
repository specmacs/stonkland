// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice What the protocol knows about one edition. Every field is written once, at
///         registration, and has no setter afterwards.
struct EditionInfo {
    address nft; // the edition's card collection
    address hook; // the only address allowed to settle that edition's cards
    uint16 weightMultiplierBps; // baked into stored weight, never reapplied at claim time
    uint8 quarterCount;
    bool registered;
}

interface IEditionRegistry {
    function editionCount() external view returns (uint256);
    function editionIdAt(uint256 index) external view returns (uint256);
    function editionIds() external view returns (uint256[] memory);
    function infoOf(uint256 edition) external view returns (EditionInfo memory);
    function nftOf(uint256 edition) external view returns (address);
    function hookOf(uint256 edition) external view returns (address);
    function quarterCountOf(uint256 edition) external view returns (uint8);
    function isRegistered(uint256 edition) external view returns (bool);

    /// @notice Reward assets that serve `quarter` of `edition`. Fixed at registration.
    function quarterAssets(uint256 edition, uint8 quarter) external view returns (address[] memory);
    function quarterAssetCount(uint256 edition, uint8 quarter) external view returns (uint256);

    /// @notice Live total weight of an edition, read from the distributor.
    function totalWeightOf(uint256 edition) external view returns (uint256);
}
