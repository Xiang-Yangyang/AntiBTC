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
  
  // 初始 BTC 价格设置为 $20,000
  const initialBTCPrice = ethers.utils.parseUnits("20000", 8);
  
  // 测试用 USDT 金额
  const testUSDTAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDT

  // 新增：常量定义
  const TOTAL_SUPPLY = ethers.utils.parseUnits("1000000000000", 18); // 1T
  const INITIAL_POOL_TOKENS = ethers.utils.parseUnits("1000000", 18);  // 1M
  const INITIAL_POOL_USDT = ethers.utils.parseUnits("1000000", 6);     // 1M

  before(async function() {
    // 检查当前网络
    const network = await ethers.provider.getNetwork();
    console.log("\n=== 网络信息 ===");
    console.log("Chain ID:", network.chainId);
    console.log("网络名称:", network.name);
    
    // 获取测试账户信息
    [owner, user1, user2, ...addrs] = await ethers.getSigners();
    console.log("\n=== 账户信息 ===");
    console.log("测试账户地址:", owner.address);
    const balance = await owner.getBalance();
    console.log("账户余额:", ethers.utils.formatEther(balance), "BNB");
    
    // 部署模拟 USDT 合约
    MockUSDT = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
    await mockUSDT.deployed();
    
    // 部署模拟 BTC 预言机
    MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
    mockOracle = await MockBTCOracle.deploy(initialBTCPrice);
    await mockOracle.deployed();
    
    // 部署 AntiBTC 合约
    AntiBTC = await ethers.getContractFactory("AntiBTC");
    antiBTC = await AntiBTC.deploy(
      "AntiBTC",
      "AntiBTC",
      mockOracle.address,
      mockUSDT.address
    );
    await antiBTC.deployed();

    console.log("\n=== 合约地址信息 ===");
    console.log("Mock Oracle 地址:", mockOracle.address);
    console.log("USDT 地址:", mockUSDT.address);
    console.log("AntiBTC 地址:", antiBTC.address);
    console.log("==================\n");
  });

  beforeEach(async function () {
    // 重置整个网络状态
    await network.provider.request({
      method: "hardhat_reset",
      params: []
    });
    
    // 获取测试账户
    [owner, user1, user2, ...addrs] = await ethers.getSigners();
    
    // 部署模拟 USDT 合约
    MockUSDT = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6); // USDT 是 6 位小数
    await mockUSDT.deployed();
    
    // 向测试用户铸造 USDT
    await mockUSDT.mint(owner.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    await mockUSDT.mint(user1.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    await mockUSDT.mint(user2.address, ethers.utils.parseUnits("10000", 6)); // 10,000 USDT
    
    // 部署模拟 BTC 预言机
    MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
    mockOracle = await MockBTCOracle.deploy(initialBTCPrice);
    await mockOracle.deployed();
    
    // 部署 AntiBTC 合约
    AntiBTC = await ethers.getContractFactory("AntiBTC");
    antiBTC = await AntiBTC.deploy(
      "AntiBTC",
      "AntiBTC",
      mockOracle.address,
      mockUSDT.address
    );
    await antiBTC.deployed();
  });

  describe("1. 网络环境", function () {
    it("1.1 应该在本地测试网络中运行", async function () {
      const network = await ethers.provider.getNetwork();
      expect(network.chainId).to.equal(31337, "Chain ID 应该是 31337 (Hardhat)");
      
      const [owner] = await ethers.getSigners();
      const balance = await owner.getBalance();
      const balanceInBNB = parseFloat(ethers.utils.formatEther(balance));
      expect(balanceInBNB).to.be.closeTo(10000, 1, "初始余额应该接近 10000 BNB");
    });

    it("1.2 应该显示合约部署的 gas 消耗", async function () {
      const [owner] = await ethers.getSigners();
      const initialBalance = await owner.getBalance();
      
      // 部署合约
      const MockUSDT = await ethers.getContractFactory("MockERC20");
      const mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
      await mockUSDT.deployed();
      
      const MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
      const mockOracle = await MockBTCOracle.deploy(ethers.utils.parseUnits("20000", 8));
      await mockOracle.deployed();
      
      const finalBalance = await owner.getBalance();
      const gasUsed = ethers.utils.formatEther(initialBalance.sub(finalBalance));
      
      console.log("\n=== Gas 消耗信息 ===");
      console.log("部署两个合约消耗的 BNB:", gasUsed);
      console.log("==================\n");
      
      // 验证 gas 消耗在合理范围内
      expect(parseFloat(gasUsed)).to.be.lt(0.1, "单次部署的 gas 消耗应该小于 0.1 BNB");
    });
  });

  describe("2. 合约部署", function () {
    it("2.1 应该成功部署 AntiBTC 合约", async function () {
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("AntiBTC");
    });
    
    it("2.2 应该正确设置代币名称和符号", async function () {
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("AntiBTC");
    });
    
    it("2.3 应该正确设置预言机地址", async function () {
      expect(await antiBTC.priceFeed()).to.equal(mockOracle.address);
    });
    
    it("2.4 应该正确设置初始流动性", async function () {
      // 验证初始流动性设置
      expect(await antiBTC.poolTokens()).to.equal(INITIAL_POOL_TOKENS);
      expect(await antiBTC.poolUSDT()).to.equal(INITIAL_POOL_USDT);
      
      // 验证初始价格为 1 USDT
      const price = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(price, 6)).to.equal("1.0");
      
      // 验证总供应量
      expect(await antiBTC.totalSupply()).to.equal(TOTAL_SUPPLY);
      
      // 验证储备量
      const reserveTokens = await antiBTC.reserveTokens();
      expect(reserveTokens).to.equal(TOTAL_SUPPLY.sub(INITIAL_POOL_TOKENS));
    });
  });
  
  describe("3. 流动性池", function () {
    it("3.1 应该正确设置初始流动性", async function () {
      expect(await antiBTC.poolTokens()).to.equal(INITIAL_POOL_TOKENS);
      expect(await antiBTC.poolUSDT()).to.equal(INITIAL_POOL_USDT);
      
      // 验证初始价格
      const price = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(price, 6)).to.equal("1.0");
    });
    
    it("3.2 应该正确计算价格", async function () {
      // 验证初始价格为 1 USDT
      const poolPrice = await antiBTC.getPrice();
      expect(ethers.utils.formatUnits(poolPrice, 6)).to.equal("1.0");
      
      // 验证理论反向价格
      const antiPrice = await antiBTC.calculateAntiPrice(initialBTCPrice);
      expect(antiPrice).to.equal(ethers.utils.parseUnits("0.00005", 8));
    });
    
    it("3.3 应该正确计算滑点", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // 计算滑点后的代币数量
        const tokensAfterSlippage = await antiBTC.calculateTokensOut(usdtAmount);
        
        // 计算滑点
        const slippage = ethers.utils.parseEther("1000").sub(tokensAfterSlippage);
        const slippagePercentage = slippage.mul(10000).div(ethers.utils.parseEther("1000"));
        
        console.log("滑点后获得代币:", ethers.utils.formatEther(tokensAfterSlippage), "AntiBTC");
        console.log("理论无滑点获得:", ethers.utils.formatEther(ethers.utils.parseEther("1000")), "AntiBTC");
        console.log("滑点百分比:", ethers.utils.formatUnits(slippagePercentage, 2), "%");
        
        // 验证滑点不超过1%
        expect(slippagePercentage).to.be.lte(100);  // 100 = 1%
    });
    
    it("3.4 应该正确计算交易金额", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // 计算预期获得的代币数量
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // 计算预期支付金额
        const expectedUsdt = await antiBTC.calculateUSDTOut(expectedTokens);
        
        // 验证预期支付金额略小于输入金额（因为滑点）
        expect(expectedUsdt).to.be.lt(usdtAmount);
        // 验证滑点不超过1%
        const slippage = usdtAmount.sub(expectedUsdt);
        const slippagePercentage = slippage.mul(10000).div(usdtAmount);
        expect(slippagePercentage).to.be.lte(100);  // 100 = 1%
    });
  });
  
  describe("4. 交易功能", function () {
    it("4.1 应该显示购买 AntiBTC 的详细过程和数量", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // 获取初始余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== 购买详情 ===");
        console.log("购买前 USDT 余额:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("购买前 AntiBTC 余额:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("购买前 Gas 余额:", ethers.utils.formatEther(initialGasBalance), "BNB\n");
        
        // 获取初始池子状态
        const initialPoolTokens = await antiBTC.poolTokens();
        const initialPoolUsdt = await antiBTC.poolUSDT();
        const initialPrice = await antiBTC.getPrice();
        
        console.log("=== 初始流动性池状态 ===");
        console.log("池中 AntiBTC:", ethers.utils.formatEther(initialPoolTokens), "AntiBTC");
        console.log("池中 USDT:", ethers.utils.formatUnits(initialPoolUsdt, 6), "USDT");
        console.log("当前价格:", ethers.utils.formatUnits(initialPrice, 6), "AntiBTC/USDT\n");
        
        // 计算预期获得的代币数量（考虑手续费）
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        const effectivePrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("用户将使用", ethers.utils.formatUnits(usdtAmount, 6), "USDT 购买 AntiBTC");
        console.log("预期获得:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("预期均价:", ethers.utils.formatUnits(effectivePrice, 6), "AntiBTC/USDT\n");
        
        // 执行购买
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // 计算 gas 费用
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // 使用 1 BNB = 600 USDT 的价格转换
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Gas 费用信息 ===");
        console.log("Gas 使用量:", gasUsed.toString(), "gas");
        console.log("Gas 价格:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Gas 总费用:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas 费用(USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("==================\n");
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        console.log("=== 购买结果 ===");
        console.log("购买后 USDT 余额:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("购买后 AntiBTC 余额:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("购买后 Gas 余额:", ethers.utils.formatEther(finalGasBalance), "BNB");
        console.log("实际花费:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("实际获得:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("实际均价:", ethers.utils.formatUnits(effectivePrice, 6), "AntiBTC/USDT\n");
        
        // 获取最终池子状态
        const finalPoolTokens = await antiBTC.poolTokens();
        const finalPoolUsdt = await antiBTC.poolUSDT();
        const finalPrice = await antiBTC.getPrice();
        
        console.log("=== 购买后流动性池状态 ===");
        console.log("池中 AntiBTC:", ethers.utils.formatEther(finalPoolTokens), "AntiBTC");
        console.log("池中 USDT:", ethers.utils.formatUnits(finalPoolUsdt, 6), "USDT");
        console.log("当前价格:", ethers.utils.formatUnits(finalPrice, 6), "AntiBTC/USDT");
        console.log("==================\n");
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(expectedTokens);
    });

    it("4.2 应该允许用户用 USDT 购买 AntiBTC", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // 获取初始余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== 交易前状态 ===");
        console.log("初始 BNB 余额:", ethers.utils.formatEther(initialGasBalance), "BNB");
        
        // 计算预期获得的代币数量（考虑手续费）
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        
        // 执行购买
        console.log("\n=== 执行购买交易 ===");
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // 计算 gas 费用
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // 使用 1 BNB = 600 USDT 的价格转换
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Gas 费用详细信息 ===");
        console.log("交易 Hash:", tx.hash);
        console.log("区块号:", receipt.blockNumber);
        console.log("Gas 使用量:", gasUsed.toString(), "gas");
        console.log("Gas 价格:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Gas 总费用:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas 费用(USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("==================\n");
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        console.log("=== 交易后状态 ===");
        console.log("最终 BNB 余额:", ethers.utils.formatEther(finalGasBalance), "BNB");
        console.log("BNB 余额变化:", ethers.utils.formatEther(initialGasBalance.sub(finalGasBalance)), "BNB");
        console.log("==================\n");
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(expectedTokens);
    });
    
    it("4.3 应该允许用户卖出 AntiBTC 换取 USDT", async function() {
        // 先购买一些代币
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        await antiBTC.connect(owner).buyTokens(usdtAmount);
        
        // 获取卖出前的余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        // 计算预期获得的USDT数量
        const expectedUsdt = await antiBTC.calculateUSDTOut(initialAntiBalance);
        
        // 执行卖出
        const tx = await antiBTC.connect(owner).sellTokens(initialAntiBalance);
        const receipt = await tx.wait();
        
        // 计算 gas 费用
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // 使用 1 BNB = 600 USDT 的价格转换
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("\n=== Gas 费用信息 ===");
        console.log("Gas 使用量:", gasUsed.toString(), "gas");
        console.log("Gas 价格:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Gas 总费用:", ethers.utils.formatEther(gasCost), "BNB");
        console.log("Gas 费用(USDT):", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("==================\n");
        
        // 获取事件
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.add(expectedUsdt.sub(expectedUsdt.mul(30).div(10000))));
        expect(finalAntiBalance).to.equal(0);
    });

    it("4.4 应该根据 BTC 价格变化调整 AntiBTC 购买价格", async function () {
      // 记录初始状态
      const initialBtcPrice = await antiBTC.lastBTCPrice();
      const initialPoolPrice = await antiBTC.getPrice();
      const initialPoolInfo = await antiBTC.getPoolInfo();
      
      console.log("\n\n======= BTC 价格变化测试 =======");
      console.log("初始 BTC 价格:", ethers.utils.formatUnits(initialBtcPrice, 8), "USD");
      console.log("初始 AntiBTC 池子价格:", ethers.utils.formatUnits(initialPoolPrice, 6), "AntiBTC/USDT");
      console.log("初始池中 AntiBTC:", ethers.utils.formatEther(initialPoolInfo[0]), "AntiBTC");
      console.log("初始池中 USDT:", ethers.utils.formatUnits(initialPoolInfo[2], 6), "USDT");
      console.log("初始储备 AntiBTC:", ethers.utils.formatEther(initialPoolInfo[1]), "AntiBTC");

      // 第一次购买（BTC = $20,000）
      await mockUSDT.connect(owner).approve(antiBTC.address, testUSDTAmount);
      const firstBuyTx = await antiBTC.connect(owner).buyTokens(testUSDTAmount);
      const firstBuyReceipt = await firstBuyTx.wait();
      const firstTokensReceived = firstBuyReceipt.events.find(e => e.event === "Swap").args[2];
      
      console.log("\n----- 第一次购买（BTC = $20,000）-----");
      console.log("支付:", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      console.log("获得:", ethers.utils.formatEther(firstTokensReceived), "AntiBTC");
      console.log("购买后 AntiBTC 池子价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "AntiBTC/USDT");
      
      // BTC 价格上涨到 $22,000 (涨10%)
      const newBtcPrice = initialBtcPrice.mul(110).div(100);
      await mockOracle.updatePrice(newBtcPrice);
      
      // 确保预言机价格已更新
      const oracleDataAfterUpdate = await mockOracle.latestRoundData();
      expect(oracleDataAfterUpdate[1]).to.equal(newBtcPrice);
      
      // 计算理论上的目标价格
      // 当BTC上涨10%，AntiBTC价格应该下降约9.09%（1/1.1 ≈ 0.9091）
      const expectedPriceAfterBtcIncrease = initialPoolPrice.mul(1e6).div(ethers.utils.parseUnits("1.1", 6));
      
      console.log("\n----- BTC 价格上涨 10% -----");
      console.log("BTC 价格从", ethers.utils.formatUnits(initialBtcPrice, 8), "上涨到", ethers.utils.formatUnits(newBtcPrice, 8), "USD");
      console.log("理论上 AntiBTC 价格应从", ethers.utils.formatUnits(initialPoolPrice, 6), 
                 "下降到约", ethers.utils.formatUnits(expectedPriceAfterBtcIncrease, 6), "AntiBTC/USDT");
      
      // 记录重平衡前的池子状态
      const beforeRebalancePoolInfo = await antiBTC.getPoolInfo();
      console.log("\n重平衡前池子状态:");
      console.log("池中 AntiBTC:", ethers.utils.formatEther(beforeRebalancePoolInfo[0]), "AntiBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(beforeRebalancePoolInfo[2], 6), "USDT");
      console.log("当前价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "AntiBTC/USDT");
      console.log("当前价格:", ethers.utils.formatEther(ethers.utils.parseUnits("1", 18).mul(ethers.utils.parseUnits("1", 6)).div(await antiBTC.getPrice())), "AntiBTC/USDT");
      
      // 触发重平衡
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      const rebalanceTx = await antiBTC.manualRebalance();
      const rebalanceReceipt = await rebalanceTx.wait();
      
      // 查看池子调整事件
      const poolAdjustedEvent = rebalanceReceipt.events.find(e => e.event === "PoolAdjusted");
      if (poolAdjustedEvent) {
        console.log("\n----- 池子调整事件 -----");
        console.log("旧池子代币:", ethers.utils.formatEther(poolAdjustedEvent.args[0]), "AntiBTC");
        console.log("新池子代币:", ethers.utils.formatEther(poolAdjustedEvent.args[1]), "AntiBTC");
        console.log("旧储备代币:", ethers.utils.formatEther(poolAdjustedEvent.args[2]), "AntiBTC");
        console.log("新储备代币:", ethers.utils.formatEther(poolAdjustedEvent.args[3]), "AntiBTC");
        
        // 计算调整比例
        const poolTokensIncrease = poolAdjustedEvent.args[1].sub(poolAdjustedEvent.args[0]);
        const poolTokensIncreasePercent = poolTokensIncrease.mul(10000).div(poolAdjustedEvent.args[0]).toNumber() / 100;
        console.log("池子代币增加:", ethers.utils.formatEther(poolTokensIncrease), "AntiBTC", `(+${poolTokensIncreasePercent}%)`);
      } else {
        console.log("未找到PoolAdjusted事件");
      }
      
      // 获取重平衡后的价格和池子状态
      const afterRebalancePrice = await antiBTC.getPrice();
      const afterRebalancePoolInfo = await antiBTC.getPoolInfo();

      console.log("\n----- 重平衡后池子状态 -----");
      console.log("池中 AntiBTC:", ethers.utils.formatEther(afterRebalancePoolInfo[0]), "AntiBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(afterRebalancePoolInfo[2], 6), "USDT");
      console.log("重平衡后价格:", ethers.utils.formatEther(ethers.utils.parseUnits("1", 18).mul(ethers.utils.parseUnits("1", 6)).div(afterRebalancePrice)), "AntiBTC/USDT");
      console.log("当前价格:", ethers.utils.formatUnits(afterRebalancePrice, 6), "AntiBTC/USDT");
      
      // 计算价格变化百分比
      const priceChangePercent = initialPoolPrice.gt(afterRebalancePrice) 
        ? initialPoolPrice.sub(afterRebalancePrice).mul(10000).div(initialPoolPrice).toNumber() / 100
        : afterRebalancePrice.sub(initialPoolPrice).mul(10000).div(initialPoolPrice).toNumber() / 100;
      
      const priceDirection = initialPoolPrice.gt(afterRebalancePrice) ? "下降" : "上涨";
      console.log(`AntiBTC 价格${priceDirection} ${priceChangePercent}%`);
      
      // 验证价格变化方向：当BTC价格上涨时，AntiBTC价格应该下降
      expect(afterRebalancePrice).to.be.lt(initialPoolPrice);
      
      // 验证价格变化幅度：当BTC价格上涨10%，AntiBTC价格应下降约9.09%
      // 允许1%的误差
      const lowerBound = expectedPriceAfterBtcIncrease.mul(99).div(100);
      const upperBound = expectedPriceAfterBtcIncrease.mul(101).div(100);
      
      // 确保价格在预期范围内
      console.log("预期价格下限:", ethers.utils.formatEther(ethers.utils.parseUnits("1", 18).mul(ethers.utils.parseUnits("1", 6)).div(lowerBound)), "AntiBTC/USDT");
      console.log("实际价格:", ethers.utils.formatEther(ethers.utils.parseUnits("1", 18).mul(ethers.utils.parseUnits("1", 6)).div(afterRebalancePrice)), "AntiBTC/USDT");
      console.log("预期价格上限:", ethers.utils.formatEther(ethers.utils.parseUnits("1", 18).mul(ethers.utils.parseUnits("1", 6)).div(upperBound)), "AntiBTC/USDT");
      
      expect(afterRebalancePrice).to.be.gt(lowerBound);
      expect(afterRebalancePrice).to.be.lt(upperBound);
      
      // 第二次购买（BTC = $22,000）
      await mockUSDT.connect(user2).approve(antiBTC.address, testUSDTAmount);
      const secondBuyTx = await antiBTC.connect(user2).buyTokens(testUSDTAmount);
      const secondBuyReceipt = await secondBuyTx.wait();
      const secondTokensReceived = secondBuyReceipt.events.find(e => e.event === "Swap").args[2];

      console.log("\n----- 第二次购买（BTC = $22,000）-----");
      console.log("支付:", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      console.log("获得:", ethers.utils.formatEther(secondTokensReceived), "AntiBTC");
      console.log("购买后 AntiBTC 池子价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "AntiBTC/USDT");
      
      // 计算两次购买的代币数量差异
      const tokenIncrease = secondTokensReceived.sub(firstTokensReceived);
      const tokenIncreasePercent = tokenIncrease.mul(10000).div(firstTokensReceived).toNumber() / 100;
      
      console.log("\n----- 购买结果对比 -----");
      console.log("第一次购买获得:", ethers.utils.formatEther(firstTokensReceived), "AntiBTC");
      console.log("第二次购买获得:", ethers.utils.formatEther(secondTokensReceived), "AntiBTC");
      console.log(`第二次比第一次多获得: ${ethers.utils.formatEther(tokenIncrease)} AntiBTC (+${tokenIncreasePercent}%)`);
      
      // 验证：当BTC价格上涨，AntiBTC价格下降时，应该获得更多的AntiBTC
      expect(secondTokensReceived).to.be.gt(firstTokensReceived);
      
      // 验证：增加的代币数量比例应该与价格下降比例接近
      // BTC价格上涨10%，AntiBTC下降约9.09%，那么应该多获得约10%的代币
      expect(tokenIncreasePercent).to.be.closeTo(10, 1.5); // 允许1.5%的误差
      
      console.log("\n======= 测试结论 =======");
      console.log(`BTC价格上涨 10%，AntiBTC价格${priceDirection} ${priceChangePercent}%`);
      console.log(`获得的AntiBTC数量增加 ${tokenIncreasePercent}%`);
      console.log("验证通过：价格变化符合反向追踪预期\n");
    });
  });
  
  describe("5. 预言机功能", function () {
    it("5.1 应该正确获取 BTC 价格", async function () {
      expect(await antiBTC.lastBTCPrice()).to.equal(initialBTCPrice);
    });

    it("5.2 应该正确计算 AntiBTC 价格", async function () {
      // 当 BTC 价格为 $20,000 时
      const antiPrice = await antiBTC.calculateAntiPrice(initialBTCPrice);
      
      // K = 1e8, btcPrice = 20000e8
      // antiPrice = K * 1e8 / btcPrice = 1e8 * 1e8 / 20000e8 = 5000 (0.00005 USD)
      const expectedAntiPrice = ethers.utils.parseUnits("0.00005", 8);
      expect(antiPrice).to.equal(expectedAntiPrice);
      
      // 测试较低的 BTC 价格
      const lowerBTCPrice = ethers.utils.parseUnits("10000", 8); // $10,000
      const antiPriceLower = await antiBTC.calculateAntiPrice(lowerBTCPrice);
      
      // K = 1e8, btcPrice = 10000e8
      // antiPrice = K * 1e8 / btcPrice = 1e8 * 1e8 / 10000e8 = 10000 (0.0001 USD)
      const expectedAntiPriceLower = ethers.utils.parseUnits("0.0001", 8);
      expect(antiPriceLower).to.equal(expectedAntiPriceLower);
    });
    
    it("5.3 应该正确计算 AntiBTC 价格（考虑滑点）", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        // 计算预期获得的代币数量
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // 计算实际价格
        const actualPrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        // 获取理论价格
        const theoreticalPrice = await antiBTC.getPrice();
        
        // 验证实际价格略高于理论价格（因为滑点）
        expect(actualPrice).to.be.gt(theoreticalPrice);
    });

    it("5.4 应该正确计算 AntiBTC 价格（考虑流动性）", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
      
      // 计算预期获得的代币数量
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmount);
        
        // 计算实际价格
        const actualPrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        // 获取理论价格
        const theoreticalPrice = await antiBTC.getPrice();
        
        // 验证实际价格略高于理论价格（因为流动性影响）
        expect(actualPrice).to.be.gt(theoreticalPrice);
    });
  });
  
  describe("6. 重平衡功能", function () {
    it("6.1 应该正确计算重平衡阈值", async function () {
      // 初始状态不需要再平衡
      const initialRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(initialRebalanceInfo._needsRebalance).to.be.false;

      // 模拟时间经过8小时
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]); // 8小时
      await ethers.provider.send("evm_mine");

      // 现在应该需要再平衡了
      const afterTimeRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(afterTimeRebalanceInfo._needsRebalance).to.be.true;
      expect(afterTimeRebalanceInfo._timeSinceLastRebalance).to.be.gte(8 * 60 * 60);
    });

    it("6.2 应该正确计算重平衡数量", async function () {
      // 更新价格，涨幅6%
      const newPrice = initialBTCPrice.mul(106).div(100); // 增加6%
      await mockOracle.updatePrice(newPrice);

      // 检查是否需要再平衡
      const rebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(rebalanceInfo._needsRebalance).to.be.true;
      expect(rebalanceInfo._priceChangePercentage).to.be.gte(ethers.utils.parseUnits("5", 6)); // 5%
    });

    it("6.3 应该正确执行重平衡", async function () {
      // 记录初始状态
      const initialUpdateTime = await antiBTC.lastPriceUpdateTime();
      const initialBtcPrice = await antiBTC.lastBTCPrice();

      // 更新价格并等待8小时
      const newPrice = initialBtcPrice.mul(106).div(100); // 增加6%
      await mockOracle.updatePrice(newPrice);
      await ethers.provider.send("evm_increaseTime", [8 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // 执行再平衡
      const tx = await antiBTC.manualRebalance();
      const receipt = await tx.wait();

      // 验证事件
      const rebalanceEvent = receipt.events.find(e => e.event === "Rebalanced");
      expect(rebalanceEvent).to.not.be.undefined;
      
      // 验证状态更新
      const newUpdateTime = await antiBTC.lastPriceUpdateTime();
      expect(newUpdateTime).to.be.gt(initialUpdateTime);
      
      // 验证价格更新
      const updatedBtcPrice = await antiBTC.lastBTCPrice();
      expect(updatedBtcPrice).to.equal(newPrice);

      // 验证再平衡后不再需要再平衡
      const afterRebalanceInfo = await antiBTC.getRebalanceInfo();
      expect(afterRebalanceInfo._needsRebalance).to.be.false;
      expect(afterRebalanceInfo._priceChangePercentage).to.equal(0); // 价格变化百分比应该重置为0
    });
  });
  
  describe("7. 手续费功能", function () {
    it("7.1 应该正确设置手续费率", async function() {
        const [feeRate, feesPer1000USDT] = await antiBTC.getFeeInfo();
        expect(feeRate).to.equal(30);  // 0.3%
        expect(feesPer1000USDT).to.equal(3);  // 3 USDT per 1000 USDT
    });
    
    it("7.2 应该正确收取买入手续费", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const expectedFee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        
        // 获取初始余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("\n=== 买入手续费测试 ===");
        console.log("初始 USDT 余额:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("初始 AntiBTC 余额:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("预期手续费:", ethers.utils.formatUnits(expectedFee, 6), "USDT\n");
        
        // 执行买入
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // 获取事件
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== 事件日志 ===");
        console.log("Swap 事件:");
        console.log("用户:", swapEvent.args.user);
        console.log("是否买入:", swapEvent.args.isBuy);
        console.log("代币数量:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("USDT 数量:", ethers.utils.formatUnits(swapEvent.args.usdtAmount, 6), "USDT");
        console.log("手续费:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT\n");
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("=== 买入后状态 ===");
        console.log("最终 USDT 余额:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("最终 AntiBTC 余额:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("==================\n");
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(swapEvent.args.fee).to.equal(expectedFee);
    });
    
    it("7.3 应该正确收取卖出手续费", async function() {
        // 先买入一些代币
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        await antiBTC.connect(owner).buyTokens(usdtAmount);
        
        // 获取卖出前的余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        
        // 计算预期获得的USDT数量
        const expectedUsdt = await antiBTC.calculateUSDTOut(initialAntiBalance);
        const expectedFee = expectedUsdt.mul(30).div(10000);
        const expectedUsdtAfterFee = expectedUsdt.sub(expectedFee);
        
        // 执行卖出
        const tx = await antiBTC.connect(owner).sellTokens(initialAntiBalance);
        const receipt = await tx.wait();
        
        // 获取事件
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== 事件日志 ===");
        console.log("Swap 事件:");
        console.log("用户:", swapEvent.args.user);
        console.log("是否买入:", swapEvent.args.isBuy);
        console.log("代币数量:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("USDT 数量:", ethers.utils.formatUnits(swapEvent.args.usdtAmount, 6), "USDT");
        console.log("手续费:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT\n");
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        
        console.log("=== 卖出后状态 ===");
        console.log("最终 USDT 余额:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("最终 AntiBTC 余额:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("==================\n");
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.add(expectedUsdtAfterFee));
        expect(finalAntiBalance).to.equal(0);
        expect(swapEvent.args.fee).to.equal(expectedFee);
    });
    
    it("7.5 应该正确计算有手续费情况下的实际价格", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        
        // 计算预期获得的代币数量
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        const effectivePrice = usdtAmount.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("\n=== 手续费对价格影响测试 ===");
        console.log("初始价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 18), "AntiBTC/USDT");
        console.log("用户支付:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("手续费:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("实际用于购买:", ethers.utils.formatUnits(usdtAmountAfterFee, 6), "USDT");
        console.log("预期获得代币:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("有效价格:", ethers.utils.formatUnits(effectivePrice, 18), "AntiBTC/USDT\n");
        
        // 执行买入
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // 获取事件
        const swapEvent = receipt.events.find(e => e.event === "Swap");
        
        console.log("=== 实际交易结果 ===");
        console.log("实际收到代币:", ethers.utils.formatEther(swapEvent.args.tokenAmount), "AntiBTC");
        console.log("实际手续费:", ethers.utils.formatUnits(swapEvent.args.fee, 6), "USDT");
        console.log("==================\n");
        
        // 验证实际获得的代币数量
        expect(swapEvent.args.tokenAmount).to.equal(expectedTokens);
        expect(swapEvent.args.fee).to.equal(fee);
    });

    it("7.6 应该正确计算所有费用的叠加影响", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        const fee = usdtAmount.mul(30).div(10000);  // 0.3% fee
        const usdtAmountAfterFee = usdtAmount.sub(fee);
        
        // 获取初始余额
        const initialUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const initialAntiBalance = await antiBTC.balanceOf(owner.address);
        const initialGasBalance = await owner.getBalance();
        
        console.log("\n=== 综合费用叠加测试 ===\n");
        console.log("=== 初始状态 ===");
        console.log("初始 USDT 余额:", ethers.utils.formatUnits(initialUsdtBalance, 6), "USDT");
        console.log("初始 AntiBTC 余额:", ethers.utils.formatEther(initialAntiBalance), "AntiBTC");
        console.log("初始 Gas 余额:", ethers.utils.formatEther(initialGasBalance), "BNB\n");
        
        // 计算预期获得的代币数量
        const expectedTokens = await antiBTC.calculateTokensOut(usdtAmountAfterFee);
        
        console.log("=== 费用叠加分析 ===");
        console.log("交易金额:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("AMM 滑点影响:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("手续费:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("手续费影响:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("最终预期获得:", ethers.utils.formatEther(expectedTokens), "AntiBTC\n");
        
        // 执行买入
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const tx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const receipt = await tx.wait();
        
        // 获取最终余额
        const finalUsdtBalance = await mockUSDT.balanceOf(owner.address);
        const finalAntiBalance = await antiBTC.balanceOf(owner.address);
        const finalGasBalance = await owner.getBalance();
        
        // 计算 gas 费用
        const gasUsed = receipt.gasUsed;
        const gasPrice = ethers.utils.parseUnits("5", "gwei");  // 5 gwei
        const gasCost = gasUsed.mul(gasPrice);
        // 使用 1 BNB = 600 USDT 的价格转换
        const gasCostInUsdt = gasCost.mul(600).mul(ethers.utils.parseUnits("1", 6)).div(ethers.utils.parseEther("1"));
        
        console.log("=== 实际交易结果 ===");
        console.log("最终 USDT 余额:", ethers.utils.formatUnits(finalUsdtBalance, 6), "USDT");
        console.log("最终 AntiBTC 余额:", ethers.utils.formatEther(finalAntiBalance), "AntiBTC");
        console.log("最终 Gas 余额:", ethers.utils.formatEther(finalGasBalance), "BNB\n");
        
        // 计算总成本
        const totalCost = usdtAmount.add(gasCostInUsdt);
        const effectivePrice = totalCost.mul(ethers.utils.parseEther("1")).div(expectedTokens);
        
        console.log("=== 综合成本分析 ===");
        console.log("USDT 成本:", ethers.utils.formatUnits(usdtAmount, 6), "USDT");
        console.log("Gas 成本:", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("总成本:", ethers.utils.formatUnits(totalCost, 6), "USDT");
        console.log("获得代币:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("实际有效价格:", ethers.utils.formatUnits(effectivePrice, 18), "AntiBTC/USDT\n");
        
        // 计算总费用百分比
        const totalFees = fee.add(gasCostInUsdt);
        const totalFeePercentage = totalFees.mul(10000).div(usdtAmount);
        
        console.log("=== 总费用分析 ===");
        console.log("AMM 滑点影响:", ethers.utils.formatEther(expectedTokens), "AntiBTC");
        console.log("交易手续费:", ethers.utils.formatUnits(fee, 6), "USDT (0.3%)");
        console.log("Gas 费用:", ethers.utils.formatUnits(gasCostInUsdt, 6), "USDT");
        console.log("总费用百分比:", ethers.utils.formatUnits(totalFeePercentage, 2), "%");
        console.log("==================\n");
        
        // 验证余额变化
        expect(finalUsdtBalance).to.equal(initialUsdtBalance.sub(usdtAmount));
        expect(finalAntiBalance).to.equal(initialAntiBalance.add(expectedTokens));
        
        // 验证 gas 余额变化（允许 0.01 BNB 的误差）
        const expectedGasBalance = initialGasBalance.sub(gasCost);
        const gasBalanceDiff = finalGasBalance.sub(expectedGasBalance);
        expect(gasBalanceDiff.abs()).to.be.lte(ethers.utils.parseEther("0.01"));
    });

    it("7.7 应该比较不同函数的 gas 使用量", async function() {
        const usdtAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDT
        
        console.log("\n=== 不同函数的 Gas 使用量比较 ===\n");
        
        // 测试 getPrice 函数
        const price = await antiBTC.getPrice();
        const getPriceGas = await antiBTC.estimateGas.getPrice();
        console.log("getPrice 函数:");
        console.log("价格:", ethers.utils.formatUnits(price, 6), "AntiBTC/USDT");
        console.log("Gas 使用量:", getPriceGas.toString(), "gas");
        console.log("操作类型: view 函数（包含除法运算）\n");
        
        // 测试 calculateTokensOut 函数
        const calculateTokensTx = await antiBTC.calculateTokensOut(usdtAmount);
        const calculateTokensGas = await antiBTC.estimateGas.calculateTokensOut(usdtAmount);
        console.log("calculateTokensOut 函数:");
        console.log("Gas 使用量:", calculateTokensGas.toString(), "gas");
        console.log("操作类型: 计算操作\n");
        
        // 测试 buyTokens 函数
        await mockUSDT.connect(owner).approve(antiBTC.address, usdtAmount);
        const buyTokensTx = await antiBTC.connect(owner).buyTokens(usdtAmount);
        const buyTokensReceipt = await buyTokensTx.wait();
        console.log("buyTokens 函数:");
        console.log("Gas 使用量:", buyTokensReceipt.gasUsed.toString(), "gas");
        console.log("操作类型: 状态读取 + 计算 + 存储\n");
        
        // 验证 gas 使用量的合理性
        expect(getPriceGas).to.be.gt(0);  // getPrice 确实消耗 gas
        expect(calculateTokensGas).to.be.gt(getPriceGas);  // calculateTokensOut 消耗更多 gas
        expect(buyTokensReceipt.gasUsed).to.be.gt(calculateTokensGas);  // buyTokens 消耗最多 gas
        
        console.log("=== Gas 使用量分析 ===");
        console.log("1. getPrice: 少量 gas，因为包含除法运算");
        console.log("2. calculateTokensOut: 中等，因为包含更多计算操作");
        console.log("3. buyTokens: 最高，因为包含状态读取、计算和存储操作");
        console.log("==================\n");
    });
  });
}); 