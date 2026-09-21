// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IWETH9} from "./interfaces/IWETH9.sol";
import {IBurnableERC20} from "./interfaces/IBurnableERC20.sol";
import {IAcquisitionAdapter} from "./interfaces/IAcquisitionAdapter.sol";

/// @title TreasuryBuyback
/// @notice Sits in front of the treasury address and spends part of its share buying the
///         token back on the open market.
///
/// @dev This recycles revenue the protocol already earned. It does not create revenue,
///      and nothing about it should be described as if it did.
///
///      The trigger is open to anyone, so the bid does not depend on someone remembering
///      to press it. The portion is the owner's to set; what happens to the bought tokens
///      is not. Whether they are burned or kept is fixed at construction and readable
///      from the verified source, so "does the treasury just sell them again" is answered
///      by the deployment rather than by a promise.
contract TreasuryBuyback is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    IWETH9 public immutable weth;
    IERC20 public immutable token;

    /// @notice Where the non-buyback remainder goes.
    address public immutable sink;

    /// @notice True when bought tokens are destroyed rather than held.
    /// @dev    Fixed at construction. A buyback that burns is the only version of a
    ///         buyback that cannot be quietly undone by selling the position later.
    bool public immutable burnsBought;

    /// @notice Where bought tokens land when they are not burned. Zero when they are.
    address public immutable buybackRecipient;

    /// @notice Share of incoming treasury revenue spent on buybacks.
    uint16 public buybackBps;

    /// @notice The only address allowed to trigger a buyback. Zero means anyone may.
    /// @dev    The token's pool has no price history to check a fill against, so the
    ///         caller's `minOut` is the whole of the price protection and somebody has to
    ///         have looked at the pool to set it. Naming a keeper means that somebody is
    ///         known, and takes away an attacker's ability to choose the moment.
    ///
    ///         Clearing it hands the trigger to everyone and leaves the cap and the
    ///         cooldown to bound what a badly-timed call can cost. That is the weaker
    ///         protection and the one that needs nobody to keep a script running.
    address public keeper;

    /// @notice Most that may be spent in one call. Zero means no ceiling.
    uint256 public maxSpendPerCall;

    /// @notice Seconds that must pass between buybacks.
    uint256 public cooldown;

    /// @notice When the last buyback ran.
    uint256 public lastExecutedAt;

    IAcquisitionAdapter public adapter;

    event BuybackBpsSet(uint16 previous, uint16 current);
    event KeeperSet(address indexed previous, address indexed current);
    event LimitsSet(uint256 maxSpendPerCall, uint256 cooldown);
    event AdapterSet(address indexed adapter);
    event BuybackSkippedNoRoute(uint256 forwarded);
    event BoughtBack(uint256 spent, uint256 received, address indexed recipient);
    event Burned(uint256 amount);
    event SweptToSink(uint256 amount);

    error ZeroAddress();
    error BpsOutOfRange(uint16 bps);
    error RecipientContradictsBurn();
    error AdapterAssetMismatch(address expected, address actual);
    error NothingToDo();
    error NotKeeper(address caller);
    error CooldownNotElapsed(uint256 readyAt);

    /// @param burnsBought_ true to destroy bought tokens, false to send them to
    ///        `buybackRecipient_`. When true, `buybackRecipient_` must be the zero
    ///        address, so a deployment cannot claim to burn while naming a recipient.
    constructor(
        address weth_,
        address token_,
        address sink_,
        bool burnsBought_,
        address buybackRecipient_,
        uint16 buybackBps_,
        address owner_
    ) Ownable(owner_) {
        if (weth_ == address(0) || token_ == address(0) || sink_ == address(0)) revert ZeroAddress();
        if (burnsBought_ != (buybackRecipient_ == address(0))) revert RecipientContradictsBurn();
        if (buybackBps_ > BPS_DENOMINATOR) revert BpsOutOfRange(buybackBps_);
        weth = IWETH9(weth_);
        token = IERC20(token_);
        sink = sink_;
        burnsBought = burnsBought_;
        buybackRecipient = buybackRecipient_;
        buybackBps = buybackBps_;
    }

    receive() external payable {}

    /// @notice Name the only address allowed to trigger a buyback, or zero for anyone.
    function setKeeper(address keeper_) external onlyOwner {
        emit KeeperSet(keeper, keeper_);
        keeper = keeper_;
    }

    /// @notice Bound what a single badly-timed buyback can cost, and how often one runs.
    /// @param  maxSpendPerCall_ ceiling on one call's spend, or zero for none
    /// @param  cooldown_ seconds between buybacks, or zero for none
    function setLimits(uint256 maxSpendPerCall_, uint256 cooldown_) external onlyOwner {
        maxSpendPerCall = maxSpendPerCall_;
        cooldown = cooldown_;
        emit LimitsSet(maxSpendPerCall_, cooldown_);
    }

    /// @notice Whether `caller` could trigger a buyback right now.
    function canExecute(address caller) external view returns (bool) {
        address k = keeper;
        if (k != address(0) && caller != k) return false;
        return block.timestamp >= lastExecutedAt + cooldown;
    }

    function setBuybackBps(uint16 bps) external onlyOwner {
        if (bps > BPS_DENOMINATOR) revert BpsOutOfRange(bps);
        emit BuybackBpsSet(buybackBps, bps);
        buybackBps = bps;
    }

    function setAdapter(address adapter_) external onlyOwner {
        if (adapter_ != address(0)) {
            address adapterAsset = IAcquisitionAdapter(adapter_).asset();
            if (adapterAsset != address(token)) revert AdapterAssetMismatch(address(token), adapterAsset);
        }
        adapter = IAcquisitionAdapter(adapter_);
        emit AdapterSet(adapter_);
    }

    function available() public view returns (uint256) {
        return weth.balanceOf(address(this)) + address(this).balance;
    }

    /// @notice Spend the configured share on the token and forward the rest. Open to anyone.
    /// @param minOut the least this call will accept for what it spends. With no price
    ///        history behind the pool, this is the whole of the price protection.
    function execute(uint256 minOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 spent, uint256 bought)
    {
        address k = keeper;
        if (k != address(0) && msg.sender != k) revert NotKeeper(msg.sender);

        uint256 readyAt = lastExecutedAt + cooldown;
        if (block.timestamp < readyAt) revert CooldownNotElapsed(readyAt);
        lastExecutedAt = block.timestamp;

        uint256 native = address(this).balance;
        if (native != 0) weth.deposit{value: native}();

        uint256 balance = weth.balanceOf(address(this));
        if (balance == 0) revert NothingToDo();

        IAcquisitionAdapter a = adapter;

        // No route, no buyback. This is the ordinary state before the token's pool
        // exists: a launch trades on a bonding curve first and only graduates into a
        // pool later, so there is nothing to buy against until it does. Treasury revenue
        // still moves, it just all goes to the sink until a route is wired.
        spent = address(a) == address(0) ? 0 : (balance * buybackBps) / BPS_DENOMINATOR;

        // The ceiling applies to the trade, not to the sweep: whatever is not spent on
        // the buyback still goes on to the sink in the same call.
        uint256 ceiling = maxSpendPerCall;
        if (ceiling != 0 && spent > ceiling) spent = ceiling;

        if (spent != 0) {
            IERC20(address(weth)).safeTransfer(address(a), spent);

            // When burning, the tokens come here first so the amount destroyed is the
            // amount measured as received rather than a number taken on trust.
            address recipient = burnsBought ? address(this) : buybackRecipient;
            bought = a.convert(spent, minOut, deadline, recipient);
            emit BoughtBack(spent, bought, recipient);

            if (burnsBought && bought != 0) {
                IBurnableERC20(address(token)).burn(bought);
                emit Burned(bought);
            }
        }

        uint256 remainder = weth.balanceOf(address(this));
        if (remainder != 0) {
            if (address(a) == address(0)) emit BuybackSkippedNoRoute(remainder);
            IERC20(address(weth)).safeTransfer(sink, remainder);
            emit SweptToSink(remainder);
        }
    }
}
