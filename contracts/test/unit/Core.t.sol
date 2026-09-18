// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixtures} from "../Fixtures.sol";
import {Token} from "../../src/Token.sol";
import {PropertyNFT} from "../../src/PropertyNFT.sol";
import {Minter} from "../../src/Minter.sol";
import {ProgressionManager} from "../../src/ProgressionManager.sol";
import {ProgressionLib} from "../../src/libraries/ProgressionLib.sol";
import {Property} from "../../src/interfaces/IPropertyNFT.sol";

contract TokenTest is Fixtures {
    function test_supplyIsFixedAndFullyIssued() public view {
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(token.MAX_SUPPLY(), 1_000_000_000e18);
        assertEq(token.decimals(), 18);
    }

    function test_noMintFunctionExists() public view {
        // There is no selector for mint(address,uint256) on this contract.
        assertEq(address(token).code.length > 0, true);
        (bool ok,) = address(token).staticcall(abi.encodeWithSignature("mint(address,uint256)", alice, 1));
        assertFalse(ok, "token must expose no mint entry point");
    }

    function test_walletToWalletTransferIsUntaxed(uint128 amount) public {
        amount = uint128(bound(amount, 1, 1_000_000e18));
        fund(alice, amount);
        vm.prank(alice);
        token.transfer(bob, amount);
        assertEq(token.balanceOf(bob), amount, "transfer must arrive whole");
        assertEq(token.balanceOf(alice), 0);
    }

    function test_burnReducesSupplyPermanently() public {
        fund(alice, 1_000e18);
        uint256 before = token.totalSupply();
        vm.prank(alice);
        token.burn(1_000e18);
        assertEq(token.totalSupply(), before - 1_000e18);
    }
}

contract ProgressionLibTest is Fixtures {
    function test_scheduleMatchesTheRulebook() public pure {
        assertEq(ProgressionLib.baseWeight(1), 100);
        assertEq(ProgressionLib.baseWeight(2), 160);
        assertEq(ProgressionLib.baseWeight(3), 250);
        assertEq(ProgressionLib.baseWeight(4), 365);
        assertEq(ProgressionLib.baseWeight(5), 500);

        assertEq(ProgressionLib.burnToReach(2), 500_000e18);
        assertEq(ProgressionLib.burnToReach(3), 1_000_000e18);
        assertEq(ProgressionLib.burnToReach(4), 1_500_000e18);
        assertEq(ProgressionLib.burnToReach(5), 2_000_000e18);
    }

    function test_houseToLandmarkCostsFivePointOneMillion() public pure {
        uint256 total = 100_000e18; // mint
        for (uint8 l = 2; l <= 5; ++l) {
            total += ProgressionLib.burnToReach(l);
        }
        assertEq(total, 5_100_000e18, "cumulative burn to max a card");
    }

    function test_foundingEditionWeights() public pure {
        assertEq(ProgressionLib.weightFor(1, 12_500), 125);
        assertEq(ProgressionLib.weightFor(2, 12_500), 200);
        assertEq(ProgressionLib.weightFor(3, 12_500), 312);
        assertEq(ProgressionLib.weightFor(4, 12_500), 456);
        assertEq(ProgressionLib.weightFor(5, 12_500), 625);
    }

    function test_landmarkIsExactlyFiveHouses() public pure {
        // The one ratio the rulebook actually promises survives the multiplier exactly.
        assertEq(ProgressionLib.weightFor(5, 12_500), 5 * ProgressionLib.weightFor(1, 12_500));
    }

    function test_levelZeroAndAboveFiveAreRejected() public {
        vm.expectRevert(abi.encodeWithSelector(ProgressionLib.LevelOutOfRange.selector, uint8(0)));
        this.exposedBaseWeight(0);
        vm.expectRevert(abi.encodeWithSelector(ProgressionLib.LevelOutOfRange.selector, uint8(6)));
        this.exposedBaseWeight(6);
    }

    function exposedBaseWeight(uint8 level) external pure returns (uint16) {
        return ProgressionLib.baseWeight(level);
    }
}

contract PropertyNFTTest is Fixtures {
    function test_supplyAndQuarterCaps() public view {
        assertEq(nft.MAX_SUPPLY(), 400);
        assertEq(nft.QUARTER_COUNT(), 4);
        assertEq(nft.QUARTER_CAP(), 100);
        assertEq(uint256(nft.MAX_SUPPLY()), uint256(nft.QUARTER_COUNT()) * nft.QUARTER_CAP());
    }

    function test_tokenIdEncodesQuarterAndPlot() public {
        for (uint8 q; q < QUARTERS; ++q) {
            // A fresh wallet per quarter: three primary mints each is the whole allowance.
            uint256 id = mintCard(address(uint160(0x2000 + q)), q);
            assertEq(id, uint256(q) * 100 + 1, "first plot of each quarter");
            assertEq(nft.quarterOf(id), q);
            (uint256 first, uint256 last) = nft.quarterBounds(q);
            assertGe(id, first);
            assertLe(id, last);
        }
    }

    function test_cardStartsAsHouse() public {
        uint256 id = mintCard(alice, 0);
        Property memory p = nft.propertyOf(id);
        assertEq(p.level, 1);
        assertEq(p.weight, 125);
        assertEq(p.burned, MINT_BURN);
        assertEq(p.quarter, 0);
    }

    function test_quarterCapIsEnforcedInContract() public {
        // Fill quarter 2 to its cap, three primary mints at a time.
        for (uint256 i; i < 100; ++i) {
            address who = address(uint160(0x1000 + i));
            mintCard(who, 2);
        }
        assertEq(nft.mintedInQuarter(2), 100);
        assertEq(nft.remainingInQuarter(2), 0);

        address late = makeAddr("late");
        fund(late, MINT_BURN);
        vm.startPrank(late);
        token.approve(address(minter), MINT_BURN);
        vm.expectRevert(abi.encodeWithSelector(PropertyNFT.QuarterFull.selector, uint8(2)));
        minter.mint(2);
        vm.stopPrank();

        // Other quarters are untouched by a full neighbour.
        assertEq(nft.remainingInQuarter(1), 100);
    }

    function test_unknownQuarterRejected() public {
        fund(alice, MINT_BURN);
        vm.startPrank(alice);
        token.approve(address(minter), MINT_BURN);
        vm.expectRevert(abi.encodeWithSelector(PropertyNFT.QuarterOutOfRange.selector, uint8(4)));
        minter.mint(4);
        vm.stopPrank();
    }

    function test_linksAreOneTimeOnly() public {
        vm.startPrank(owner);
        vm.expectRevert(PropertyNFT.AlreadyLinked.selector);
        nft.linkMinter(address(0xdead));
        vm.expectRevert(PropertyNFT.AlreadyLinked.selector);
        nft.linkProgressionManager(address(0xdead));
        vm.expectRevert(PropertyNFT.AlreadyLinked.selector);
        nft.linkSettlementHook(address(0xdead));
        vm.stopPrank();
    }

    function test_onlyMinterCanMintAndOnlyManagerCanAdvance() public {
        vm.prank(alice);
        vm.expectRevert(PropertyNFT.NotMinter.selector);
        nft.mint(alice, 0, 0);

        uint256 id = mintCard(alice, 0);
        vm.prank(alice);
        vm.expectRevert(PropertyNFT.NotProgressionManager.selector);
        nft.advance(id);
    }

    function test_rendererSwapCannotTouchCardState() public {
        uint256 id = mintCard(alice, 1);
        Property memory before = nft.propertyOf(id);

        vm.prank(owner);
        nft.setRenderer(address(0xBEEF)); // any address; presentation only

        Property memory afterSwap = nft.propertyOf(id);
        assertEq(afterSwap.quarter, before.quarter);
        assertEq(afterSwap.level, before.level);
        assertEq(afterSwap.weight, before.weight);
        assertEq(afterSwap.burned, before.burned);
        assertEq(nft.ownerOf(id), alice);
    }

    function test_royaltyIsFivePercentToTheLinkedRouter() public {
        address router = makeAddr("royaltyRouter");
        vm.prank(owner);
        nft.linkRoyaltyReceiver(router);

        (address receiver, uint256 amount) = nft.royaltyInfo(1, 10 ether);
        assertEq(receiver, router);
        assertEq(amount, 0.5 ether, "500 bps");

        vm.prank(owner);
        vm.expectRevert(PropertyNFT.AlreadyLinked.selector);
        nft.linkRoyaltyReceiver(address(0xdead));
    }

    function test_transferCarriesLevelWeightAndBurnHistory() public {
        uint256 id = mintCard(alice, 0);
        buildTo(alice, id, 3);
        Property memory before = nft.propertyOf(id);

        vm.prank(alice);
        nft.transferFrom(alice, bob, id);

        Property memory afterMove = nft.propertyOf(id);
        assertEq(nft.ownerOf(id), bob);
        assertEq(afterMove.level, before.level);
        assertEq(afterMove.weight, before.weight);
        assertEq(afterMove.burned, before.burned);
        assertEq(afterMove.quarter, before.quarter);
    }
}

contract MinterTest is Fixtures {
    function test_deployedPausedSoLaunchIsOneVerb() public {
        Minter fresh = new Minter(address(token), address(nft), owner);
        assertTrue(fresh.paused());
        assertFalse(fresh.mintOpen());
    }

    function test_mintBurnsExactlyOneHundredThousand() public {
        uint256 supplyBefore = token.totalSupply();
        mintCard(alice, 0);
        assertEq(token.totalSupply(), supplyBefore - MINT_BURN);
    }

    function test_walletLimitIsThreePrimaryMints() public {
        fund(alice, MINT_BURN * 4);
        vm.startPrank(alice);
        token.approve(address(minter), type(uint256).max);
        minter.mint(0);
        minter.mint(0);
        minter.mint(1);
        assertEq(minter.remainingMints(alice), 0);
        vm.expectRevert(abi.encodeWithSelector(Minter.WalletLimitReached.selector, uint8(3), uint8(3)));
        minter.mint(0);
        vm.stopPrank();
    }

    function test_walletLimitDoesNotCapOwnership() public {
        // Alice exhausts her primary mints, then buys three more on the secondary market.
        fund(alice, MINT_BURN * 3);
        vm.startPrank(alice);
        token.approve(address(minter), type(uint256).max);
        minter.mint(0);
        minter.mint(0);
        minter.mint(0);
        vm.stopPrank();

        uint256[3] memory bought;
        for (uint256 i; i < 3; ++i) {
            bought[i] = mintCard(bob, 1);
            vm.prank(bob);
            nft.transferFrom(bob, alice, bought[i]);
        }
        assertEq(nft.balanceOf(alice), 6, "no ownership cap exists");
        assertEq(minter.remainingMints(alice), 0, "primary allowance is separate and spent");
    }

    function test_pauseStopsMintingAndOwnerCanResume() public {
        vm.prank(owner);
        minter.pause();
        fund(alice, MINT_BURN);
        vm.startPrank(alice);
        token.approve(address(minter), MINT_BURN);
        vm.expectRevert();
        minter.mint(0);
        vm.stopPrank();

        vm.prank(owner);
        minter.unpause();
        mintCard(alice, 0);
    }

    function test_mintBatchRespectsTheSameAllowance() public {
        fund(alice, MINT_BURN * 3);
        vm.startPrank(alice);
        token.approve(address(minter), type(uint256).max);
        uint256[] memory ids = minter.mintBatch(3, 3);
        assertEq(ids.length, 3);
        vm.expectRevert(abi.encodeWithSelector(Minter.WalletLimitReached.selector, uint8(3), uint8(3)));
        minter.mint(3);
        vm.stopPrank();
    }

    function test_insufficientBalanceRevertsAndBurnsNothing() public {
        vm.startPrank(alice);
        token.approve(address(minter), type(uint256).max);
        vm.expectRevert();
        minter.mint(0);
        vm.stopPrank();
        assertEq(nft.totalSupply(), 0);
    }
}

contract ProgressionTest is Fixtures {
    function test_buildFollowsTheScheduleExactly() public {
        uint256 id = mintCard(alice, 0);
        uint16[6] memory weights = [uint16(0), 125, 200, 312, 456, 625];
        uint256[6] memory costs =
            [uint256(0), 0, 500_000e18, 1_000_000e18, 1_500_000e18, 2_000_000e18];

        for (uint8 level = 2; level <= 5; ++level) {
            (uint8 nextLevel, uint16 nextWeight, uint256 burnAmount) = nft.nextUpgrade(id);
            assertEq(nextLevel, level);
            assertEq(nextWeight, weights[level]);
            assertEq(burnAmount, costs[level]);

            uint256 supplyBefore = token.totalSupply();
            build(alice, id);
            assertEq(token.totalSupply(), supplyBefore - costs[level], "burn is real");
            assertEq(nft.levelOf(id), level);
            assertEq(nft.weightOf(id), weights[level]);
        }
        assertEq(nft.propertyOf(id).burned, 5_100_000e18, "lifetime burn including mint");
    }

    function test_cannotBuildPastLandmark() public {
        uint256 id = mintCard(alice, 0);
        buildTo(alice, id, 5);
        vm.expectRevert(ProgressionLib.AlreadyAtMaxLevel.selector);
        nft.nextUpgrade(id);

        fund(alice, 10_000_000e18);
        vm.startPrank(alice);
        token.approve(address(manager), type(uint256).max);
        vm.expectRevert(ProgressionLib.AlreadyAtMaxLevel.selector);
        manager.build(id);
        vm.stopPrank();
    }

    function test_onlyCurrentOwnerCanBuild() public {
        uint256 id = mintCard(alice, 0);
        fund(bob, 1_000_000e18);
        vm.startPrank(bob);
        token.approve(address(manager), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(ProgressionManager.NotCardOwner.selector, id, bob));
        manager.build(id);
        vm.stopPrank();
    }

    function test_noLevelSkippingAndNoDowngrade() public {
        uint256 id = mintCard(alice, 0);
        build(alice, id);
        assertEq(nft.levelOf(id), 2, "levels advance one at a time");
        // There is no entry point anywhere that lowers a level or sets one directly.
        (bool ok,) = address(nft).call(abi.encodeWithSignature("setLevel(uint256,uint8)", id, 1));
        assertFalse(ok);
    }

    function test_buildIsPausableButTransfersAreNot() public {
        uint256 id = mintCard(alice, 0);
        vm.prank(owner);
        manager.pause();

        fund(alice, 500_000e18);
        vm.startPrank(alice);
        token.approve(address(manager), type(uint256).max);
        vm.expectRevert();
        manager.build(id);
        // The card still moves. Nobody can hold it hostage.
        nft.transferFrom(alice, bob, id);
        vm.stopPrank();
        assertEq(nft.ownerOf(id), bob);

        // Token transfers are equally unpausable -- there is no pause on the token at all.
        fund(bob, 1e18);
        vm.prank(bob);
        token.transfer(carol, 1e18);
        assertEq(token.balanceOf(carol), 1e18);
    }
}
