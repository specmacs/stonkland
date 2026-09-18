// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SystemDeployer, DeployConfig, Deployment} from "./SystemDeployer.sol";
import {DeploymentChecks} from "./DeploymentChecks.sol";

/// @notice Deploys the founding edition and writes the address manifest.
///
/// @dev Rehearse with no broadcast first and diff the manifest:
///        forge script script/Deploy.s.sol --fork-url $RPC_URL
///      Then, only once the diff is empty:
///        forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
///
///      The whole system is constructed inside one transaction by `SystemDeployer`, which
///      removes the class of mistake the nonce-ordered runbook exists to prevent: there is
///      no window in which a half-linked system is sitting on chain, and no predicted
///      address that can be wrong because nothing is predicted. The deployer holds each
///      owner role only for the length of that transaction.
///
///      Minting stays paused. Unpausing is the launch and is a separate, deliberate act.
contract Deploy is Script {
    function run() external {
        DeployConfig memory c = _config();

        vm.startBroadcast();
        Deployment memory d = SystemDeployer.deploy(c, msg.sender);
        vm.stopBroadcast();

        // Every published claim, verified against what is now on chain.
        new DeploymentChecks().check(c, d);
        _writeManifest(c, d);
        _print(d);
    }

    function _config() internal view returns (DeployConfig memory c) {
        c.tokenName = vm.envOr("TOKEN_NAME", string("Landlord"));
        c.tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("LORD"));
        c.nftName = vm.envOr("NFT_NAME", string("Landlord Property Card"));
        c.nftSymbol = vm.envOr("NFT_SYMBOL", string("CARD"));

        c.owner = vm.envAddress("OWNER");
        c.tokenRecipient = vm.envAddress("TOKEN_RECIPIENT");
        c.treasurySink = vm.envAddress("TREASURY_SINK");
        c.buybackRecipient = vm.envAddress("BUYBACK_RECIPIENT");
        c.weth = vm.envAddress("WETH");
        c.feeSource = vm.envOr("FEE_SOURCE", address(0));

        c.buybackBps = uint16(vm.envOr("BUYBACK_BPS", uint256(0)));
        c.weightMultiplierBps = uint16(vm.envOr("WEIGHT_MULTIPLIER_BPS", uint256(12_500)));

        c.rewardAssets[0] = vm.envAddress("REWARD_ASSET_Q1");
        c.rewardAssets[1] = vm.envAddress("REWARD_ASSET_Q2");
        c.rewardAssets[2] = vm.envAddress("REWARD_ASSET_Q3");
        c.rewardAssets[3] = vm.envAddress("REWARD_ASSET_Q4");

        c.imageBaseURI = vm.envOr("IMAGE_BASE_URI", string(""));
        c.externalBaseURI = vm.envOr("EXTERNAL_BASE_URI", string(""));
    }


    function _writeManifest(DeployConfig memory c, Deployment memory d) internal {
        string memory k = "manifest";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployedAtBlock", block.number);
        vm.serializeAddress(k, "owner", c.owner);
        vm.serializeAddress(k, "weth", c.weth);

        vm.serializeAddress(k, "Token", address(d.token));
        vm.serializeAddress(k, "PropertyNFT", address(d.nft));
        vm.serializeAddress(k, "Distributor", address(d.distributor));
        vm.serializeAddress(k, "EditionRegistry", address(d.registry));
        vm.serializeAddress(k, "TransferHook", address(d.hook));
        vm.serializeAddress(k, "Minter", address(d.minter));
        vm.serializeAddress(k, "ProgressionManager", address(d.manager));
        vm.serializeAddress(k, "AllocationController", address(d.allocation));
        vm.serializeAddress(k, "StreamVault", address(d.streamVault));
        vm.serializeAddress(k, "FeeRouter", address(d.feeRouter));
        vm.serializeAddress(k, "RevenueVault", address(d.revenueVault));
        vm.serializeAddress(k, "RoyaltyRouter", address(d.royaltyRouter));
        vm.serializeAddress(k, "TreasuryBuyback", address(d.buyback));
        vm.serializeAddress(k, "MetadataRenderer", address(d.renderer));

        address[] memory assets = new address[](4);
        for (uint8 q; q < 4; ++q) {
            assets[q] = c.rewardAssets[q];
        }
        string memory json = vm.serializeAddress(k, "rewardAssets", assets);

        string memory path =
            string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("manifest written to", path);
    }

    function _print(Deployment memory d) internal pure {
        console2.log("Token               ", address(d.token));
        console2.log("PropertyNFT         ", address(d.nft));
        console2.log("Distributor         ", address(d.distributor));
        console2.log("EditionRegistry     ", address(d.registry));
        console2.log("TransferHook        ", address(d.hook));
        console2.log("Minter              ", address(d.minter));
        console2.log("ProgressionManager  ", address(d.manager));
        console2.log("AllocationController", address(d.allocation));
        console2.log("StreamVault         ", address(d.streamVault));
        console2.log("FeeRouter           ", address(d.feeRouter));
        console2.log("RevenueVault        ", address(d.revenueVault));
        console2.log("RoyaltyRouter       ", address(d.royaltyRouter));
        console2.log("TreasuryBuyback     ", address(d.buyback));
        console2.log("MetadataRenderer    ", address(d.renderer));
        console2.log("");
        console2.log("Minting is PAUSED. Unpausing the minter is the launch.");
        console2.log("Adapters are NOT wired. Set one per quarter before any conversion.");
    }
}
