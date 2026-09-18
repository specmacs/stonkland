// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";
import {ISwapRouter} from "../../src/adapters/UniswapV3Adapter.sol";

/// @dev Local test doubles only. Never deployed to any public network.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract MockAggregator is IAggregatorV3 {
    uint8 public decimals;
    string public description;

    uint80 public roundId = 1;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public answeredInRound = 1;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
        roundId += 1;
        answeredInRound = roundId;
    }

    function setUpdatedAt(uint256 t) external {
        updatedAt = t;
    }

    function setIncomplete() external {
        roundId += 1; // a new round opened that has not been answered
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}

/// @dev Executes at a configurable rate so a fill can be pushed away from the oracle on
///      purpose, and can be emptied entirely to stand in for a route with no liquidity.
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    /// @notice Output units per 1e18 input units.
    uint256 public rate;
    bool public noLiquidity;

    constructor(uint256 rate_) {
        rate = rate_;
    }

    function setRate(uint256 rate_) external {
        rate = rate_;
    }

    function setNoLiquidity(bool v) external {
        noLiquidity = v;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        require(!noLiquidity, "MockSwapRouter: no liquidity on route");
        require(block.timestamp <= params.deadline, "MockSwapRouter: expired");

        address tokenIn = _addressAt(params.path, 0);
        address tokenOut = _addressAt(params.path, params.path.length - 20);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "MockSwapRouter: Too little received");
        IERC20(tokenOut).safeTransfer(params.recipient, amountOut);
    }

    function _addressAt(bytes calldata data, uint256 offset) private pure returns (address result) {
        result = address(bytes20(data[offset:offset + 20]));
    }
}

/// @dev A treasury that refuses native value until told otherwise.
contract RefusingTreasury {
    bool public accepting;
    uint256 public receivedTotal;

    function setAccepting(bool v) external {
        accepting = v;
    }

    receive() external payable {
        require(accepting, "treasury refuses");
        receivedTotal += msg.value;
    }
}

/// @dev A venue whose fee claim reverts, to prove it cannot block distributing what is
///      already in hand.
contract RevertingFeeSource {
    function claimFees() external pure {
        revert("venue down");
    }
}
