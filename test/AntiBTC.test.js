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
  
  beforeEach(async function () {
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
    antiBTC = await AntiBTC.deploy(mockOracle.address, mockUSDT.address);
    await antiBTC.deployed();
  });
  
  describe("部署", function () {
    it("应该正确设置代币名称和符号", async function () {
      expect(await antiBTC.name()).to.equal("AntiBTC");
      expect(await antiBTC.symbol()).to.equal("aBTC");
    });
    
    it("应该正确设置初始流动性池", async function () {
      expect(await antiBTC.poolTokens()).to.equal(ethers.utils.parseUnits("1000000", 18)); // 1M tokens
      expect(await antiBTC.poolUSDT()).to.equal(ethers.utils.parseUnits("1000000", 6)); // 1M USDT
    });
    
    it("应该正确设置 BTC 价格和预言机", async function () {
      expect(await antiBTC.lastBTCPrice()).to.equal(initialBTCPrice);
      expect(await antiBTC.priceOracle()).to.equal(mockOracle.address);
    });
  });
  
  describe("价格计算", function () {
    it("应该正确计算反向价格", async function () {
      // 当 BTC 价格为 $20,000 时
      const antiPrice = await antiBTC.calculateAntiPrice(initialBTCPrice);
      
      // 由于 BTC 价格 $20,000 > 2 * INITIAL_PRICE($1)，所以结果为 0
      expect(antiPrice).to.equal(0);
      
      // 测试较低的 BTC 价格，这个价格应该在有效范围内
      const lowerBTCPrice = ethers.utils.parseUnits("1", 8); // $1
      const antiPriceLower = await antiBTC.calculateAntiPrice(lowerBTCPrice);
      
      // 预期的反向价格：(2 * 1) - 1 = 1
      const expectedAntiPrice = ethers.utils.parseUnits("1", 8);
      expect(antiPriceLower).to.equal(expectedAntiPrice);
    });
    
    it("应该正确计算 AMM 交换金额", async function () {
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
  
  describe("交易功能", function () {
    it("应该允许用户用 USDT 购买 AntiBTC", async function () {
      // 记录初始余额
      const initialUSDTBalance = await mockUSDT.balanceOf(user1.address);
      const initialTokenBalance = await antiBTC.balanceOf(user1.address);
      
      // 用户授权合约使用 USDT
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      
      // 用户购买代币
      await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      
      // 检查用户余额变化
      expect(await mockUSDT.balanceOf(user1.address)).to.equal(initialUSDTBalance.sub(testUSDTAmount));
      expect(await antiBTC.balanceOf(user1.address)).to.be.gt(initialTokenBalance);
      
      // 检查合约收到 USDT
      expect(await mockUSDT.balanceOf(antiBTC.address)).to.be.gt(0);
    });
    
    it("应该允许用户卖出 AntiBTC 换取 USDT", async function () {
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
  
  describe("流动性功能", function () {
    it("应该允许用户添加流动性", async function () {
      // 用户授权合约使用 USDT
      await mockUSDT.connect(user2).approve(antiBTC.address, testUSDTAmount);
      
      // 计算预期获得的代币数量
      const expectedTokens = ethers.utils.parseUnits("1000000", 18).mul(testUSDTAmount)
          .div(ethers.utils.parseUnits("1000000", 6));
      
      // 用户添加流动性
      await expect(antiBTC.connect(user2).addLiquidity(testUSDTAmount))
        .to.emit(antiBTC, "LiquidityAdded")
        .withArgs(user2.address, expectedTokens, testUSDTAmount);
      
      // 检查用户余额
      expect(await antiBTC.balanceOf(user2.address)).to.equal(expectedTokens);
      
      // 检查池子状态
      expect(await antiBTC.poolTokens()).to.equal(
        ethers.utils.parseUnits("1000000", 18).add(expectedTokens)
      );
      expect(await antiBTC.poolUSDT()).to.equal(
        ethers.utils.parseUnits("1000000", 6).add(testUSDTAmount)
      );
    });
    
    it("应该允许用户移除流动性", async function () {
      // 首先让用户添加流动性
      await mockUSDT.connect(user2).approve(antiBTC.address, testUSDTAmount);
      await antiBTC.connect(user2).addLiquidity(testUSDTAmount);
      
      // 获取用户的代币余额
      const tokenBalance = await antiBTC.balanceOf(user2.address);
      
      // 计算预期获得的 USDT 数量
      const expectedUSDT = tokenBalance.mul(await antiBTC.poolUSDT()).div(await antiBTC.poolTokens());
      
      // 用户移除流动性
      await expect(antiBTC.connect(user2).removeLiquidity(tokenBalance))
        .to.emit(antiBTC, "LiquidityRemoved")
        .withArgs(user2.address, tokenBalance, expectedUSDT);
      
      // 检查用户余额
      expect(await antiBTC.balanceOf(user2.address)).to.equal(0);
      expect(await mockUSDT.balanceOf(user2.address)).to.be.closeTo(
        ethers.utils.parseUnits("10000", 6),
        ethers.utils.parseUnits("1", 6) // 允许 1 USDT 的误差
      );
    });
  });
  
  describe("预言机更新", function () {
    it("应该能正确更新 BTC 价格", async function () {
      // 更新 BTC 价格到 $15,000
      const newBTCPrice = ethers.utils.parseUnits("15000", 8);
      await mockOracle.updatePrice(newBTCPrice);
      
      // 通过交易触发价格更新
      await mockUSDT.connect(user1).approve(antiBTC.address, testUSDTAmount);
      await antiBTC.connect(user1).buyTokens(testUSDTAmount);
      
      // 检查价格是否更新
      expect(await antiBTC.lastBTCPrice()).to.equal(newBTCPrice);
    });
  });
}); 