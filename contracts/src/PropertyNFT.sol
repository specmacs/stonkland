// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ProgressionLib} from "./libraries/ProgressionLib.sol";
import {IMetadataRenderer} from "./interfaces/IMetadataRenderer.sol";
import {ISettlementHook} from "./interfaces/ISettlementHook.sol";
import {Property} from "./interfaces/IPropertyNFT.sol";

/// @title PropertyNFT
/// @notice The card collection for one edition. Hard-capped, with per-quarter caps
///         enforced here rather than trusted to a caller.
///
/// @dev Token ids double as board plot ids. Quarter `q` owns the contiguous block
///      `[q * QUARTER_CAP + 1, (q + 1) * QUARTER_CAP]`, so a card's quarter and its cell
///      in that quarter's 10x10 grid both fall straight out of its id and never need a
///      lookup. Ids are handed out in order within a quarter.
///
///      The owner key can do exactly two things here: complete each one-time link once,
///      and swap the metadata renderer. A renderer receives a copy of a card's state and
///      returns a string. There is no path from a renderer back into quarter, level,
///      weight or burn history -- those are written only by `mint` and `advance`, which
///      are reachable only from the linked minter and progression manager.
contract PropertyNFT is ERC721, ERC721Enumerable, ERC2981, Ownable {
    using ProgressionLib for uint8;

    /// @notice Quarters in this edition.
    uint8 public constant QUARTER_COUNT = 4;

    /// @notice Cards per quarter. Four quarters of 100 laid out as a 10x10 grid each.
    uint16 public constant QUARTER_CAP = 100;

    /// @notice Cards in this edition, ever.
    uint16 public constant MAX_SUPPLY = QUARTER_COUNT * QUARTER_CAP;

    /// @notice Edition weight multiplier in basis points, applied when weight is written.
    /// @dev    The founding edition stores 1.25x. The distributor only ever sees the
    ///         final number, so this can never be reinterpreted at claim time.
    uint16 public immutable WEIGHT_MULTIPLIER_BPS;

    /// @notice Card resale royalty in basis points, routed into rewards.
    uint96 public constant ROYALTY_BPS = 500;

    // --- one-time links -------------------------------------------------------------

    address public minter;
    address public progressionManager;
    ISettlementHook public settlementHook;
    bool public royaltyLinked;

    // --- presentation ---------------------------------------------------------------

    IMetadataRenderer public renderer;
    string public fallbackBaseURI;

    // --- card state -----------------------------------------------------------------

    mapping(uint256 tokenId => Property) private _properties;
    mapping(uint8 quarter => uint16) private _mintedInQuarter;

    event Linked(string what, address target);
    event RendererUpdated(address indexed previous, address indexed current);
    event FallbackBaseURIUpdated(string uri);
    event Minted(uint256 indexed tokenId, address indexed to, uint8 indexed quarter, uint16 weight);
    event Advanced(
        uint256 indexed tokenId, uint8 indexed newLevel, uint16 newWeight, uint256 burnAmount
    );

    error AlreadyLinked();
    error NotMinter();
    error NotProgressionManager();
    error QuarterOutOfRange(uint8 quarter);
    error QuarterFull(uint8 quarter);
    error UnknownToken(uint256 tokenId);
    error ZeroAddress();
    error MultiplierOutOfRange();

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    modifier onlyProgressionManager() {
        if (msg.sender != progressionManager) revert NotProgressionManager();
        _;
    }

    constructor(string memory name_, string memory symbol_, uint16 weightMultiplierBps, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
    {
        // A multiplier below 1x would be a downgrade dressed as an edition, and the top of
        // the schedule times the multiplier has to stay inside the uint16 weight field.
        if (weightMultiplierBps < ProgressionLib.MULTIPLIER_DENOMINATOR) revert MultiplierOutOfRange();
        uint256 topWeight = (uint256(ProgressionLib.baseWeight(ProgressionLib.MAX_LEVEL))
            * weightMultiplierBps) / ProgressionLib.MULTIPLIER_DENOMINATOR;
        if (topWeight > type(uint16).max) revert MultiplierOutOfRange();
        WEIGHT_MULTIPLIER_BPS = weightMultiplierBps;
    }

    // --- links ----------------------------------------------------------------------

    function linkMinter(address minter_) external onlyOwner {
        if (minter != address(0)) revert AlreadyLinked();
        if (minter_ == address(0)) revert ZeroAddress();
        minter = minter_;
        emit Linked("minter", minter_);
    }

    function linkProgressionManager(address manager_) external onlyOwner {
        if (progressionManager != address(0)) revert AlreadyLinked();
        if (manager_ == address(0)) revert ZeroAddress();
        progressionManager = manager_;
        emit Linked("progressionManager", manager_);
    }

    function linkSettlementHook(address hook_) external onlyOwner {
        if (address(settlementHook) != address(0)) revert AlreadyLinked();
        if (hook_ == address(0)) revert ZeroAddress();
        settlementHook = ISettlementHook(hook_);
        emit Linked("settlementHook", hook_);
    }

    /// @notice Point the ERC-2981 royalty at the router that feeds rewards. Once only.
    function linkRoyaltyReceiver(address receiver) external onlyOwner {
        if (royaltyLinked) revert AlreadyLinked();
        if (receiver == address(0)) revert ZeroAddress();
        royaltyLinked = true;
        _setDefaultRoyalty(receiver, ROYALTY_BPS);
        emit Linked("royaltyReceiver", receiver);
    }

    // --- presentation -----------------------------------------------------------------

    /// @notice Swap the renderer. Presentation only; card state is unreachable from here.
    function setRenderer(address renderer_) external onlyOwner {
        address previous = address(renderer);
        renderer = IMetadataRenderer(renderer_);
        emit RendererUpdated(previous, renderer_);
    }

    function setFallbackBaseURI(string calldata uri) external onlyOwner {
        fallbackBaseURI = uri;
        emit FallbackBaseURIUpdated(uri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        IMetadataRenderer r = renderer;
        if (address(r) != address(0)) {
            return r.tokenURI(tokenId, _properties[tokenId]);
        }
        return bytes(fallbackBaseURI).length == 0
            ? ""
            : string.concat(fallbackBaseURI, Strings.toString(tokenId));
    }

    // --- reads ------------------------------------------------------------------------

    function propertyOf(uint256 tokenId) external view returns (Property memory) {
        _requireKnown(tokenId);
        return _properties[tokenId];
    }

    function quarterOf(uint256 tokenId) external view returns (uint8) {
        _requireKnown(tokenId);
        return _properties[tokenId].quarter;
    }

    function levelOf(uint256 tokenId) external view returns (uint8) {
        _requireKnown(tokenId);
        return _properties[tokenId].level;
    }

    function weightOf(uint256 tokenId) external view returns (uint16) {
        _requireKnown(tokenId);
        return _properties[tokenId].weight;
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function mintedInQuarter(uint8 quarter) external view returns (uint16) {
        return _mintedInQuarter[quarter];
    }

    function remainingInQuarter(uint8 quarter) external view returns (uint16) {
        if (quarter >= QUARTER_COUNT) revert QuarterOutOfRange(quarter);
        return QUARTER_CAP - _mintedInQuarter[quarter];
    }

    /// @notice Weight a card at `level` would carry in this edition.
    function scheduleWeight(uint8 level) external view returns (uint16) {
        return ProgressionLib.weightFor(level, WEIGHT_MULTIPLIER_BPS);
    }

    /// @notice Everything the next build on `tokenId` costs and produces.
    /// @dev    Callers supply a token id and nothing else, anywhere in the upgrade path.
    function nextUpgrade(uint256 tokenId)
        external
        view
        returns (uint8 nextLevel_, uint16 nextWeight, uint256 burnAmount)
    {
        _requireKnown(tokenId);
        nextLevel_ = ProgressionLib.nextLevel(_properties[tokenId].level);
        nextWeight = ProgressionLib.weightFor(nextLevel_, WEIGHT_MULTIPLIER_BPS);
        burnAmount = ProgressionLib.burnToReach(nextLevel_);
    }

    /// @notice First and last token id belonging to `quarter`, inclusive.
    function quarterBounds(uint8 quarter) external pure returns (uint256 firstId, uint256 lastId) {
        if (quarter >= QUARTER_COUNT) revert QuarterOutOfRange(quarter);
        firstId = uint256(quarter) * QUARTER_CAP + 1;
        lastId = uint256(quarter + 1) * QUARTER_CAP;
    }

    // --- writes -----------------------------------------------------------------------

    /// @notice Create the next card in `quarter`. Only the linked minter can reach this.
    /// @param  mintBurn tokens the minter destroyed to create this card, recorded as the
    ///         card's opening burn history.
    function mint(address to, uint8 quarter, uint256 mintBurn)
        external
        onlyMinter
        returns (uint256 tokenId)
    {
        if (quarter >= QUARTER_COUNT) revert QuarterOutOfRange(quarter);
        uint16 minted = _mintedInQuarter[quarter];
        if (minted >= QUARTER_CAP) revert QuarterFull(quarter);

        unchecked {
            tokenId = uint256(quarter) * QUARTER_CAP + minted + 1;
            _mintedInQuarter[quarter] = minted + 1;
        }

        uint16 weight = ProgressionLib.weightFor(ProgressionLib.START_LEVEL, WEIGHT_MULTIPLIER_BPS);

        // State is written before the token exists so the hook, which fires inside
        // `_update`, reads a fully-formed card rather than a half-initialised one.
        _properties[tokenId] =
            Property({quarter: quarter, level: ProgressionLib.START_LEVEL, weight: weight, burned: mintBurn});

        _safeMint(to, tokenId);
        emit Minted(tokenId, to, quarter, weight);
    }

    /// @notice Advance `tokenId` one level. Only the linked progression manager can reach
    ///         this, and it passes a token id and nothing else.
    /// @dev    The settlement hook is called here rather than by the manager so the
    ///         ordering is guaranteed by the contract that owns the state: the card is
    ///         settled at its old weight, and only then is the new weight written. No
    ///         caller can reorder that.
    function advance(uint256 tokenId)
        external
        onlyProgressionManager
        returns (uint8 newLevel, uint16 newWeight, uint256 burnAmount)
    {
        _requireKnown(tokenId);
        Property storage p = _properties[tokenId];
        uint16 oldWeight = p.weight;

        newLevel = ProgressionLib.nextLevel(p.level);
        newWeight = ProgressionLib.weightFor(newLevel, WEIGHT_MULTIPLIER_BPS);
        burnAmount = ProgressionLib.burnToReach(newLevel);

        ISettlementHook hook = settlementHook;
        if (address(hook) != address(0)) hook.onBeforeWeightChange(tokenId);

        p.level = newLevel;
        p.weight = newWeight;
        p.burned += burnAmount;

        if (address(hook) != address(0)) hook.onAfterWeightChange(tokenId, oldWeight, newWeight);

        emit Advanced(tokenId, newLevel, newWeight, burnAmount);
    }

    // --- internals --------------------------------------------------------------------

    function _requireKnown(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert UnknownToken(tokenId);
    }

    /// @dev Settlement is wired here, not in a transfer wrapper, so it cannot be bypassed
    ///      by any transfer entry point. The hook is arithmetic-only by contract, which is
    ///      what makes it safe to sit in the path of a transfer that nobody can pause.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);
        ISettlementHook hook = settlementHook;

        if (address(hook) != address(0) && from != address(0)) {
            hook.onBeforeTransfer(tokenId, from, to);
        }

        address previous = super._update(to, tokenId, auth);

        if (address(hook) != address(0) && from == address(0)) {
            hook.onMint(tokenId, to);
        }
        return previous;
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
