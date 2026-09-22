// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local test double only. Never deployed to any public network.
contract MockERC20 is ERC20 {
    /// @notice Addresses this token refuses to pay, so a push can be tested against one.
    /// @dev    Real assets do this for real reasons -- blocklists, contracts that cannot
    ///         hold them. The behaviour under test is that one such holder cannot stop
    ///         everybody else from being paid.
    mapping(address => bool) public rejected;

    function setReject(address who, bool on) external {
        rejected[who] = on;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!rejected[to], "recipient refuses this token");
        super._update(from, to, value);
    }

    uint8 private immutable _decimals;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _decimals = d;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Takes a cut on every transfer, so the distributor's measured-delta accounting is
///      exercised against an asset that never delivers what it was asked for.
contract MockFeeOnTransferERC20 is ERC20 {
    uint256 public feeBps;

    constructor(uint256 feeBps_) ERC20("FeeOnTransfer", "FOT") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        if (fee != 0) super._update(from, address(0xdead), fee);
    }
}

/// @dev An issuer that can freeze a holder. The claim path must revert cleanly and leave
///      the credit on the ledger rather than consuming it on a failed send.
contract MockBlocklistERC20 is ERC20 {
    mapping(address => bool) public blocked;

    error Blocked(address account);

    constructor() ERC20("Blocklist", "BLK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[to] || blocked[from]) revert Blocked(blocked[to] ? to : from);
        super._update(from, to, value);
    }
}

/// @dev Quietly delivers less than asked and still returns true.
contract MockShortfallERC20 is ERC20 {
    uint256 public shortfallBps;

    constructor(uint256 shortfallBps_) ERC20("Shortfall", "SHORT") {
        shortfallBps = shortfallBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        uint256 delivered = value - (value * shortfallBps) / 10_000;
        _transfer(_msgSender(), to, delivered);
        return true;
    }
}
