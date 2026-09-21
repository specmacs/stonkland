// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeployConfig, Deployment} from "./SystemDeployer.sol";
import {ProgressionLib} from "../src/libraries/ProgressionLib.sol";

/// @notice Everything the rulebook claims, checked against the bytecode that actually
///         landed. Run before the frontend is pointed at a deployment.
/// @dev    Deliberately separate from the deploy script so it can be run again later,
///         against a manifest, by someone who did not do the deploying.
contract DeploymentChecks {
    function check(DeployConfig memory c, Deployment memory d) public view {
        require(d.token.totalSupply() == 1_000_000_000e18, "token supply");
        require(d.token.balanceOf(c.tokenRecipient) == 1_000_000_000e18, "token distribution");

        require(d.nft.MAX_SUPPLY() == 400, "card supply");
        require(d.nft.QUARTER_COUNT() == 4, "quarters");
        require(d.nft.QUARTER_CAP() == 100, "quarter cap");
        require(d.nft.WEIGHT_MULTIPLIER_BPS() == c.weightMultiplierBps, "multiplier");
        require(d.nft.ROYALTY_BPS() == 500, "royalty");

        require(d.minter.MINT_BURN() == 100_000e18, "mint burn");
        require(d.minter.MINTS_PER_WALLET() == 3, "wallet allowance");
        require(d.minter.paused(), "minter must launch paused");

        require(d.feeRouter.TREASURY_BPS() == 3_333, "treasury split");
        require(d.feeRouter.REWARDS_BPS() == 6_667, "rewards split");
        require(d.streamVault.EPOCH() == 300, "stream epoch");

        require(d.allocation.quarterCount() == 4, "allocation quarters");
        for (uint8 q; q < 4; ++q) {
            require(d.allocation.allocationBps(q) == 2_500, "allocation bps");
        }

        // Links completed, and completed to the right places.
        require(d.nft.minter() == address(d.minter), "link: minter");
        require(d.nft.progressionManager() == address(d.manager), "link: manager");
        require(address(d.nft.settlementHook()) == address(d.hook), "link: hook");
        require(address(d.distributor.registry()) == address(d.registry), "link: registry");
        require(d.distributor.revenueVault() == address(d.revenueVault), "link: revenue vault");
        require(address(d.revenueVault.distributor()) == address(d.distributor), "link: distributor");
        require(d.streamVault.revenueVault() == address(d.revenueVault), "link: stream target");
        require(d.royaltyRouter.revenueVault() == address(d.revenueVault), "link: royalty target");
        require(address(d.feeRouter.streamVault()) == address(d.streamVault), "link: fee target");
        require(d.feeRouter.treasury() == address(d.buyback), "link: treasury");
        require(d.buyback.burnsBought() == c.burnsBought, "buyback: burn behaviour");
        require(d.buyback.buybackRecipient() == c.buybackRecipient, "buyback: recipient");
        require(d.buyback.buybackBps() == c.buybackBps, "buyback: share");

        (address royaltyReceiver, uint256 royaltyAmount) = d.nft.royaltyInfo(1, 10_000);
        require(royaltyReceiver == address(d.royaltyRouter), "royalty receiver");
        require(royaltyAmount == 500, "royalty amount");

        // Edition registered and frozen.
        require(d.registry.isRegistered(1), "edition 1");
        for (uint8 q; q < 4; ++q) {
            address[] memory assets = d.registry.quarterAssets(1, q);
            require(assets.length == 1, "one asset per quarter");
            require(assets[0] == c.rewardAssets[q], "asset address");
        }

        // Every key handed over. Nothing is left owned by the deployer.
        require(d.nft.owner() == c.owner, "owner: nft");
        require(d.registry.owner() == c.owner, "owner: registry");
        require(d.minter.owner() == c.owner, "owner: minter");
        require(d.manager.owner() == c.owner, "owner: manager");
        require(d.revenueVault.owner() == c.owner, "owner: revenue vault");
        require(d.buyback.owner() == c.owner, "owner: buyback");
        require(d.renderer.owner() == c.owner, "owner: renderer");

        // The level schedule, as published.
        require(d.nft.scheduleWeight(1) == ProgressionLib.weightFor(1, c.weightMultiplierBps), "w1");
        require(d.nft.scheduleWeight(5) == ProgressionLib.weightFor(5, c.weightMultiplierBps), "w5");
    }
}
