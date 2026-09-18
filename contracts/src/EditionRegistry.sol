// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EditionInfo, IEditionRegistry} from "./interfaces/IEditionRegistry.sol";
import {IDistributor} from "./interfaces/IDistributor.sol";

/// @title EditionRegistry
/// @notice The list of editions sharing one revenue pot.
///
/// @dev Registering an edition is the single discretionary power in this protocol, and it
///      is held by one externally owned account with no timelock. Every new edition adds
///      weight to the shared pot, which lowers every existing card's share of future fees.
///      That is not a side effect, it is the mechanism, and it is disclosed in the
///      rulebook before anyone buys rather than announced afterwards.
///
///      What registration cannot do: touch an already-registered edition. There is no
///      setter for an edition's nft, hook, multiplier, quarter count or asset set. An
///      edition's assets are fixed the moment it is registered; adding an asset requires
///      registering a new edition, which is visible on-chain to everyone.
contract EditionRegistry is IEditionRegistry, Ownable {
    /// @notice Ceiling on reward assets serving a single quarter.
    /// @dev    Settlement loops over this set, and settlement sits in the path of a card
    ///         transfer that nobody can pause. The bound is what keeps that path finite.
    uint256 public constant MAX_ASSETS_PER_QUARTER = 8;

    /// @notice Ceiling on quarters in one edition, for the same reason.
    uint8 public constant MAX_QUARTERS = 16;

    IDistributor public immutable distributor;

    mapping(uint256 edition => EditionInfo) private _editions;
    mapping(uint256 edition => mapping(uint8 quarter => address[])) private _quarterAssets;
    uint256[] private _editionIds;

    event EditionRegistered(
        uint256 indexed edition,
        address indexed nft,
        address indexed hook,
        uint16 weightMultiplierBps,
        uint8 quarterCount
    );
    event QuarterAssetsSet(uint256 indexed edition, uint8 indexed quarter, address[] assets);

    error AlreadyRegistered(uint256 edition);
    error NotRegistered(uint256 edition);
    error ZeroAddress();
    error BadQuarterCount();
    error BadAssetCount();
    error DuplicateAsset(address asset);
    error QuarterOutOfRange(uint8 quarter);
    error MultiplierTooLow();

    constructor(address distributor_, address owner_) Ownable(owner_) {
        if (distributor_ == address(0)) revert ZeroAddress();
        distributor = IDistributor(distributor_);
    }

    /// @notice Register an edition and freeze its parameters forever.
    /// @param  assetsByQuarter one asset list per quarter, in quarter order.
    function registerEdition(
        uint256 edition,
        address nft,
        address hook,
        uint16 weightMultiplierBps,
        address[][] calldata assetsByQuarter
    ) external onlyOwner {
        if (_editions[edition].registered) revert AlreadyRegistered(edition);
        if (nft == address(0) || hook == address(0)) revert ZeroAddress();
        if (weightMultiplierBps < 10_000) revert MultiplierTooLow();

        uint256 quarters = assetsByQuarter.length;
        if (quarters == 0 || quarters > MAX_QUARTERS) revert BadQuarterCount();

        _editions[edition] = EditionInfo({
            nft: nft,
            hook: hook,
            weightMultiplierBps: weightMultiplierBps,
            quarterCount: uint8(quarters),
            registered: true
        });
        _editionIds.push(edition);

        for (uint8 q; q < quarters; ++q) {
            address[] calldata assets = assetsByQuarter[q];
            uint256 n = assets.length;
            if (n == 0 || n > MAX_ASSETS_PER_QUARTER) revert BadAssetCount();
            for (uint256 i; i < n; ++i) {
                if (assets[i] == address(0)) revert ZeroAddress();
                for (uint256 j; j < i; ++j) {
                    if (assets[i] == assets[j]) revert DuplicateAsset(assets[i]);
                }
                _quarterAssets[edition][q].push(assets[i]);
            }
            emit QuarterAssetsSet(edition, q, assets);
        }

        emit EditionRegistered(edition, nft, hook, weightMultiplierBps, uint8(quarters));
    }

    function editionCount() external view returns (uint256) {
        return _editionIds.length;
    }

    function editionIdAt(uint256 index) external view returns (uint256) {
        return _editionIds[index];
    }

    function editionIds() external view returns (uint256[] memory) {
        return _editionIds;
    }

    function infoOf(uint256 edition) external view returns (EditionInfo memory) {
        return _editions[edition];
    }

    function nftOf(uint256 edition) external view returns (address) {
        return _editions[edition].nft;
    }

    function hookOf(uint256 edition) external view returns (address) {
        return _editions[edition].hook;
    }

    function quarterCountOf(uint256 edition) external view returns (uint8) {
        return _editions[edition].quarterCount;
    }

    function isRegistered(uint256 edition) external view returns (bool) {
        return _editions[edition].registered;
    }

    function quarterAssets(uint256 edition, uint8 quarter) external view returns (address[] memory) {
        return _quarterAssets[edition][quarter];
    }

    function quarterAssetCount(uint256 edition, uint8 quarter) external view returns (uint256) {
        return _quarterAssets[edition][quarter].length;
    }

    /// @notice Live total weight of `edition`. Held by the distributor, which is the only
    ///         contract that watches weight move; mirroring it here would only create a
    ///         second number that can disagree with the first.
    function totalWeightOf(uint256 edition) external view returns (uint256) {
        return distributor.editionWeight(edition);
    }

    function requireRegistered(uint256 edition) external view {
        if (!_editions[edition].registered) revert NotRegistered(edition);
    }
}
