// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {StdCheats} from "forge-std/StdCheats.sol";

import {Token} from "../../src/Token.sol";
import {PropertyNFT} from "../../src/PropertyNFT.sol";
import {Distributor} from "../../src/Distributor.sol";
import {Minter} from "../../src/Minter.sol";
import {ProgressionManager} from "../../src/ProgressionManager.sol";
import {ProgressionLib} from "../../src/libraries/ProgressionLib.sol";
import {Property} from "../../src/interfaces/IPropertyNFT.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Drives the protocol through random, legal sequences of play so the invariants
///         are checked against histories nobody thought to write down.
contract Handler is CommonBase, StdCheats, StdUtils {
    uint256 public constant EDITION = 1;
    uint8 public constant QUARTERS = 4;

    Token public immutable token;
    PropertyNFT public immutable nft;
    Distributor public immutable distributor;
    Minter public immutable minter;
    ProgressionManager public immutable manager;
    address public immutable revenueVault;
    address public immutable treasury;
    address[QUARTERS] public rewardAsset;

    address[] public actors;
    uint256[] public mintedTokens;
    mapping(uint256 => bool) public isMinted;

    // Ghost state: what the invariants compare against.
    mapping(uint256 => uint8) public highWaterLevel;
    mapping(uint256 => mapping(address => uint256)) public highWaterCheckpoint;
    uint256 public totalMintBurned;
    uint256 public totalUpgradeBurned;

    // Action counters, so a run that never reached the interesting paths is visible.
    uint256 public mints;
    uint256 public builds;
    uint256 public transfers;
    uint256 public deposits;
    uint256 public claims;

    constructor(
        Token token_,
        PropertyNFT nft_,
        Distributor distributor_,
        Minter minter_,
        ProgressionManager manager_,
        address revenueVault_,
        address treasury_,
        address[QUARTERS] memory rewardAsset_,
        address[] memory actors_
    ) {
        token = token_;
        nft = nft_;
        distributor = distributor_;
        minter = minter_;
        manager = manager_;
        revenueVault = revenueVault_;
        treasury = treasury_;
        rewardAsset = rewardAsset_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _quarter(uint256 seed) internal pure returns (uint8) {
        return uint8(seed % QUARTERS);
    }

    // --- actions ----------------------------------------------------------------------

    function mintCard(uint256 actorSeed, uint256 quarterSeed) external {
        address who = _actor(actorSeed);
        uint8 q = _quarter(quarterSeed);
        if (minter.remainingMints(who) == 0) return;
        if (nft.mintedInQuarter(q) >= nft.QUARTER_CAP()) return;
        if (token.balanceOf(who) < minter.MINT_BURN()) return;

        vm.startPrank(who);
        token.approve(address(minter), minter.MINT_BURN());
        uint256 id = minter.mint(q);
        vm.stopPrank();

        mintedTokens.push(id);
        isMinted[id] = true;
        totalMintBurned += minter.MINT_BURN();
        ++mints;
        _record(id);
    }

    function build(uint256 tokenSeed) external {
        if (mintedTokens.length == 0) return;
        uint256 id = mintedTokens[tokenSeed % mintedTokens.length];
        if (nft.levelOf(id) >= ProgressionLib.MAX_LEVEL) return;

        address who = nft.ownerOf(id);
        (,, uint256 cost) = nft.nextUpgrade(id);
        if (token.balanceOf(who) < cost) return;

        vm.startPrank(who);
        token.approve(address(manager), cost);
        manager.build(id);
        vm.stopPrank();

        totalUpgradeBurned += cost;
        ++builds;
        _record(id);
    }

    function transferCard(uint256 tokenSeed, uint256 toSeed) external {
        if (mintedTokens.length == 0) return;
        uint256 id = mintedTokens[tokenSeed % mintedTokens.length];
        address from = nft.ownerOf(id);
        address to = _actor(toSeed);
        if (from == to) return;

        vm.prank(from);
        nft.transferFrom(from, to, id);
        ++transfers;
        _record(id);
    }

    function depositReward(uint256 quarterSeed, uint256 amount) external {
        uint8 q = _quarter(quarterSeed);
        amount = bound(amount, 1, 1_000_000e18);
        address asset = rewardAsset[q];

        IMintable(asset).mint(revenueVault, amount);
        vm.startPrank(revenueVault);
        IMintable(asset).approve(address(distributor), amount);
        distributor.deposit(EDITION, asset, q, amount);
        vm.stopPrank();
        ++deposits;
    }

    function claimQuarter(uint256 actorSeed, uint256 quarterSeed, uint256 maxScan) external {
        address who = _actor(actorSeed);
        uint8 q = _quarter(quarterSeed);
        maxScan = bound(maxScan, 0, 12);

        vm.prank(who);
        distributor.claimQuarter(EDITION, q, 0, maxScan);
        ++claims;
        _recordAll();
    }

    function claimCredited(uint256 actorSeed, uint256 quarterSeed) external {
        address who = _actor(actorSeed);
        vm.prank(who);
        distributor.claimCredited(EDITION, _quarter(quarterSeed));
        ++claims;
    }

    function settleTokens(uint256 tokenSeed) external {
        if (mintedTokens.length == 0) return;
        uint256[] memory ids = new uint256[](1);
        ids[0] = mintedTokens[tokenSeed % mintedTokens.length];
        distributor.settleTokens(EDITION, ids);
        _record(ids[0]);
    }

    function warp(uint256 secondsAhead) external {
        vm.warp(block.timestamp + bound(secondsAhead, 1, 7 days));
    }

    // --- ghost bookkeeping ------------------------------------------------------------

    function _record(uint256 id) internal {
        uint8 level = nft.levelOf(id);
        require(level >= highWaterLevel[id], "level went backwards");
        highWaterLevel[id] = level;

        uint8 q = nft.quarterOf(id);
        address asset = rewardAsset[q];
        uint256 cp = distributor.checkpointOf(EDITION, asset, id);
        require(cp >= highWaterCheckpoint[id][asset], "checkpoint went backwards");
        highWaterCheckpoint[id][asset] = cp;
    }

    function _recordAll() internal {
        for (uint256 i; i < mintedTokens.length; ++i) {
            _record(mintedTokens[i]);
        }
    }

    // --- views for the invariant contract ---------------------------------------------

    function mintedCount() external view returns (uint256) {
        return mintedTokens.length;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
