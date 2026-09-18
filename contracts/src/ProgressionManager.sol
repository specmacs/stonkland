// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IBurnableERC20} from "./interfaces/IBurnableERC20.sol";
import {IPropertyNFT} from "./interfaces/IPropertyNFT.sol";
import {Distributor} from "./Distributor.sol";

/// @title ProgressionManager
/// @notice Builds a card up one level. Takes a token id and nothing else.
///
/// @dev No caller anywhere in this path supplies a level, a weight, a burn amount or a
///      price. All four are derived on-chain from the card's current state, so there is
///      no economic parameter for a caller to lie about.
///
///      Ordering is the thing to get right here. The card is settled at its old weight
///      before a single token is burned, and the collection settles it again inside
///      `advance` immediately before the new weight is written. An upgrade in the same
///      block as a deposit therefore accrues against that deposit at the old weight, and
///      the higher weight applies only to what arrives afterwards.
contract ProgressionManager is Ownable, Pausable, ReentrancyGuard {
    IBurnableERC20 public immutable token;
    IPropertyNFT public immutable nft;
    Distributor public immutable distributor;
    uint256 public immutable edition;

    event Built(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 indexed newLevel,
        uint16 newWeight,
        uint256 burned
    );

    error ZeroAddress();
    error NotCardOwner(uint256 tokenId, address caller);

    constructor(address token_, address nft_, address distributor_, uint256 edition_, address owner_)
        Ownable(owner_)
    {
        if (token_ == address(0) || nft_ == address(0) || distributor_ == address(0)) revert ZeroAddress();
        token = IBurnableERC20(token_);
        nft = IPropertyNFT(nft_);
        distributor = Distributor(distributor_);
        edition = edition_;
    }

    /// @notice Cost and result of the next build on `tokenId`.
    function quote(uint256 tokenId)
        external
        view
        returns (uint8 nextLevel, uint16 nextWeight, uint256 burnAmount)
    {
        return nft.nextUpgrade(tokenId);
    }

    /// @notice Build `tokenId` up one level, destroying the required tokens permanently.
    function build(uint256 tokenId) external whenNotPaused nonReentrant {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotCardOwner(tokenId, msg.sender);

        (, , uint256 burnAmount) = nft.nextUpgrade(tokenId);

        // Checkpoint before the burn, so nothing about this transaction can reach
        // backwards into deposits that have already landed.
        uint256[] memory one = new uint256[](1);
        one[0] = tokenId;
        distributor.settleTokens(edition, one);

        token.burnFrom(msg.sender, burnAmount);

        (uint8 newLevel, uint16 newWeight, ) = nft.advance(tokenId);
        emit Built(tokenId, msg.sender, newLevel, newWeight, burnAmount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
