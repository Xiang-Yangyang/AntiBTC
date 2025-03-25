const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("\n=== BSC 测试网环境 ===");
  console.log("Chain ID:", 97);
  console.log("网络:", "BSC Testnet");
  console.log("货币:", "BNB");

  // 获取账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n部署账户:", deployer.address);
  console.log("账户余额:", hre.ethers.utils.formatEther(await deployer.getBalance()), "BNB");

  // 部署合约
  console.log("\n开始部署合约...");

  // 部署模拟 USDT
  const MockUSDT = await hre.ethers.getContractFactory("MockERC20");
  const mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
  await mockUSDT.deployed();
  console.log("模拟 USDT 已部署到:", mockUSDT.address);

  // 部署模拟 BTC 预言机
  const MockBTCOracle = await hre.ethers.getContractFactory("MockBTCOracle");
  const mockOracle = await MockBTCOracle.deploy(hre.ethers.utils.parseUnits("20000", 8));
  await mockOracle.deployed();
  console.log("BTC 预言机已部署到:", mockOracle.address);

  // 部署模拟 Price Feed
  const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");
  const mockPriceFeed = await MockPriceFeed.deploy(hre.ethers.utils.parseUnits("20000", 8));
  await mockPriceFeed.deployed();
  console.log("Price Feed 已部署到:", mockPriceFeed.address);

  // 部署 AntiBTC
  const AntiBTC = await hre.ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(
    "AntiBTC",
    "aBTC",
    mockOracle.address,
    mockUSDT.address,
    mockPriceFeed.address
  );
  await antiBTC.deployed();
  console.log("AntiBTC 已部署到:", antiBTC.address);

  // 铸造测试 USDT
  const testAmount = hre.ethers.utils.parseUnits("1000000", 6); // 1,000,000 USDT
  await mockUSDT.mint(deployer.address, testAmount);
  console.log("\n已铸造", hre.ethers.utils.formatUnits(testAmount, 6), "USDT 到部署者账户");

  // 保存合约地址
  const addresses = {
    USDT: mockUSDT.address,
    BTCOracle: mockOracle.address,
    PriceFeed: mockPriceFeed.address,
    AntiBTC: antiBTC.address
  };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\n合约地址已保存到 deployed-addresses.json");

  console.log("\n=== MetaMask 配置信息 ===");
  console.log("网络名称: BSC Testnet");
  console.log("RPC URL: http://127.0.0.1:8545");
  console.log("Chain ID: 97");
  console.log("货币符号: BNB");
  console.log("\n代币合约地址:");
  console.log("USDT:", mockUSDT.address);
  console.log("AntiBTC:", antiBTC.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 