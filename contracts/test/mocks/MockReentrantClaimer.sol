// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IClaimTarget {
    function claimCredited(uint256 edition, uint8 quarter)
        external
        returns (address[] memory, uint256[] memory);
    function claimQuarter(uint256 edition, uint8 quarter, uint256 cursor, uint256 maxScan)
        external
        returns (uint256, bool, address[] memory, uint256[] memory);
}

/// @dev A reward asset that calls back into the distributor mid-transfer.
contract MockReentrantERC20 is ERC20 {
    IClaimTarget public target;
    uint256 public edition;
    uint8 public quarter;
    bool public armed;
    bool public reenterAttempted;
    bool public reenterSucceeded;

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, uint256 edition_, uint8 quarter_) external {
        target = IClaimTarget(target_);
        edition = edition_;
        quarter = quarter_;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && from != address(0) && to != address(0)) {
            armed = false;
            reenterAttempted = true;
            try target.claimCredited(edition, quarter) {
                reenterSucceeded = true;
            } catch {
                reenterSucceeded = false;
            }
        }
    }
}

/// @dev Refuses native value on receive, to prove the treasury leg is retryable and
///      cannot hold the rewards leg hostage.
contract MockRevertingTreasury is IERC721Receiver {
    bool public accepting;

    function setAccepting(bool v) external {
        accepting = v;
    }

    receive() external payable {
        require(accepting, "treasury refuses");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
