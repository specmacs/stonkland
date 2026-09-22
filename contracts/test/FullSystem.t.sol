// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SystemDeployer, DeployConfig, Deployment} from "../script/SystemDeployer.sol";
import {DeploymentChecks} from "../script/DeploymentChecks.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {TreasuryBuyback} from "../src/TreasuryBuyback.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";
import {OracleGuard} from "../src/libraries/OracleGuard.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockWETH, MockAggregator, MockSwapRouter, RefusingTreasury} from "./mocks/MockVenue.sol";
import {RejectingHolder} from "./mocks/RejectingHolder.sol";

/// @notice Trades in, rewards out, through the deployment the runbook actually produces.
contract FullSystemTest is Test {
    uint256 internal constant EDITION = 1;
    uint256 internal constant MINT_BURN = 100_000e18;

    address internal owner = makeAddr("owner");
    address internal treasurySink = makeAddr("treasurySink");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    Deployment internal d;
    MockWETH internal weth;
    MockERC20[4] internal assets;
    MockSwapRouter[4] internal routers;
    UniswapV3Adapter[4] internal adapters;
    MockAggregator internal wethUsd;
    MockAggregator internal assetUsd;

    function setUp() public {
        vm.warp(1_700_000_000);
        weth = new MockWETH();
        wethUsd = new MockAggregator(8, 3_000e8);
        assetUsd = new MockAggregator(8, 150e8);

        address[4] memory assetAddrs;
        for (uint8 q; q < 4; ++q) {
            assets[q] = new MockERC20(string.concat("Reward", vm.toString(q)), "RW", 18);
            assetAddrs[q] = address(assets[q]);
        }

        d = SystemDeployer.deploy(
            DeployConfig({
                tokenName: "StonkTown",
                tokenSymbol: "TOWN",
                tokenRecipient: address(this),
                nftName: "StonkTown Property Card",
                nftSymbol: "CARD",
                owner: owner,
                treasurySink: treasurySink,
                burnsBought: true,
                buybackRecipient: address(0),
                buybackBps: 2_000,
                weth: address(weth),
                feeEscrow: address(0),
                weightMultiplierBps: 12_500,
                rewardAssets: assetAddrs,
                imageBaseURI: "https://example.invalid/art/level-",
                externalBaseURI: "https://example.invalid/card/"
            }),
            address(this)
        );

        // Routes, wired after deployment because an adapter is the one swappable piece.
        vm.startPrank(owner);
        for (uint8 q; q < 4; ++q) {
            routers[q] = new MockSwapRouter(20e18);
            assets[q].mint(address(routers[q]), 10_000_000e18);
            adapters[q] = new UniswapV3Adapter(
                address(weth),
                address(assets[q]),
                address(routers[q]),
                abi.encodePacked(address(weth), uint24(3000), address(assets[q])),
                address(wethUsd),
                address(assetUsd),
                1 hours,
                200
            );
            d.revenueVault.setAdapter(EDITION, q, address(assets[q]), address(adapters[q]));
        }
        d.minter.unpause(); // launch
        vm.stopPrank();
    }

    function _mint(address who, uint8 quarter) internal returns (uint256 id) {
        d.token.transfer(who, MINT_BURN);
        vm.startPrank(who);
        d.token.approve(address(d.minter), MINT_BURN);
        id = d.minter.mint(quarter);
        vm.stopPrank();
    }

    function test_deploymentPassesItsOwnPublishedChecks() public {
        DeployConfig memory c = _config();
        Deployment memory fresh = SystemDeployer.deploy(c, address(this));
        // The same check the runbook runs before pointing the frontend at a deployment.
        new DeploymentChecks().check(c, fresh);
    }

    function test_deploymentHandsOverEveryKeyAndLaunchesPaused() public {
        Deployment memory fresh = SystemDeployer.deploy(_config(), address(this));

        assertEq(fresh.nft.owner(), owner);
        assertEq(fresh.registry.owner(), owner);
        assertEq(fresh.minter.owner(), owner);
        assertEq(fresh.manager.owner(), owner);
        assertEq(fresh.revenueVault.owner(), owner);
        assertEq(fresh.buyback.owner(), owner);
        assertEq(fresh.renderer.owner(), owner);

        assertTrue(fresh.minter.paused(), "minting opens by unpausing, which is the launch");
        assertEq(fresh.token.totalSupply(), 1_000_000_000e18);
        assertEq(fresh.nft.MAX_SUPPLY(), 400);
    }

    function test_oneTimeLinksCannotBeRedoneByTheNewOwner() public {
        vm.startPrank(owner);
        vm.expectRevert();
        d.nft.linkMinter(address(0xdead));
        vm.expectRevert();
        d.nft.linkSettlementHook(address(0xdead));
        vm.expectRevert();
        d.revenueVault.linkDistributor(address(0xdead));
        vm.stopPrank();
    }

    function test_tradesInRewardsOut() public {
        uint256 a = _mint(alice, 0);
        _mint(bob, 0);

        // A sweep of trading fees arrives at the router in native value.
        vm.deal(address(d.feeRouter), 100 ether);

        // 1. Anyone splits it.
        vm.prank(makeAddr("anyone"));
        (uint256 toRewards, uint256 toTreasury) = d.feeRouter.distribute();
        assertEq(toTreasury, 33.33 ether);
        assertEq(toRewards, 66.67 ether);
        assertEq(weth.balanceOf(address(d.streamVault)), toRewards);

        // 2. It streams over 300 seconds rather than landing in one moment.
        assertEq(d.streamVault.releasable(), 0);
        vm.warp(block.timestamp + 300);
        assertApproxEqAbs(d.streamVault.releasable(), toRewards, 1e6);

        vm.prank(makeAddr("anyone"));
        uint256 released = d.streamVault.release();
        assertApproxEqAbs(released, toRewards, 1e6);

        // 3. Anyone allocates it across editions by weight, then across quarters.
        vm.prank(makeAddr("anyone"));
        uint256 assigned = d.revenueVault.allocate();
        assertApproxEqAbs(assigned, released, 4);
        uint256 perQuarter = d.revenueVault.quarterPending(EDITION, 0);
        assertApproxEqAbs(perQuarter, released / 4, 1e6);
        assertApproxEqAbs(d.revenueVault.quarterPending(EDITION, 3), released / 4, 1e6);

        // 4. Anyone converts a quarter into that quarter's own asset.
        uint256[] memory minOuts = new uint256[](1);
        vm.prank(makeAddr("anyone"));
        d.revenueVault.processQuarter(EDITION, 0, minOuts, block.timestamp + 60);

        assertEq(d.revenueVault.quarterPending(EDITION, 0), 0);
        uint256 deposited = d.distributor.totalDeposited(EDITION, address(assets[0]), 0);
        assertApproxEqAbs(deposited, (perQuarter * 20), 1e12);

        // 5. And a holder claims their relative share of what was actually deposited.
        uint256 pendingA = d.distributor.pendingOf(EDITION, address(assets[0]), 0, a, 125);
        assertApproxEqAbs(pendingA, deposited / 2, 2, "two equal houses");

        vm.prank(alice);
        d.distributor.claimQuarter(EDITION, 0, 0, 0);
        assertEq(assets[0].balanceOf(alice), pendingA);
    }

    function test_aFailedRouteStrandsOnlyItsOwnQuarter() public {
        _mint(alice, 0);
        _mint(bob, 1);

        vm.deal(address(d.feeRouter), 100 ether);
        d.feeRouter.distribute();
        vm.warp(block.timestamp + 300);
        d.streamVault.release();
        d.revenueVault.allocate();

        routers[0].setNoLiquidity(true); // quarter 0's venue goes dry

        uint256[] memory minOuts = new uint256[](1);
        vm.expectRevert(bytes("MockSwapRouter: no liquidity on route"));
        d.revenueVault.processQuarter(EDITION, 0, minOuts, block.timestamp + 60);

        // Quarter 0's WETH is still pending, untouched and still its own.
        assertGt(d.revenueVault.quarterPending(EDITION, 0), 0);

        // Quarter 1 converts normally. Nothing about quarter 0's problem reached it.
        d.revenueVault.processQuarter(EDITION, 1, minOuts, block.timestamp + 60);
        assertEq(d.revenueVault.quarterPending(EDITION, 1), 0);
        assertGt(d.distributor.totalDeposited(EDITION, address(assets[1]), 1), 0);
        assertEq(d.distributor.totalDeposited(EDITION, address(assets[0]), 0), 0);

        // Pending WETH is a comfortable resting state, for days if the asset is thin.
        routers[0].setNoLiquidity(false);
        vm.warp(block.timestamp + 3 days);

        // Liquidity alone is not enough: a days-old price is refused outright.
        uint256 lastPriced = wethUsd.updatedAt();
        vm.expectRevert(
            abi.encodeWithSelector(
                OracleGuard.StaleAnswer.selector, lastPriced, block.timestamp - lastPriced, 1 hours
            )
        );
        d.revenueVault.processQuarter(EDITION, 0, minOuts, block.timestamp + 60);
        assertGt(d.revenueVault.quarterPending(EDITION, 0), 0, "still waiting, still its own");

        // With a fresh price and liquidity back, it goes through.
        wethUsd.setAnswer(3_000e8);
        assetUsd.setAnswer(150e8);
        d.revenueVault.processQuarter(EDITION, 0, minOuts, block.timestamp + 60);
        assertGt(d.distributor.totalDeposited(EDITION, address(assets[0]), 0), 0);
    }

    function test_cardRoyaltiesFlowThroughTheSamePipeline() public {
        _mint(alice, 2);

        (address royaltyReceiver, uint256 royaltyAmount) = d.nft.royaltyInfo(1, 10 ether);
        assertEq(royaltyReceiver, address(d.royaltyRouter), "royalties are routed into rewards");
        assertEq(royaltyAmount, 0.5 ether, "500 bps");

        // A marketplace pays the royalty in native value.
        vm.deal(address(d.royaltyRouter), 0.5 ether);
        vm.prank(makeAddr("anyone"));
        d.royaltyRouter.forward();
        assertEq(weth.balanceOf(address(d.revenueVault)), 0.5 ether);

        d.revenueVault.allocate();
        uint256[] memory minOuts = new uint256[](1);
        d.revenueVault.processQuarter(EDITION, 2, minOuts, block.timestamp + 60);
        assertGt(d.distributor.totalDeposited(EDITION, address(assets[2]), 2), 0);
    }

    function test_treasuryBuybackBurnsWhatItBuysAndForwardsTheRest() public {
        UniswapV3Adapter tokenAdapter;
        MockSwapRouter tokenRouter = new MockSwapRouter(1_000e18);
        MockAggregator tokenUsd = new MockAggregator(8, 3e8); // $3 per token
        d.token.transfer(address(tokenRouter), 100_000_000e18);

        tokenAdapter = new UniswapV3Adapter(
            address(weth),
            address(d.token),
            address(tokenRouter),
            abi.encodePacked(address(weth), uint24(3000), address(d.token)),
            address(wethUsd),
            address(tokenUsd),
            1 hours,
            200
        );

        vm.prank(owner);
        d.buyback.setAdapter(address(tokenAdapter));

        vm.deal(address(d.buyback), 10 ether);
        uint256 supplyBefore = d.token.totalSupply();

        vm.prank(makeAddr("anyone"));
        (uint256 spent, uint256 bought) = d.buyback.execute(0, block.timestamp + 60);

        assertEq(spent, 2 ether, "2000 bps of the treasury share");
        assertEq(bought, 2_000e18);

        // Bought and destroyed, not parked somewhere it could be sold again.
        assertTrue(d.buyback.burnsBought());
        assertEq(d.token.totalSupply(), supplyBefore - bought, "supply fell by what was bought");
        assertEq(d.token.balanceOf(address(d.buyback)), 0, "nothing held back");
        assertEq(d.token.balanceOf(treasurySink), 0, "the treasury never receives them");
        assertEq(weth.balanceOf(treasurySink), 8 ether, "the remainder goes on to the sink");
    }

    /// @dev A launch trades on a bonding curve before it graduates into a pool, so there
    ///      is nothing to buy the token against until it does. Treasury revenue has to
    ///      keep moving in the meantime.
    function test_withNoRouteTheBuybackForwardsEverythingInsteadOfReverting() public {
        assertEq(address(d.buyback.adapter()), address(0), "no route wired yet");

        vm.deal(address(d.buyback), 10 ether);
        vm.prank(makeAddr("anyone"));
        (uint256 spent, uint256 bought) = d.buyback.execute(0, block.timestamp + 60);

        assertEq(spent, 0);
        assertEq(bought, 0);
        assertEq(weth.balanceOf(treasurySink), 10 ether, "all of it went on to the sink");
        assertEq(d.token.balanceOf(address(d.buyback)), 0);
    }

    function test_aKeeperCanBeNamedAndLaterStoodDown() public {
        address keeper = makeAddr("keeper");
        address stranger = makeAddr("stranger");

        vm.startPrank(owner);
        d.buyback.setKeeper(keeper);
        d.buyback.setLimits(1 ether, 1 hours);
        vm.stopPrank();

        assertTrue(d.buyback.canExecute(keeper));
        assertFalse(d.buyback.canExecute(stranger));

        vm.deal(address(d.buyback), 5 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TreasuryBuyback.NotKeeper.selector, stranger));
        d.buyback.execute(0, block.timestamp + 60);

        vm.prank(keeper);
        d.buyback.execute(0, block.timestamp + 60);

        // Clearing the keeper hands the trigger to everyone, with the cooldown and the
        // ceiling left to bound what a badly-timed call can cost.
        vm.prank(owner);
        d.buyback.setKeeper(address(0));

        // The cooldown from the keeper's call still applies to everybody, which is the
        // point of it: standing the keeper down loosens who may call, not how often.
        assertFalse(d.buyback.canExecute(stranger), "cooldown still running");
        vm.warp(block.timestamp + 1 hours);
        assertTrue(d.buyback.canExecute(stranger), "open to anyone once stood down");
    }

    function test_theCooldownHoldsBackARepeatCall() public {
        vm.prank(owner);
        d.buyback.setLimits(0, 1 hours);

        vm.deal(address(d.buyback), 2 ether);
        d.buyback.execute(0, block.timestamp + 60);

        vm.deal(address(d.buyback), 2 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                TreasuryBuyback.CooldownNotElapsed.selector, block.timestamp + 1 hours
            )
        );
        d.buyback.execute(0, block.timestamp + 60);

        vm.warp(block.timestamp + 1 hours);
        d.buyback.execute(0, block.timestamp + 60);
    }

    function test_aDeploymentCannotClaimToBurnWhileNamingARecipient() public {
        vm.expectRevert(TreasuryBuyback.RecipientContradictsBurn.selector);
        new TreasuryBuyback(address(weth), address(d.token), treasurySink, true, treasurySink, 2_000, owner);

        vm.expectRevert(TreasuryBuyback.RecipientContradictsBurn.selector);
        new TreasuryBuyback(address(weth), address(d.token), treasurySink, false, address(0), 2_000, owner);
    }

    function test_pausingConversionLeavesTransfersAndClaimsAlone() public {
        uint256 a = _mint(alice, 0);
        vm.deal(address(d.feeRouter), 100 ether);
        d.feeRouter.distribute();
        vm.warp(block.timestamp + 300);
        d.streamVault.release();
        d.revenueVault.allocate();
        uint256[] memory minOuts = new uint256[](1);
        d.revenueVault.processQuarter(EDITION, 0, minOuts, block.timestamp + 60);

        vm.prank(owner);
        d.revenueVault.pause();

        // Conversion is closed to the public while paused.
        vm.deal(address(d.royaltyRouter), 1 ether);
        d.royaltyRouter.forward();
        vm.expectRevert(RevenueVault.NotProcessorWhilePaused.selector);
        d.revenueVault.allocate();

        // Everything a holder owns still moves.
        vm.prank(alice);
        d.nft.transferFrom(alice, bob, a);
        assertEq(d.nft.ownerOf(a), bob);

        vm.prank(alice);
        d.distributor.claimQuarter(EDITION, 0, 0, 0);
        assertGt(assets[0].balanceOf(alice), 0, "already-deposited rewards stay claimable");

        d.token.transfer(bob, 1e18);
        vm.prank(bob);
        d.token.transfer(alice, 1e18);
    }

    function test_processorMayActWhilePausedForIncidentRecovery() public {
        _mint(alice, 0);
        address processor = makeAddr("processor");
        vm.startPrank(owner);
        d.revenueVault.setProcessor(processor);
        d.revenueVault.pause();
        vm.stopPrank();

        vm.deal(address(d.royaltyRouter), 1 ether);
        d.royaltyRouter.forward();

        vm.prank(processor);
        d.revenueVault.allocate();
        assertGt(d.revenueVault.quarterPending(EDITION, 0), 0);
    }

    function test_anAdapterSwapCannotChangeWhichAssetHoldersReceive() public {
        MockERC20 wrongAsset = new MockERC20("Wrong", "WRG", 18);
        MockSwapRouter r = new MockSwapRouter(20e18);
        UniswapV3Adapter wrong = new UniswapV3Adapter(
            address(weth),
            address(wrongAsset),
            address(r),
            abi.encodePacked(address(weth), uint24(3000), address(wrongAsset)),
            address(wethUsd),
            address(assetUsd),
            1 hours,
            200
        );

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                RevenueVault.AdapterAssetMismatch.selector, address(assets[0]), address(wrongAsset)
            )
        );
        d.revenueVault.setAdapter(EDITION, 0, address(assets[0]), address(wrong));
    }

    /// @dev A view that tells an interface an action has nothing to do, when it does, is
    ///      worse than no view at all: the control gets disabled on the strength of it and
    ///      the value sits there looking like it does not exist. `allocate` wraps native
    ///      before dividing anything, so `unallocated` has to count it.
    function test_unallocatedCountsNativeBecauseAllocateWrapsIt() public {
        _mint(alice, 0);

        vm.deal(address(d.revenueVault), 9 ether);

        assertEq(
            d.revenueVault.unallocated(),
            9 ether,
            "native value waiting reported as nothing waiting"
        );

        // And the action agrees with the view: it processes exactly what was reported.
        uint256 assigned = d.revenueVault.allocate();
        assertEq(assigned, 9 ether, "allocate moved a different amount than the view promised");
        assertEq(d.revenueVault.unallocated(), 0, "nothing should be left unallocated");
        assertEq(address(d.revenueVault).balance, 0, "native should have been wrapped");
    }

    /// @dev Everything up to the point where a quarter's asset is sitting in the
    ///      distributor waiting for its owners. Returns what was deposited.
    function _depositInto(uint8 quarter) internal returns (uint256 deposited) {
        vm.deal(address(d.feeRouter), 100 ether);
        d.feeRouter.distribute();
        vm.warp(block.timestamp + 300);
        d.streamVault.release();
        d.revenueVault.allocate();
        uint256[] memory minOuts = new uint256[](1);
        d.revenueVault.processQuarter(EDITION, quarter, minOuts, block.timestamp + 60);
        return d.distributor.totalDeposited(EDITION, address(assets[quarter]), quarter);
    }

    /// @dev Nobody should have to ask to be paid. This is the whole point of the push.
    function test_pushPaysEveryOwnerWithoutThemAsking() public {
        _mint(alice, 0);
        _mint(bob, 0);
        uint256 deposited = _depositInto(0);
        assertGt(deposited, 0, "nothing to push");

        assertEq(assets[0].balanceOf(alice), 0);
        assertEq(assets[0].balanceOf(bob), 0);

        vm.prank(makeAddr("a passer-by"));
        (uint256 nextId, bool complete) = d.distributor.pushQuarter(EDITION, 0, 0, 0);

        assertTrue(complete, "one call should finish a two-card quarter");
        assertEq(nextId, 3, "two cards start at id 1");
        assertApproxEqAbs(assets[0].balanceOf(alice), deposited / 2, 2, "alice paid without claiming");
        assertApproxEqAbs(assets[0].balanceOf(bob), deposited / 2, 2, "bob paid without claiming");
    }

    /// @dev A push must be resumable, or a full quarter could not be paid within a block.
    function test_pushIsBoundedAndResumable() public {
        _mint(alice, 0);
        _mint(bob, 0);
        _mint(carol, 0);
        _depositInto(0);

        (uint256 nextId, bool complete) = d.distributor.pushQuarter(EDITION, 0, 0, 1);
        assertFalse(complete, "one of three is not finished");
        assertEq(nextId, 2);
        assertGt(assets[0].balanceOf(alice), 0, "first card paid");
        assertEq(assets[0].balanceOf(bob), 0, "second card not reached yet");

        (nextId, complete) = d.distributor.pushQuarter(EDITION, 0, nextId, 0);
        assertTrue(complete);
        assertGt(assets[0].balanceOf(bob), 0, "second card paid on resume");
        assertGt(assets[0].balanceOf(carol), 0, "third card paid on resume");
    }

    /// @dev One owner who cannot receive must not stop the rest being paid. Their credit
    ///      survives untouched and the ordinary claim still works for them afterwards.
    function test_aRecipientThatCannotReceiveDoesNotBlockThePush() public {
        RejectingHolder bad = new RejectingHolder();
        _mint(address(bad), 0);
        _mint(bob, 0);
        uint256 deposited = _depositInto(0);

        assets[0].setReject(address(bad), true);

        d.distributor.pushQuarter(EDITION, 0, 0, 0);

        assertEq(assets[0].balanceOf(address(bad)), 0, "the bad recipient was skipped");
        assertApproxEqAbs(assets[0].balanceOf(bob), deposited / 2, 2, "everyone else was paid");
        assertApproxEqAbs(
            d.distributor.creditedOf(EDITION, address(assets[0]), 0, address(bad)),
            deposited / 2,
            2,
            "the skipped credit is still owed, not lost"
        );

        // And once the obstruction clears, the ordinary claim pays them.
        assets[0].setReject(address(bad), false);
        vm.prank(address(bad));
        d.distributor.claimQuarter(EDITION, 0, 0, 0);
        assertApproxEqAbs(assets[0].balanceOf(address(bad)), deposited / 2, 2, "paid on claim");
    }

    /// @dev Pushing twice must not pay twice.
    function test_pushingAnAlreadyPushedQuarterPaysNothingMore() public {
        _mint(alice, 0);
        _depositInto(0);

        d.distributor.pushQuarter(EDITION, 0, 0, 0);
        uint256 afterFirst = assets[0].balanceOf(alice);
        assertGt(afterFirst, 0);

        d.distributor.pushQuarter(EDITION, 0, 0, 0);
        assertEq(assets[0].balanceOf(alice), afterFirst, "a second push pays nothing again");
    }

    function _config() internal view returns (DeployConfig memory) {
        address[4] memory assetAddrs;
        for (uint8 q; q < 4; ++q) {
            assetAddrs[q] = address(assets[q]);
        }
        return DeployConfig({
            tokenName: "StonkTown",
            tokenSymbol: "TOWN",
            tokenRecipient: address(this),
            nftName: "StonkTown Property Card",
            nftSymbol: "CARD",
            owner: owner,
            treasurySink: treasurySink,
            burnsBought: true,
            buybackRecipient: address(0),
            buybackBps: 2_000,
            weth: address(weth),
            feeEscrow: address(0),
            weightMultiplierBps: 12_500,
            rewardAssets: assetAddrs,
            imageBaseURI: "https://example.invalid/art/level-",
            externalBaseURI: "https://example.invalid/card/"
        });
    }
}
