// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceOracle {
    /**
     * @dev Returns the latest BTC/USD price
     * @return price The current BTC price in USD with 8 decimals
     * @return timestamp The timestamp of the last price update
     */
    function getBTCPrice() external view returns (uint256 price, uint256 timestamp);

    /**
     * @dev Event emitted when the price is updated
     */
    event PriceUpdated(uint256 price, uint256 timestamp);
} 