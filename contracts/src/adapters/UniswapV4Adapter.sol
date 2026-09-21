// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAcquisitionAdapter} from "../interfaces/IAcquisitionAdapter.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {
    IPoolManagerV4, IUnlockCallback, PoolKey, SwapParams
} from "../interfaces/IPoolManagerV4.sol";

/// @title UniswapV4Adapter
/// @notice Buys one asset from a single Uniswap V4 pool.
///
/// @dev Written for the token's own pool after it graduates from the launch venue's
///      bonding curve. There is no V4 router on this chain worth using -- the deployed
///      universal router points its `poolManager()` at an address with no code here -- so
///      this talks to the singleton directly.
///
///      There is also no price history to check a fill against. V4 core keeps none, and
///      the venue's hook exposes none, so the oracle floor that guards the reward-asset
///      routes has no equivalent here. `minOut` is therefore the whole of the price
///      protection and it is enforced strictly: the caller has to have looked at the pool
///      and decided what a fair fill is. Whoever is allowed to call, and how much they
///      may spend at once, is decided upstream in `TreasuryBuyback`.
///
///      The pool, the currencies, the fee, the tick spacing and the hook are all fixed at
///      construction. Nothing about where this trades can be changed afterwards.
contract UniswapV4Adapter is IAcquisitionAdapter, IUnlockCallback {
    using SafeERC20 for IERC20;

    /// @dev V4's price bounds. A swap is clamped just inside them, which means "no limit"
    ///      in the direction of travel and leaves `minOut` to do the real work.
    uint160 internal constant MIN_SQRT_PRICE = 4_295_128_739;
    uint160 internal constant MAX_SQRT_PRICE =
        1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342;

    IPoolManagerV4 public immutable poolManager;
    IWETH9 public immutable weth;

    address public immutable override inputToken;
    address public immutable override asset;

    address public immutable currency0;
    address public immutable currency1;
    uint24 public immutable poolFee;
    int24 public immutable tickSpacing;
    address public immutable hooks;

    /// @notice True when the swap sells currency0 to buy currency1.
    bool public immutable zeroForOne;

    /// @notice True when the spent currency is native value rather than a token.
    bool public immutable spendsNative;

    event Converted(uint256 amountIn, uint256 received, address indexed recipient);

    error ZeroAddress();
    error DeadlinePassed(uint256 deadline);
    error NothingToConvert();
    error AssetNotInPool();
    error InputNotInPool();
    error NotPoolManager();
    error BelowMinimum(uint256 received, uint256 minOut);
    error UnexpectedDelta();
    error InputNotFullySpent(uint256 expected, uint256 actual);

    /// @param inputToken_ what the vault hands over. Always the wrapped native token;
    ///        it is unwrapped here when the pool trades the native currency.
    constructor(address inputToken_, address asset_, address poolManager_, PoolKey memory key) {
        if (inputToken_ == address(0) || asset_ == address(0) || poolManager_ == address(0)) {
            revert ZeroAddress();
        }

        // The pool must actually trade the pair this adapter claims to.
        bool assetIs0 = key.currency0 == asset_;
        bool assetIs1 = key.currency1 == asset_;
        if (!assetIs0 && !assetIs1) revert AssetNotInPool();

        address spendCurrency = assetIs0 ? key.currency1 : key.currency0;
        // The other side is either the wrapped token itself or the native currency, which
        // V4 writes as the zero address.
        bool native = spendCurrency == address(0);
        if (!native && spendCurrency != inputToken_) revert InputNotInPool();

        poolManager = IPoolManagerV4(poolManager_);
        weth = IWETH9(inputToken_);
        inputToken = inputToken_;
        asset = asset_;

        currency0 = key.currency0;
        currency1 = key.currency1;
        poolFee = key.fee;
        tickSpacing = key.tickSpacing;
        hooks = key.hooks;

        zeroForOne = assetIs1;
        spendsNative = native;
    }

    receive() external payable {}

    function poolKey() public view returns (PoolKey memory) {
        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: poolFee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });
    }

    /// @inheritdoc IAcquisitionAdapter
    /// @dev The caller transfers the input in first; this spends exactly what arrived.
    function convert(uint256 amountIn, uint256 minOut, uint256 deadline, address recipient)
        external
        returns (uint256 received)
    {
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        if (amountIn == 0) revert NothingToConvert();
        if (recipient == address(0)) revert ZeroAddress();

        uint256 inputBefore = IERC20(inputToken).balanceOf(address(this));

        // V4 holds the native currency as the zero address, so a pool paired against ETH
        // needs the wrapper taken off before anything can be settled.
        if (spendsNative) weth.withdraw(amountIn);

        uint256 assetBefore = IERC20(asset).balanceOf(address(this));
        poolManager.unlock(abi.encode(amountIn));
        received = IERC20(asset).balanceOf(address(this)) - assetBefore;

        uint256 spent = inputBefore - IERC20(inputToken).balanceOf(address(this));
        if (spent != amountIn) revert InputNotFullySpent(amountIn, spent);

        // With no price history to check against, this is the whole of the protection.
        if (received < minOut) revert BelowMinimum(received, minOut);

        IERC20(asset).safeTransfer(recipient, received);
        emit Converted(amountIn, received, recipient);
    }

    /// @notice Settlement window opened by `unlock`. Only the singleton may call it.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        uint256 amountIn = abi.decode(data, (uint256));
        bool zfo = zeroForOne;

        int256 delta = poolManager.swap(
            poolKey(),
            SwapParams({
                zeroForOne: zfo,
                // Negative asks the pool for an exact-input swap.
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zfo ? MIN_SQRT_PRICE + 1 : MAX_SQRT_PRICE - 1
            }),
            ""
        );

        (int128 delta0, int128 delta1) = _split(delta);
        (int128 owedDelta, int128 gainedDelta) = zfo ? (delta0, delta1) : (delta1, delta0);

        // Exact input: one side is owed to the pool, the other owed to this contract.
        if (owedDelta > 0 || gainedDelta < 0) revert UnexpectedDelta();

        address spendCurrency = zfo ? currency0 : currency1;
        address takeCurrency = zfo ? currency1 : currency0;

        uint256 owed = uint256(uint128(-owedDelta));
        if (owed != 0) {
            if (spendsNative) {
                poolManager.settle{value: owed}();
            } else {
                // Sync first, then transfer, then settle: the singleton measures the
                // difference rather than trusting a number passed to it.
                poolManager.sync(spendCurrency);
                IERC20(spendCurrency).safeTransfer(address(poolManager), owed);
                poolManager.settle();
            }
        }

        uint256 gained = uint256(uint128(gainedDelta));
        if (gained != 0) poolManager.take(takeCurrency, address(this), gained);

        return "";
    }

    /// @dev BalanceDelta packs amount0 into the high 128 bits and amount1 into the low.
    function _split(int256 delta) private pure returns (int128 amount0, int128 amount1) {
        assembly {
            amount0 := sar(128, delta)
            amount1 := signextend(15, delta)
        }
    }
}
