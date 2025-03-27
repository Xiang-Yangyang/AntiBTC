const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");  // 使用标准 ethers 而不是 hardhat 的 ethers

// 编译好的合约 JSON
const MockERC20Json = require("../../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json");
const MockBTCOracleJson = require("../../artifacts/contracts/mocks/MockBTCOracle.sol/MockBTCOracle.json");
const AntiBTCJson = require("../../artifacts/contracts/AntiBTC.sol/AntiBTC.json");

async function checkNodeRunning() {
  try {
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    await provider.getNetwork();
    return provider;  // 返回 provider 对象
  } catch (error) {
    return null;
  }
}

async function main() {
  // 检查本地节点是否运行
  const provider = await checkNodeRunning();
  if (!provider) {
    console.error("\n错误: 本地节点未运行!");
    console.error("请先运行: node test/scripts/start-bsc-node.js");
    process.exit(1);
  }

  const network = await provider.getNetwork();
  console.log("\n=== BSC 测试网环境 ===");
  console.log("Chain ID:", network.chainId);
  console.log("网络:", "BSC Testnet");
  console.log("货币:", "BNB");

  // 使用第一个账户作为部署者
  const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat 默认的第一个账户私钥
  const deployer = new ethers.Wallet(deployerPrivateKey, provider);
  
  console.log("\n部署账户:", deployer.address);
  console.log("账户余额:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");

  // 部署合约
  console.log("\n开始部署合约...");

  // 部署模拟 USDT
  const MockUSDTFactory = new ethers.ContractFactory(
    MockERC20Json.abi,
    MockERC20Json.bytecode,
    deployer
  );
  const mockUSDT = await MockUSDTFactory.deploy("Mock USDT", "USDT", 6);
  await mockUSDT.deployed();
  console.log("模拟 USDT 已部署到:", mockUSDT.address);

  // 部署模拟 BTC 预言机
  const MockBTCOracleFactory = new ethers.ContractFactory(
    MockBTCOracleJson.abi,
    MockBTCOracleJson.bytecode,
    deployer
  );
  const mockOracle = await MockBTCOracleFactory.deploy(ethers.utils.parseUnits("20000", "8"));
  await mockOracle.deployed();
  console.log("BTC 预言机已部署到:", mockOracle.address);

  // 部署 AntiBTC
  const AntiBTCFactory = new ethers.ContractFactory(
    AntiBTCJson.abi,
    AntiBTCJson.bytecode,
    deployer
  );
  const antiBTC = await AntiBTCFactory.deploy(
    "AntiBTC",
    "aBTC",
    mockOracle.address,
    mockUSDT.address
  );
  await antiBTC.deployed();
  console.log("AntiBTC 已部署到:", antiBTC.address);

  // 铸造测试 USDT
  const testAmount = ethers.utils.parseUnits("1000000", "6"); // 1,000,000 USDT
  const mintTx = await mockUSDT.mint(deployer.address, testAmount);
  await mintTx.wait();
  console.log("\n已铸造", ethers.utils.formatUnits(testAmount, 6), "USDT 到部署者账户");

  // 保存合约地址
  const addresses = {
    USDT: mockUSDT.address,
    BTCOracle: mockOracle.address,
    AntiBTC: antiBTC.address
  };
  
  // 使用相对于项目根目录的路径
  const addressesPath = path.join(__dirname, '../../deployed-addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("\n合约地址已保存到 deployed-addresses.json");

  console.log("\n=== MetaMask 配置信息 ===");
  console.log("网络名称: BSC Testnet");
  console.log("RPC URL: http://127.0.0.1:8545");
  console.log("Chain ID:", network.chainId);
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