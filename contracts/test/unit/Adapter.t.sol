// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {UniswapV3Adapter} from "../../src/adapters/UniswapV3Adapter.sol";
import {OracleGuard} from "../../src/libraries/OracleGuard.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockWETH, MockAggregator, MockSwapRouter} from "../mocks/MockVenue.sol";

/// @notice The conversion guards. Every one of these exists because a bad price looks
///         exactly like a good one from inside the contract.
contract AdapterTest is Test {
    MockWETH internal weth;
    MockERC20 internal asset;
    MockSwapRouter internal router;
    MockAggregator internal wethUsd;
    MockAggregator internal assetUsd;
    UniswapV3Adapter internal adapter;

    address internal recipient = makeAddr("revenueVault");
    uint256 internal constant STALE_AFTER = 1 hours;
    uint16 internal constant MAX_DEVIATION_BPS = 200; // 2%

    function setUp() public {
        vm.warp(1_700_000_000);
        weth = new MockWETH();
        asset = new MockERC20("Reward", "RW", 18);

        // 1 WETH = $3000, 1 asset = $150, so 1 WETH buys 20 assets.
        wethUsd = new MockAggregator(8, 3_000e8);
        assetUsd = new MockAggregator(8, 150e8);

        router = new MockSwapRouter(20e18); // 20 out per 1 in, exactly on the oracle
        asset.mint(address(router), 1_000_000e18);

        adapter = new UniswapV3Adapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), uint24(3000), address(asset)),
            address(wethUsd),
            address(assetUsd),
            STALE_AFTER,
            MAX_DEVIATION_BPS
        );
    }

    function _fundAdapter(uint256 amount) internal {
        vm.deal(address(this), amount);
        weth.deposit{value: amount}();
        weth.transfer(address(adapter), amount);
    }

    function test_oracleMathMatchesTheFeeds() public view {
        assertEq(adapter.expectedOut(1e18), 20e18);
        assertEq(adapter.floorOut(1e18), (20e18 * 9_800) / 10_000);
    }

    function test_convertsAndClearsItsAllowance() public {
        _fundAdapter(1e18);
        uint256 received = adapter.convert(1e18, 0, block.timestamp + 60, recipient);

        assertEq(received, 20e18);
        assertEq(asset.balanceOf(recipient), 20e18);
        assertEq(
            weth.allowance(address(adapter), address(router)), 0, "no standing allowance is left"
        );
        assertEq(weth.balanceOf(address(adapter)), 0, "the input was spent exactly");
    }

    function test_aFillBelowTheOracleFloorIsRejected() public {
        router.setRate(19e18); // 5% below oracle, past the 2% ceiling
        _fundAdapter(1e18);

        vm.expectRevert(bytes("MockSwapRouter: Too little received"));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(asset.balanceOf(recipient), 0, "funds stay put rather than trading badly");
    }

    function test_aCallerCannotLoosenTheFloor() public {
        router.setRate(19e18);
        _fundAdapter(1e18);

        // minOut of zero is the loosest thing a caller can ask for, and it changes nothing.
        vm.expectRevert(bytes("MockSwapRouter: Too little received"));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_aCallerCanTightenTheFloor() public {
        _fundAdapter(1e18);
        vm.expectRevert(bytes("MockSwapRouter: Too little received"));
        adapter.convert(1e18, 21e18, block.timestamp + 60, recipient); // stricter than oracle
    }

    function test_aFillInsideTheDeviationBandIsAccepted() public {
        router.setRate(19.7e18); // 1.5% below oracle, inside the 2% band
        _fundAdapter(1e18);
        uint256 received = adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(received, 19.7e18);
    }

    // --- oracle failure modes ----------------------------------------------------------

    function test_staleOracleIsRejected() public {
        _fundAdapter(1e18);
        vm.warp(block.timestamp + STALE_AFTER + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                OracleGuard.StaleAnswer.selector,
                block.timestamp - STALE_AFTER - 1,
                STALE_AFTER + 1,
                STALE_AFTER
            )
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_zeroAnswerIsRejected() public {
        assetUsd.setAnswer(0);
        _fundAdapter(1e18);
        vm.expectRevert(abi.encodeWithSelector(OracleGuard.NonPositiveAnswer.selector, int256(0)));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_negativeAnswerIsRejected() public {
        wethUsd.setAnswer(-1);
        _fundAdapter(1e18);
        vm.expectRevert(abi.encodeWithSelector(OracleGuard.NonPositiveAnswer.selector, int256(-1)));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_incompleteRoundIsRejected() public {
        assetUsd.setIncomplete();
        _fundAdapter(1e18);
        vm.expectRevert(
            abi.encodeWithSelector(OracleGuard.IncompleteRound.selector, uint80(2), uint80(1))
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_aTimestampAheadOfTheBlockIsRejected() public {
        wethUsd.setUpdatedAt(block.timestamp + 1);
        _fundAdapter(1e18);
        vm.expectRevert(
            abi.encodeWithSelector(OracleGuard.FutureAnswer.selector, block.timestamp + 1)
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    // --- venue failure modes -----------------------------------------------------------

    function test_aRouteWithNoLiquidityLeavesTheFundsPending() public {
        router.setNoLiquidity(true);
        _fundAdapter(1e18);

        vm.expectRevert(bytes("MockSwapRouter: no liquidity on route"));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);

        assertEq(weth.balanceOf(address(adapter)), 1e18, "waiting is an acceptable resting state");
    }

    function test_anExpiredDeadlineIsRejected() public {
        _fundAdapter(1e18);
        vm.expectRevert(
            abi.encodeWithSelector(UniswapV3Adapter.DeadlinePassed.selector, block.timestamp - 1)
        );
        adapter.convert(1e18, 0, block.timestamp - 1, recipient);
    }

    // --- construction ------------------------------------------------------------------

    function test_theRouteIsFixedAtConstructionAndValidated() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);

        vm.expectRevert(UniswapV3Adapter.PathDoesNotStartWithInput.selector);
        new UniswapV3Adapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(other), uint24(3000), address(asset)),
            address(wethUsd),
            address(assetUsd),
            STALE_AFTER,
            MAX_DEVIATION_BPS
        );

        vm.expectRevert(UniswapV3Adapter.PathDoesNotEndWithAsset.selector);
        new UniswapV3Adapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), uint24(3000), address(other)),
            address(wethUsd),
            address(assetUsd),
            STALE_AFTER,
            MAX_DEVIATION_BPS
        );

        // There is no setter for the route, the venue, the feeds or the deviation band.
        (bool ok,) = address(adapter).call(abi.encodeWithSignature("setPath(bytes)", hex"00"));
        assertFalse(ok);
        (ok,) = address(adapter).call(abi.encodeWithSignature("setRouter(address)", address(1)));
        assertFalse(ok);
    }

    function test_aDeviationCeilingOfAHundredPercentIsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(UniswapV3Adapter.DeviationTooWide.selector, uint16(10_000)));
        new UniswapV3Adapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), uint24(3000), address(asset)),
            address(wethUsd),
            address(assetUsd),
            STALE_AFTER,
            10_000
        );
    }

    function test_assetDecimalsAreRespected() public {
        MockERC20 sixDecimals = new MockERC20("Six", "SIX", 6);
        MockSwapRouter r = new MockSwapRouter(20e6);
        sixDecimals.mint(address(r), 1_000_000e6);

        UniswapV3Adapter a = new UniswapV3Adapter(
            address(weth),
            address(sixDecimals),
            address(r),
            abi.encodePacked(address(weth), uint24(3000), address(sixDecimals)),
            address(wethUsd),
            address(assetUsd),
            STALE_AFTER,
            MAX_DEVIATION_BPS
        );
        assertEq(a.expectedOut(1e18), 20e6, "priced in the asset's own decimals");
    }
}
