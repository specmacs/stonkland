// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWETH9} from "./interfaces/IWETH9.sol";

/// @title RoyaltyRouter
/// @notice Receives the 5% card resale royalty and passes it into the reward pipeline.
///
/// @dev This is the one revenue source that does not depend on token trading volume: it
///      is paid when cards change hands. Marketplaces pay in the sale currency, so this
///      accepts native value and WETH and nothing else -- a catch-all sweep would only
///      pile assets the conversion path cannot use into the vault behind it.
///
///      No owner, no roles, no withdrawal. Everything that arrives here goes forward.
contract RoyaltyRouter {
    using SafeERC20 for IERC20;

    IWETH9 public immutable weth;

    /// @notice Where royalties go. Immutable.
    address public immutable revenueVault;

    event Forwarded(address indexed caller, uint256 amount);

    error ZeroAddress();

    constructor(address weth_, address revenueVault_) {
        if (weth_ == address(0) || revenueVault_ == address(0)) revert ZeroAddress();
        weth = IWETH9(weth_);
        revenueVault = revenueVault_;
    }

    receive() external payable {}

    function pending() external view returns (uint256) {
        return address(this).balance + weth.balanceOf(address(this));
    }

    /// @notice Wrap anything native and push the whole balance on. Open to anyone.
    function forward() external returns (uint256 amount) {
        uint256 native = address(this).balance;
        if (native != 0) weth.deposit{value: native}();

        amount = weth.balanceOf(address(this));
        if (amount == 0) return 0;

        IERC20(address(weth)).safeTransfer(revenueVault, amount);
        emit Forwarded(msg.sender, amount);
    }
}
