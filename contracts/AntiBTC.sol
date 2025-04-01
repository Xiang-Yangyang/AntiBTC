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
    // Constants
    uint256 public constant PRICE_PRECISION = 1e8;  // 8 decimals for price
    uint256 public constant INITIAL_PRICE = 1e8;    // Initial price of 1 USD
    uint256 public constant MAX_SLIPPAGE = 100;     // 1% max slippage

    // State variables
    AggregatorV3Interface public immutable priceFeed;  // Binance 预言机接口
    IERC20 public usdt;  // USDT contract
    uint256 public lastBTCPrice;
    uint256 public lastPriceUpdateTime;
    
    // Pool variables
    uint256 public constant INITIAL_POOL_TOKENS = 1000000 * 1e18;  // 1M tokens
    uint256 public constant INITIAL_POOL_USDT = 1000000 * 1e6;     // 1M USDT (6 decimals)
    uint256 public poolTokens;
    uint256 public poolUSDT;

    // Price related
    uint256 public constant REBALANCE_INTERVAL = 8 hours;  // 再平衡时间间隔改为8小时
    uint256 public constant REBALANCE_THRESHOLD = 5e6;      // 5% 价格变化阈值 (1e8 = 100%)

    // Events
    event Swap(address indexed user, bool isBuy, uint256 tokenAmount, uint256 usdtAmount);
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

    constructor(
        string memory name,
        string memory symbol,
        address _priceFeed,  // Binance 预言机地址
        address _usdt
    ) ERC20(name, symbol) {
        require(_priceFeed != address(0), "Invalid price feed address");
        require(_usdt != address(0), "Invalid USDT address");
        
        priceFeed = AggregatorV3Interface(_priceFeed);
        usdt = IERC20(_usdt);
        
        // Initialize pool with initial liquidity
        poolTokens = INITIAL_POOL_TOKENS;
        poolUSDT = INITIAL_POOL_USDT;
        _mint(address(this), INITIAL_POOL_TOKENS);
        
        // Get initial BTC price
        (, int256 price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid initial price");
        lastBTCPrice = uint256(price);
        lastPriceUpdateTime = block.timestamp;
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
        
        uint256 newPrice = uint256(price);
        
        // 只在价格变化时更新
        if (newPrice != lastBTCPrice) {
            lastBTCPrice = newPrice;
            lastPriceUpdateTime = block.timestamp;
            
            // Calculate and emit new AntiBTC price
            uint256 antibtcPrice = calculateAntiPrice(newPrice);
            emit PriceUpdated(newPrice, antibtcPrice);
        }
    }

    /**
     * @dev Calculates the inverse price of BTC
     */
    function calculateAntiPrice(uint256 btcPrice) public pure returns (uint256) {
        return PriceCalculator.calculateAntiPrice(btcPrice);
    }

    /**
     * @dev Buy AntiBTC tokens with USDT
     */
    function buyTokens(uint256 usdtAmount) external nonReentrant whenNotPaused {
        require(usdtAmount > 0, "Zero USDT amount");
        
        // Update price first
        updatePrice();
        
        // Calculate tokens to mint based on AMM formula
        uint256 tokensOut = calculateTokensOut(usdtAmount);
        require(tokensOut > 0, "Zero tokens out");
        
        // Transfer USDT from user
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        
        // Update pool state
        poolUSDT += usdtAmount;
        poolTokens -= tokensOut;
        
        // Transfer tokens
        _transfer(address(this), msg.sender, tokensOut);
        
        emit Swap(msg.sender, true, tokensOut, usdtAmount);
    }

    /**
     * @dev Sell AntiBTC tokens for USDT
     */
    function sellTokens(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Zero tokens");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Update price first
        updatePrice();
        
        // Calculate USDT out based on AMM formula
        uint256 usdtOut = calculateUSDTOut(tokenAmount);
        require(usdtOut > 0, "Zero USDT out");
        require(usdt.balanceOf(address(this)) >= usdtOut, "Insufficient liquidity");
        
        // Update pool state
        poolTokens += tokenAmount;
        poolUSDT -= usdtOut;
        
        // Transfer tokens and USDT
        _transfer(msg.sender, address(this), tokenAmount);
        require(usdt.transfer(msg.sender, usdtOut), "USDT transfer failed");
        
        emit Swap(msg.sender, false, tokenAmount, usdtOut);
    }

    /**
     * @dev Calculate tokens to receive for given USDT amount
     */
    function calculateTokensOut(uint256 usdtIn) public view returns (uint256) {
        return PriceCalculator.calculateTokensOut(usdtIn, poolTokens, poolUSDT);
    }

    /**
     * @dev Calculate USDT to receive for given token amount
     */
    function calculateUSDTOut(uint256 tokensIn) public view returns (uint256) {
        return PriceCalculator.calculateUSDTOut(tokensIn, poolTokens, poolUSDT);
    }

    /**
     * @dev Add liquidity to the pool
     */
    function addLiquidity(uint256 usdtAmount) external nonReentrant whenNotPaused {
        require(usdtAmount > 0, "Zero USDT amount");
        
        // Calculate proportional amount of tokens
        uint256 tokenAmount = (usdtAmount * poolTokens) / poolUSDT;
        require(tokenAmount > 0, "Zero token amount");
        
        // Transfer USDT from user
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        
        // Mint new tokens for liquidity provider
        _mint(msg.sender, tokenAmount);
        
        // Update pool state
        poolUSDT += usdtAmount;
        poolTokens += tokenAmount;
        
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
        
        // Burn tokens
        _burn(msg.sender, tokenAmount);
        
        // Transfer USDT to user
        require(usdt.transfer(msg.sender, usdtAmount), "USDT transfer failed");
        
        // Update pool state
        poolUSDT -= usdtAmount;
        poolTokens -= tokenAmount;
        
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
     * @dev 检查是否需要再平衡
     * 当满足以下任一条件时触发再平衡：
     * 1. 距离上次再平衡超过24小时
     * 2. BTC价格相对于上次再平衡时变化超过5%
     */
    function needsRebalance() public view returns (bool) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 currentPrice = uint256(price);
        uint256 timeSinceLastUpdate = block.timestamp - lastPriceUpdateTime;
        
        // 计算价格变化百分比
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
     * @dev Chainlink Automation 检查函数
     * 当需要再平衡时返回 true
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
     * @dev Chainlink Automation 执行函数
     * 只能被 Chainlink Automation Registry 调用
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        require(needsRebalance(), "Rebalance conditions not met");
        _rebalance();  // 内部再平衡函数
    }

    /**
     * @dev 内部再平衡函数
     */
    function _rebalance() internal {
        uint256 oldBtcPrice = lastBTCPrice;
        (, int256 price,,,) = priceFeed.latestRoundData();
        uint256 newBtcPrice = uint256(price);
        
        uint256 oldAntiPrice = PriceCalculator.calculateAntiPrice(oldBtcPrice);
        uint256 newAntiPrice = PriceCalculator.calculateAntiPrice(newBtcPrice);
        
        // 更新状态
        lastBTCPrice = newBtcPrice;
        lastPriceUpdateTime = block.timestamp;
        
        emit Rebalanced(
            oldBtcPrice,
            newBtcPrice,
            oldAntiPrice,
            newAntiPrice,
            block.timestamp
        );
    }

    /**
     * @dev 获取合约中托管的所有资产信息
     * @return _poolTokens 池中的AntiBTC代币数量
     * @return _poolUSDT 池中的USDT数量
     * @return _totalSupply AntiBTC的总供应量
     * @return _lastBTCPrice 最新的BTC价格
     * @return _lastAntiPrice 最新的AntiBTC价格
     * @return _lastPriceUpdateTime 上次再平衡时间
     */
    function getPoolInfo() external view returns (
        uint256 _poolTokens,
        uint256 _poolUSDT,
        uint256 _totalSupply,
        uint256 _lastBTCPrice,
        uint256 _lastAntiPrice,
        uint256 _lastPriceUpdateTime
    ) {
        return (
            poolTokens,
            poolUSDT,
            totalSupply(),
            lastBTCPrice,
            calculateAntiPrice(lastBTCPrice),
            lastPriceUpdateTime
        );
    }

    /**
     * @dev 获取用户在池中的份额信息
     * @param user 用户地址
     * @return _tokenBalance 用户持有的AntiBTC数量
     * @return _tokenShare 用户占总供应量的百分比（精度为1e8，即100% = 1e8）
     * @return _usdtValue 按当前池价格计算的USDT价值
     */
    function getUserShare(address user) external view returns (
        uint256 _tokenBalance,
        uint256 _tokenShare,
        uint256 _usdtValue
    ) {
        uint256 balance = balanceOf(user);
        uint256 total = totalSupply();
        
        // 计算用户份额百分比
        uint256 share = total > 0 ? (balance * 1e8) / total : 0;
        
        // 计算用户的USDT价值
        uint256 usdtValue = balance > 0 ? (balance * poolUSDT) / poolTokens : 0;
        
        return (balance, share, usdtValue);
    }

    /**
     * @dev 获取当前池子的价格信息
     * @return _btcPrice 当前BTC价格
     * @return _antiPrice 当前AntiBTC价格
     * @return _poolPrice 池子中的AntiBTC/USDT价格（1个AntiBTC值多少USDT）
     */
    function getPriceInfo() external view returns (
        uint256 _btcPrice,
        uint256 _antiPrice,
        uint256 _poolPrice
    ) {
        uint256 antiPrice = calculateAntiPrice(lastBTCPrice);
        uint256 poolPrice = poolTokens > 0 ? (poolUSDT * 1e18) / poolTokens : 0;  // 1e18是为了保持精度
        
        return (lastBTCPrice, antiPrice, poolPrice);
    }

    /**
     * @dev 获取再平衡状态信息
     * @return _needsRebalance 是否需要再平衡
     * @return _timeSinceLastRebalance 距离上次再平衡的时间（秒）
     * @return _priceChangePercentage 价格变化百分比（精度为1e8）
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

    // 修改原来的 rebalance 函数为手动触发
    function manualRebalance() external onlyOwner nonReentrant {
        require(needsRebalance(), "Rebalance conditions not met");
        _rebalance();
    }
} 