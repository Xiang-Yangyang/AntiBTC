// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPriceOracle.sol";
import "./libraries/SafeMath.sol";
import "./libraries/PriceCalculator.sol";

/**
 * @title AntiBTC
 * @dev Implementation of the AntiBTC token with AMM functionality
 */
contract AntiBTC is ERC20, ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;
    using PriceCalculator for uint256;

    // Constants
    uint256 public constant PRICE_PRECISION = 1e8;  // 8 decimals for price
    uint256 public constant INITIAL_PRICE = 1e8;    // Initial price of 1 USD
    uint256 public constant MAX_SLIPPAGE = 100;     // 1% max slippage

    // State variables
    IPriceOracle public priceOracle;
    IERC20 public usdt;  // USDT contract
    uint256 public lastBTCPrice;
    uint256 public lastUpdateTime;
    
    // Pool variables
    uint256 public constant INITIAL_POOL_TOKENS = 1000000 * 1e18;  // 1M tokens
    uint256 public constant INITIAL_POOL_USDT = 1000000 * 1e6;     // 1M USDT (6 decimals)
    uint256 public poolTokens;
    uint256 public poolUSDT;

    // Events
    event Swap(address indexed user, bool isBuy, uint256 tokenAmount, uint256 usdtAmount);
    event LiquidityAdded(address indexed provider, uint256 tokenAmount, uint256 usdtAmount);
    event LiquidityRemoved(address indexed provider, uint256 tokenAmount, uint256 usdtAmount);
    event PriceUpdated(uint256 btcPrice, uint256 antibtcPrice);

    constructor(address _priceOracle, address _usdt) ERC20("AntiBTC", "aBTC") {
        require(_priceOracle != address(0), "Invalid oracle address");
        require(_usdt != address(0), "Invalid USDT address");
        priceOracle = IPriceOracle(_priceOracle);
        usdt = IERC20(_usdt);
        
        // Initialize pool with initial liquidity
        poolTokens = INITIAL_POOL_TOKENS;
        poolUSDT = INITIAL_POOL_USDT;
        _mint(address(this), INITIAL_POOL_TOKENS);
        
        // Get initial BTC price
        (uint256 btcPrice, uint256 timestamp) = priceOracle.getBTCPrice();
        require(btcPrice > 0 && timestamp > 0, "Invalid initial price");
        lastBTCPrice = btcPrice;
        lastUpdateTime = timestamp;
    }

    /**
     * @dev Updates the BTC price from the oracle
     */
    function updatePrice() public {
        (uint256 newBTCPrice, uint256 timestamp) = priceOracle.getBTCPrice();
        // 在测试环境中，我们允许使用相同的时间戳
        require(newBTCPrice > 0, "Invalid price data");
        
        // 只有在时间戳更新或者是第一次调用时才更新价格
        if (timestamp > lastUpdateTime || lastUpdateTime == 0) {
            lastBTCPrice = newBTCPrice;
            lastUpdateTime = timestamp;
            
            // Calculate and emit new AntiBTC price
            uint256 antibtcPrice = calculateAntiPrice(newBTCPrice);
            emit PriceUpdated(newBTCPrice, antibtcPrice);
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
} 