// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Identifies one Uniswap V4 pool inside the singleton.
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct SwapParams {
    bool zeroForOne;
    /// @dev Negative for an exact-input swap.
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

/// @notice The V4 singleton. Pools are entries in it, not contracts of their own.
interface IPoolManagerV4 {
    /// @notice Opens a settlement window and calls `unlockCallback` on the caller.
    function unlock(bytes calldata data) external returns (bytes memory);

    /// @dev Returns a BalanceDelta: amount0 in the high 128 bits, amount1 in the low.
    ///      Negative means owed to the pool, positive means owed to the caller.
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        returns (int256 delta);

    /// @notice Records the pool's balance of `currency` before a token is transferred in.
    function sync(address currency) external;

    /// @notice Pays what the caller owes, from native value or from a synced transfer.
    function settle() external payable returns (uint256 paid);

    /// @notice Withdraws what the caller is owed.
    function take(address currency, address to, uint256 amount) external;

    function extsload(bytes32 slot) external view returns (bytes32);
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
