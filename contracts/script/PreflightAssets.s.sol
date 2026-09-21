// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {OracleGuard} from "../src/libraries/OracleGuard.sol";

/// @notice Checks, against a fork of the real chain, whether the four reward assets can
///         actually be used the way this protocol needs to use them.
///
/// @dev Run this before writing a single conversion route:
///
///        forge script script/PreflightAssets.s.sol --fork-url $RPC_URL -vv
///
///      The question it exists to answer is not "will the code compile". It is whether a
///      tokenized equity can be held by a contract and sent on to whoever is owed it.
///
///      Tokenized equities are frequently permissioned. If the issuer restricts transfers
///      to verified holders, then a contract cannot hold the asset and holders cannot
///      receive it, and no amount of care in the distributor changes that. The protocol
///      already fails closed in that case -- a refused transfer reverts and leaves the
///      credit on the ledger rather than consuming it -- but failing closed on every
///      single claim is a dead reward loop, not a working one.
///
///      A red result here is a reason to change the reward assets, not a reason to
///      proceed carefully.
contract PreflightAssets is Script, StdCheats {
    struct AssetCheck {
        address token;
        string symbol;
        uint8 decimals;
        bool readable;
        bool movedToAContract;
        bool movedOnFromAContract;
        uint256 totalSupply;
    }

    uint256 internal constant DEFAULT_STALE_AFTER = 1 hours;

    function run() external {
        address[4] memory assets = [
            vm.envAddress("REWARD_ASSET_Q1"),
            vm.envAddress("REWARD_ASSET_Q2"),
            vm.envAddress("REWARD_ASSET_Q3"),
            vm.envAddress("REWARD_ASSET_Q4")
        ];

        console2.log("=== Reward asset preflight ===");
        console2.log("chain id", block.chainid);
        console2.log("");

        bool allClear = true;
        for (uint256 i; i < assets.length; ++i) {
            if (!_checkAsset(i + 1, assets[i])) allClear = false;
        }

        _checkOracles();

        console2.log("");
        if (allClear) {
            console2.log("All four assets can be held and moved on by a contract.");
            console2.log("This clears the mechanical question only. It says nothing about");
            console2.log("whether the issuer's terms permit it, which is a question for");
            console2.log("them and for counsel, not for a fork.");
        } else {
            console2.log("AT LEAST ONE ASSET CANNOT BE USED AS A REWARD ASSET.");
            console2.log("A contract cannot hold it, or cannot pass it on. The reward loop");
            console2.log("would revert on every claim. Change the asset.");
        }
    }

    /// @dev Moves a real balance through a contract, because a token's interface tells
    ///      you nothing about whether its transfer hook will allow this.
    function _checkAsset(uint256 quarter, address token) internal returns (bool ok) {
        console2.log("--- Quarter", quarter, "---");
        console2.log("token", token);

        if (token.code.length == 0) {
            console2.log("  FAIL: no contract at this address");
            return false;
        }

        ok = true;

        try IERC20Metadata(token).symbol() returns (string memory symbol) {
            console2.log("  symbol", symbol);
        } catch {
            console2.log("  WARN: symbol() did not return; the interface will show a blank");
        }

        uint8 decimals = 18;
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            decimals = d;
            console2.log("  decimals", d);
        } catch {
            console2.log("  FAIL: decimals() did not return; the adapter cannot price this");
            ok = false;
        }

        uint256 supply;
        try IERC20(token).totalSupply() returns (uint256 s) {
            supply = s;
            console2.log("  total supply", s);
        } catch {
            console2.log("  FAIL: totalSupply() did not return");
            return false;
        }

        if (supply == 0) {
            console2.log("  FAIL: zero supply, nothing to acquire");
            return false;
        }

        // Two stand-in contracts: one playing the distributor, one playing a holder that
        // happens to be a contract, since plenty of holders will be.
        address custodian = address(new Bystander());
        address recipient = address(new Bystander());
        uint256 probe = 10 ** decimals;
        if (probe > supply) probe = supply;

        // Seed the custodian. A real holder is far better evidence than a forced balance,
        // because `deal` writes the balance slot directly and would sail straight through
        // exactly the transfer restriction this script exists to find. Set WHALE_Qn to an
        // address that actually holds the asset on the forked chain.
        address whale = vm.envOr(string.concat("WHALE_Q", vm.toString(quarter)), address(0));
        if (whale != address(0)) {
            uint256 whaleBalance = IERC20(token).balanceOf(whale);
            if (whaleBalance < probe) probe = whaleBalance;
            if (probe == 0) {
                console2.log("  FAIL: the named holder has no balance on this block");
                return false;
            }
            vm.prank(whale);
            try IERC20(token).transfer(custodian, probe) {
                console2.log("  a real holder can send it to a contract");
            } catch {
                console2.log("  FAIL: a real holder cannot send this to a contract");
                console2.log("        the distributor could never be paid. Change the asset.");
                return false;
            }
        } else {
            console2.log("  WARN: no WHALE_Q", quarter, "set; forcing a balance instead");
            console2.log("        a forced balance bypasses transfer restrictions, so this");
            console2.log("        run proves less than one seeded from a real holder");
            deal(token, custodian, probe, true);
        }

        if (IERC20(token).balanceOf(custodian) < probe) {
            console2.log("  FAIL: a contract could not be given a balance at all");
            console2.log("        this asset is almost certainly transfer-restricted");
            return false;
        }
        console2.log("  a contract can hold it");

        try Bystander(payable(custodian)).send(token, recipient, probe) {
            uint256 landed = IERC20(token).balanceOf(recipient);
            if (landed == 0) {
                console2.log("  FAIL: transfer returned but nothing arrived");
                ok = false;
            } else if (landed < probe) {
                console2.log("  WARN: fee on transfer; delivered", landed, "of", probe);
                console2.log("        accounting handles this, but holders receive less");
            } else {
                console2.log("  a contract can pass it on");
            }
        } catch {
            console2.log("  FAIL: a contract could not send it onward");
            console2.log("        every claim would revert. This asset cannot pay holders.");
            ok = false;
        }

        console2.log("");
        return ok;
    }

    /// @dev A quarter with no usable feed cannot convert, because the adapter refuses to
    ///      trade on a price it cannot check.
    function _checkOracles() internal view {
        console2.log("--- Price feeds ---");

        string[5] memory names =
            ["ORACLE_NATIVE_USD", "ORACLE_Q1_USD", "ORACLE_Q2_USD", "ORACLE_Q3_USD", "ORACLE_Q4_USD"];

        for (uint256 i; i < names.length; ++i) {
            address feed = vm.envOr(names[i], address(0));
            if (feed == address(0)) {
                console2.log(string.concat("  ", names[i], ": not set"));
                continue;
            }
            try this.readFeed(feed) returns (uint256 price, uint8 decimals) {
                console2.log(string.concat("  ", names[i], ": ok"));
                console2.log("    price", price, "decimals", decimals);
            } catch {
                console2.log(string.concat("  ", names[i], ": FAIL -- stale, zero, or incomplete"));
                console2.log("    that quarter cannot convert until a usable feed exists");
            }
        }
        console2.log("");
        console2.log("A feed that does not exist is not a gap to work around. Without one");
        console2.log("the adapter has nothing to check a fill against, and an unchecked");
        console2.log("fill on a thin market is how a treasury gets emptied.");
    }

    function readFeed(address feed) external view returns (uint256, uint8) {
        OracleGuard.Price memory p = OracleGuard.readFresh(IAggregatorV3(feed), DEFAULT_STALE_AFTER);
        return (p.value, p.decimals);
    }
}

/// @dev Stands in for a contract that holds and forwards a reward asset.
contract Bystander {
    function send(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }

    receive() external payable {}
}
