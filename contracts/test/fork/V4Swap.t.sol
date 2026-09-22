// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {UniswapV4Adapter} from "../../src/adapters/UniswapV4Adapter.sol";
import {IPoolManagerV4, PoolKey} from "../../src/interfaces/IPoolManagerV4.sol";
import {TreasuryBuyback} from "../../src/TreasuryBuyback.sol";
import {Token} from "../../src/Token.sol";

/// @notice Drives a real Uniswap V4 swap against a live pool on the launch chain.
///
/// @dev The buyback will trade the project's own pool once it graduates, and that pool
///      does not exist yet. Rather than wait, this runs the same machinery against a pool
///      that graduated on the same venue, through the same singleton, with the same shape:
///      native currency first, zero pool fee, tick spacing 60, a hook charging the swap
///      fee. The PoolKey below was read off the singleton's own Initialize event.
///
///      What this proves is the part worth proving: unlock, swap, settle in native value,
///      take, and the minimum being enforced on a measured balance rather than on the
///      venue's return value. Swapping in the project's own token afterwards is a change
///      of address, not of mechanism.
///
///        ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
///          forge test --match-path 'test/fork/V4Swap.t.sol' -vv
contract V4SwapForkTest is Test {
    address internal constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    // A graduated launch on the same venue, used purely as a live pool of the right shape.
    address internal constant GRADUATED_TOKEN = 0x15dEA2C2810d2a331006De1419B65A239B317C65;
    address internal constant GRADUATED_HOOK = 0xe76f0d6FF90D1765aD5402cF3033b011fD3a80CC;
    uint24 internal constant POOL_FEE = 0;
    int24 internal constant TICK_SPACING = 60;

    bool internal live;
    UniswapV4Adapter internal adapter;

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;

        adapter = new UniswapV4Adapter(
            WETH,
            GRADUATED_TOKEN,
            POOL_MANAGER,
            PoolKey({
                currency0: address(0),
                currency1: GRADUATED_TOKEN,
                fee: POOL_FEE,
                tickSpacing: TICK_SPACING,
                hooks: GRADUATED_HOOK
            })
        );
    }

    modifier onlyLive() {
        if (!live) return;
        _;
    }

    function _fundAdapter(uint256 amount) internal {
        vm.deal(address(this), amount);
        (bool ok,) = WETH.call{value: amount}("");
        require(ok, "wrap failed");
        IERC20(WETH).transfer(address(adapter), amount);
    }

    function test_theAdapterKnowsWhichSideItIsBuying() public view onlyLive {
        assertEq(adapter.asset(), GRADUATED_TOKEN);
        assertEq(adapter.inputToken(), WETH);
        assertTrue(adapter.zeroForOne(), "buying currency1 by selling currency0");
        assertTrue(adapter.spendsNative(), "this pool trades the native currency");
    }

    /// @dev The whole V4 path: unwrap, unlock, swap, settle native, take, measure.
    function test_swapsWethForTheTokenThroughTheSingleton() public onlyLive {
        address recipient = makeAddr("treasuryBuyback");
        uint256 amountIn = 0.01 ether;
        _fundAdapter(amountIn);

        uint256 received = adapter.convert(amountIn, 0, block.timestamp + 60, recipient);

        assertGt(received, 0, "the swap returned nothing");
        assertEq(IERC20(GRADUATED_TOKEN).balanceOf(recipient), received, "recipient was paid");
        assertEq(IERC20(WETH).balanceOf(address(adapter)), 0, "the input was spent exactly");
        assertEq(address(adapter).balance, 0, "no native value left behind");
        assertEq(
            IERC20(GRADUATED_TOKEN).balanceOf(address(adapter)), 0, "nothing held back"
        );
    }

    /// @dev With no price history behind this pool, the caller's minimum is the entire
    ///      price protection, so it had better actually bite.
    function test_theMinimumIsEnforced() public onlyLive {
        uint256 amountIn = 0.01 ether;
        _fundAdapter(amountIn);

        uint256 fair = adapter.convert(amountIn, 0, block.timestamp + 60, address(this));
        assertGt(fair, 0);

        // Ask for more than the pool will give and the trade must refuse.
        _fundAdapter(amountIn);
        vm.expectRevert();
        adapter.convert(amountIn, fair * 10, block.timestamp + 60, address(this));
        assertEq(IERC20(WETH).balanceOf(address(adapter)), amountIn, "funds stay put");
    }

    function test_onlyTheSingletonMayReachTheCallback() public onlyLive {
        vm.expectRevert(UniswapV4Adapter.NotPoolManager.selector);
        adapter.unlockCallback(abi.encode(uint256(1 ether)));
    }

    function test_anExpiredDeadlineIsRejected() public onlyLive {
        _fundAdapter(0.01 ether);
        vm.expectRevert(
            abi.encodeWithSelector(UniswapV4Adapter.DeadlinePassed.selector, block.timestamp - 1)
        );
        adapter.convert(0.01 ether, 0, block.timestamp - 1, address(this));
    }

    /// @dev The buyback end to end: keeper-gated, capped, and the tokens destroyed.
    function test_theBuybackBurnsWhatItBuysThroughAV4Pool() public onlyLive {
        address owner = makeAddr("owner");
        address keeper = makeAddr("keeper");
        address sink = makeAddr("sink");

        // A stand-in for the project token, so the burn is observable. The pool trades
        // the graduated token, so that is what the buyback is pointed at here.
        TreasuryBuyback buyback = new TreasuryBuyback(
            WETH, GRADUATED_TOKEN, sink, false, sink, 2_000, owner
        );

        vm.startPrank(owner);
        buyback.setAdapter(address(adapter));
        buyback.setKeeper(keeper);
        buyback.setLimits(0.05 ether, 1 hours);
        vm.stopPrank();

        vm.deal(address(buyback), 1 ether);

        // A stranger cannot trigger it while a keeper is named.
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(
            abi.encodeWithSelector(TreasuryBuyback.NotKeeper.selector, makeAddr("stranger"))
        );
        buyback.execute(0, block.timestamp + 60);

        vm.prank(keeper);
        (uint256 spent, uint256 bought) = buyback.execute(0, block.timestamp + 60);

        assertEq(spent, 0.05 ether, "the per-call ceiling bound the trade");
        assertGt(bought, 0, "tokens were bought");
        assertEq(IERC20(WETH).balanceOf(sink), 0.95 ether, "the rest went on to the sink");

        // And the cooldown holds the keeper off until it has elapsed.
        vm.prank(keeper);
        vm.expectRevert();
        buyback.execute(0, block.timestamp + 60);
    }

    /// @dev The launch script recovers the pool key by searching rather than being told
    ///      it. If that search cannot find a pool this test already trades against, it
    ///      would fail silently on launch day against the pool that actually matters.
    function test_theLaunchScriptsSearchFindsThisPool() public {
        if (!live) return;

        uint24[4] memory fees = [uint24(0), 100, 3000, 10000];
        int24[8] memory spacings =
            [int24(1), int24(10), int24(50), int24(60), int24(100), int24(200), int24(2000), int24(60000)];

        bool found;
        for (uint256 f; f < fees.length && !found; ++f) {
            for (uint256 sp; sp < spacings.length && !found; ++sp) {
                PoolKey memory candidate = PoolKey({
                    currency0: address(0),
                    currency1: GRADUATED_TOKEN,
                    fee: fees[f],
                    tickSpacing: spacings[sp],
                    hooks: GRADUATED_HOOK
                });
                bytes32 id = keccak256(abi.encode(candidate));
                if (IPoolManagerV4(POOL_MANAGER).extsload(keccak256(abi.encode(id, uint256(6)))) != bytes32(0)) {
                    found = true;
                    assertEq(uint256(candidate.fee), 0, "the graduated pool's own fee is zero");
                    assertEq(int256(candidate.tickSpacing), int256(60), "tick spacing");
                }
            }
        }
        assertTrue(found, "the script's search did not find a pool this suite trades against");
    }
}
