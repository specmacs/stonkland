// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAcquisitionAdapter} from "../interfaces/IAcquisitionAdapter.sol";
import {IUniswapV3Pool} from "../interfaces/IUniswapV3Pool.sol";
import {ISwapRouter} from "./UniswapV3Adapter.sol";

/// @title UniswapV3TwapAdapter
/// @notice Buys one reward asset along one fixed route, priced against the route's own
///         time-weighted average rather than an external feed.
///
/// @dev Written for a chain with no price-feed infrastructure. Where a feed exists, use
///      `UniswapV3Adapter` instead: an independent price source is strictly better
///      evidence than the venue's own history.
///
///      The protection here is a pair of tick checks on every pool in the path.
///
///      Before the swap, the pool's spot tick must sit within `maxTickDeviation` of its
///      TWAP. A pool whose spot has been pushed away from its own average is a pool
///      somebody is setting up, and this refuses to trade into it.
///
///      After the swap, the new spot tick must still sit within that band. This is what
///      bounds the trade's own price impact, and it is the check that matters most here:
///      these markets are thin, and the failure that empties a treasury is not a clever
///      manipulation but an ordinary large order walking the book.
///
///      Ticks are compared directly, and no tick is ever converted back into a price.
///      That is deliberate. The conversion needs full `TickMath`, and a subtle error
///      there would be both silent and expensive. A tick band expresses the same
///      tolerance -- one tick is one basis point of price -- with nothing to get wrong.
///
///      Everything an attacker would want to control is fixed at construction: the route,
///      the venue, the pools the TWAP is read from, the window, and the band. A caller
///      supplies a minimum and a deadline, and those can only make the trade stricter.
contract UniswapV3TwapAdapter is IAcquisitionAdapter {
    using SafeERC20 for IERC20;

    address public immutable override inputToken;
    address public immutable override asset;
    ISwapRouter public immutable router;

    /// @notice Seconds of history the average is taken over.
    uint32 public immutable twapWindow;

    /// @notice How far spot may sit from the average, in ticks. One tick is one basis
    ///         point of price, so 200 is roughly 2%.
    int24 public immutable maxTickDeviation;

    /// @notice The route. Fixed here, never supplied by a caller.
    bytes public path;

    /// @dev The pools the path trades through, in order.
    IUniswapV3Pool[] private _pools;

    event Converted(uint256 amountIn, uint256 received, address indexed recipient);

    error ZeroAddress();
    error DeadlinePassed(uint256 deadline);
    error PathDoesNotStartWithInput();
    error PathDoesNotEndWithAsset();
    error PathTooShort();
    error NoPools();
    error PoolCountMismatch(uint256 hops, uint256 pools);
    error PoolDoesNotMatchPath(uint256 index);
    error WindowTooShort();
    error DeviationOutOfRange();
    error NothingToConvert();
    error InputNotFullySpent(uint256 expected, uint256 actual);
    error RouterReportedMoreThanArrived(uint256 reported, uint256 measured);
    error BelowMinimum(uint256 received, uint256 minOut);
    error NoHistory(uint256 poolIndex);
    error SpotFarFromAverage(uint256 poolIndex, int24 spotTick, int24 twapTick);
    error TradeMovedPriceTooFar(uint256 poolIndex, int24 spotTick, int24 twapTick);

    /// @param path_ the encoded route, `token | fee | token | fee | token ...`
    /// @param pools_ the pool for each hop of `path_`, in the same order
    constructor(
        address inputToken_,
        address asset_,
        address router_,
        bytes memory path_,
        address[] memory pools_,
        uint32 twapWindow_,
        int24 maxTickDeviation_
    ) {
        if (inputToken_ == address(0) || asset_ == address(0) || router_ == address(0)) {
            revert ZeroAddress();
        }
        if (path_.length < 43) revert PathTooShort(); // 20 + 3 + 20
        if ((path_.length - 20) % 23 != 0) revert PathTooShort();
        if (_addressAt(path_, 0) != inputToken_) revert PathDoesNotStartWithInput();
        if (_addressAt(path_, path_.length - 20) != asset_) revert PathDoesNotEndWithAsset();

        // A window short enough to sit inside one block is not an average, it is spot
        // with extra steps.
        if (twapWindow_ < 300) revert WindowTooShort();
        // A band at or past a 10x price move would wave anything through.
        if (maxTickDeviation_ <= 0 || maxTickDeviation_ > 23_000) revert DeviationOutOfRange();

        uint256 hops = (path_.length - 20) / 23;
        if (pools_.length == 0) revert NoPools();
        if (pools_.length != hops) revert PoolCountMismatch(hops, pools_.length);

        // Each pool must be the pool the path actually trades through. Without this the
        // average could be read from a deep pool while the swap runs through a shallow
        // one, which is the whole protection inverted.
        for (uint256 i; i < hops; ++i) {
            IUniswapV3Pool pool = IUniswapV3Pool(pools_[i]);
            address expectedIn = _addressAt(path_, i * 23);
            address expectedOut_ = _addressAt(path_, i * 23 + 23);
            uint24 expectedFee = _feeAt(path_, i * 23 + 20);

            (address t0, address t1) =
                expectedIn < expectedOut_ ? (expectedIn, expectedOut_) : (expectedOut_, expectedIn);
            if (pool.token0() != t0 || pool.token1() != t1 || pool.fee() != expectedFee) {
                revert PoolDoesNotMatchPath(i);
            }
            _pools.push(pool);
        }

        inputToken = inputToken_;
        asset = asset_;
        router = ISwapRouter(router_);
        path = path_;
        twapWindow = twapWindow_;
        maxTickDeviation = maxTickDeviation_;
    }

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }

    function poolAt(uint256 index) external view returns (address) {
        return address(_pools[index]);
    }

    /// @notice Average tick over `twapWindow`, and the current spot tick, for one hop.
    function ticksAt(uint256 index) public view returns (int24 twapTick, int24 spotTick) {
        IUniswapV3Pool pool = _pools[index];

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = twapWindow;
        secondsAgos[1] = 0;

        try pool.observe(secondsAgos) returns (int56[] memory cumulatives, uint160[] memory) {
            int56 delta = cumulatives[1] - cumulatives[0];
            twapTick = int24(delta / int56(uint56(twapWindow)));
            // Uniswap rounds the average toward negative infinity; matching that keeps
            // this consistent with every other reader of the same pool.
            if (delta < 0 && (delta % int56(uint56(twapWindow)) != 0)) twapTick--;
        } catch {
            // The pool has not recorded `twapWindow` seconds of history yet.
            revert NoHistory(index);
        }

        (, spotTick,,,,,) = pool.slot0();
    }

    /// @notice True when every pool on the route is currently within its band.
    function routeHealthy() external view returns (bool) {
        for (uint256 i; i < _pools.length; ++i) {
            (int24 twapTick, int24 spotTick) = ticksAt(i);
            if (_deviation(spotTick, twapTick) > maxTickDeviation) return false;
        }
        return true;
    }

    /// @inheritdoc IAcquisitionAdapter
    /// @dev The vault transfers the input in first; this spends exactly what arrived.
    function convert(uint256 amountIn, uint256 minOut, uint256 deadline, address recipient)
        external
        returns (uint256 received)
    {
        if (block.timestamp > deadline) revert DeadlinePassed(deadline);
        if (amountIn == 0) revert NothingToConvert();
        if (recipient == address(0)) revert ZeroAddress();

        // Refuse to trade into a pool that has already been pushed off its average.
        int24[] memory twapTicks = new int24[](_pools.length);
        for (uint256 i; i < _pools.length; ++i) {
            (int24 twapTick, int24 spotTick) = ticksAt(i);
            twapTicks[i] = twapTick;
            if (_deviation(spotTick, twapTick) > maxTickDeviation) {
                revert SpotFarFromAverage(i, spotTick, twapTick);
            }
        }

        uint256 inputBefore = IERC20(inputToken).balanceOf(address(this));
        uint256 assetBefore = IERC20(asset).balanceOf(recipient);

        IERC20(inputToken).forceApprove(address(router), amountIn);
        uint256 reported = router.exactInput(
            ISwapRouter.ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minOut
            })
        );
        IERC20(inputToken).forceApprove(address(router), 0);

        uint256 spent = inputBefore - IERC20(inputToken).balanceOf(address(this));
        if (spent != amountIn) revert InputNotFullySpent(amountIn, spent);

        received = IERC20(asset).balanceOf(recipient) - assetBefore;
        // Trust the measurement, not the venue's return value.
        if (reported > received) revert RouterReportedMoreThanArrived(reported, received);
        if (received < minOut) revert BelowMinimum(received, minOut);

        // And refuse to have moved the price further than the band allows. On a thin
        // market this is the check that stops one oversized order paying far above the
        // average for the tail of its own fill.
        for (uint256 i; i < _pools.length; ++i) {
            (, int24 spotAfter,,,,,) = _pools[i].slot0();
            if (_deviation(spotAfter, twapTicks[i]) > maxTickDeviation) {
                revert TradeMovedPriceTooFar(i, spotAfter, twapTicks[i]);
            }
        }

        emit Converted(amountIn, received, recipient);
    }

    function _deviation(int24 a, int24 b) private pure returns (int24) {
        return a >= b ? a - b : b - a;
    }

    function _addressAt(bytes memory data, uint256 offset) private pure returns (address result) {
        assembly {
            result := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }

    function _feeAt(bytes memory data, uint256 offset) private pure returns (uint24 result) {
        assembly {
            result := shr(232, mload(add(add(data, 0x20), offset)))
        }
    }
}
