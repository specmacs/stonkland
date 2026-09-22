// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IToken is IERC20 {
    function approve(address, uint256) external returns (bool);
}

interface IMinter {
    function mint(uint8 quarter) external returns (uint256);
}

interface IProgression {
    function build(uint256 tokenId) external;
}

interface IFeeRouter {
    function distribute() external returns (uint256, uint256);
}

interface IStreamVault {
    function release() external returns (uint256);
}

interface IRevenueVault {
    function allocate() external returns (uint256);
    function processQuarter(uint256 edition, uint8 quarter, uint256[] calldata minOuts, uint256 deadline)
        external
        returns (uint256);
}

/// @notice Puts a local deployment into a state worth looking at: cards claimed across
///         every quarter, a few built up the ladder, and fees carried the whole way from
///         the router to rewards that owners can actually claim.
///
/// @dev    Development aid, local chains only. It exists because the interface's hardest
///         claim -- that every figure it shows is a live reading -- is only really tested
///         against a chain that has something to say. An empty deployment exercises the
///         empty states and nothing else.
///
///         Mints are spread across anvil's default accounts because the contract caps
///         primary mints per wallet, which is the behaviour under test rather than an
///         obstacle to work around.
///
///         Runs in two stages because the reward stream pays out over real time. `vm.warp`
///         moves the simulation's clock, not the chain's, so the caller advances anvil
///         between them (`evm_increaseTime`) and the stream matures for real. Faking it
///         inside the script would have the pipeline release tokens the chain does not
///         think have vested yet.
contract Seed is Script {
    uint256 internal constant ANVIL = 31_337;
    uint256 internal constant EDITION = 1;

    error NotALocalChain(uint256 chainId);

    // anvil's deterministic accounts. Account 0 holds the whole token supply.
    uint256[8] internal KEYS = [
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
        0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
        0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a,
        0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba,
        0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e,
        0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
    ];

    function run() external {
        if (block.chainid != ANVIL) revert NotALocalChain(block.chainid);
        uint256 stage = vm.envOr("STAGE", uint256(1));
        if (stage == 2) {
            _pipeline();
            return;
        }

        IToken token = IToken(vm.envAddress("TOKEN"));
        IMinter minter = IMinter(vm.envAddress("MINTER"));
        IProgression progression = IProgression(vm.envAddress("PROGRESSION"));
        IFeeRouter feeRouter = IFeeRouter(vm.envAddress("FEE_ROUTER"));
        IStreamVault streamVault = IStreamVault(vm.envAddress("STREAM_VAULT"));
        IRevenueVault revenueVault = IRevenueVault(vm.envAddress("REVENUE_VAULT"));

        address treasury = vm.addr(KEYS[0]);

        // Every wallet that is going to burn needs tokens and an allowance for both the
        // minter and the progression manager.
        uint256 stake = 8_000_000e18;
        for (uint256 i = 1; i < 6; ++i) {
            vm.broadcast(KEYS[0]);
            token.transfer(vm.addr(KEYS[i]), stake);
        }

        // Cards, spread so every quarter has something and the counts differ.
        uint8[13] memory plan = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 0, 1];
        uint256[] memory minted = new uint256[](plan.length);
        uint256 walletIndex = 1;
        uint256 mintsThisWallet;

        for (uint256 i; i < plan.length; ++i) {
            if (mintsThisWallet == 3) {
                walletIndex += 1;
                mintsThisWallet = 0;
            }
            uint256 key = KEYS[walletIndex];

            vm.startBroadcast(key);
            token.approve(address(minter), type(uint256).max);
            minted[i] = minter.mint(plan[i]);
            vm.stopBroadcast();

            mintsThisWallet += 1;
        }

        // Build a handful, so the ladder is visible rather than a wall of Houses.
        // Card 0 to Landmark, card 3 to Building, card 6 to Residence.
        _buildTo(progression, token, KEYS[1], minted[0], 4);
        _buildTo(progression, token, KEYS[2], minted[3], 2);
        _buildTo(progression, token, KEYS[3], minted[6], 1);

        // Fees enter the way the venue pays them: native value to the router. Splitting
        // them is already the permissionless path the protocol page exposes.
        vm.broadcast(KEYS[0]);
        payable(address(feeRouter)).transfer(30 ether);

        vm.broadcast(KEYS[0]);
        feeRouter.distribute();

        console2.log("treasury", treasury);
        console2.log("cards minted", plan.length);
        console2.log("stage 1 done: advance the chain's clock, then run STAGE=2");
    }

    /// @dev Everything downstream of the stream, once it has actually had time to mature.
    function _pipeline() internal {
        IFeeRouter feeRouter = IFeeRouter(vm.envAddress("FEE_ROUTER"));
        IStreamVault streamVault = IStreamVault(vm.envAddress("STREAM_VAULT"));
        IRevenueVault revenueVault = IRevenueVault(vm.envAddress("REVENUE_VAULT"));

        vm.broadcast(KEYS[0]);
        streamVault.release();

        vm.broadcast(KEYS[0]);
        revenueVault.allocate();

        uint256[] memory minOuts = new uint256[](1);
        for (uint8 q; q < 4; ++q) {
            vm.broadcast(KEYS[0]);
            revenueVault.processQuarter(EDITION, q, minOuts, block.timestamp + 600);
            console2.log("converted quarter", q);
        }

        // Leave fresh fees at the top of the pipeline, so every stage on the protocol page
        // has a live figure rather than a column of zeroes.
        vm.broadcast(KEYS[0]);
        payable(address(feeRouter)).transfer(6 ether);

        console2.log("stage 2 done");
    }

    function _buildTo(
        IProgression progression,
        IToken token,
        uint256 key,
        uint256 tokenId,
        uint256 steps
    ) internal {
        vm.broadcast(key);
        token.approve(address(progression), type(uint256).max);
        for (uint256 s; s < steps; ++s) {
            vm.broadcast(key);
            progression.build(tokenId);
        }
    }
}
