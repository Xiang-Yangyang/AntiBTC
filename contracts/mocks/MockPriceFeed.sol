// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IPriceFeed.sol";

contract MockPriceFeed is IPriceFeed {
    uint256 private price;
    uint256 private lastUpdateTime;

    constructor(uint256 _initialPrice) {
        price = _initialPrice;
        lastUpdateTime = block.timestamp;
    }

    function getPrice() external view returns (uint256) {
        return price;
    }

    function getLastUpdateTime() external view returns (uint256) {
        return lastUpdateTime;
    }

    // 测试用函数：更新价格
    function updatePrice(uint256 _newPrice) external {
        price = _newPrice;
        lastUpdateTime = block.timestamp;
    }
} 