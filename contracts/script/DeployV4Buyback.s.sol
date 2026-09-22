// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManagerV4, PoolKey} from "../src/interfaces/IPoolManagerV4.sol";
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";
import {TreasuryBuyback} from "../src/TreasuryBuyback.sol";

/// @notice Points the treasury buyback at the token's Uniswap V4 pool, once one exists.
///
/// @dev    Deliberately a separate script from the system deploy, because the pool it
///         needs cannot exist at that point: the launch runs a bonding curve first and
///         only graduates into a V4 pool when the curve is bought out. Until then the
///         buyback holds what it collects and forwards the rest, which is why running
///         this late costs nothing.
///
///         The pool key is recovered rather than supplied. A V4 pool's id is the hash of
///         its key, and the singleton stores state under that id, so the key can be
///         confirmed by asking the singleton whether the pool it describes holds a price.
///         Typing a key in by hand and getting one field wrong would produce a plausible
///         adapter that silently addresses a pool which does not exist.
///
///         Required: POOL_MANAGER, LAUNCH_TOKEN, PONS_HOOK, TREASURY_BUYBACK.
///         Optional: QUOTE_TOKEN, when the pool is paired against a token rather than
///         native value. Defaults to native.
contract DeployV4Buyback is Script {
    /// @dev Where the singleton keeps `pools`, established by reading a live pool.
    uint256 internal constant POOLS_SLOT = 6;

    error NoPoolFound(address token);
    error AdapterAssetWrong(address expected, address actual);

    function run() external {
        IPoolManagerV4 pm = IPoolManagerV4(vm.envAddress("POOL_MANAGER"));
        address token = vm.envAddress("LAUNCH_TOKEN");
        address hooks = vm.envAddress("PONS_HOOK");
        TreasuryBuyback buyback = TreasuryBuyback(payable(vm.envAddress("TREASURY_BUYBACK")));

        // Native by default: the Pons curve is priced in ETH and graduates the same way.
        address quote = vm.envOr("QUOTE_TOKEN", address(0));

        (PoolKey memory key, bool found) = _findPool(pm, token, quote, hooks);
        if (!found) revert NoPoolFound(token);

        console2.log("pool found");
        console2.log("  currency0   ", key.currency0);
        console2.log("  currency1   ", key.currency1);
        console2.log("  fee         ", uint256(key.fee));
        console2.log("  tickSpacing ", int256(key.tickSpacing));
        console2.log("  hooks       ", key.hooks);

        vm.startBroadcast();

        // The buyback spends what it holds, which is wrapped ether; the adapter unwraps
        // when the pool is native-paired.
        UniswapV4Adapter adapter =
            new UniswapV4Adapter(address(buyback.weth()), token, address(pm), key);

        // setAdapter checks this itself, but a mismatch here means the wrong token was
        // named, and that is worth failing on before anything is wired.
        if (adapter.asset() != token) revert AdapterAssetWrong(token, adapter.asset());

        buyback.setAdapter(address(adapter));

        vm.stopBroadcast();

        console2.log("UniswapV4Adapter    ", address(adapter));
        console2.log("wired to buyback    ", address(buyback));
        console2.log("");
        console2.log("Set a keeper and limits before the first run if you want them:");
        console2.log("  buyback.setKeeper(address)");
        console2.log("  buyback.setLimits(maxSpendPerCall, cooldown)");
    }

    /// @dev Tries every shape the launch could have produced and asks the singleton which
    ///      one actually holds a price. Both currency orderings are tried because a pool
    ///      paired against a token rather than native value sorts by address.
    function _findPool(IPoolManagerV4 pm, address token, address quote, address hooks)
        internal
        view
        returns (PoolKey memory key, bool found)
    {
        uint24[4] memory fees = [uint24(0), 100, 3000, 10000];
        int24[8] memory spacings =
            [int24(1), int24(10), int24(50), int24(60), int24(100), int24(200), int24(2000), int24(60000)];

        (address c0, address c1) = quote < token ? (quote, token) : (token, quote);

        for (uint256 f; f < fees.length; ++f) {
            for (uint256 s; s < spacings.length; ++s) {
                PoolKey memory candidate = PoolKey({
                    currency0: c0,
                    currency1: c1,
                    fee: fees[f],
                    tickSpacing: spacings[s],
                    hooks: hooks
                });
                bytes32 id = keccak256(abi.encode(candidate));
                // slot0 holds sqrtPriceX96 in its low bits. Non-zero means initialised.
                if (pm.extsload(keccak256(abi.encode(id, POOLS_SLOT))) != bytes32(0)) {
                    return (candidate, true);
                }
            }
        }
    }
}
