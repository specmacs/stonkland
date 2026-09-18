// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Token} from "../src/Token.sol";
import {PropertyNFT} from "../src/PropertyNFT.sol";
import {Distributor} from "../src/Distributor.sol";
import {EditionRegistry} from "../src/EditionRegistry.sol";
import {TransferHook} from "../src/TransferHook.sol";
import {Minter} from "../src/Minter.sol";
import {ProgressionManager} from "../src/ProgressionManager.sol";
import {AllocationController} from "../src/AllocationController.sol";
import {StreamVault} from "../src/StreamVault.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {RoyaltyRouter} from "../src/RoyaltyRouter.sol";
import {TreasuryBuyback} from "../src/TreasuryBuyback.sol";
import {MetadataRenderer} from "../src/MetadataRenderer.sol";

struct DeployConfig {
    string tokenName;
    string tokenSymbol;
    address tokenRecipient;
    string nftName;
    string nftSymbol;
    address owner;
    address treasurySink;
    address buybackRecipient;
    uint16 buybackBps;
    address weth;
    address feeSource; // may be zero until the venue is settled
    uint16 weightMultiplierBps;
    address[4] rewardAssets;
    string imageBaseURI;
    string externalBaseURI;
}

struct Deployment {
    Token token;
    PropertyNFT nft;
    Distributor distributor;
    EditionRegistry registry;
    TransferHook hook;
    Minter minter;
    ProgressionManager manager;
    AllocationController allocation;
    StreamVault streamVault;
    FeeRouter feeRouter;
    RevenueVault revenueVault;
    RoyaltyRouter royaltyRouter;
    TreasuryBuyback buyback;
    MetadataRenderer renderer;
}

/// @notice Deploys the founding edition in reviewed order and hands every key over.
///
/// @dev The deployer holds each owner role only long enough to complete the one-time
///      links, then transfers it on. Nothing is left owned by this contract, which the
///      manifest check at the end of the runbook verifies.
///
///      Order matters in two places. `StreamVault` is constructed before `FeeRouter`
///      because the router takes the vault's address as an immutable. `RevenueVault` is
///      constructed before `Distributor` because the distributor takes the vault's
///      address as an immutable and will accept deposits from nothing else; the vault
///      learns the distributor's address afterwards, through a link it can only complete
///      once.
contract SystemDeployer {
    uint256 public constant FOUNDING_EDITION = 1;
    uint8 public constant QUARTERS = 4;

    error AssetMissing(uint8 quarter);

    function deploy(DeployConfig memory c) public returns (Deployment memory d) {
        for (uint8 q; q < QUARTERS; ++q) {
            if (c.rewardAssets[q] == address(0)) revert AssetMissing(q);
        }

        // 1. The token. Fully issued at construction, never again.
        d.token = new Token(c.tokenName, c.tokenSymbol, c.tokenRecipient);

        // 2. Revenue custody, then accounting. The distributor's depositor is immutable,
        //    so the vault has to exist first.
        d.revenueVault = new RevenueVault(c.weth, address(this));
        d.distributor = new Distributor(address(d.revenueVault), address(this));
        d.registry = new EditionRegistry(address(d.distributor), address(this));

        d.distributor.setRegistry(address(d.registry));
        d.revenueVault.linkDistributor(address(d.distributor));
        d.revenueVault.linkRegistry(address(d.registry));

        // 3. The frozen quarter allocation: a quarter each, and no setter anywhere.
        uint16[] memory bps = new uint16[](QUARTERS);
        for (uint8 q; q < QUARTERS; ++q) {
            bps[q] = 2_500;
        }
        d.allocation = new AllocationController(bps);
        d.revenueVault.linkAllocator(FOUNDING_EDITION, address(d.allocation));

        // 4. Treasury side, then streaming, then the router that feeds both.
        d.buyback = new TreasuryBuyback(
            c.weth,
            address(d.token),
            c.treasurySink,
            c.buybackRecipient,
            c.buybackBps,
            address(this)
        );
        d.streamVault = new StreamVault(c.weth, address(d.revenueVault));
        d.feeRouter = new FeeRouter(c.weth, address(d.buyback), address(d.streamVault), c.feeSource);

        // 5. The collection and everything that may write to it.
        d.nft = new PropertyNFT(c.nftName, c.nftSymbol, c.weightMultiplierBps, address(this));
        d.hook = new TransferHook(address(d.nft), address(d.distributor), FOUNDING_EDITION);
        d.minter = new Minter(address(d.token), address(d.nft), address(this));
        d.manager = new ProgressionManager(
            address(d.token), address(d.nft), address(d.distributor), FOUNDING_EDITION, address(this)
        );
        d.royaltyRouter = new RoyaltyRouter(c.weth, address(d.revenueVault));
        d.renderer =
            new MetadataRenderer(c.nftName, c.imageBaseURI, c.externalBaseURI, address(this));

        // 6. One-time links. Each of these reverts if attempted a second time.
        d.nft.linkSettlementHook(address(d.hook));
        d.nft.linkMinter(address(d.minter));
        d.nft.linkProgressionManager(address(d.manager));
        d.nft.linkRoyaltyReceiver(address(d.royaltyRouter));
        d.nft.setRenderer(address(d.renderer));

        // 7. Register the edition and freeze its asset set.
        address[][] memory assetsByQuarter = new address[][](QUARTERS);
        for (uint8 q; q < QUARTERS; ++q) {
            address[] memory one = new address[](1);
            one[0] = c.rewardAssets[q];
            assetsByQuarter[q] = one;
        }
        d.registry.registerEdition(
            FOUNDING_EDITION, address(d.nft), address(d.hook), c.weightMultiplierBps, assetsByQuarter
        );

        // 8. Hand over every key. The minter stays paused: unpausing it is the launch.
        d.nft.transferOwnership(c.owner);
        d.registry.transferOwnership(c.owner);
        d.minter.transferOwnership(c.owner);
        d.manager.transferOwnership(c.owner);
        d.revenueVault.transferOwnership(c.owner);
        d.buyback.transferOwnership(c.owner);
        d.renderer.transferOwnership(c.owner);
    }
}
