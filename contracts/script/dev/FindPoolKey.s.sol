// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManagerV4, PoolKey} from "../../src/interfaces/IPoolManagerV4.sol";

/// @notice Recovers a graduated launch's PoolKey by trying the parameters it could have
///         and asking the singleton which one actually holds a price.
/// @dev    Development aid. The key is fixed at graduation and only has to be found once.
contract FindPoolKey is Script {
    uint256 internal constant POOLS_SLOT = 6;

    function run() external view {
        IPoolManagerV4 pm = IPoolManagerV4(vm.envAddress("POOL_MANAGER"));
        address token = vm.envAddress("LAUNCH_TOKEN");
        address hooks = vm.envAddress("PONS_HOOK");

        uint24[4] memory fees = [uint24(0), 100, 3000, 10000];
        int24[8] memory spacings =
            [int24(1), int24(10), int24(50), int24(60), int24(100), int24(200), int24(2000), int24(60000)];

        // A native-paired launch sorts the zero address first.
        (address c0, address c1) = (address(0), token);

        for (uint256 f; f < fees.length; ++f) {
            for (uint256 s; s < spacings.length; ++s) {
                PoolKey memory key = PoolKey({
                    currency0: c0,
                    currency1: c1,
                    fee: fees[f],
                    tickSpacing: spacings[s],
                    hooks: hooks
                });
                bytes32 id = keccak256(abi.encode(key));
                bytes32 slot0 = pm.extsload(keccak256(abi.encode(id, POOLS_SLOT)));
                if (slot0 != bytes32(0)) {
                    console2.log("FOUND");
                    console2.log("  currency0   ", c0);
                    console2.log("  currency1   ", c1);
                    console2.log("  fee         ", uint256(fees[f]));
                    console2.log("  tickSpacing ", int256(spacings[s]));
                    console2.log("  hooks       ", hooks);
                    console2.logBytes32(id);
                    console2.log("  sqrtPriceX96", uint256(uint160(uint256(slot0))));
                    return;
                }
            }
        }
        console2.log("no pool matched; the pair may not be native, or the slot layout differs");
    }
}
