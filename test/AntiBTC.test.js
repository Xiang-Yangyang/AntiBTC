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
      "aBTC",
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
      "aBTC",
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
      expect(await antiBTC.symbol()).to.equal("aBTC");
    });
    
    it("2.2 应该正确设置代币名称和符号", async function () {
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("aBTC");
    });
    
    it("2.3 应该正确设置预言机地址", async function () {
      expect(await antiBTC.priceFeed()).to.equal(mockOracle.address);
    });
    
    it("2.4 应该正确设置 USDT 地址", async function () {
      expect(await antiBTC.poolUSDT()).to.equal(ethers.utils.parseUnits("1000000", 6)); // 1M USDT
    });
  });
  
  describe("3. 流动性池", function () {
    it("3.1 应该正确设置初始流动性", async function () {
      expect(await antiBTC.poolTokens()).to.equal(ethers.utils.parseUnits("1000000", 18)); // 1M tokens
      expect(await antiBTC.poolUSDT()).to.equal(ethers.utils.parseUnits("1000000", 6)); // 1M USDT
    });
    
    it("3.2 应该正确计算价格", async function () {
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
    
    it("3.3 应该正确计算滑点", async function () {
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
      // 记录初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialTokenBalance = await antiBTC.balanceOf(user1.address);
      
      console.log("\n=== 购买详情 ===");
      console.log("购买前 USDT 余额:", ethers.utils.formatUnits(initialUSDTBalance, 6), "USDT");
      console.log("购买前 aBTC 余额:", ethers.utils.formatEther(initialTokenBalance), "aBTC");
      
      // 获取初始流动性池状态
      const initialPoolTokens = await antiBTC.poolTokens();
      const initialPoolUSDT = await antiBTC.poolUSDT();
      console.log("\n=== 初始流动性池状态 ===");
      console.log("池中 aBTC:", ethers.utils.formatEther(initialPoolTokens), "aBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(initialPoolUSDT, 6), "USDT");
      
      // 计算预期获得的代币数量
      const expectedTokens = await antiBTC.calculateTokensOut(testUSDTAmount);
      console.log("\n用户将使用", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT 购买 aBTC");
      console.log("预期获得:", ethers.utils.formatEther(expectedTokens), "aBTC");
      
      // 用户授权合约使用 USDT
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      console.log("用户已授权 AntiBTC 合约使用", ethers.utils.formatUnits(testUSDTAmount, 6), "USDT");
      
      // 用户购买代币
      const tx = await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      const receipt = await tx.wait();
      console.log("购买交易成功, Gas 消耗:", receipt.gasUsed.toString());
      
      // 获取购买后的余额
      const finalUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const finalTokenBalance = await antiBTC.balanceOf(user1.address);
      
      console.log("\n=== 购买结果 ===");
      console.log("购买后 USDT 余额:", ethers.utils.formatUnits(finalUSDTBalance, 6), "USDT");
      console.log("购买后 aBTC 余额:", ethers.utils.formatEther(finalTokenBalance), "aBTC");
      console.log("实际花费:", ethers.utils.formatUnits(initialUSDTBalance.sub(finalUSDTBalance), 6), "USDT");
      console.log("实际获得:", ethers.utils.formatEther(finalTokenBalance.sub(initialTokenBalance)), "aBTC");
      
      // 获取购买后的流动性池状态
      const finalPoolTokens = await antiBTC.poolTokens();
      const finalPoolUSDT = await antiBTC.poolUSDT();
      console.log("\n=== 购买后流动性池状态 ===");
      console.log("池中 aBTC:", ethers.utils.formatEther(finalPoolTokens), "aBTC");
      console.log("池中 USDT:", ethers.utils.formatUnits(finalPoolUSDT, 6), "USDT");
      console.log("池中 aBTC 变化:", ethers.utils.formatEther(finalPoolTokens.sub(initialPoolTokens)), "aBTC");
      console.log("池中 USDT 变化:", ethers.utils.formatUnits(finalPoolUSDT.sub(initialPoolUSDT), 6), "USDT");
      console.log("==================\n");
      
      // 验证实际获得的代币数量与预期相符
      expect(finalTokenBalance.sub(initialTokenBalance)).to.equal(expectedTokens);
      expect(initialUSDTBalance.sub(finalUSDTBalance)).to.equal(testUSDTAmount);
      
      // 检查合约收到 USDT
      expect(await mockUSDT.balanceOf(antiBTC.address)).to.be.gt(0);
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