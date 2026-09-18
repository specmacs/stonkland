// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AllocationController
/// @notice How an edition's reward share is divided between its quarters.
/// @dev    Written once, by the constructor, and there is no setter. Not "frozen after a
///         governance step" -- there is no function here that writes storage at all.
contract AllocationController {
    uint16 public constant BPS_DENOMINATOR = 10_000;

    uint8 public immutable quarterCount;

    uint16[] private _allocationBps;

    error BadQuarterCount();
    error AllocationMustSumToFull(uint256 got);
    error QuarterOutOfRange(uint8 quarter);

    constructor(uint16[] memory allocationBps_) {
        uint256 n = allocationBps_.length;
        if (n == 0 || n > 16) revert BadQuarterCount();

        uint256 sum;
        for (uint256 i; i < n; ++i) {
            sum += allocationBps_[i];
            _allocationBps.push(allocationBps_[i]);
        }
        if (sum != BPS_DENOMINATOR) revert AllocationMustSumToFull(sum);
        quarterCount = uint8(n);
    }

    function allocationBps(uint8 quarter) external view returns (uint16) {
        if (quarter >= quarterCount) revert QuarterOutOfRange(quarter);
        return _allocationBps[quarter];
    }

    function allocations() external view returns (uint16[] memory) {
        return _allocationBps;
    }

    /// @notice `total` split by this allocation, with the remainder from truncation left
    ///         on the last quarter so the parts always add back up to the whole.
    function split(uint256 total) external view returns (uint256[] memory parts) {
        uint8 n = quarterCount;
        parts = new uint256[](n);
        uint256 assigned;
        for (uint8 i; i < n - 1; ++i) {
            parts[i] = (total * _allocationBps[i]) / BPS_DENOMINATOR;
            assigned += parts[i];
        }
        parts[n - 1] = total - assigned;
    }
}
