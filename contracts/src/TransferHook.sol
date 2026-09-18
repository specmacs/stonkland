// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISettlementHook} from "./interfaces/ISettlementHook.sol";
import {IDistributor} from "./interfaces/IDistributor.sol";
import {IPropertyNFT, Property} from "./interfaces/IPropertyNFT.sol";

/// @title TransferHook
/// @notice Carries card events from one edition's collection into reward accounting.
///
/// @dev This contract has no owner, no storage and no token handling. Everything it does
///      reduces to reading a card's state and forwarding arithmetic to the distributor.
///      That matters: it sits in the path of every card transfer, and card transfers are
///      not pausable by anyone. A hook that could fail would be a hook that could freeze
///      the collection.
contract TransferHook is ISettlementHook {
    IPropertyNFT public immutable nft;
    IDistributor public immutable distributor;

    /// @notice Which edition this hook speaks for.
    uint256 public immutable edition;

    error NotCollection();
    error ZeroAddress();

    modifier onlyCollection() {
        if (msg.sender != address(nft)) revert NotCollection();
        _;
    }

    constructor(address nft_, address distributor_, uint256 edition_) {
        if (nft_ == address(0) || distributor_ == address(0)) revert ZeroAddress();
        nft = IPropertyNFT(nft_);
        distributor = IDistributor(distributor_);
        edition = edition_;
    }

    /// @inheritdoc ISettlementHook
    function onMint(uint256 tokenId, address) external onlyCollection {
        Property memory p = nft.propertyOf(tokenId);
        distributor.onMint(edition, tokenId, p.quarter, p.weight);
    }

    /// @inheritdoc ISettlementHook
    /// @dev Credits the seller. Whatever the card accrued up to this moment belongs to
    ///      whoever owned it while it accrued, and the buyer starts from here.
    function onBeforeTransfer(uint256 tokenId, address from, address) external onlyCollection {
        Property memory p = nft.propertyOf(tokenId);
        distributor.settleToken(edition, tokenId, p.quarter, p.weight, from);
    }

    /// @inheritdoc ISettlementHook
    /// @dev Called while the old weight is still in storage. Without this the new, higher
    ///      weight would apply to deposits that landed before the upgrade was paid for.
    function onBeforeWeightChange(uint256 tokenId) external onlyCollection {
        Property memory p = nft.propertyOf(tokenId);
        distributor.settleToken(edition, tokenId, p.quarter, p.weight, nft.ownerOf(tokenId));
    }

    /// @inheritdoc ISettlementHook
    function onAfterWeightChange(uint256 tokenId, uint16 oldWeight, uint16 newWeight)
        external
        onlyCollection
    {
        distributor.onWeightChange(edition, nft.quarterOf(tokenId), oldWeight, newWeight);
    }
}
