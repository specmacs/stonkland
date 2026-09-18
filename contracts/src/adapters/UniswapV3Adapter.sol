// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAcquisitionAdapter} from "../interfaces/IAcquisitionAdapter.sol";
import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";
import {OracleGuard} from "../libraries/OracleGuard.sol";

interface ISwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/// @title UniswapV3Adapter
/// @notice Buys one reward asset along one fixed route.
///
/// @dev Everything an attacker would want to control is fixed at construction: the route,
///      the venue, both price feeds, the staleness window and the deviation ceiling. A
///      caller supplies a minimum and a deadline, and those can only make the trade
///      stricter -- the oracle floor applies underneath whatever they pass, so a caller
///      who asks for zero slippage protection still cannot be used to execute a bad fill.
///
///      That is what makes conversion safe to leave open to anyone, which is the point:
///      no operator's absence should be able to stop rewards moving.
///
///      A failed conversion leaves the funds where they were. Funds waiting are an
///      acceptable resting state, sometimes for days if the asset is thinly traded. A bad
///      conversion is not.
contract UniswapV3Adapter is IAcquisitionAdapter {
    using SafeERC20 for IERC20;
    using OracleGuard for IAggregatorV3;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    address public immutable override inputToken;
    address public immutable override asset;
    ISwapRouter public immutable router;

    /// @notice USD feed for the input token.
    IAggregatorV3 public immutable inputUsdFeed;
    /// @notice USD feed for the acquired asset.
    IAggregatorV3 public immutable assetUsdFeed;

    /// @notice Maximum age either feed may report.
    uint256 public immutable staleAfter;
    /// @notice How far below the oracle-implied output a fill may land.
    uint16 public immutable maxDeviationBps;

    /// @notice The route. Fixed here, never supplied by a caller.
    bytes public path;

    uint8 private immutable _inputDecimals;
    uint8 private immutable _assetDecimals;

    event Converted(uint256 amountIn, uint256 received, uint256 floor, address indexed recipient);

    error ZeroAddress();
    error DeadlinePassed(uint256 deadline);
    error PathDoesNotStartWithInput();
    error PathDoesNotEndWithAsset();
    error PathTooShort();
    error DeviationTooWide(uint16 bps);
    error NothingToConvert();
    error InputNotFullySpent(uint256 expected, uint256 actual);
    error BelowFloor(uint256 received, uint256 floor);
    error RouterReportedMoreThanArrived(uint256 reported, uint256 measured);

    constructor(
        address inputToken_,
        address asset_,
        address router_,
        bytes memory path_,
        address inputUsdFeed_,
        address assetUsdFeed_,
        uint256 staleAfter_,
        uint16 maxDeviationBps_
    ) {
        if (
            inputToken_ == address(0) || asset_ == address(0) || router_ == address(0)
                || inputUsdFeed_ == address(0) || assetUsdFeed_ == address(0)
        ) revert ZeroAddress();
        // A ceiling at or above 100% would be no ceiling at all.
        if (maxDeviationBps_ >= BPS_DENOMINATOR) revert DeviationTooWide(maxDeviationBps_);
        if (path_.length < 43) revert PathTooShort(); // 20 + 3 + 20

        if (_addressAt(path_, 0) != inputToken_) revert PathDoesNotStartWithInput();
        if (_addressAt(path_, path_.length - 20) != asset_) revert PathDoesNotEndWithAsset();

        inputToken = inputToken_;
        asset = asset_;
        router = ISwapRouter(router_);
        path = path_;
        inputUsdFeed = IAggregatorV3(inputUsdFeed_);
        assetUsdFeed = IAggregatorV3(assetUsdFeed_);
        staleAfter = staleAfter_;
        maxDeviationBps = maxDeviationBps_;
        _inputDecimals = IERC20Metadata(inputToken_).decimals();
        _assetDecimals = IERC20Metadata(asset_).decimals();
    }

    /// @inheritdoc IAcquisitionAdapter
    function expectedOut(uint256 amountIn) public view returns (uint256) {
        OracleGuard.Price memory inPrice = inputUsdFeed.readFresh(staleAfter);
        OracleGuard.Price memory outPrice = assetUsdFeed.readFresh(staleAfter);

        // amountIn * (inUsd / 10^inFeedDec) / (outUsd / 10^outFeedDec), rescaled from the
        // input's decimals to the asset's.
        uint256 numerator = amountIn * inPrice.value * (10 ** outPrice.decimals) * (10 ** _assetDecimals);
        uint256 denominator = outPrice.value * (10 ** inPrice.decimals) * (10 ** _inputDecimals);
        return numerator / denominator;
    }

    /// @inheritdoc IAcquisitionAdapter
    function floorOut(uint256 amountIn) public view returns (uint256) {
        return (expectedOut(amountIn) * (BPS_DENOMINATOR - maxDeviationBps)) / BPS_DENOMINATOR;
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

        uint256 floor = floorOut(amountIn);
        // The caller's minimum may tighten this. It can never loosen it.
        uint256 effectiveMin = minOut > floor ? minOut : floor;

        uint256 inputBefore = IERC20(inputToken).balanceOf(address(this));
        uint256 assetBefore = IERC20(asset).balanceOf(recipient);

        // Exactly what is needed, and nothing left standing afterwards.
        IERC20(inputToken).forceApprove(address(router), amountIn);
        uint256 reported = router.exactInput(
            ISwapRouter.ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: effectiveMin
            })
        );
        IERC20(inputToken).forceApprove(address(router), 0);

        uint256 spent = inputBefore - IERC20(inputToken).balanceOf(address(this));
        if (spent != amountIn) revert InputNotFullySpent(amountIn, spent);

        received = IERC20(asset).balanceOf(recipient) - assetBefore;
        // Trust the measurement, not the venue's return value.
        if (reported > received) revert RouterReportedMoreThanArrived(reported, received);
        if (received < effectiveMin) revert BelowFloor(received, effectiveMin);

        emit Converted(amountIn, received, floor, recipient);
    }

    function _addressAt(bytes memory data, uint256 offset) private pure returns (address result) {
        assembly {
            result := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }
}
