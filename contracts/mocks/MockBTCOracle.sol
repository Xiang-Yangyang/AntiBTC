// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";

contract MockBTCOracle is IPriceOracle, Ownable {
    uint256 private btcPrice;

    constructor(uint256 initialPrice) {
        btcPrice = initialPrice;
    }

    function getPrice() external view override returns (uint256) {
        return btcPrice;
    }

    function updatePrice(uint256 newPrice) external onlyOwner {
        btcPrice = newPrice;
        emit PriceUpdated(newPrice);
    }
} 