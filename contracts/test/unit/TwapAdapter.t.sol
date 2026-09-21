// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UniswapV3TwapAdapter} from "../../src/adapters/UniswapV3TwapAdapter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockWETH} from "../mocks/MockVenue.sol";
import {MockV3Pool, MockImpactRouter} from "../mocks/MockV3Pool.sol";

/// @notice The guards on the adapter that prices a trade against the route's own average.
contract TwapAdapterTest is Test {
    MockWETH internal weth;
    MockERC20 internal asset;
    MockV3Pool internal pool;
    MockImpactRouter internal router;
    UniswapV3TwapAdapter internal adapter;

    address internal recipient = makeAddr("revenueVault");
    uint32 internal constant WINDOW = 1_800; // 30 minutes
    int24 internal constant MAX_DEVIATION = 200; // ~2%
    uint24 internal constant FEE = 500;

    function setUp() public {
        vm.warp(1_700_000_000);
        weth = new MockWETH();
        asset = new MockERC20("Reward", "RW", 18);

        pool = new MockV3Pool(address(weth), address(asset), FEE, 1_000);
        router = new MockImpactRouter(20e18, pool);
        asset.mint(address(router), 1_000_000e18);

        adapter = _deploy(FEE, address(pool));
    }

    function _deploy(uint24 fee, address pool_) internal returns (UniswapV3TwapAdapter) {
        address[] memory pools = new address[](1);
        pools[0] = pool_;
        return new UniswapV3TwapAdapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), fee, address(asset)),
            pools,
            WINDOW,
            MAX_DEVIATION
        );
    }

    function _fund(uint256 amount) internal {
        vm.deal(address(this), amount);
        weth.deposit{value: amount}();
        weth.transfer(address(adapter), amount);
    }

    function test_readsTheAverageAndTheSpot() public view {
        (int24 twapTick, int24 spotTick) = adapter.ticksAt(0);
        assertEq(twapTick, 1_000);
        assertEq(spotTick, 1_000);
        assertTrue(adapter.routeHealthy());
    }

    function test_convertsWhenTheRouteIsHealthy() public {
        _fund(1e18);
        uint256 received = adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(received, 20e18);
        assertEq(asset.balanceOf(recipient), 20e18);
        assertEq(weth.allowance(address(adapter), address(router)), 0, "no standing allowance");
    }

    function test_refusesToTradeIntoAPoolPushedOffItsAverage() public {
        // Somebody moved spot well away from the pool's own 30-minute average.
        pool.setSpotTick(1_000 + MAX_DEVIATION + 1);
        _fund(1e18);

        vm.expectRevert(
            abi.encodeWithSelector(
                UniswapV3TwapAdapter.SpotFarFromAverage.selector, 0, int24(1_201), int24(1_000)
            )
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(weth.balanceOf(address(adapter)), 1e18, "funds stay put");
    }

    function test_refusesWhenItsOwnTradeWouldMoveThePriceTooFar() public {
        // The pool starts fine, but this order walks the book past the band. On a thin
        // market this is the realistic failure, not a clever manipulation.
        router.setTickImpact(MAX_DEVIATION + 50);
        _fund(1e18);

        vm.expectRevert(
            abi.encodeWithSelector(
                UniswapV3TwapAdapter.TradeMovedPriceTooFar.selector, 0, int24(1_250), int24(1_000)
            )
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(asset.balanceOf(recipient), 0, "nothing was bought");
    }

    function test_aTradeInsideTheBandIsAccepted() public {
        router.setTickImpact(MAX_DEVIATION - 10);
        _fund(1e18);
        uint256 received = adapter.convert(1e18, 0, block.timestamp + 60, recipient);
        assertEq(received, 20e18);
    }

    function test_deviationIsSymmetric() public {
        pool.setSpotTick(1_000 - MAX_DEVIATION - 1);
        _fund(1e18);
        vm.expectRevert(
            abi.encodeWithSelector(
                UniswapV3TwapAdapter.SpotFarFromAverage.selector, 0, int24(799), int24(1_000)
            )
        );
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_aPoolWithoutEnoughHistoryCannotBeTraded() public {
        pool.setHistoryMissing(true);
        _fund(1e18);
        vm.expectRevert(abi.encodeWithSelector(UniswapV3TwapAdapter.NoHistory.selector, 0));
        adapter.convert(1e18, 0, block.timestamp + 60, recipient);
    }

    function test_negativeAveragesRoundTheWayUniswapDoes() public {
        // Uniswap floors the average toward negative infinity; anything else would put
        // this adapter half a tick away from every other reader of the same pool.
        pool.setTwapTick(-500);
        pool.setSpotTick(-500);
        (int24 twapTick,) = adapter.ticksAt(0);
        assertEq(twapTick, -500);
        assertTrue(adapter.routeHealthy());
    }

    function test_callerMinimumStillApplies() public {
        _fund(1e18);
        vm.expectRevert(bytes("MockImpactRouter: Too little received"));
        adapter.convert(1e18, 21e18, block.timestamp + 60, recipient);
    }

    function test_expiredDeadlineIsRejected() public {
        _fund(1e18);
        vm.expectRevert(
            abi.encodeWithSelector(UniswapV3TwapAdapter.DeadlinePassed.selector, block.timestamp - 1)
        );
        adapter.convert(1e18, 0, block.timestamp - 1, recipient);
    }

    // --- construction ------------------------------------------------------------------

    function test_theQuotedPoolMustBeThePoolThePathTradesThrough() public {
        // A pool at a different fee tier is a different pool, with a different average.
        // Reading the deep pool while swapping through the shallow one is the protection
        // inverted, so the constructor refuses it.
        vm.expectRevert(abi.encodeWithSelector(UniswapV3TwapAdapter.PoolDoesNotMatchPath.selector, 0));
        _deploy(3_000, address(pool));

        MockERC20 other = new MockERC20("Other", "OTH", 18);
        MockV3Pool unrelated = new MockV3Pool(address(weth), address(other), FEE, 1_000);
        vm.expectRevert(abi.encodeWithSelector(UniswapV3TwapAdapter.PoolDoesNotMatchPath.selector, 0));
        _deploy(FEE, address(unrelated));
    }

    function test_rejectsAWindowShortEnoughToSitInsideABlock() public {
        address[] memory pools = new address[](1);
        pools[0] = address(pool);
        vm.expectRevert(UniswapV3TwapAdapter.WindowTooShort.selector);
        new UniswapV3TwapAdapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), FEE, address(asset)),
            pools,
            60,
            MAX_DEVIATION
        );
    }

    function test_rejectsABandThatWouldWaveAnythingThrough() public {
        address[] memory pools = new address[](1);
        pools[0] = address(pool);
        vm.expectRevert(UniswapV3TwapAdapter.DeviationOutOfRange.selector);
        new UniswapV3TwapAdapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), FEE, address(asset)),
            pools,
            WINDOW,
            int24(30_000)
        );
    }

    function test_everyHopNeedsItsOwnPool() public {
        MockERC20 mid = new MockERC20("Mid", "MID", 18);
        bytes memory twoHop =
            abi.encodePacked(address(weth), FEE, address(mid), FEE, address(asset));
        address[] memory onlyOne = new address[](1);
        onlyOne[0] = address(pool);

        vm.expectRevert(abi.encodeWithSelector(UniswapV3TwapAdapter.PoolCountMismatch.selector, 2, 1));
        new UniswapV3TwapAdapter(
            address(weth), address(asset), address(router), twoHop, onlyOne, WINDOW, MAX_DEVIATION
        );
    }

    function test_routeMustStartAndEndWhereItClaims() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        address[] memory pools = new address[](1);
        pools[0] = address(pool);

        vm.expectRevert(UniswapV3TwapAdapter.PathDoesNotStartWithInput.selector);
        new UniswapV3TwapAdapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(other), FEE, address(asset)),
            pools,
            WINDOW,
            MAX_DEVIATION
        );

        vm.expectRevert(UniswapV3TwapAdapter.PathDoesNotEndWithAsset.selector);
        new UniswapV3TwapAdapter(
            address(weth),
            address(asset),
            address(router),
            abi.encodePacked(address(weth), FEE, address(other)),
            pools,
            WINDOW,
            MAX_DEVIATION
        );
    }

    function test_hasNoSettersForAnythingThatMatters() public view {
        // The route, venue, pools, window and band are all immutable or write-once.
        (bool ok,) = address(adapter).staticcall(abi.encodeWithSignature("setPath(bytes)", hex"00"));
        assertFalse(ok);
        (ok,) = address(adapter).staticcall(abi.encodeWithSignature("setTwapWindow(uint32)", 60));
        assertFalse(ok);
        (ok,) = address(adapter).staticcall(abi.encodeWithSignature("owner()"));
        assertFalse(ok);
    }
}
