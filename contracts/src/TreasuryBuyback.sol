// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IWETH9} from "./interfaces/IWETH9.sol";
import {IAcquisitionAdapter} from "./interfaces/IAcquisitionAdapter.sol";

/// @title TreasuryBuyback
/// @notice Sits in front of the treasury address and spends part of its share buying the
///         token back on the open market.
///
/// @dev This recycles revenue the protocol already earned. It does not create revenue,
///      and nothing about it should be described as if it did.
///
///      The trigger is open to anyone, so the bid does not depend on someone remembering
///      to press it. The portion is the owner's to set; where the bought tokens land is
///      not -- that is fixed at construction, so the answer to "does the treasury just
///      sell them again" is settled by the deployment rather than by a promise.
contract TreasuryBuyback is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;

    IWETH9 public immutable weth;
    IERC20 public immutable token;

    /// @notice Where the non-buyback remainder goes.
    address public immutable sink;

    /// @notice Where bought tokens land. Immutable, and readable by anyone before they buy.
    address public immutable buybackRecipient;

    /// @notice Share of incoming treasury revenue spent on buybacks.
    uint16 public buybackBps;

    IAcquisitionAdapter public adapter;

    event BuybackBpsSet(uint16 previous, uint16 current);
    event AdapterSet(address indexed adapter);
    event BoughtBack(uint256 spent, uint256 received, address indexed recipient);
    event SweptToSink(uint256 amount);

    error ZeroAddress();
    error BpsOutOfRange(uint16 bps);
    error AdapterNotSet();
    error AdapterAssetMismatch(address expected, address actual);
    error NothingToDo();

    constructor(
        address weth_,
        address token_,
        address sink_,
        address buybackRecipient_,
        uint16 buybackBps_,
        address owner_
    ) Ownable(owner_) {
        if (weth_ == address(0) || token_ == address(0) || sink_ == address(0)) revert ZeroAddress();
        if (buybackRecipient_ == address(0)) revert ZeroAddress();
        if (buybackBps_ > BPS_DENOMINATOR) revert BpsOutOfRange(buybackBps_);
        weth = IWETH9(weth_);
        token = IERC20(token_);
        sink = sink_;
        buybackRecipient = buybackRecipient_;
        buybackBps = buybackBps_;
    }

    receive() external payable {}

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
    function execute(uint256 minOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 spent, uint256 bought)
    {
        uint256 native = address(this).balance;
        if (native != 0) weth.deposit{value: native}();

        uint256 balance = weth.balanceOf(address(this));
        if (balance == 0) revert NothingToDo();

        spent = (balance * buybackBps) / BPS_DENOMINATOR;

        if (spent != 0) {
            IAcquisitionAdapter a = adapter;
            if (address(a) == address(0)) revert AdapterNotSet();
            IERC20(address(weth)).safeTransfer(address(a), spent);
            bought = a.convert(spent, minOut, deadline, buybackRecipient);
            emit BoughtBack(spent, bought, buybackRecipient);
        }

        uint256 remainder = weth.balanceOf(address(this));
        if (remainder != 0) {
            IERC20(address(weth)).safeTransfer(sink, remainder);
            emit SweptToSink(remainder);
        }
    }
}
