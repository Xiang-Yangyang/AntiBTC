// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockBTCOracle is AggregatorV3Interface, Ownable {
    uint8 private constant DECIMALS = 8;
    uint80 private roundId;
    int256 private btcPrice;
    uint256 private timestamp;
    string private constant DESCRIPTION = "Mock BTC/USD Price Feed";

    constructor(int256 initialPrice) {
        btcPrice = initialPrice;
        roundId = 1;
        timestamp = block.timestamp;
    }

    // 实现 AggregatorV3Interface 的必要函数
    function decimals() external pure override returns (uint8) {
        return DECIMALS;
    }

    function description() external pure override returns (string memory) {
        return DESCRIPTION;
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId) external view override returns (
        uint80 roundId_,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (_roundId, btcPrice, timestamp, timestamp, _roundId);
    }

    function latestRoundData() external view override returns (
        uint80 roundId_,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (roundId, btcPrice, timestamp, timestamp, roundId);
    }

    // 更新价格的函数（仅用于测试）
    function updatePrice(int256 newPrice) external onlyOwner {
        btcPrice = newPrice;
        roundId++;
        timestamp = block.timestamp;
    }
} 