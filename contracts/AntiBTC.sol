// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/PriceCalculator.sol";

/**
 * @title AntiBTC
 * @dev Implementation of the AntiBTC token with AMM functionality and  // Chainlink Automation
 */
contract AntiBTC is ERC20, ReentrancyGuard, Pausable, Ownable {
    // Constants - use smaller types
    uint64 public constant PRICE_PRECISION = 1e8;  // 8 decimals for price
    uint16 public constant MAX_SLIPPAGE = 100;     // 1% max slippage
    uint16 public constant FEE_RATE = 30;          // 0.3% fee rate (30 basis points)
    
    // Token supply related constants - use smaller types
    uint128 public constant TOTAL_SUPPLY = 1_000_000_000_000 * 1e18;  // Total supply is 1T
    uint128 public constant INITIAL_POOL_ANTIBTC = 1_000_000 * 1e18;   // Initial circulation 1M (18 decimals)
    uint64 public constant INITIAL_POOL_USDT = 1_000_000 * 1e6;      // Initial USDT 1M (6 decimals)

    // State variables
    AggregatorV3Interface public immutable priceFeed;  // Binance Oracle interface
    IERC20 public usdt;  // USDT contract
    uint64 public lastBTCPrice;  // Use uint64
    uint32 public lastPriceUpdateTime;  // Use uint32
    
    // Pool variables - keep uint256 because it involves token amounts
    uint256 public poolAntiBTC;    // Circulating supply (tokens in pool)
    uint256 public reserveAntiBTC; // Reserve supply (for price adjustment)
    uint256 public poolUSDT;      // USDT in pool

    // Price related - use smaller types
    uint32 public constant REBALANCE_INTERVAL = 8 hours;  // Rebalance interval set to 8 hours
    uint32 public constant REBALANCE_THRESHOLD = 5e6;     // 5% price change threshold (1e8 = 100%)

    // Events
    event Swap(address indexed user, bool isBuy, uint256 tokenAmount, uint256 usdtAmount, uint256 fee);
    event PriceUpdated(uint256 btcPrice, uint256 antibtcPrice);
    event Rebalanced(
        uint256 oldBtcPrice,
        uint256 newBtcPrice,
        uint256 oldAntiPrice,
        uint256 newAntiPrice,
        uint256 timestamp
    );
    event PoolAdjusted(uint256 oldPoolTokens, uint256 newPoolTokens, uint256 oldReserveTokens, uint256 newReserveTokens);

    constructor(
        string memory name,
        string memory symbol,
        address _priceFeedAddress,
        address _usdtAddress
    ) ERC20(name, symbol) {
        require(_priceFeedAddress != address(0), "Invalid price feed address");
        require(_usdtAddress != address(0), "Invalid USDT address");
        
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        usdt = IERC20(_usdtAddress);
        
        // Initialize pool
        poolAntiBTC = INITIAL_POOL_ANTIBTC;
        poolUSDT = INITIAL_POOL_USDT;
        reserveAntiBTC = TOTAL_SUPPLY - INITIAL_POOL_ANTIBTC;
        
        // Mint all tokens to contract
        _mint(address(this), TOTAL_SUPPLY);
        
        // Get initial BTC price
        (, int256 btcPrice,,,) = priceFeed.latestRoundData();
        require(btcPrice > 0, "Invalid initial price");
        require(uint256(btcPrice) <= type(uint64).max, "Price overflow");
        lastBTCPrice = uint64(uint256(btcPrice));
        lastPriceUpdateTime = uint32(block.timestamp);
    }

    /**
     * @dev Calculates the target price of AntiBTC
     */
    function calculateTargetAntiBTCPrice(uint256 btcPrice) public pure returns (uint256) {
        return PriceCalculator.calculateTargetAntiBTCPrice(btcPrice);
    }

    /**
     * @dev Calculate the target AntiBTC price based on BTC price
     * @param btcPrice BTC price (8 decimals precision)
     * @return AntiBTC price (8 decimals precision)
     */
    function calculateAntiPrice(uint256 btcPrice) public pure returns (uint256) {
        return calculateTargetAntiBTCPrice(btcPrice);
    }

    /**
     * @dev Buy AntiBTC tokens with USDT
     */
    function buyTokens(uint256 usdtIn) external nonReentrant whenNotPaused {
        require(usdtIn > 0, "Zero USDT amount");
        
        // 1. Get current BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentBTCPrice = uint256(price);
        
        // 2. Check if price update is needed
        uint256 timeSinceLastUpdate = block.timestamp - lastPriceUpdateTime;
        uint256 priceChange = currentBTCPrice > lastBTCPrice ? 
            ((currentBTCPrice - lastBTCPrice) * 1e8) / lastBTCPrice :
            ((lastBTCPrice - currentBTCPrice) * 1e8) / lastBTCPrice;
            
        // Only update price and adjust pool if conditions are met
        if (timeSinceLastUpdate >= REBALANCE_INTERVAL || priceChange >= REBALANCE_THRESHOLD) {
            uint256 targetPrice = calculateTargetAntiBTCPrice(currentBTCPrice);
            _adjustPoolForAntiBTCPrice(targetPrice);
            lastBTCPrice = uint64(currentBTCPrice);
            lastPriceUpdateTime = uint32(block.timestamp);
            emit PriceUpdated(currentBTCPrice, targetPrice);
        }
        
        // 3. Calculate and deduct fee
        uint256 fee = (usdtIn * FEE_RATE) / 10000;
        uint256 usdtAfterFee = usdtIn - fee;
        
        // 4. Execute trade
        uint256 antiBTCOut = calculateTokensOut(usdtAfterFee);
        require(antiBTCOut > 0, "Zero AntiBTC out");
        require(antiBTCOut <= poolAntiBTC, "Insufficient liquidity");
        
        // Transfer USDT from user
        require(usdt.transferFrom(msg.sender, address(this), usdtIn), "USDT transfer failed");
        
        // Update pool state
        poolUSDT += usdtIn;  // All USDT goes to pool, including fees
        poolAntiBTC -= antiBTCOut;
        
        // Transfer tokens
        _transfer(address(this), msg.sender, antiBTCOut);
        
        emit Swap(msg.sender, true, antiBTCOut, usdtIn, fee);
    }

    /**
     * @dev Sell AntiBTC tokens for USDT
     */
    function sellTokens(uint256 antiBTCIn) external nonReentrant whenNotPaused {
        require(antiBTCIn > 0, "Zero tokens");
        require(balanceOf(msg.sender) >= antiBTCIn, "Insufficient balance");
        
        // 1. Get current BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentBTCPrice = uint256(price);
        
        // 2. Check if price update is needed
        uint256 timeSinceLastUpdate = block.timestamp - lastPriceUpdateTime;
        uint256 priceChange = currentBTCPrice > lastBTCPrice ? 
            ((currentBTCPrice - lastBTCPrice) * 1e8) / lastBTCPrice :
            ((lastBTCPrice - currentBTCPrice) * 1e8) / lastBTCPrice;
            
        // Only update price and adjust pool if conditions are met
        if (timeSinceLastUpdate >= REBALANCE_INTERVAL || priceChange >= REBALANCE_THRESHOLD) {
            uint256 targetPrice = calculateTargetAntiBTCPrice(currentBTCPrice);
            _adjustPoolForAntiBTCPrice(targetPrice);
            lastBTCPrice = uint64(currentBTCPrice);
            lastPriceUpdateTime = uint32(block.timestamp);
            emit PriceUpdated(currentBTCPrice, targetPrice);
        }
        
        // Calculate USDT out based on AMM formula
        uint256 usdtRawOut = calculateUSDTOut(antiBTCIn);
        require(usdtRawOut > 0, "Zero USDT out");
        
        // 3. Calculate and deduct fee
        uint256 fee = (usdtRawOut * FEE_RATE) / 10000;
        uint256 usdtOut = usdtRawOut - fee;
        
        require(usdt.balanceOf(address(this)) >= usdtOut, "Insufficient liquidity");
        
        // 4. Update pool state
        poolAntiBTC += antiBTCIn;
        poolUSDT -= usdtOut;  // Only deduct actual USDT paid to user, fees stay in pool
        
        // Transfer tokens and USDT
        _transfer(msg.sender, address(this), antiBTCIn);
        require(usdt.transfer(msg.sender, usdtOut), "USDT transfer failed");
        
        emit Swap(msg.sender, false, antiBTCIn, usdtOut, fee);
    }

    /**
     * @dev Calculate tokens to receive for given USDT amount
     */
    function calculateTokensOut(uint256 usdtIn) public view returns (uint256) {
        return PriceCalculator.calculateAMMAntiBTCOut(usdtIn, poolAntiBTC, poolUSDT);
    }

    /**
     * @dev Calculate USDT to receive for given token amount
     */
    function calculateUSDTOut(uint256 tokensIn) public view returns (uint256) {
        return PriceCalculator.calculateAMMUSDTOut(tokensIn, poolAntiBTC, poolUSDT);
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Check if rebalance is needed
     * Triggers rebalance when either condition is met:
     * 1. More than 8 hours since last rebalance
     * 2. BTC price changed more than 5% since last rebalance
     */
    function needsRebalance() public view returns (bool) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentPrice = uint256(price);
        uint256 timeSinceLastUpdate = block.timestamp - lastPriceUpdateTime;
        
        // Calculate price change percentage
        uint256 priceChange;
        if (currentPrice > lastBTCPrice) {
            priceChange = ((currentPrice - lastBTCPrice) * 1e8) / lastBTCPrice;
        } else {
            priceChange = ((lastBTCPrice - currentPrice) * 1e8) / lastBTCPrice;
        }
        
        return (timeSinceLastUpdate >= REBALANCE_INTERVAL) || 
               (priceChange >= REBALANCE_THRESHOLD);
    }

    /**
     * @dev Internal rebalance function
     */
    function _rebalance() internal {
        uint256 oldBtcPrice = lastBTCPrice;
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 newBtcPrice = uint256(price);
        
        uint256 oldAntiPrice = PriceCalculator.calculateTargetAntiBTCPrice(oldBtcPrice);
        uint256 newAntiPrice = PriceCalculator.calculateTargetAntiBTCPrice(newBtcPrice);
        
        // 直接传入目标价格进行调整
        _adjustPoolForAntiBTCPrice(newAntiPrice);
        
        // 更新状态
        lastBTCPrice = uint64(newBtcPrice);
        lastPriceUpdateTime = uint32(block.timestamp);
        
        emit Rebalanced(
            oldBtcPrice,
            newBtcPrice,
            oldAntiPrice,
            newAntiPrice,
            block.timestamp
        );
    }

    /**
     * @dev Get all managed assets information in the contract
     * @return _poolTokens AntiBTC tokens in pool (circulating supply)
     * @return _reserveTokens AntiBTC tokens in reserve
     * @return _poolUSDT USDT amount in pool
     * @return _totalSupply Total supply of AntiBTC
     * @return _lastBTCPrice Latest BTC price
     * @return _lastAntiPrice Latest AntiBTC price
     * @return _lastPriceUpdateTime Last rebalance time
     */
    function getPoolInfo() external view returns (
        uint256 _poolTokens,
        uint256 _reserveTokens,
        uint256 _poolUSDT,
        uint256 _totalSupply,
        uint256 _lastBTCPrice,
        uint256 _lastAntiPrice,
        uint256 _lastPriceUpdateTime
    ) {
        return (
            poolAntiBTC,
            reserveAntiBTC,
            poolUSDT,
            totalSupply(),
            lastBTCPrice,
            calculateTargetAntiBTCPrice(lastBTCPrice),
            lastPriceUpdateTime
        );
    }

    /**
     * @dev Get user's share information in the pool
     * @param user User address
     * @return _tokenBalance User's AntiBTC balance
     * @return _tokenShare User's percentage of total supply (precision 1e8, 100% = 1e8)
     * @return _usdtValue USDT value at current pool price
     */
    function getUserShare(address user) external view returns (
        uint256 _tokenBalance,
        uint256 _tokenShare,
        uint256 _usdtValue
    ) {
        uint256 balance = balanceOf(user);
        uint256 total = totalSupply();
        
        // Calculate user share percentage
        uint256 share = total > 0 ? (balance * 1e8) / total : 0;
        
        // Calculate user's USDT value
        uint256 usdtValue = balance > 0 ? (balance * poolUSDT) / poolAntiBTC : 0;
        
        return (balance, share, usdtValue);
    }

    /**
     * @dev Get rebalance status information
     * @return _needsRebalance Whether rebalance is needed
     * @return _timeSinceLastRebalance Time since last rebalance (seconds)
     * @return _priceChangePercentage Price change percentage (precision 1e8)
     */
    function getRebalanceInfo() external view returns (
        bool _needsRebalance,
        uint256 _timeSinceLastRebalance,
        uint256 _priceChangePercentage
    ) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentPrice = uint256(price);
        uint256 timeSinceLastUpdate = block.timestamp - lastPriceUpdateTime;
        
        uint256 priceChange;
        if (currentPrice > lastBTCPrice) {
            priceChange = ((currentPrice - lastBTCPrice) * 1e8) / lastBTCPrice;
        } else {
            priceChange = ((lastBTCPrice - currentPrice) * 1e8) / lastBTCPrice;
        }
        
        return (needsRebalance(), timeSinceLastUpdate, priceChange);
    }

    // Modify original rebalance function to manual trigger
    function manualRebalance() external {
        _rebalance();
    }

    /**
     * @dev Get current AntiBTC USDT price
     * @return price Current AntiBTC price (in USDT, 8 decimals precision)
     */
    function getPrice() public view returns (uint256) {
        // Calculate price from liquidity pool
        if (poolAntiBTC == 0) return 0;
        
        // price = poolUSDT / poolTokens
        // poolUSDT precision is 6, poolTokens precision is 18
        // To get 8 decimal precision for price, we need to multiply by 1e20
        return (poolUSDT * 1e20) / poolAntiBTC;
    }

    /**
     * @dev Adjust pool ratio based on target AntiBTC price
     * @param targetAntiBTCPrice Target AntiBTC price (8 decimal precision)
     */
    function _adjustPoolForAntiBTCPrice(uint256 targetAntiBTCPrice) internal {
        // Get current pool AntiBTC price (convert to 8 decimal precision)
        uint256 currentPoolPrice = (poolUSDT * 1e20) / poolAntiBTC;  // Convert to 8 decimal precision
        
        // If prices are equal, no adjustment is needed
        if (currentPoolPrice == targetAntiBTCPrice) return;
        
        // Record the state before adjustment
        uint256 oldPoolAntiBTC = poolAntiBTC;
        uint256 oldReserveAntiBTC = reserveAntiBTC;
        
        // Calculate price change ratio
        uint256 priceRatio;
        
        if (targetAntiBTCPrice < currentPoolPrice) {
            // Target price is lower than current price
            // Example: Current price 1.1 USDT, target price 1.0 USDT
            // priceRatio = 1.1 * 1e18 / 1.0 = 1.1 * 1e18
            priceRatio = (currentPoolPrice * 1e18) / targetAntiBTCPrice;
            
            // AntiBTC price should decrease, token amount in the pool should increase
            // New pool token amount = old pool token amount * priceRatio
            uint256 newPoolAntiBTC = (poolAntiBTC * priceRatio) / 1e18;
            uint256 tokensToAdd = newPoolAntiBTC - poolAntiBTC;
            
            // Check if reserve is sufficient
            if (tokensToAdd <= reserveAntiBTC) {
                // Sufficient, directly adjust
                poolAntiBTC = newPoolAntiBTC;
                reserveAntiBTC -= tokensToAdd;
            } else if (reserveAntiBTC > 0) {
                // Insufficient, use all reserve
                poolAntiBTC += reserveAntiBTC;
                reserveAntiBTC = 0;
            }
        } else {
            // Target price is higher than current price
            // Example: Current price 0.9 USDT, target price 1.0 USDT
            // priceRatio = 1.0 * 1e18 / 0.9 = 1.111... * 1e18

            priceRatio = (targetAntiBTCPrice * 1e18) / currentPoolPrice;
            
            // AntiBTC price should increase, token amount in the pool should decrease
            // New pool token amount = old pool token amount / priceRatio
            uint256 newPoolAntiBTC = (poolAntiBTC * 1e18) / priceRatio;
            uint256 tokensToRemove = poolAntiBTC - newPoolAntiBTC;
            
            // Ensure pool has enough tokens (at least 1000)
            if (tokensToRemove < poolAntiBTC && newPoolAntiBTC >= 1000 * 1e18) {
                poolAntiBTC = newPoolAntiBTC;
                reserveAntiBTC += tokensToRemove;
            }
        }
        
        // Ensure pool has at least 1000 tokens (prevent price from becoming too high)
        if (poolAntiBTC < 1000 * 1e18) {
            uint256 tokensToAdd = 1000 * 1e18 - poolAntiBTC;
            if (tokensToAdd <= reserveAntiBTC) {
                poolAntiBTC += tokensToAdd;
                reserveAntiBTC -= tokensToAdd;
            }
        }
        
        // Emit pool adjustment event
        emit PoolAdjusted(oldPoolAntiBTC, poolAntiBTC, oldReserveAntiBTC, reserveAntiBTC);
    }
} 


    // /**
    //  * @dev Chainlink Automation check function
    //  * Returns true when rebalance is needed
    //  */
    // function checkUpkeep(bytes calldata /* checkData */) 
    //     external 
    //     view 
    //     override 
    //     returns (bool upkeepNeeded, bytes memory /* performData */) 
    // {
    //     upkeepNeeded = needsRebalance();
    //     return (upkeepNeeded, "");
    // }

    // /**
    //  * @dev Chainlink Automation execution function
    //  * Can only be called by Chainlink Automation Registry
    //  */
    // function performUpkeep(bytes calldata /* performData */) external override {
    //     require(needsRebalance(), "Rebalance conditions not met");
    //     _rebalance();  // Internal rebalance function
    // }


    // /**
    //  * @dev Get current pool price information
    //  * @return _btcPrice Current BTC price
    //  * @return _antiPrice Current theoretical AntiBTC price
    //  * @return _poolPrice AntiBTC/USDT price in pool (how many USDT per AntiBTC)
    //  */
    // function getPriceInfo() external view returns (
    //     uint256 _btcPrice,
    //     uint256 _antiPrice,
    //     uint256 _poolPrice
    // ) {
    //     uint256 antiPrice = calculateTargetAntiBTCPrice(lastBTCPrice);
    //     uint256 poolPrice = poolAntiBTC > 0 ? (poolUSDT * 1e18) / poolAntiBTC : 0;  // 1e18 is for precision
        
    //     return (lastBTCPrice, antiPrice, poolPrice);
    // }
