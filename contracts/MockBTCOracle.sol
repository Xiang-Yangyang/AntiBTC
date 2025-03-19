// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockBTCOracle is IPriceOracle, Ownable {
    uint256 private btcPrice;
    uint256 private lastUpdateTimestamp;

    constructor(uint256 _initialPrice) {
        btcPrice = _initialPrice;
        lastUpdateTimestamp = block.timestamp;
    }

    function getBTCPrice() external view override returns (uint256, uint256) {
        return (btcPrice, lastUpdateTimestamp);
    }

    function updatePrice(uint256 _newPrice) external onlyOwner {
        btcPrice = _newPrice;
        lastUpdateTimestamp = block.timestamp + 1;
        emit PriceUpdated(btcPrice, lastUpdateTimestamp);
    }
} 