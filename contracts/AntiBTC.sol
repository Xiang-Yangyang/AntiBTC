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
 * @dev Implementation of the AntiBTC token with AMM functionality
 */
contract AntiBTC is ERC20, ReentrancyGuard, Pausable, Ownable, AutomationCompatible {
    // Constants - 使用更小的类型
    uint64 public constant PRICE_PRECISION = 1e8;  // 8 decimals for price
    uint64 public constant INITIAL_PRICE = 1e8;    // Initial price of 1 USD
    uint16 public constant MAX_SLIPPAGE = 100;     // 1% max slippage
    uint16 public constant FEE_RATE = 30;          // 0.3% fee rate (30 basis points)
    
    // Token supply related constants - 使用更小的类型
    uint128 public constant TOTAL_SUPPLY = 1_000_000_000_000 * 1e18;  // Total supply is 1T
    uint128 public constant INITIAL_POOL_TOKENS = 1_000_000 * 1e18;   // Initial circulation 1M (18 decimals)
    uint64 public constant INITIAL_POOL_USDT = 1_000_000 * 1e6;      // Initial USDT 1M (6 decimals)

    // State variables
    AggregatorV3Interface public immutable priceFeed;  // Binance Oracle interface
    IERC20 public usdt;  // USDT contract
    uint64 public lastBTCPrice;  // 改用 uint64
    uint32 public lastPriceUpdateTime;  // 改用 uint32
    
    // Pool variables - 保持 uint256 因为涉及代币数量
    uint256 public poolTokens;    // Circulating supply (tokens in pool)
    uint256 public reserveTokens; // Reserve supply (for price adjustment)
    uint256 public poolUSDT;      // USDT in pool

    // Price related - 使用更小的类型
    uint32 public constant REBALANCE_INTERVAL = 8 hours;  // Rebalance interval set to 8 hours
    uint32 public constant REBALANCE_THRESHOLD = 5e6;     // 5% price change threshold (1e8 = 100%)

    // Events
    event Swap(address indexed user, bool isBuy, uint256 tokenAmount, uint256 usdtAmount, uint256 fee);
    event LiquidityAdded(address indexed provider, uint256 tokenAmount, uint256 usdtAmount);
    event LiquidityRemoved(address indexed provider, uint256 tokenAmount, uint256 usdtAmount);
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
        poolTokens = INITIAL_POOL_TOKENS;
        poolUSDT = INITIAL_POOL_USDT;
        reserveTokens = TOTAL_SUPPLY - INITIAL_POOL_TOKENS;
        
        // Mint all tokens to contract
        _mint(address(this), TOTAL_SUPPLY);
        
        // Get initial BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid initial price");
        require(uint256(price) <= type(uint64).max, "Price overflow");
        lastBTCPrice = uint64(uint256(price));
        lastPriceUpdateTime = uint32(block.timestamp);
    }

    /**
     * @dev Updates the BTC price from Binance oracle
     */
    function updatePrice() public {
        (
            uint80 roundID,
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        require(timeStamp != 0, "Round not complete");
        require(answeredInRound >= roundID, "Stale price");
        require(price > 0, "Invalid price");
        require(uint256(price) <= type(uint64).max, "Price overflow");
        
        uint64 newPrice = uint64(uint256(price));
        
        if (newPrice != lastBTCPrice) {
            lastBTCPrice = newPrice;
            lastPriceUpdateTime = uint32(block.timestamp);
            
            uint256 antibtcPrice = calculateTargetAntiBTCPrice(newPrice);
            emit PriceUpdated(newPrice, antibtcPrice);
        }
    }

    /**
     * @dev Calculates the inverse price of BTC
     */
    function calculateTargetAntiBTCPrice(uint256 btcPrice) public pure returns (uint256) {
        return PriceCalculator.calculateTargetAntiBTCPrice(btcPrice);
    }

    /**
     * @dev Alias for calculateTargetAntiBTCPrice for test compatibility
     */
    function calculateAntiPrice(uint256 btcPrice) public pure returns (uint256) {
        return calculateTargetAntiBTCPrice(btcPrice);
    }

    /**
     * @dev Buy AntiBTC tokens with USDT
     */
    function buyTokens(uint256 usdtAmount) external nonReentrant whenNotPaused {
        require(usdtAmount > 0, "Zero USDT amount");
        
        // 1. Update BTC price
        updatePrice();
        
        // Get current and last BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentBTCPrice = uint256(price);
        
        // 2. Adjust pool based on BTC price change
        _adjustPoolForBTCPrice(lastBTCPrice, currentBTCPrice);
        
        // 3. Calculate and deduct fee
        uint256 fee = (usdtAmount * FEE_RATE) / 10000;
        uint256 usdtAmountAfterFee = usdtAmount - fee;
        
        // 4. Execute trade
        uint256 tokensOut = calculateTokensOut(usdtAmountAfterFee);
        require(tokensOut > 0, "Zero tokens out");
        require(tokensOut <= poolTokens, "Insufficient liquidity");
        
        // Transfer USDT from user
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        
        // Update pool state
        poolUSDT += usdtAmount;  // All USDT goes to pool, including fees
        poolTokens -= tokensOut;
        
        // Transfer tokens
        _transfer(address(this), msg.sender, tokensOut);
        
        emit Swap(msg.sender, true, tokensOut, usdtAmount, fee);
    }

    /**
     * @dev Sell AntiBTC tokens for USDT
     */
    function sellTokens(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Zero tokens");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Update price first
        updatePrice();
        
        // Get current and last BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentBTCPrice = uint256(price);
        
        // 根据 BTC 价格变化调整池子
        _adjustPoolForBTCPrice(lastBTCPrice, currentBTCPrice);
        
        // Calculate USDT out based on AMM formula - Calculate original USDT to receive
        uint256 rawUsdtOut = calculateUSDTOut(tokenAmount);
        require(rawUsdtOut > 0, "Zero USDT out");
        
        // 计算并扣除手续费
        uint256 fee = (rawUsdtOut * FEE_RATE) / 10000;
        uint256 usdtOut = rawUsdtOut - fee;
        
        require(usdt.balanceOf(address(this)) >= usdtOut, "Insufficient liquidity");
        
        // Update pool state
        poolTokens += tokenAmount;
        poolUSDT -= usdtOut;  // Only deduct actual USDT paid to user, fees stay in pool
        
        // Transfer tokens and USDT
        _transfer(msg.sender, address(this), tokenAmount);
        require(usdt.transfer(msg.sender, usdtOut), "USDT transfer failed");
        
        emit Swap(msg.sender, false, tokenAmount, usdtOut, fee);
    }

    /**
     * @dev Calculate tokens to receive for given USDT amount
     */
    function calculateTokensOut(uint256 usdtIn) public view returns (uint256) {
        return PriceCalculator.calculateAMMTokensOut(usdtIn, poolTokens, poolUSDT);
    }

    /**
     * @dev Calculate USDT to receive for given token amount
     */
    function calculateUSDTOut(uint256 tokensIn) public view returns (uint256) {
        return PriceCalculator.calculateAMMUSDTOut(tokensIn, poolTokens, poolUSDT);
    }

    /**
     * @dev Add liquidity to the pool
     */
    function addLiquidity(uint256 usdtAmount) external nonReentrant whenNotPaused {
        require(usdtAmount > 0, "Zero USDT amount");
        
        // Calculate proportional amount of tokens
        uint256 tokenAmount = (usdtAmount * poolTokens) / poolUSDT;
        require(tokenAmount > 0, "Zero token amount");
        require(tokenAmount <= reserveTokens, "Insufficient reserve tokens");
        
        // Transfer USDT from user
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        
        // Transfer tokens from reserve to pool
        poolTokens += tokenAmount;
        reserveTokens -= tokenAmount;
        
        // Mint new tokens to liquidity provider
        _transfer(address(this), msg.sender, tokenAmount);
        
        // Update pool state
        poolUSDT += usdtAmount;
        
        emit LiquidityAdded(msg.sender, tokenAmount, usdtAmount);
    }

    /**
     * @dev Remove liquidity from the pool
     */
    function removeLiquidity(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Zero token amount");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Calculate proportional amount of USDT
        uint256 usdtAmount = (tokenAmount * poolUSDT) / poolTokens;
        require(usdtAmount > 0, "Zero USDT amount");
        require(usdt.balanceOf(address(this)) >= usdtAmount, "Insufficient USDT in pool");
        
        // Transfer tokens from circulation pool to reserve pool
        poolTokens -= tokenAmount;
        reserveTokens += tokenAmount;
        
        // Transfer USDT to user
        require(usdt.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        // Update pool state
        poolUSDT -= usdtAmount;
        
        emit LiquidityRemoved(msg.sender, tokenAmount, usdtAmount);
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
     * @dev Chainlink Automation check function
     * Returns true when rebalance is needed
     */
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory /* performData */) 
    {
        upkeepNeeded = needsRebalance();
        return (upkeepNeeded, "");
    }

    /**
     * @dev Chainlink Automation execution function
     * Can only be called by Chainlink Automation Registry
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        require(needsRebalance(), "Rebalance conditions not met");
        _rebalance();  // Internal rebalance function
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
        
        // Adjust pool first, then update state
        // Pass old and new prices for adjustment
        _adjustPoolForBTCPrice(oldBtcPrice, newBtcPrice);
        
        // Update state
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
            poolTokens,
            reserveTokens,
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
        uint256 usdtValue = balance > 0 ? (balance * poolUSDT) / poolTokens : 0;
        
        return (balance, share, usdtValue);
    }

    /**
     * @dev Get current pool price information
     * @return _btcPrice Current BTC price
     * @return _antiPrice Current theoretical AntiBTC price
     * @return _poolPrice AntiBTC/USDT price in pool (how many USDT per AntiBTC)
     */
    function getPriceInfo() external view returns (
        uint256 _btcPrice,
        uint256 _antiPrice,
        uint256 _poolPrice
    ) {
        uint256 antiPrice = calculateTargetAntiBTCPrice(lastBTCPrice);
        uint256 poolPrice = poolTokens > 0 ? (poolUSDT * 1e18) / poolTokens : 0;  // 1e18 is for precision
        
        return (lastBTCPrice, antiPrice, poolPrice);
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
     * @return price Current AntiBTC price (in USDT, 6 decimals precision)
     */
    function getPrice() public view returns (uint256) {
        // Calculate price from liquidity pool
        if (poolTokens == 0) return 0;
        
        // price = poolUSDT / poolTokens
        // poolUSDT precision is 6, poolTokens precision is 18
        // To maintain precision, we need to multiply by 1e18 first
        return (poolUSDT * 1e18) / poolTokens;
    }

    /**
     * @dev Adjust pool ratio based on BTC price change
     * When BTC price rises, AntiBTC price should fall; when BTC price falls, AntiBTC price should rise
     * @param oldPrice BTC price before adjustment
     * @param newPrice BTC price after adjustment
     */
    function _adjustPoolForBTCPrice(uint256 oldPrice, uint256 newPrice) internal {
        // If price hasn't changed, no adjustment needed
        if (oldPrice == newPrice) return;
        
        // Record state before adjustment
        uint256 oldPoolTokens = poolTokens;
        uint256 oldReserveTokens = reserveTokens;
        
        // Calculate price change ratio
        uint256 priceRatio;
        
        if (newPrice > oldPrice) {
            // BTC price rises
            // Example: BTC price rises from 20000 to 22000, up 10%
            // priceRatio = 22000 * 1e18 / 20000 = 1.1 * 1e18
            priceRatio = (newPrice * 1e18) / oldPrice;
            
            // AntiBTC price should fall, pool tokens should increase
            // New pool tokens = old pool tokens * priceRatio
            uint256 newPoolTokens = (poolTokens * priceRatio) / 1e18;
            uint256 tokensToAdd = newPoolTokens - poolTokens;
            
            // Check if reserve is sufficient
            if (tokensToAdd <= reserveTokens) {
                // Sufficient, adjust directly
                poolTokens = newPoolTokens;
                reserveTokens -= tokensToAdd;
            } else if (reserveTokens > 0) {
                // Insufficient, use all reserves
                poolTokens += reserveTokens;
                reserveTokens = 0;
            }
        } else {
            // BTC price falls
            // Example: BTC price falls from 20000 to 18000, down 10%
            // priceRatio = 20000 * 1e18 / 18000 = 1.111... * 1e18
            priceRatio = (oldPrice * 1e18) / newPrice;
            
            // AntiBTC price should rise, pool tokens should decrease
            // New pool tokens = old pool tokens / priceRatio = old pool tokens * (newPrice / oldPrice)
            uint256 newPoolTokens = (poolTokens * 1e18) / priceRatio;
            uint256 tokensToRemove = poolTokens - newPoolTokens;
            
            // Ensure enough tokens remain in pool (at least 1000)
            if (tokensToRemove < poolTokens && newPoolTokens >= 1000 * 1e18) {
                poolTokens = newPoolTokens;
                reserveTokens += tokensToRemove;
            }
        }
        
        // Ensure at least 1000 tokens in pool (prevent infinite price)
        if (poolTokens < 1000 * 1e18) {
            uint256 tokensToAdd = 1000 * 1e18 - poolTokens;
            if (tokensToAdd <= reserveTokens) {
                poolTokens += tokensToAdd;
                reserveTokens -= tokensToAdd;
            }
        }
        
        // Emit pool adjustment event
        emit PoolAdjusted(oldPoolTokens, poolTokens, oldReserveTokens, reserveTokens);
    }

} 