// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Per-card state. Every field except `burned` is fixed or monotonic.
struct Property {
    uint8 quarter; // assigned at mint, permanent
    uint8 level; // 1-5, monotonically increasing
    uint16 weight; // derived from level and the edition multiplier, stored for O(1) reads
    uint256 burned; // lifetime tokens destroyed by this card, mint included
}

interface IPropertyNFT {
    function propertyOf(uint256 tokenId) external view returns (Property memory);
    function quarterOf(uint256 tokenId) external view returns (uint8);
    function weightOf(uint256 tokenId) external view returns (uint16);
    function levelOf(uint256 tokenId) external view returns (uint8);
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function exists(uint256 tokenId) external view returns (bool);

    function QUARTER_COUNT() external view returns (uint8);
    function QUARTER_CAP() external view returns (uint16);
    function MAX_SUPPLY() external view returns (uint16);
    function WEIGHT_MULTIPLIER_BPS() external view returns (uint16);
    function mintedInQuarter(uint8 quarter) external view returns (uint16);

    /// @notice Cost and result of the next build on `tokenId`, derived entirely on-chain.
    function nextUpgrade(uint256 tokenId)
        external
        view
        returns (uint8 nextLevel, uint16 nextWeight, uint256 burnAmount);

    function mint(address to, uint8 quarter, uint256 mintBurn) external returns (uint256 tokenId);
    function advance(uint256 tokenId)
        external
        returns (uint8 newLevel, uint16 newWeight, uint256 burnAmount);
}
