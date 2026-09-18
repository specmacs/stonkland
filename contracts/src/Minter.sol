// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IBurnableERC20} from "./interfaces/IBurnableERC20.sol";
import {IPropertyNFT} from "./interfaces/IPropertyNFT.sol";

/// @title Minter
/// @notice The only route to a primary card. Destroys tokens and asks the collection for
///         the next plot in the chosen quarter.
///
/// @dev The per-wallet limit is an allowance on primary mints, not a cap on ownership.
///      Nothing here or anywhere else restricts how many cards a wallet can buy from
///      other holders, and the interface has to say so or the number reads as a
///      holding limit.
///
///      There is no owner mint, no admin mint and no reserve. Any team allocation has to
///      come out of the same supply everyone else mints from, through this contract.
///
///      The contract is deployed paused. Unpausing is the launch, which keeps the admin
///      surface at exactly one verb.
contract Minter is Ownable, Pausable, ReentrancyGuard {
    /// @notice Tokens destroyed per card.
    uint256 public constant MINT_BURN = 100_000e18;

    /// @notice Primary mints allowed per wallet.
    uint8 public constant MINTS_PER_WALLET = 3;

    IBurnableERC20 public immutable token;
    IPropertyNFT public immutable nft;

    mapping(address wallet => uint8) public mintsUsed;

    event CardMinted(address indexed to, uint256 indexed tokenId, uint8 indexed quarter, uint256 burned);

    error ZeroAddress();
    error WalletLimitReached(uint8 used, uint8 allowed);
    error InvalidQuantity();

    constructor(address token_, address nft_, address owner_) Ownable(owner_) {
        if (token_ == address(0) || nft_ == address(0)) revert ZeroAddress();
        token = IBurnableERC20(token_);
        nft = IPropertyNFT(nft_);
        _pause();
    }

    /// @notice True when a card can actually be minted right now. The interface disables
    ///         its controls unless this read succeeds and returns true.
    function mintOpen() external view returns (bool) {
        return !paused();
    }

    function remainingMints(address wallet) external view returns (uint8) {
        uint8 used = mintsUsed[wallet];
        return used >= MINTS_PER_WALLET ? 0 : MINTS_PER_WALLET - used;
    }

    /// @notice Burn `MINT_BURN` tokens and take the next plot in `quarter`.
    function mint(uint8 quarter) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        return _mintOne(quarter);
    }

    /// @notice Mint `quantity` cards in one transaction, within the wallet allowance.
    function mintBatch(uint8 quarter, uint8 quantity)
        external
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds)
    {
        if (quantity == 0 || quantity > MINTS_PER_WALLET) revert InvalidQuantity();
        tokenIds = new uint256[](quantity);
        for (uint8 i; i < quantity; ++i) {
            tokenIds[i] = _mintOne(quarter);
        }
    }

    /// @notice Mint using an EIP-2612 signature instead of a separate approval.
    function mintWithPermit(uint8 quarter, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        // A front-run that consumes the signature must not strand the mint, so a failed
        // permit is tolerated when the allowance is already in place.
        try token.permit(msg.sender, address(this), MINT_BURN, deadline, v, r, s) {} catch {}
        return _mintOne(quarter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _mintOne(uint8 quarter) private returns (uint256 tokenId) {
        uint8 used = mintsUsed[msg.sender];
        if (used >= MINTS_PER_WALLET) revert WalletLimitReached(used, MINTS_PER_WALLET);
        unchecked {
            mintsUsed[msg.sender] = used + 1;
        }

        // Burned first. The quarter cap is enforced inside the collection, so an
        // over-subscribed quarter reverts the whole call and the tokens survive.
        token.burnFrom(msg.sender, MINT_BURN);

        tokenId = nft.mint(msg.sender, quarter, MINT_BURN);
        emit CardMinted(msg.sender, tokenId, quarter, MINT_BURN);
    }
}
