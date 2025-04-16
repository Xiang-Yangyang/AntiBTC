const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AntiBTC", function () {
  let AntiBTC;
  let antiBTC;
  let MockBTCOracle;
  let mockOracle;
  let MockUSDT;
  let mockUSDT;
  let owner;
  let user1;
  let user2;
  
  // Initial BTC price set to $20,000
  const initialBTCPrice = ethers.utils.parseUnits("20000", 8);
  
  // Test USDT amount
  const testUSDTAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDT

  // Added: Constants definition
  const TOTAL_SUPPLY = ethers.utils.parseUnits("1000000000000", 18); // 1T
  const INITIAL_POOL_TOKENS = ethers.utils.parseUnits("1000000", 18);  // 1M
  const INITIAL_POOL_USDT = ethers.utils.parseUnits("1000000", 6);     // 1M

  before(async function() {
    // Check current network
    const network = await ethers.provider.getNetwork();
    console.log("\n=== Network Information ===");
    console.log("Chain ID:", network.chainId);
    console.log("Network Name:", network.name);
    
    // Get test account information
    [owner, user1, user2, ...addrs] = await ethers.getSigners();
    console.log("\n=== Account Information ===");
    console.log("Test Account Address:", owner.address);
    const balance = await owner.getBalance();
    console.log("Account Balance:", ethers.utils.formatEther(balance), "BNB");
    
    // Deploy mock USDT contract
    MockUSDT = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
    await mockUSDT.deployed();
    
    // Deploy mock BTC oracle
    MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
    mockOracle = await MockBTCOracle.deploy(initialBTCPrice);
    await mockOracle.deployed();
    
    // Deploy AntiBTC contract
    AntiBTC = await ethers.getContractFactory("AntiBTC");
    antiBTC = await AntiBTC.deploy(
      "AntiBTC",
      "AntiBTC",
      mockOracle.address,
      mockUSDT.address
    );
    await antiBTC.deployed();

    console.log("\n=== Contract Addresses ===");
    console.log("Mock Oracle Address:", mockOracle.address);
    console.log("USDT Address:", mockUSDT.address);
    console.log("AntiBTC Address:", antiBTC.address);
    console.log("==================\n");
  });

  beforeEach(async function () {
    // Reset entire network state
    await network.provider.request({
      method: "hardhat_reset",
      params: []
    });
    
    // Get test account information
    [owner, user1, user2, ...addrs] = await ethers.getSigners();
    
    // Deploy mock USDT contract
    MockUSDT = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6); // USDT has 6 decimals
    await mockUSDT.deployed();
    
    // Mint USDT to test users
    await mockUSDT.mint(owner.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    await mockUSDT.mint(user1.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    await mockUSDT.mint(user2.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    
    // Deploy mock BTC oracle
    MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
    mockOracle = await MockBTCOracle.deploy(initialBTCPrice);
    await mockOracle.deployed();
    
    // Deploy AntiBTC contract
    AntiBTC = await ethers.getContractFactory("AntiBTC");
    antiBTC = await AntiBTC.deploy(
      "AntiBTC",
      "AntiBTC",
      mockOracle.address,
      mockUSDT.address
    );
    await antiBTC.deployed();
  });

  describe("1. Network Environment", function () {
    it("1.1 Should run on local test network", async function () {
      const network = await ethers.provider.getNetwork();
      expect(network.chainId).to.equal(31337, "Chain ID should be 31337 (Hardhat)");
      
      const [owner] = await ethers.getSigners();
      const balance = await owner.getBalance();
      const balanceInBNB = parseFloat(ethers.utils.formatEther(balance));
      expect(balanceInBNB).to.be.closeTo(10000, 1, "Initial balance should be close to 10000 BNB");
    });

    it("1.2 Should display gas consumption of contract deployment", async function () {
      const [owner] = await ethers.getSigners();
      const initialBalance = await owner.getBalance();
      
      // Deploy contracts
      const MockUSDT = await ethers.getContractFactory("MockERC20");
      const mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
      await mockUSDT.deployed();
      
      const MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
      const mockOracle = await MockBTCOracle.deploy(ethers.utils.parseUnits("20000", 8));
      await mockOracle.deployed();
      
      const finalBalance = await owner.getBalance();
      const gasUsed = ethers.utils.formatEther(initialBalance.sub(finalBalance));
      
      console.log("\n=== Gas Consumption Information ===");
      console.log("Deploying two contracts consumed BNB:", gasUsed);
      console.log("==================\n");
      
      // Verify gas consumption within reasonable range
      expect(parseFloat(gasUsed)).to.be.lt(0.1, "Single deployment gas consumption should be less than 0.1 BNB");
    });
  });

  describe("2. Contract Deployment", function () {
    it("2.1 Should successfully deploy AntiBTC contract", async function () { 
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("AntiBTC");
    });
    
    it("2.2 Should correctly set token name and symbol", async function () {
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("AntiBTC");
    });
    
    it("2.3 Should correctly set price feed address", async function () {
      expect(await antiBTC.priceFeed()).to.equal(mockOracle.address);
    });
    
    it("2.4 Should correctly set initial liquidity", async function () {
      // Verify initial liquidity settings
      expect(await antiBTC.poolAntiBTC()).to.equal(INITIAL_POOL_TOKENS);
      expect(await antiBTC.poolUSDT()).to.equal(INITIAL_POOL_USDT);
      
      // Verify initial price is 1 USDT
      const price = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(price, 8)).to.equal("1.0");
      
      // Verify total supply
      expect(await antiBTC.totalSupply()).to.equal(TOTAL_SUPPLY);
      
      // Verify reserve amount
      const reserveTokens = await antiBTC.reserveAntiBTC();
      expect(reserveTokens).to.equal(TOTAL_SUPPLY.sub(INITIAL_POOL_TOKENS));
    });
  });
  
  describe("3. Liquidity Pool", function () {
    it("3.1 Should correctly set initial liquidity", async function () {
      expect(await antiBTC.poolAntiBTC()).to.equal(INITIAL_POOL_TOKENS);
      expect(await antiBTC.poolUSDT()).to.equal(INITIAL_POOL_USDT);
      
      // Verify initial price
      const price = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(price, 8)).to.equal("1.0");
    });
    
    it("3.2 Should correctly calculate price", async function () {
      // Verify initial price is 1 USDT
      const poolPrice = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(poolPrice, 8)).to.equal("1.0");
      
      // Verify theoretical reverse price
      const antiPrice = await antiBTC.calculateAntiPrice(initialBTCPrice);
      // K = 20000e8, btcPrice = 20000e8
      // antiPrice = K * 1e8 / btcPrice = 20000e8 * 1e8 / 20000e8 = 1e8 (1 USD)
      expect(antiPrice).to.equal(ethers.utils.parseUnits("1", 8));
    });
    
    it("3.3 Should correctly calculate slippage", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // Calculate slippage adjusted tokens
        const tokensAfterSlippage = await antiBTC.calculateTokensOut(usdtAmount);
        
        // Calculate slippage
        const slippage = ethers.utils.parseEther("1000").sub(tokensAfterSlippage);
        const slippagePercentage = slippage.mul(10000).div(ethers.utils.parseEther("1000"));
        
        console.log("Slippage-adjusted tokens obtained:", ethers.utils.formatEther(tokensAfterSlippage), "AntiBTC");
        console.log("Theoretical tokens without slippage:", ethers.utils.formatEther(ethers.utils.parseEther("1000")), "AntiBTC");
        console.log("Slippage percentage:", ethers.utils.formatUnits(slippagePercentage, 2), "%");
        
        // Verify slippage does not exceed 1%
        expect(slippagePercentage).to.be.lte(100);  // 100 = 1%
    });
    
    it("3.4 Should correctly calculate transaction amount", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // Calculate expected tokens to be received
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // Calculate expected payment amount
        const expectedUsdt = await antiBTC.calculateUSDTOut(expectedTokens);
        
        // Verify expected payment amount is slightly less than input amount (due to slippage)
        expect(expectedUsdt).to.be.lt(usdtAmount);
        // Verify slippage does not exceed 1%
        const slippage = usdtAmount.sub(expectedUsdt);
        const slippagePercentage = slippage.mul(10000).div(usdtAmount);
        expect(slippagePercentage).to.be.lte(100);  // 100 = 1%
    });
  });
  
  describe("4. Trading Functions", function () {
    it("4.1 Should display detailed process and amount for buying AntiBTC", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // Get initial balances
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== Purchase Details ===");
        console.log("USDT Balance Before:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("AntiBTC Balance Before:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("Gas Balance Before:", ethers.utils.formatEther(initialGasBalance), "BNB\n");
        
        // Get initial pool status
        const initialPoolTokens = await antiBTC.poolAntiBTC();
        const initialPoolUsdt = await antiBTC.poolUSDT();
        const initialPrice = await antiBTC.getPrice();
        
        console.log("=== Initial Pool Status ===");
        console.log("AntiBTC in Pool:", ethers.utils.formatEther(initialPoolTokens), "AntiBTC");
        console.log("USDT in Pool:", ethers.utils.formatUnits(initialPoolUsdt, 6), "USDT");
        console.log("Current Price:", ethers.utils.formatUnits(initialPrice, 6), "AntiBTC/USDT\n");
        
        // Calculate expected tokens to be received (considering fee)
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        const effectivePrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("User will use", ethers.utils.formatUnits(usdtAmount, 6), "USDT to buy AntiBTC");
        console.log("Expected to receive:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Expected Average Price:", ethers.utils.formatUnits(effectivePrice, 6), "AntiBTC/USDT\n");
        
        // Execute purchase
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // Calculate gas fees
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // Convert using 1 BNB = 600 USDT rate
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Gas Fee Information ===");
        console.log("Gas Used:", gasUsed.toString(), "gas");
        console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Total Gas Cost:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas Cost (USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("==================\n");
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        console.log("=== Purchase Result ===");
        console.log("USDT Balance After:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("AntiBTC Balance After:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("Gas Balance After:", ethers.utils.formatEther(finalGasBalance), "BNB");
        console.log("Actual Spent:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("Actual Received:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("Actual Average Price:", ethers.utils.formatUnits(effectivePrice, 6), "AntiBTC/USDT\n");
        
        // Get final pool status
        const finalPoolTokens = await antiBTC.poolAntiBTC();
        const finalPoolUsdt = await antiBTC.poolUSDT();
        const finalPrice = await antiBTC.getPrice();
        
        console.log("=== Post-Purchase Pool Status ===");
        console.log("AntiBTC in Pool:", ethers.utils.formatEther(finalPoolTokens), "AntiBTC");
        console.log("USDT in Pool:", ethers.utils.formatUnits(finalPoolUsdt, 6), "USDT");
        console.log("Current Price:", ethers.utils.formatUnits(finalPrice, 6), "AntiBTC/USDT");
        console.log("==================\n");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(expectedTokens);
    });

    it("4.2 Should allow user to buy AntiBTC with USDT", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // Get initial balances
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== Transaction Before ===");
        console.log("Initial BNB Balance:", ethers.utils.formatEther(initialGasBalance), "BNB");
        
        // Calculate expected tokens to be received (considering fee)
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        
        // Execute purchase
        console.log("\n=== Executing Purchase Transaction ===");
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // Calculate gas fees
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // Convert using 1 BNB = 600 USDT rate
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Detailed Gas Fee Information ===");
        console.log("Transaction Hash:", tx.hash);
        console.log("Block Number:", receipt.blockNumber);
        console.log("Gas Used:", gasUsed.toString(), "gas");
        console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Total Gas Cost:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas Cost (USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("==================\n");
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        console.log("=== Transaction After ===");
        console.log("Final BNB Balance:", ethers.utils.formatEther(finalGasBalance), "BNB");
        console.log("BNB Balance Change:", ethers.utils.formatEther(initialGasBalance.sub(finalGasBalance)), "BNB");
        console.log("==================\n");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(expectedTokens);
    });
    
    it("4.3 Should allow user to sell AntiBTC for USDT", async function() {
        // First buy some tokens
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        console.log("\n=== Initial Purchase to Get AntiBTC ===");
        console.log("Buying Amount:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const buyTx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const buyReceipt = await buyTx.wait();
        const buyEvent = buyReceipt.events.find(e => e.event === "Swap");
        console.log("Received AntiBTC:", ethers.utils.formatEther(buyEvent.args.tokenAmount), "AntiBTC");
        
        // Get balances before selling
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== Pre-Sell Status ===");
        console.log("USDT Balance Before:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("AntiBTC Balance Before:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("Gas Balance Before:", ethers.utils.formatEther(initialGasBalance), "BNB");
        
        // Get initial pool status
        const initialPoolTokens = await antiBTC.poolAntiBTC();
        const initialPoolUsdt = await antiBTC.poolUSDT();
        const initialPrice = await antiBTC.getPrice();
        
        console.log("\n=== Initial Pool Status ===");
        console.log("AntiBTC in Pool:", ethers.utils.formatEther(initialPoolTokens), "AntiBTC");
        console.log("USDT in Pool:", ethers.utils.formatUnits(initialPoolUsdt, 6), "USDT");
        console.log("Current Price:", ethers.utils.formatUnits(initialPrice, 6), "AntiBTC/USDT");
        
        // Calculate expected USDT amount to be received
        const expectedUsdt = await antiBTC.calculateUSDTOut(initialAntiBalance);
        const fee = expectedUsdt.mul(30).div(10000);  // 0.3% fee
        const expectedUsdtAfterFee = expectedUsdt.sub(fee);
        
        console.log("\n=== Expected Sell Result ===");
        console.log("Selling Amount:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("Expected USDT:", ethers.utils.formatUnits(expectedUsdt, 6), "USDT");
        console.log("Expected Fee:", ethers.utils.formatUnits(fee, 6), "USDT");
        console.log("Expected USDT After Fee:", ethers.utils.formatUnits(expectedUsdtAfterFee, 6), "USDT");
        
        // Execute sell
        console.log("\n=== Executing Sell Transaction ===");
        const tx = await antiBTC.connect(owner).sellTokens(initialAntiBalance);
        const receipt = await tx.wait();
        
        // Calculate gas fees
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Gas Fee Information ===");
        console.log("Gas Used:", gasUsed.toString(), "gas");
        console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Total Gas Cost:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas Cost (USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        
        // Get event details
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        console.log("\n=== Swap Event Details ===");
        console.log("User:", swapEvent.args.user);
        console.log("Is Buy:", swapEvent.args.isBuy);
        console.log("Token Amount:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("USDT Amount:", ethers.utils.formatUnits(swapEvent.args.usdtAmount, 6), "USDT");
        console.log("Fee:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT");
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        // Get final pool status
        const finalPoolTokens = await antiBTC.poolAntiBTC();
        const finalPoolUsdt = await antiBTC.poolUSDT();
        const finalPrice = await antiBTC.getPrice();
        
        console.log("\n=== Final Status ===");
        console.log("USDT Balance After:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("AntiBTC Balance After:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("Gas Balance After:", ethers.utils.formatEther(finalGasBalance), "BNB");
        console.log("USDT Change:", ethers.utils.formatUnits(finalUsdtBalance.sub(initialUsdtBalance), 6), "USDT");
        console.log("Gas Used (in BNB):", ethers.utils.formatEther(initialGasBalance.sub(finalGasBalance)), "BNB");
        
        console.log("\n=== Final Pool Status ===");
        console.log("AntiBTC in Pool:", ethers.utils.formatEther(finalPoolTokens), "AntiBTC");
        console.log("USDT in Pool:", ethers.utils.formatUnits(finalPoolUsdt, 6), "USDT");
        console.log("Final Price:", ethers.utils.formatUnits(finalPrice, 6), "AntiBTC/USDT");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.add(expectedUsdtAfterFee));
        expect(finalAntiBalance).to.equal(0);
    });

    it("4.4 Should adjust AntiBTC purchase price based on BTC price change", async function () {
      // Record initial state
      const initialBtcPrice = await antiBTC.lastBTCPrice();
      const initialPoolPrice = await antiBTC.getPrice();
      const initialPoolInfo = await antiBTC.getPoolInfo();
      
      console.log("\n\n======= BTC Price Change Test =======");
      console.log("Initial BTC Price:", ethers.utils.formatUnits(initialBtcPrice, 8), "USD");
      console.log("Initial AntiBTC Pool Price:", ethers.utils.formatUnits(initialPoolPrice, 6), "AntiBTC/USDT");
      console.log("Initial AntiBTC in Pool:", ethers.utils.formatEther(initialPoolInfo[0]), "AntiBTC");
      console.log("Initial USDT in Pool:", ethers.utils.formatUnits(initialPoolInfo[2], 6), "USDT");
      console.log("Initial AntiBTC Reserve:", ethers.utils.formatEther(initialPoolInfo[1]), "AntiBTC");

      // First purchase (BTC = $20,000)
      await mockUSDT.connect(owner).approve(antiBTC.address, testUSDTAmount);
      const firstBuyTx = await antiBTC.connect(owner).buyTokens(testUSDTAmount);
      const firstBuyReceipt = await firstBuyTx.wait();
      const firstTokensReceived = firstBuyReceipt.events.find(e => e.event === "Swap").args[2];
      
      console.log("\n----- First Purchase (BTC = $20,000) -----");
      console.log("Paid:", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      console.log("Received:", ethers.utils.formatEther(firstTokensReceived), "AntiBTC");
      console.log("Post-Purchase AntiBTC Pool Price:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "AntiBTC/USDT");
      
      // BTC price increases to $22,000 (up 10%)
      const newBtcPrice = initialBtcPrice.mul(110).div(100);
      await mockOracle.updatePrice(newBtcPrice);
      
      // Calculate theoretical target price
      // When BTC rises 10%, AntiBTC price should fall about 9.09% (1/1.1 ≈ 0.9091)
      const expectedPriceAfterBtcIncrease = initialPoolPrice.mul(1e6).div(ethers.utils.parseUnits("1.1", 6));
      
      console.log("\n----- BTC Price Increase by 10% -----");
      console.log("BTC Price increased from", ethers.utils.formatUnits(initialBtcPrice, 8), "to", ethers.utils.formatUnits(newBtcPrice, 8), "USD");
      console.log("Theoretically, AntiBTC Price should decrease from", ethers.utils.formatUnits(initialPoolPrice, 6), 
                 "to approximately", ethers.utils.formatUnits(expectedPriceAfterBtcIncrease, 6), "AntiBTC/USDT");
      
      // Record pre-rebalance pool status
      const beforeRebalancePoolInfo = await antiBTC.getPoolInfo();
      console.log("\nPre-Rebalance Pool Status:");
      console.log("AntiBTC in Pool:", ethers.utils.formatEther(beforeRebalancePoolInfo[0]), "AntiBTC");
      console.log("USDT in Pool:", ethers.utils.formatUnits(beforeRebalancePoolInfo[2], 6), "USDT");
      const preRebalancePrice = await antiBTC.getPrice();
      console.log("AntiBTC Price:", ethers.utils.formatUnits(preRebalancePrice, 6), "AntiBTC/USDT");
      
      // Trigger rebalance
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const rebalanceTx = await antiBTC.manualRebalance();
      const rebalanceReceipt = await rebalanceTx.wait();
      
      // Check pool adjustment event
      const poolAdjustedEvent = rebalanceReceipt.events.find(e => e.event === "PoolAdjusted");
      if (poolAdjustedEvent) {
        console.log("\n----- Pool Adjustment Event -----");
        console.log("Old Pool AntiBTC:", ethers.utils.formatEther(poolAdjustedEvent.args[0]), "AntiBTC");
        console.log("New Pool AntiBTC:", ethers.utils.formatEther(poolAdjustedEvent.args[1]), "AntiBTC");
        console.log("Old Reserve AntiBTC:", ethers.utils.formatEther(poolAdjustedEvent.args[2]), "AntiBTC");
        console.log("New Reserve AntiBTC:", ethers.utils.formatEther(poolAdjustedEvent.args[3]), "AntiBTC");
        
        // Calculate adjustment ratio
        const poolTokensIncrease = poolAdjustedEvent.args[1].sub(poolAdjustedEvent.args[0]);
        const poolTokensIncreasePercent = poolTokensIncrease.mul(10000).div(poolAdjustedEvent.args[0]).toNumber() / 100;
        console.log("Pool AntiBTC Increase:", ethers.utils.formatEther(poolTokensIncrease), "AntiBTC", `(+${poolTokensIncreasePercent}%)`);
      } else {
        console.log("PoolAdjusted event not found");
      }
      
      // Get rebalance price and pool status
      const afterRebalancePrice = await antiBTC.getPrice();
      const afterRebalancePoolInfo = await antiBTC.getPoolInfo();

      console.log("\n----- Post-Rebalance Pool Status -----");
      console.log("AntiBTC in Pool:", ethers.utils.formatEther(afterRebalancePoolInfo[0]), "AntiBTC");
      console.log("USDT in Pool:", ethers.utils.formatUnits(afterRebalancePoolInfo[2], 6), "USDT");
      console.log("AntiBTC Price:", ethers.utils.formatUnits(afterRebalancePrice, 6), "USDT/AntiBTC");
      
      // Calculate price change percentage
      const priceChangePercent = initialPoolPrice.gt(afterRebalancePrice) 
        ? initialPoolPrice.sub(afterRebalancePrice).mul(10000).div(initialPoolPrice).toNumber() / 100
        : afterRebalancePrice.sub(initialPoolPrice).mul(10000).div(initialPoolPrice).toNumber() / 100;
      
      const priceDirection = initialPoolPrice.gt(afterRebalancePrice) ? "decreased" : "increased";
      console.log(`AntiBTC Price ${priceDirection} by ${priceChangePercent}%`);
      
      // Verify price change direction: When BTC price rises, AntiBTC price should fall
      expect(afterRebalancePrice).to.be.lt(initialPoolPrice);
      
      // Verify price change magnitude: When BTC price rises 10%, AntiBTC price should fall about 9.09%
      // Allow 1% error
      const lowerBound = expectedPriceAfterBtcIncrease.mul(99).div(100);
      const upperBound = expectedPriceAfterBtcIncrease.mul(101).div(100);
      
      // Verify price is within expected range
      console.log("Expected Price Range:");
      console.log("Lower Bound:", ethers.utils.formatUnits(lowerBound, 6), "USDT/AntiBTC");
      console.log("Actual Price:", ethers.utils.formatUnits(afterRebalancePrice, 6), "USDT/AntiBTC");
      console.log("Upper Bound:", ethers.utils.formatUnits(upperBound, 6), "USDT/AntiBTC");
      
      expect(afterRebalancePrice).to.be.gt(lowerBound);
      expect(afterRebalancePrice).to.be.lt(upperBound);
      
      // Second purchase (BTC = $22,000)
      await mockUSDT.connect(user2).approve(antiBTC.address, testUSDTAmount);
      const secondBuyTx = await antiBTC.connect(user2).buyTokens(testUSDTAmount);
      const secondBuyReceipt = await secondBuyTx.wait();
      const secondTokensReceived = secondBuyReceipt.events.find(e => e.event === "Swap").args[2];

      console.log("\n----- Second Purchase (BTC = $22,000) -----");
      console.log("Paid:", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      console.log("Received:", ethers.utils.formatEther(secondTokensReceived), "AntiBTC");
      console.log("Post-Purchase AntiBTC Pool Price:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "AntiBTC/USDT");
      
      // Calculate token increase
      const tokenIncrease = secondTokensReceived.sub(firstTokensReceived);
      const tokenIncreasePercent = tokenIncrease.mul(10000).div(firstTokensReceived).toNumber() / 100;
      
      console.log("\n----- Purchase Result Comparison -----");
      console.log("First Purchase Received:", ethers.utils.formatEther(firstTokensReceived), "AntiBTC");
      console.log("Second Purchase Received:", ethers.utils.formatEther(secondTokensReceived), "AntiBTC");
      console.log(`Second Purchase Received More: ${ethers.utils.formatEther(tokenIncrease)} AntiBTC (+${tokenIncreasePercent}%)`);
      
      // Verify: When BTC price rises, AntiBTC price falls, should receive more AntiBTC
      expect(secondTokensReceived).to.be.gt(firstTokensReceived);
      
      // Verify: Token increase ratio should be close to price decrease ratio
      // When BTC price rises 10%, AntiBTC falls about 9.09%, should receive about 10% more tokens
      expect(tokenIncreasePercent).to.be.closeTo(10, 1.5); // Allow 1.5% error
      
      console.log("\n======= Test Conclusion =======");
      console.log(`BTC Price Increased by 10%, AntiBTC Price ${priceDirection} by ${priceChangePercent}%`);
      console.log(`Received AntiBTC Quantity Increased by ${tokenIncreasePercent}%`);
      console.log("Verification Passed: Price Change Conforms to Reverse Tracking Expectation\n");
    });
  });
  
  describe("5. Price Feed Function", function () {
    it("5.1 Should correctly get BTC price", async function () {
      expect(await antiBTC.lastBTCPrice()).to.equal(initialBTCPrice);
    });

    it("5.2 Should correctly calculate AntiBTC price", async function () {
      // When BTC price is $20,000
      const antiPrice = await antiBTC.calculateAntiPrice(initialBTCPrice);
      
      // K = 20000e8, btcPrice = 20000e8
      // antiPrice = K * 1e8 / btcPrice = 20000e8 * 1e8 / 20000e8 = 1e8 (1 USD)
      const expectedAntiPrice = ethers.utils.parseUnits("1", 8);
      expect(antiPrice).to.equal(expectedAntiPrice);
      
      // Test lower BTC price
      const lowerBTCPrice = ethers.utils.parseUnits("10000", 8); // $10,000
      const antiPriceLower = await antiBTC.calculateAntiPrice(lowerBTCPrice);
      
      // K = 20000e8, btcPrice = 10000e8
      // antiPrice = K * 1e8 / btcPrice = 20000e8 * 1e8 / 10000e8 = 2e8 (2 USD)
      const expectedAntiPriceLower = ethers.utils.parseUnits("2", 8);
      expect(antiPriceLower).to.equal(expectedAntiPriceLower);
    });
    
    it("5.3 Should correctly calculate AntiBTC price (considering slippage)", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // Calculate expected tokens to be received
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // Calculate actual price with 8 decimal precision
        const actualPrice = usdtAmount.mul(ethers.utils.parseUnits("1", 20)).div(expectedTokens);
        
        // Get theoretical price
        const theoreticalPrice = await antiBTC.getPrice();
        
        // Verify actual price is slightly higher than theoretical price (due to slippage)
        expect(actualPrice).to.be.gt(theoreticalPrice);
    });

    it("5.4 Should correctly calculate AntiBTC price (considering liquidity)", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
      
        // Calculate expected tokens to be received
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // Calculate actual price with 8 decimal precision
        const actualPrice = usdtAmount.mul(ethers.utils.parseUnits("1", 20)).div(expectedTokens);
        
        // Get theoretical price
        const theoreticalPrice = await antiBTC.getPrice();
        
        // Verify actual price is slightly higher than theoretical price (due to liquidity impact)
        expect(actualPrice).to.be.gt(theoreticalPrice);
    });
  });
  
  describe("6. Rebalance Function", function () {
    it("6.1 Should correctly calculate rebalance threshold", async function () {
      // Initial state does not need rebalance
      const initialRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(initialRebalanceInfo._needsRebalance).to.be.false;

      // Simulate time passing 8 hours
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]); // 8 hours
      await ethers.provider.send("evm_mine");

      // Now it should need rebalance
      const afterTimeRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(afterTimeRebalanceInfo._needsRebalance).to.be.true;
      expect(afterTimeRebalanceInfo._timeSinceLastRebalance).to.be.gte(8 * 60 * 60);
    });

    it("6.2 Should correctly calculate rebalance quantity", async function () {
      // Update price, 6% increase
      const newPrice = initialBTCPrice.mul(106).div(100); // Increase 6%
      await mockOracle.updatePrice(newPrice);

      // Check if rebalance is needed
      const rebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(rebalanceInfo._needsRebalance).to.be.true;
      expect(rebalanceInfo._priceChangePercentage).to.be.gte(ethers.utils.parseUnits("5", 6)); // 5%
    });

    it("6.3 Should correctly execute rebalance", async function () {
      // Record initial state
      const initialUpdateTime = await antiBTC.lastPriceUpdateTime();
      const initialBtcPrice = await antiBTC.lastBTCPrice();

      // Update price and wait 8 hours
      const newPrice = initialBtcPrice.mul(106).div(100); // Increase 6%
      await mockOracle.updatePrice(newPrice);
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Execute rebalance
      const tx = await antiBTC.manualRebalance();
      const receipt = await tx.wait();

      // Verify event
      const rebalanceEvent = receipt.events.find(e => e.event === "Rebalanced");
      expect(rebalanceEvent).to.not.be.undefined;
      
      // Verify state update
      const newUpdateTime = await antiBTC.lastPriceUpdateTime();
      expect(newUpdateTime).to.be.gt(initialUpdateTime);
      
      // Verify price update
      const updatedBtcPrice = await antiBTC.lastBTCPrice();
      expect(updatedBtcPrice).to.equal(newPrice);

      // Verify rebalance after no longer needs rebalance
      const afterRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(afterRebalanceInfo._needsRebalance).to.be.false;
      expect(afterRebalanceInfo._priceChangePercentage).to.equal(0); // Price change percentage should reset to 0
    });
  });
  
  describe("7. Fee Functions", function () {
    it("7.1 Should correctly set fee rate", async function() {
        const feeRate = await antiBTC.FEE_RATE();
        expect(feeRate).to.equal(30);  // 0.3%
    });
    
    it("7.2 Should correctly collect buy fee", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const expectedFee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        
        // Get initial balances
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("\n=== Buy Fee Test ===");
        console.log("Initial USDT Balance:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("Initial AntiBTC Balance:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("Expected Fee:", ethers.utils.formatUnits(expectedFee, 6), "USDT\n");
        
        // Execute buy
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // Get event
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== Event Log ===");
        console.log("Swap Event:");
        console.log("User:", swapEvent.args.user);
        console.log("Is Buy:", swapEvent.args.isBuy);
        console.log("Token Amount:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("USDT Amount:", ethers.utils.formatUnits(swapEvent.args.usdtAmount, 6), "USDT");
        console.log("Fee:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT\n");
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("=== Post-Buy Status ===");
        console.log("Final USDT Balance:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("Final AntiBTC Balance:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("==================\n");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(swapEvent.args.fee).to.equal(expectedFee);
    });
    
    it("7.3 Should correctly collect sell fee", async function() {
        // First buy some tokens
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        await antiBTC.connect(owner).buyTokens(usdtAmount);
        
        // Get balances before selling
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        
        // Calculate expected USDT amount to be received
        const expectedUsdt = await antiBTC.calculateUSDTOut(initialAntiBalance);
        const expectedFee = expectedUsdt.mul(30).div(10000);
        const expectedUsdtAfterFee = expectedUsdt.sub(expectedFee);
        
        // Execute sell
        const tx = await antiBTC.connect(owner).sellTokens(initialAntiBalance);
        const receipt = await tx.wait();
        
        // Get event
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== Event Log ===");
        console.log("Swap Event:");
        console.log("User:", swapEvent.args.user);
        console.log("Is Buy:", swapEvent.args.isBuy);
        console.log("Token Amount:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("USDT Amount:", ethers.utils.formatUnits(swapEvent.args.usdtAmount, 6), "USDT");
        console.log("Fee:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT\n");
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("=== Post-Sell Status ===");
        console.log("Final USDT Balance:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("Final AntiBTC Balance:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("==================\n");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.add(expectedUsdtAfterFee));
        expect(finalAntiBalance).to.equal(0);
        expect(swapEvent.args.fee).to.equal(expectedFee);
    });
    
    it("7.5 Should correctly calculate effective price with fee", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        
        // Calculate expected tokens to be received
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        const effectivePrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("\n=== Fee Impact on Price Test ===");
        console.log("Initial Price:", ethers.utils.formatUnits(await antiBTC.getPrice(), 18), "AntiBTC/USDT");
        console.log("User Paid:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("Fee:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("Actual Used for Purchase:", ethers.utils.formatUnits(usdtAmountAfterFee, 6), "USDT");
        console.log("Expected Tokens Received:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Effective Price:", ethers.utils.formatUnits(effectivePrice, 18), "AntiBTC/USDT\n");
        
        // Execute buy
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // Get event
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== Actual Transaction Result ===");
        console.log("Actual Tokens Received:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("Actual Fee:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT");
        console.log("==================\n");
        
        // Verify actual tokens received
        expect(swapEvent.args.tokenAmount).to.equal(expectedTokens);
        expect(swapEvent.args.fee).to.equal(fee);
    });

    it("7.6 Should correctly calculate cumulative impact of all fees", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        
        // Get initial balances
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== Cumulative Fee Impact Test ===\n");
        console.log("=== Initial State ===");
        console.log("Initial USDT Balance:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("Initial AntiBTC Balance:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("Initial Gas Balance:", ethers.utils.formatEther(initialGasBalance), "BNB\n");
        
        // Calculate expected tokens to be received
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        
        console.log("=== Fee Impact Analysis ===");
        console.log("Transaction Amount:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("AMM Slippage Impact:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Fee:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("Fee Impact:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Final Expected Tokens Received:", ethers.utils.formatEther(expectedTokens), "AntiBTC\n");
        
        // Execute buy
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // Get final balances
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        // Calculate gas fees
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // Convert using 1 BNB = 600 USDT rate
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("=== Actual Transaction Result ===");
        console.log("Final USDT Balance:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("Final AntiBTC Balance:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("Final Gas Balance:", ethers.utils.formatEther(finalGasBalance), "BNB\n");
        
        // Calculate total cost
        const totalCost = usdtAmount.add(gasCostInUsdt);
        const effectivePrice = totalCost.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("=== Cumulative Cost Analysis ===");
        console.log("USDT Cost:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("Gas Cost:", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("Total Cost:", ethers.utils.formatUnits(totalCost, 6), "USDT");
        console.log("Received Tokens:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Actual Effective Price:", ethers.utils.formatUnits(effectivePrice, 18), "AntiBTC/USDT\n");
        
        // Calculate total fee percentage
        const totalFees = fee.add(gasCostInUsdt);
        const totalFeePercentage = totalFees.mul(10000).div(usdtAmount);
        
        console.log("=== Total Fee Analysis ===");
        console.log("AMM Slippage Impact:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("Transaction Fee:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("Gas Fee:", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("Total Fee Percentage:", ethers.utils.formatUnits(totalFeePercentage, 2), "%");
        console.log("==================\n");
        
        // Verify balance changes
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(initialAntiBalance.add(expectedTokens));
        
        // Verify gas balance changes (Allow 0.01 BNB error)
        const expectedGasBalance = initialGasBalance.sub(gasCost);
        const gasBalanceDiff = finalGasBalance.sub(expectedGasBalance);
        expect(gasBalanceDiff.abs()).to.be.lte(ethers.utils.parseEther("0.01"));
    });

    it("7.7 Should compare gas usage of different functions", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        console.log("\n=== Gas Usage Comparison of Different Functions ===\n");
        
        // Test getPrice function
        const price = await antiBTC.getPrice();
        const getPriceGas = await antiBTC.estimateGas.getPrice();
        console.log("getPrice Function:");
        console.log("Price:", ethers.utils.formatUnits(price, 6), "AntiBTC/USDT");
        console.log("Gas Used:", getPriceGas.toString(), "gas");
        console.log("Operation Type: view function (includes division operation)\n");
        
        // Test calculateTokensOut function
        const calculateTokensTx = await antiBTC.calculateTokensOut(usdtAmount);
        const calculateTokensGas = await antiBTC.estimateGas.calculateTokensOut(usdtAmount);
        console.log("calculateTokensOut Function:");
        console.log("Gas Used:", calculateTokensGas.toString(), "gas");
        console.log("Operation Type: calculation operation\n");
        
        // Test buyTokens function
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const buyTokensTx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const buyTokensReceipt = await buyTokensTx.wait();
        console.log("buyTokens Function:");
        console.log("Gas Used:", buyTokensReceipt.gasUsed.toString(), "gas");
        console.log("Operation Type: state read + calculation + storage\n");
        
        // Verify gas usage reasonability
        expect(getPriceGas).to.be.gt(0);  // getPrice does consume gas
        expect(calculateTokensGas).to.be.gt(getPriceGas);  // calculateTokensOut consumes more gas
        expect(buyTokensReceipt.gasUsed).to.be.gt(calculateTokensGas);  // buyTokens consumes most gas
        
        console.log("=== Gas Usage Analysis ===");
        console.log("1. getPrice: small gas, because includes division operation");
        console.log("2. calculateTokensOut: medium, because includes more calculation operation");
        console.log("3. buyTokens: highest, because includes state read, calculation, and storage operation");
        console.log("==================\n");
    });
  });
}); 