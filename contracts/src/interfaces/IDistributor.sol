// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDistributor {
    function onMint(uint256 edition, uint256 tokenId, uint8 quarter, uint16 weight) external;
    function settleToken(uint256 edition, uint256 tokenId, uint8 quarter, uint16 weight, address owner)
        external;
    function onWeightChange(uint256 edition, uint8 quarter, uint16 oldWeight, uint16 newWeight) external;
    function deposit(uint256 edition, address asset, uint8 quarter, uint256 amount)
        external
        returns (uint256 received);
    function editionWeight(uint256 edition) external view returns (uint256);
    function protocolWeight() external view returns (uint256);
    function quarterWeight(uint256 edition, uint8 quarter) external view returns (uint256);
}
