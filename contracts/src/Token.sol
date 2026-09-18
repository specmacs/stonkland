// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title Token
/// @notice Fixed-supply protocol token. The entire supply is minted once, to the
///         recipient named at construction, and there is no code path anywhere in this
///         contract that can create another unit.
/// @dev    There is deliberately no transfer tax, no fee-on-transfer branch, no
///         blocklist, no pause and no owner. Wallet-to-wallet movement is free and
///         cannot be interfered with by anyone, including the deployer. The protocol's
///         3% trading fee is charged by the trading venue in the pair's quote asset and
///         has nothing to do with this contract.
contract Token is ERC20, ERC20Burnable, ERC20Permit {
    /// @notice Total units ever created, in whole tokens.
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    error ZeroRecipient();

    constructor(string memory name_, string memory symbol_, address recipient)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        if (recipient == address(0)) revert ZeroRecipient();
        _mint(recipient, MAX_SUPPLY);
    }
}
