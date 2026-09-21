// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {UniswapV3TwapAdapter} from "../../src/adapters/UniswapV3TwapAdapter.sol";
import {IUniswapV3Pool} from "../../src/interfaces/IUniswapV3Pool.sol";

/// @notice Runs the reward-asset assumptions against the real chain rather than a mock.
///
/// @dev Skipped unless ROBINHOOD_RPC_URL is set, so a normal `forge test` stays offline:
///
///        ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
///          forge test --match-path 'test/fork/*'
///
///      Set ROBINHOOD_FORK_BLOCK to pin a block, which is what a real rehearsal should
///      do so that a run today and a run in six months disagree only about things that
///      actually changed. That needs an archive node: the public RPC keeps recent state
///      only, and rejects a pinned block with "historical state is not available". With
///      the variable unset, this forks at the head instead and stays useful for a quick
///      check at the cost of reproducibility.
contract RobinhoodChainForkTest is Test {
    uint256 internal constant CHAIN_ID = 4663;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    // The official Robinhood equity tokens, one per quarter. Note that impostor tokens
    // carrying these exact symbols also trade on this chain; these are the addresses, and
    // the addresses are what matter.
    address internal constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address internal constant GOOGL = 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3;
    address internal constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address internal constant META = 0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35;

    // Their deepest WETH pools.
    address internal constant NVDA_WETH_500 = 0x62AB521f71431f78ac374CdbadC6cda3c8916b6C;
    address internal constant GOOGL_WETH_10000 = 0x8c2B4303fA0B99d07A5D3E9411497A277e65b673;
    address internal constant AAPL_WETH_500 = 0x8bb3514e2204E1cDF3Ac149EFEe7Ff04D91B719f;
    address internal constant META_WETH_3000 = 0xa4BdB396a69617eb7F70E2cc1EF526f7340b1B0d;

    uint32 internal constant WINDOW = 1_800;
    int24 internal constant MAX_DEVIATION = 200;

    bool internal live;

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        uint256 pinned = vm.envOr("ROBINHOOD_FORK_BLOCK", uint256(0));
        if (pinned == 0) {
            vm.createSelectFork(rpc);
        } else {
            vm.createSelectFork(rpc, pinned);
        }
        live = true;
    }

    modifier onlyLive() {
        if (!live) return;
        _;
    }

    function _assets() internal pure returns (address[4] memory) {
        return [NVDA, GOOGL, AAPL, META];
    }

    function _pools() internal pure returns (address[4] memory) {
        return [NVDA_WETH_500, GOOGL_WETH_10000, AAPL_WETH_500, META_WETH_3000];
    }

    function test_theChainIsWhatWeThinkItIs() public view onlyLive {
        assertEq(block.chainid, CHAIN_ID);
    }

    function test_allFourRewardAssetsAreEighteenDecimalTokens() public view onlyLive {
        address[4] memory assets = _assets();
        string[4] memory symbols = ["NVDA", "GOOGL", "AAPL", "META"];

        for (uint256 i; i < assets.length; ++i) {
            assertGt(assets[i].code.length, 0, "no contract at this address");
            assertEq(IERC20Metadata(assets[i]).symbol(), symbols[i], "symbol");
            assertEq(IERC20Metadata(assets[i]).decimals(), 18, "decimals");
            assertGt(IERC20(assets[i]).totalSupply(), 0, "supply");
        }
        // Worth pinning: the deepest quote asset on this chain is not 18 decimals, and
        // any route priced through it has to respect that.
        assertEq(IERC20Metadata(USDG).decimals(), 6, "USDG decimals");
    }

    /// @dev The question that decides whether this design can work at all. A tokenized
    ///      equity that restricts transfers to verified holders cannot be held by the
    ///      distributor or received by a card owner, and no care taken elsewhere in the
    ///      protocol changes that.
    function test_aContractCanHoldAndForwardEveryRewardAsset() public onlyLive {
        address[4] memory assets = _assets();
        address[4] memory holders = _pools();

        for (uint256 i; i < assets.length; ++i) {
            address custodian = address(new Holder());
            address payee = address(new Holder());

            uint256 amount = IERC20(assets[i]).balanceOf(holders[i]) / 100;
            assertGt(amount, 0, "the pool holds nothing to probe with");

            vm.prank(holders[i]);
            IERC20(assets[i]).transfer(custodian, amount);
            assertEq(IERC20(assets[i]).balanceOf(custodian), amount, "a contract cannot hold it");

            Holder(custodian).forward(assets[i], payee, amount);
            assertEq(IERC20(assets[i]).balanceOf(payee), amount, "a contract cannot pass it on");
        }
    }

    /// @dev There is no Chainlink or Pyth deployment on this chain, so the pools' own
    ///      history is the price reference. This checks there is enough of it to use.
    function test_everyRouteHasThirtyMinutesOfHistory() public view onlyLive {
        address[4] memory pools = _pools();

        for (uint256 i; i < pools.length; ++i) {
            (,,, uint16 cardinality,,,) = IUniswapV3Pool(pools[i]).slot0();
            assertGt(cardinality, 1, "pool records no history at all");

            uint32[] memory secondsAgos = new uint32[](2);
            secondsAgos[0] = WINDOW;
            secondsAgos[1] = 0;
            IUniswapV3Pool(pools[i]).observe(secondsAgos);
        }
    }

    function test_theAdapterReadsLivePoolsAndAgreesWithThem() public onlyLive {
        address[4] memory assets = _assets();
        address[4] memory pools = _pools();
        uint24[4] memory fees = [uint24(500), 10_000, 500, 3_000];

        for (uint256 i; i < assets.length; ++i) {
            address[] memory poolList = new address[](1);
            poolList[0] = pools[i];

            UniswapV3TwapAdapter adapter = new UniswapV3TwapAdapter(
                WETH,
                assets[i],
                address(0xdead), // the router is never called in this test
                abi.encodePacked(WETH, fees[i], assets[i]),
                poolList,
                WINDOW,
                MAX_DEVIATION
            );

            (int24 twapTick, int24 spotTick) = adapter.ticksAt(0);
            (, int24 poolTick,,,,,) = IUniswapV3Pool(pools[i]).slot0();
            assertEq(spotTick, poolTick, "spot disagrees with the pool");
            assertTrue(twapTick != 0, "average read back as zero");
        }
    }

    /// @dev Reports how far each pool sits from its own average at the forked block, so
    ///      the band is chosen from how these markets actually behave rather than a guess.
    function test_reportDeviationAtTheForkedBlock() public onlyLive {
        address[4] memory assets = _assets();
        address[4] memory pools = _pools();
        uint24[4] memory fees = [uint24(500), 10_000, 500, 3_000];
        string[4] memory names = ["NVDA", "GOOGL", "AAPL", "META"];

        for (uint256 i; i < assets.length; ++i) {
            address[] memory poolList = new address[](1);
            poolList[0] = pools[i];

            UniswapV3TwapAdapter adapter = new UniswapV3TwapAdapter(
                WETH,
                assets[i],
                address(0xdead),
                abi.encodePacked(WETH, fees[i], assets[i]),
                poolList,
                WINDOW,
                MAX_DEVIATION
            );

            (int24 twapTick, int24 spotTick) = adapter.ticksAt(0);
            int24 deviation = spotTick >= twapTick ? spotTick - twapTick : twapTick - spotTick;
            emit log_named_string("pool", names[i]);
            emit log_named_int("  30m average tick", twapTick);
            emit log_named_int("  spot tick", spotTick);
            emit log_named_int("  deviation (ticks, 1 tick ~ 1bp)", deviation);
            emit log_named_string(
                "  inside the 200-tick band", adapter.routeHealthy() ? "yes" : "NO"
            );
        }
    }
}

/// @dev Stands in for the distributor, and for a card owner that happens to be a contract.
contract Holder {
    function forward(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }
}
