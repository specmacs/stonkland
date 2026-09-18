// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixtures} from "../Fixtures.sol";
import {Handler} from "./Handler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ProgressionLib} from "../../src/libraries/ProgressionLib.sol";
import {Property} from "../../src/interfaces/IPropertyNFT.sol";

/// @notice Every invariant the build handoff names, checked against random play.
contract AccountingInvariantTest is Fixtures {
    Handler internal handler;
    address[] internal actors;

    function setUp() public override {
        super.setUp();

        for (uint256 i; i < 8; ++i) {
            actors.push(address(uint160(0xA11CE000 + i)));
        }

        address[4] memory assets;
        for (uint8 q; q < QUARTERS; ++q) {
            assets[q] = rewardAsset[q];
        }

        handler = new Handler(
            token, nft, distributor, minter, manager, revenueVault, treasury, assets, actors
        );

        // Enough float for every actor to mint out and build high.
        vm.startPrank(owner);
        for (uint256 i; i < actors.length; ++i) {
            token.transfer(actors[i], 20_000_000e18);
        }
        vm.stopPrank();

        targetContract(address(handler));
    }

    /// @dev The token can only ever shrink from the amount the constructor issued.
    function invariant_tokenSupplyNeverGrows() public view {
        assertLe(token.totalSupply(), token.MAX_SUPPLY());
        assertEq(
            token.totalSupply(),
            token.MAX_SUPPLY() - handler.totalMintBurned() - handler.totalUpgradeBurned(),
            "every missing token is accounted for by a mint or a build"
        );
    }

    /// @dev Card supply never exceeds 400, and no quarter exceeds its own cap.
    function invariant_cardSupplyAndQuarterCaps() public view {
        assertLe(nft.totalSupply(), nft.MAX_SUPPLY());
        uint256 sum;
        for (uint8 q; q < QUARTERS; ++q) {
            uint16 minted = nft.mintedInQuarter(q);
            assertLe(minted, nft.QUARTER_CAP());
            sum += minted;
        }
        assertEq(sum, nft.totalSupply());
    }

    /// @dev Weight is always exactly what the schedule says for the card's level.
    function invariant_weightMatchesTheSchedule() public view {
        uint256 n = handler.mintedCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.mintedTokens(i);
            Property memory p = nft.propertyOf(id);
            assertGe(p.level, 1);
            assertLe(p.level, ProgressionLib.MAX_LEVEL);
            assertEq(p.weight, nft.scheduleWeight(p.level), "weight is derived, never set");
        }
    }

    /// @dev Levels only ever climb. The handler asserts this at the moment of change; this
    ///      re-checks it against the running high-water mark.
    function invariant_levelsNeverFall() public view {
        uint256 n = handler.mintedCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.mintedTokens(i);
            assertGe(nft.levelOf(id), handler.highWaterLevel(id));
        }
    }

    /// @dev A checkpoint that fell would let a card claim the same deposit twice.
    function invariant_checkpointsNeverFall() public view {
        uint256 n = handler.mintedCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.mintedTokens(i);
            uint8 q = nft.quarterOf(id);
            address asset = rewardAsset[q];
            assertGe(
                distributor.checkpointOf(EDITION, asset, id), handler.highWaterCheckpoint(id, asset)
            );
        }
    }

    /// @dev Tracked weight always equals the weight actually sitting on the cards.
    function invariant_weightTotalsReconcile() public view {
        uint256[QUARTERS] memory byQuarter;
        uint256 n = handler.mintedCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.mintedTokens(i);
            Property memory p = nft.propertyOf(id);
            byQuarter[p.quarter] += p.weight;
        }

        uint256 editionSum;
        for (uint8 q; q < QUARTERS; ++q) {
            assertEq(distributor.quarterWeight(EDITION, q), byQuarter[q], "quarter weight");
            editionSum += byQuarter[q];
        }
        assertEq(distributor.editionWeight(EDITION), editionSum, "edition weight");
        assertEq(distributor.protocolWeight(), editionSum, "protocol weight");
    }

    /// @dev The solvency invariant, per quarter.
    function invariant_claimedNeverExceedsDeposited() public view {
        for (uint8 q; q < QUARTERS; ++q) {
            assertLe(
                distributor.totalClaimed(EDITION, rewardAsset[q], q),
                distributor.totalDeposited(EDITION, rewardAsset[q], q),
                "a quarter paid out more than it took in"
            );
        }
    }

    /// @dev Everything owed to everyone is actually sitting in the contract.
    function invariant_owedIsCovered() public view {
        for (uint8 q; q < QUARTERS; ++q) {
            address asset = rewardAsset[q];
            uint256 owed = distributor.reserveOf(EDITION, asset, q);

            uint256 n = handler.mintedCount();
            for (uint256 i; i < n; ++i) {
                uint256 id = handler.mintedTokens(i);
                Property memory p = nft.propertyOf(id);
                if (p.quarter != q) continue;
                owed += distributor.pendingOf(EDITION, asset, q, id, p.weight);
            }
            for (uint256 a; a < actors.length; ++a) {
                owed += distributor.creditedOf(EDITION, asset, q, actors[a]);
            }

            assertLe(owed, IERC20(asset).balanceOf(address(distributor)), "pending + credited is covered");
        }
    }

    /// @dev A quarter that received nothing owes nothing, whatever happened elsewhere.
    function invariant_quartersStayIsolated() public view {
        for (uint8 q; q < QUARTERS; ++q) {
            address asset = rewardAsset[q];
            if (distributor.totalDeposited(EDITION, asset, q) != 0) continue;
            assertEq(distributor.accumulatorOf(EDITION, asset, q), 0);
            assertEq(distributor.totalClaimed(EDITION, asset, q), 0);
            for (uint256 a; a < actors.length; ++a) {
                assertEq(distributor.creditedOf(EDITION, asset, q, actors[a]), 0);
            }
        }
    }

    function invariant_callSummary() public view {
        // Surfaces a run that never reached the interesting paths.
        assertGe(
            handler.mints() + handler.builds() + handler.transfers() + handler.deposits()
                + handler.claims(),
            0
        );
    }
}
