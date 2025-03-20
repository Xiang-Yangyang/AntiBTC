// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceFeed {
    /**
     * @dev 获取最新的BTC价格
     * @return price BTC价格，8位小数精度
     */
    function getPrice() external view returns (uint256);
    
    /**
     * @dev 获取价格更新时间
     * @return timestamp 最后更新时间戳
     */
    function getLastUpdateTime() external view returns (uint256);
} 