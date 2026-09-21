// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUniswapV3Pool} from "../../src/interfaces/IUniswapV3Pool.sol";
import {ISwapRouter} from "../../src/adapters/UniswapV3Adapter.sol";

/// @dev Local test double only. Models the two things the TWAP adapter reads: where the
///      pool is now, and where it has been on average.
contract MockV3Pool is IUniswapV3Pool {
    address public token0;
    address public token1;
    uint24 public fee;

    int24 public twapTick;
    int24 public spotTick;
    bool public historyMissing;

    constructor(address tokenA, address tokenB, uint24 fee_, int24 startTick) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        fee = fee_;
        twapTick = startTick;
        spotTick = startTick;
    }

    function setSpotTick(int24 t) external {
        spotTick = t;
    }

    function setTwapTick(int24 t) external {
        twapTick = t;
    }

    /// @dev A pool younger than the window cannot answer, and says so by reverting.
    function setHistoryMissing(bool v) external {
        historyMissing = v;
    }

    function slot0()
        external
        view
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
        return (0, spotTick, 0, 1_000, 1_000, 0, true);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidity)
    {
        require(!historyMissing, "OLD");
        uint32 window = secondsAgos[0];
        tickCumulatives = new int56[](2);
        secondsPerLiquidity = new uint160[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = int56(twapTick) * int56(uint56(window));
    }
}

/// @dev A router that also moves the pool it trades through, so the adapter's
///      after-the-fact price-impact check has something real to catch.
contract MockImpactRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    uint256 public rate;
    MockV3Pool public pool;
    int24 public tickImpact;

    constructor(uint256 rate_, MockV3Pool pool_) {
        rate = rate_;
        pool = pool_;
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    /// @notice How far a swap shifts the pool's spot tick.
    function setTickImpact(int24 t) external {
        tickImpact = t;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        require(block.timestamp <= params.deadline, "MockImpactRouter: expired");
        address tokenIn = _addressAt(params.path, 0);
        address tokenOut = _addressAt(params.path, params.path.length - 20);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "MockImpactRouter: Too little received");
        IERC20(tokenOut).safeTransfer(params.recipient, amountOut);

        if (tickImpact != 0) pool.setSpotTick(pool.spotTick() + tickImpact);
    }

    function _addressAt(bytes calldata data, uint256 offset) private pure returns (address) {
        return address(bytes20(data[offset:offset + 20]));
    }
}
