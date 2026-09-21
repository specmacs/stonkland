// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SystemDeployer, DeployConfig, Deployment} from "./SystemDeployer.sol";
import {DeploymentChecks} from "./DeploymentChecks.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockWETH, MockAggregator, MockSwapRouter} from "../test/mocks/MockVenue.sol";

/// @notice A complete local deployment, stand-in venue and all, for developing the
///         interface against.
///
/// @dev Refuses to run anywhere but a local chain. The mocks this deploys -- a fake WETH,
///      fake price feeds, a fake venue, and four reward assets that represent nothing --
///      have no business on a network anybody else can reach, and the guard below is what
///      stops a mistyped RPC from putting them there.
contract DeployLocal is Script {
    uint256 internal constant ANVIL = 31_337;

    error NotALocalChain(uint256 chainId);

    function run() external {
        if (block.chainid != ANVIL) revert NotALocalChain(block.chainid);

        address owner = vm.envOr("OWNER", msg.sender);

        vm.startBroadcast();

        MockWETH weth = new MockWETH();
        MockAggregator wethUsd = new MockAggregator(8, 3_000e8);
        MockAggregator assetUsd = new MockAggregator(8, 150e8);

        address[4] memory assetAddrs;
        MockSwapRouter[4] memory routers;
        for (uint8 q; q < 4; ++q) {
            MockERC20 asset = new MockERC20(
                string.concat("Quarter ", vm.toString(uint256(q) + 1), " Reward"),
                string.concat("RWD", vm.toString(uint256(q) + 1)),
                18
            );
            assetAddrs[q] = address(asset);
            routers[q] = new MockSwapRouter(20e18);
            asset.mint(address(routers[q]), 10_000_000e18);
        }

        Deployment memory d = SystemDeployer.deploy(
            DeployConfig({
                tokenName: "Stocktown",
                tokenSymbol: "TOWN",
                tokenRecipient: owner,
                nftName: "Stocktown Property Card",
                nftSymbol: "CARD",
                owner: owner,
                treasurySink: owner,
                burnsBought: true,
                buybackRecipient: address(0),
                buybackBps: 2_000,
                weth: address(weth),
                feeSource: address(0),
                weightMultiplierBps: 12_500,
                rewardAssets: assetAddrs,
                imageBaseURI: "http://localhost:3000/game/pieces/level-",
                externalBaseURI: "http://localhost:3000/board/"
            }),
            msg.sender
        );

        for (uint8 q; q < 4; ++q) {
            UniswapV3Adapter adapter = new UniswapV3Adapter(
                address(weth),
                assetAddrs[q],
                address(routers[q]),
                abi.encodePacked(address(weth), uint24(3000), assetAddrs[q]),
                address(wethUsd),
                address(assetUsd),
                1 hours,
                200
            );
            d.revenueVault.setAdapter(1, q, assetAddrs[q], address(adapter));
        }

        vm.stopBroadcast();

        // Checked in its as-deployed state, paused and all, before anything is launched.
        new DeploymentChecks().check(_configFor(owner, address(weth), assetAddrs), d);

        vm.startBroadcast();
        d.minter.unpause(); // a local chain launches immediately
        vm.stopBroadcast();

        _writeEnv(d, address(weth), assetAddrs);
    }

    function _configFor(address owner, address weth, address[4] memory assets)
        internal
        pure
        returns (DeployConfig memory c)
    {
        c.tokenName = "Stocktown";
        c.tokenSymbol = "TOWN";
        c.tokenRecipient = owner;
        c.nftName = "Stocktown Property Card";
        c.nftSymbol = "CARD";
        c.owner = owner;
        c.treasurySink = owner;
        c.burnsBought = true;
        c.buybackRecipient = address(0);
        c.buybackBps = 2_000;
        c.weth = weth;
        c.feeSource = address(0);
        c.weightMultiplierBps = 12_500;
        c.rewardAssets = assets;
    }

    /// @dev Writes the env block the interface reads, so a local run is one copy away.
    function _writeEnv(Deployment memory d, address weth, address[4] memory assets) internal {
        string memory core = string.concat(
            "NEXT_PUBLIC_CHAIN_ID=31337\n",
            "NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545\n",
            "NEXT_PUBLIC_TOKEN_ADDRESS=", vm.toString(address(d.token)), "\n",
            "NEXT_PUBLIC_NFT_ADDRESS=", vm.toString(address(d.nft)), "\n",
            "NEXT_PUBLIC_MINTER_ADDRESS=", vm.toString(address(d.minter)), "\n",
            "NEXT_PUBLIC_PROGRESSION_MANAGER_ADDRESS=", vm.toString(address(d.manager)), "\n",
            "NEXT_PUBLIC_DISTRIBUTOR_ADDRESS=", vm.toString(address(d.distributor)), "\n"
        );
        string memory pipeline = string.concat(
            "NEXT_PUBLIC_EDITION_REGISTRY_ADDRESS=", vm.toString(address(d.registry)), "\n",
            "NEXT_PUBLIC_REVENUE_VAULT_ADDRESS=", vm.toString(address(d.revenueVault)), "\n",
            "NEXT_PUBLIC_STREAM_VAULT_ADDRESS=", vm.toString(address(d.streamVault)), "\n",
            "NEXT_PUBLIC_FEE_ROUTER_ADDRESS=", vm.toString(address(d.feeRouter)), "\n",
            "NEXT_PUBLIC_ROYALTY_ROUTER_ADDRESS=", vm.toString(address(d.royaltyRouter)), "\n",
            "NEXT_PUBLIC_WETH_ADDRESS=", vm.toString(weth), "\n"
        );
        string memory rewardAssets = string.concat(
            "NEXT_PUBLIC_REWARD_ASSET_Q1=", vm.toString(assets[0]), "\n",
            "NEXT_PUBLIC_REWARD_ASSET_Q2=", vm.toString(assets[1]), "\n",
            "NEXT_PUBLIC_REWARD_ASSET_Q3=", vm.toString(assets[2]), "\n",
            "NEXT_PUBLIC_REWARD_ASSET_Q4=", vm.toString(assets[3]), "\n"
        );
        string memory env = string.concat(core, pipeline, rewardAssets);
        vm.writeFile("deployments/local.env", env);
        console2.log("wrote deployments/local.env");
    }
}
