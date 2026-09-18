// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

/// @title OracleGuard
/// @notice Reads a price feed and refuses every shape of bad answer.
/// @dev    A feed that is down, stalled, or mid-round does not return an error -- it
///         returns a number. Every one of these checks exists because the number looks
///         fine on its own.
library OracleGuard {
    error NonPositiveAnswer(int256 answer);
    error IncompleteRound(uint80 roundId, uint80 answeredInRound);
    error StaleAnswer(uint256 updatedAt, uint256 age, uint256 staleAfter);
    error FutureAnswer(uint256 updatedAt);

    struct Price {
        uint256 value;
        uint8 decimals;
    }

    /// @notice Latest price from `feed`, or a revert.
    /// @param  staleAfter maximum age, in seconds, this caller will accept.
    function readFresh(IAggregatorV3 feed, uint256 staleAfter) internal view returns (Price memory) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            feed.latestRoundData();

        // Zero or negative is never a usable price, whatever the feed means by it.
        if (answer <= 0) revert NonPositiveAnswer(answer);
        // A round that has not been answered yet carries the previous round's number.
        if (updatedAt == 0 || answeredInRound < roundId) revert IncompleteRound(roundId, answeredInRound);
        // A timestamp ahead of the block is a broken feed, not a fresh one.
        if (updatedAt > block.timestamp) revert FutureAnswer(updatedAt);

        uint256 age = block.timestamp - updatedAt;
        if (age > staleAfter) revert StaleAnswer(updatedAt, age, staleAfter);

        return Price({value: uint256(answer), decimals: feed.decimals()});
    }
}
