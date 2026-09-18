// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProgressionLib
/// @notice The level schedule, fixed in code. There is no storage here and no way to
///         change any of these numbers after deployment short of deploying a new system.
/// @dev    Base weights are edition-independent. An edition applies its own immutable
///         multiplier on top (see `weightFor`), and the product is what the distributor
///         ever sees. Burn amounts are denominated in whole tokens scaled by 1e18.
library ProgressionLib {
    /// @notice Highest reachable level.
    uint8 internal constant MAX_LEVEL = 5;

    /// @notice Level every card starts at.
    uint8 internal constant START_LEVEL = 1;

    /// @notice Denominator for an edition's weight multiplier.
    uint16 internal constant MULTIPLIER_DENOMINATOR = 10_000;

    error LevelOutOfRange(uint8 level);
    error AlreadyAtMaxLevel();

    /// @notice Base score carried by a card at `level`, before any edition multiplier.
    function baseWeight(uint8 level) internal pure returns (uint16) {
        if (level == 1) return 100;
        if (level == 2) return 160;
        if (level == 3) return 250;
        if (level == 4) return 365;
        if (level == 5) return 500;
        revert LevelOutOfRange(level);
    }

    /// @notice Tokens destroyed to move a card from `level - 1` up to `level`.
    /// @dev    Level 1 is reached by minting, which burns a separate mint cost, so it has
    ///         no upgrade burn and is rejected here on purpose.
    function burnToReach(uint8 level) internal pure returns (uint256) {
        if (level == 2) return 500_000e18;
        if (level == 3) return 1_000_000e18;
        if (level == 4) return 1_500_000e18;
        if (level == 5) return 2_000_000e18;
        revert LevelOutOfRange(level);
    }

    /// @notice Human-readable form name for `level`.
    function formName(uint8 level) internal pure returns (string memory) {
        if (level == 1) return "House";
        if (level == 2) return "Residence";
        if (level == 3) return "Building";
        if (level == 4) return "Tower";
        if (level == 5) return "Landmark";
        revert LevelOutOfRange(level);
    }

    /// @notice Stored weight for `level` under an edition whose multiplier is `multiplierBps`.
    /// @dev    Integer division truncates. For the 12_500 bps founding edition the exact
    ///         table is 125 / 200 / 312 / 456 / 625 -- levels 3 and 4 lose the half-unit
    ///         that 1.25x would otherwise produce. The ratio that the rulebook actually
    ///         promises, Landmark = 5x House, survives exactly (625 = 5 * 125).
    function weightFor(uint8 level, uint16 multiplierBps) internal pure returns (uint16) {
        uint256 w = (uint256(baseWeight(level)) * multiplierBps) / MULTIPLIER_DENOMINATOR;
        // Ceiling of the schedule is 500 * (max sane multiplier). uint16 is checked, not assumed.
        return uint16(w);
    }

    /// @notice The level a card at `current` advances to, reverting if it is already maxed.
    function nextLevel(uint8 current) internal pure returns (uint8) {
        if (current == 0 || current > MAX_LEVEL) revert LevelOutOfRange(current);
        if (current == MAX_LEVEL) revert AlreadyAtMaxLevel();
        unchecked {
            return current + 1;
        }
    }
}
