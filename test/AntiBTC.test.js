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
    
    it("3.3 应该正确计算滑点", async function () {
      // 用 1000 USDT 可以获得的代币数量
      const tokensOut = await antiBTC.calculateTokensOut(testUSDTAmount);
      
      // 由于初始价格是 1:1，考虑滑点后应该获得略少于 1000 个代币
      expect(tokensOut).to.be.lt(ethers.utils.parseUnits("1000", 18));
      expect(tokensOut).to.be.gt(ethers.utils.parseUnits("995", 18)); // 假设滑点不超过 0.5%
      
      // 计算滑点百分比 - 修复精度问题
      const expectedTokens = ethers.utils.parseUnits("1000", 18);
      // 先乘以100再除，避免在整数除法中丢失精度
      const slippagePercentage = expectedTokens.sub(tokensOut).mul(10000).div(expectedTokens);
      
      console.log("实际获得代币:", ethers.utils.formatEther(tokensOut), "AntiBTC");
      console.log("理论无滑点获得:", ethers.utils.formatEther(expectedTokens), "AntiBTC"); 
      console.log("滑点百分比:", slippagePercentage.toNumber() / 100, "%");
      
      // 验证滑点在合理范围内 (0.05% 到 0.5%)
      expect(slippagePercentage).to.be.gt(5);  // 大于0.05%
      expect(slippagePercentage).to.be.lt(50); // 小于0.5%
    });
    
    it("3.4 应该正确计算交易金额", async function () {
      // 用 1000 USDT 可以获得的代币数量
      const tokensOut = await antiBTC.calculateTokensOut(testUSDTAmount);
      
      // 使用 AMM 公式：(poolTokens * usdtIn) / (poolUSDT + usdtIn)
      const expectedTokens = ethers.utils.parseUnits("1000000", 18).mul(testUSDTAmount)
          .div(ethers.utils.parseUnits("1000000", 6).add(testUSDTAmount));
      
      expect(tokensOut).to.equal(expectedTokens);
      
      // 用 1000 代币可以获得的 USDT 数量
      const tokenAmount = ethers.utils.parseUnits("1000", 18);
      const usdtOut = await antiBTC.calculateUSDTOut(tokenAmount);
      
      // 使用 AMM 公式：(poolUSDT * tokensIn) / (poolTokens + tokensIn)
      const expectedUSDT = ethers.utils.parseUnits("1000000", 6).mul(tokenAmount)
          .div(ethers.utils.parseUnits("1000000", 18).add(tokenAmount));
      
      expect(usdtOut).to.equal(expectedUSDT);
    });
  });
  
  describe("4. 交易功能", function () {
    it("4.1 应该显示购买 AntiBTC 的详细过程和数量", async function () {
      // 获取测试用户的 USDT 余额
      const usdtBalance = await mockUSDT.balanceOf(user1.address);
      // 获取测试用户的 AntiBTC 余额
      const tokenBalance = await antiBTC.balanceOf(user1.address);

      console.log("\n=== 购买详情 ===");
      console.log("购买前 USDT 余额:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");
      console.log("购买前 AntiBTC 余额:", ethers.utils.formatEther(tokenBalance), "AntiBTC");

      // 获取流动性池状态
      const poolInfo = await antiBTC.getPoolInfo();
      console.log("\n=== 初始流动性池状态 ===");
      console.log("池中 AntiBTC:", ethers.utils.formatEther(poolInfo[0]), "AntiBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(poolInfo[2], 6), "USDT");
      console.log("当前价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "USDT/AntiBTC");

      // 计算预期获得的代币数量
      const expectedTokensOut = await antiBTC.calculateTokensOut(testUSDTAmount);
      const expectedAvgPrice = testUSDTAmount.mul(ethers.utils.parseUnits("1", 18)).div(expectedTokensOut);
      
      console.log("\n用户将使用", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT 购买 AntiBTC");
      console.log("预期获得:", ethers.utils.formatEther(expectedTokensOut), "AntiBTC");
      console.log("预期均价:", ethers.utils.formatUnits(expectedAvgPrice.div(ethers.utils.parseUnits("1", 12)), 6), "USDT/AntiBTC");

      // 批准并购买代币
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      const tx = await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      const receipt = await tx.wait();

      // 验证余额变化
      const newUsdtBalance = await mockUSDT.balanceOf(user1.address);
      const newTokenBalance = await antiBTC.balanceOf(user1.address);
      const actualTokensReceived = newTokenBalance.sub(tokenBalance);
      const actualUsdtSpent = usdtBalance.sub(newUsdtBalance);
      const actualAvgPrice = actualUsdtSpent.mul(ethers.utils.parseUnits("1", 18)).div(actualTokensReceived);

      console.log("\n=== 购买结果 ===");
      console.log("购买后 USDT 余额:", ethers.utils.formatUnits(newUsdtBalance, 6), "USDT");
      console.log("购买后 AntiBTC 余额:", ethers.utils.formatEther(newTokenBalance), "AntiBTC");
      console.log("实际花费:", ethers.utils.formatUnits(actualUsdtSpent, 6), "USDT");
      console.log("实际获得:", ethers.utils.formatEther(actualTokensReceived), "AntiBTC");
      console.log("实际均价:", ethers.utils.formatUnits(actualAvgPrice.div(ethers.utils.parseUnits("1", 12)), 6), "USDT/AntiBTC");

      // 获取购买后的流动性池状态
      const newPoolInfo = await antiBTC.getPoolInfo();
      console.log("\n=== 购买后流动性池状态 ===");
      console.log("池中 AntiBTC:", ethers.utils.formatEther(newPoolInfo[0]), "AntiBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(newPoolInfo[2], 6), "USDT");
      console.log("当前价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "USDT/AntiBTC");
      console.log("==================\n");
    });

    it("4.2 应该允许用户用 USDT 购买 AntiBTC", async function () {
      // 记录初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialTokenBalance = await antiBTC.balanceOf(user1.address);
      
      // 计算预期获得的代币数量
      const expectedTokens = await antiBTC.calculateTokensOut(testUSDTAmount);
      
      // 用户授权合约使用 USDT
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      
      // 用户购买代币
      const tx = await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      const receipt = await tx.wait();
      
      // 获取购买后的余额
      const finalUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const finalTokenBalance = await antiBTC.balanceOf(user1.address);
      
      // 检查用户余额变化
      expect(finalUSDTBalance).to.equal(initialUSDTBalance.sub(testUSDTAmount));
      expect(finalTokenBalance).to.equal(initialTokenBalance.add(expectedTokens));
      
      // 检查合约收到 USDT
      expect(await mockUSDT.balanceOf(antiBTC.address)).to.be.gt(0);
    });
    
    it("4.3 应该允许用户卖出 AntiBTC 换取 USDT", async function () {
      // 首先让用户购买一些代币
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      
      // 获取用户的代币余额
      const tokenBalance = await antiBTC.balanceOf(user1.address);
      
      // 计算预期获得的 USDT 数量
      const expectedUSDT = await antiBTC.calculateUSDTOut(tokenBalance);
      
      // 用户卖出代币
      await expect(antiBTC.connect(user1).sellTokens(tokenBalance))
        .to.emit(antiBTC, "Swap")
        .withArgs(user1.address, false, tokenBalance, expectedUSDT);
      
      // 检查用户余额
      expect(await antiBTC.balanceOf(user1.address)).to.equal(0);
      
      // 由于 AMM 的工作方式，用户应该拿回略少于原始金额的 USDT
      // 因为有滑点
      const finalUSDTBalance = await mockUSDT.balanceOf(user1.address);
      expect(finalUSDTBalance).to.be.lt(ethers.utils.parseUnits("10000", 6));
      expect(finalUSDTBalance).to.be.gt(ethers.utils.parseUnits("9990", 6)); // 假设滑点不超过 0.1%
    });

    it("4.4 应该根据 BTC 价格变化调整 AntiBTC 购买价格", async function () {
      // 记录初始状态
      const initialBtcPrice = await antiBTC.lastBTCPrice();
      const initialPoolPrice = await antiBTC.getPrice();
      const initialPoolInfo = await antiBTC.getPoolInfo();
      
      console.log("\n\n======= BTC 价格变化测试 =======");
      console.log("初始 BTC 价格:", ethers.utils.formatUnits(initialBtcPrice, 8), "USD");
      console.log("初始 AntiBTC 池子价格:", ethers.utils.formatUnits(initialPoolPrice, 6), "USDT/AntiBTC");
      console.log("初始池中 AntiBTC:", ethers.utils.formatEther(initialPoolInfo[0]), "AntiBTC");
      console.log("初始池中 USDT:", ethers.utils.formatUnits(initialPoolInfo[2], 6), "USDT");
      console.log("初始储备 AntiBTC:", ethers.utils.formatEther(initialPoolInfo[1]), "AntiBTC");

      // 第一次购买（BTC = $20,000）
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      const firstBuyTx = await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      const firstBuyReceipt = await firstBuyTx.wait();
      const firstTokensReceived = firstBuyReceipt.events.find(e => e.event === "Swap").args[2];
      
      console.log("\n----- 第一次购买（BTC = $20,000）-----");
      console.log("支付:", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      console.log("获得:", ethers.utils.formatEther(firstTokensReceived), "AntiBTC");
      console.log("购买后 AntiBTC 池子价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "USDT/AntiBTC");
      
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
                 "下降到约", ethers.utils.formatUnits(expectedPriceAfterBtcIncrease, 6), "USDT/AntiBTC");
      
      // 记录重平衡前的池子状态
      const beforeRebalancePoolInfo = await antiBTC.getPoolInfo();
      console.log("\n重平衡前池子状态:");
      console.log("池中 AntiBTC:", ethers.utils.formatEther(beforeRebalancePoolInfo[0]), "AntiBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(beforeRebalancePoolInfo[2], 6), "USDT");
      console.log("当前价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "USDT/AntiBTC");
      
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
      console.log("重平衡后价格:", ethers.utils.formatUnits(afterRebalancePrice, 6), "USDT/AntiBTC");
      
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
      console.log("预期价格下限:", ethers.utils.formatUnits(lowerBound, 6), "USDT/AntiBTC");
      console.log("实际价格:", ethers.utils.formatUnits(afterRebalancePrice, 6), "USDT/AntiBTC");
      console.log("预期价格上限:", ethers.utils.formatUnits(upperBound, 6), "USDT/AntiBTC");
      
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
      console.log("购买后 AntiBTC 池子价格:", ethers.utils.formatUnits(await antiBTC.getPrice(), 6), "USDT/AntiBTC");
      
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

    it("5.3 应该正确计算 AntiBTC 价格（考虑滑点）", async function () {
      // 用 1000 USDT 可以获得的代币数量
      const tokensOut = await antiBTC.calculateTokensOut(testUSDTAmount);
      
      // 使用 AMM 公式：(poolTokens * usdtIn) / (poolUSDT + usdtIn)
      const expectedTokens = ethers.utils.parseUnits("1000000", 18).mul(testUSDTAmount)
          .div(ethers.utils.parseUnits("1000000", 6).add(testUSDTAmount));
      
      expect(tokensOut).to.equal(expectedTokens);
      
      // 用 1000 代币可以获得的 USDT 数量
      const tokenAmount = ethers.utils.parseUnits("1000", 18);
      const usdtOut = await antiBTC.calculateUSDTOut(tokenAmount);
      
      // 使用 AMM 公式：(poolUSDT * tokensIn) / (poolTokens + tokensIn)
      const expectedUSDT = ethers.utils.parseUnits("1000000", 6).mul(tokenAmount)
          .div(ethers.utils.parseUnits("1000000", 18).add(tokenAmount));
      
      expect(usdtOut).to.equal(expectedUSDT);
    });

    it("5.4 应该正确计算 AntiBTC 价格（考虑流动性）", async function () {
      // 用 1000 USDT 可以获得的代币数量
      const tokensOut = await antiBTC.calculateTokensOut(testUSDTAmount);
      
      // 使用 AMM 公式：(poolTokens * usdtIn) / (poolUSDT + usdtIn)
      const expectedTokens = ethers.utils.parseUnits("1000000", 18).mul(testUSDTAmount)
          .div(ethers.utils.parseUnits("1000000", 6).add(testUSDTAmount));
      
      expect(tokensOut).to.equal(expectedTokens);
      
      // 用 1000 代币可以获得的 USDT 数量
      const tokenAmount = ethers.utils.parseUnits("1000", 18);
      const usdtOut = await antiBTC.calculateUSDTOut(tokenAmount);
      
      // 使用 AMM 公式：(poolUSDT * tokensIn) / (poolTokens + tokensIn)
      const expectedUSDT = ethers.utils.parseUnits("1000000", 6).mul(tokenAmount)
          .div(ethers.utils.parseUnits("1000000", 18).add(tokenAmount));
      
      expect(usdtOut).to.equal(expectedUSDT);
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
}); 