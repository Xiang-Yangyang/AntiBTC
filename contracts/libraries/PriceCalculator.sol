// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PriceCalculator
 * @dev Library for calculating AntiBTC prices and AMM operations
 */
library PriceCalculator {
    uint256 constant PRICE_PRECISION = 1e8;  // 8 decimals for price
    // K = initial AntiBTC price (with precision) * initial BTC price (with precision)
    uint256 constant K = 1e8 * 20000 * 1e8;  // 2e20

    /**
     * @dev Calculate the inverse price for AntiBTC using inverse proportion
     * antiPrice = K / btcPrice
     * Example: When BTC = $20,000, AntiBTC = $1 
     *          When BTC = $10,000, AntiBTC = $2
     */
    function calculateTargetAntiBTCPrice(uint256 btcPrice) internal pure returns (uint256) {
        require(btcPrice > 0, "BTC price cannot be zero");
        // btcPrice with 8 decimals
        // return value with 8 decimals
        return K / btcPrice;  
    }

    /**
     * @dev Calculate AntiBTC tokens to receive for given USDT amount using AMM formula
     */
    function calculateAMMAntiBTCOut(
        uint256 usdtIn,
        uint256 poolTokens,
        uint256 poolUSDT
    ) internal pure returns (uint256) {
        return (poolTokens * usdtIn) / (poolUSDT + usdtIn);
    }

    /**
     * @dev Calculate USDT to receive for given token amount using AMM formula
     */
    function calculateAMMUSDTOut(
        uint256 tokensIn,
        uint256 poolTokens,
        uint256 poolUSDT
    ) internal pure returns (uint256) {
        return (poolUSDT * tokensIn) / (poolTokens + tokensIn);
    }

    /**
     * @dev Calculate liquidity shares for given USDT amount
     */
    function calculateLiquidityShares(
        uint256 usdtAmount,
        uint256 poolTokens,
        uint256 poolUSDT
    ) internal pure returns (uint256) {
        return (usdtAmount * poolTokens) / poolUSDT;
    }

    /**
     * @dev Check if price impact is within acceptable range
     */
    function checkPriceImpact(
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 expectedPrice,
        uint256 maxSlippage
    ) internal pure returns (bool) {
        uint256 actualPrice = (outputAmount * PRICE_PRECISION) / inputAmount;
        uint256 minAcceptablePrice = (expectedPrice * (PRICE_PRECISION - maxSlippage)) / PRICE_PRECISION;
        uint256 maxAcceptablePrice = (expectedPrice * (PRICE_PRECISION + maxSlippage)) / PRICE_PRECISION;
        
        return actualPrice >= minAcceptablePrice && actualPrice <= maxAcceptablePrice;
    }
} 