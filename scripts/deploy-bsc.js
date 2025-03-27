const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
  // 获取环境变量
  const initialBTCPrice = process.env.INITIAL_BTC_PRICE || "2000000000000";
  
  console.log("部署到 BSC 网络...");
  console.log("初始 BTC 价格:", ethers.utils.formatUnits(initialBTCPrice, 8), "USD");
  
  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  
  console.log(
    "使用账户地址:",
    deployer.address
  );
  
  console.log("账户余额:", (await deployer.getBalance()).toString());
  
  // 部署 MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const usdt = await MockUSDT.deploy("Mock USDT", "USDT", 6);
  await usdt.deployed();
  console.log("MockUSDT 已部署到:", usdt.address);
  
  // 部署 MockBTCOracle
  const MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
  const oracle = await MockBTCOracle.deploy(initialBTCPrice);
  await oracle.deployed();
  console.log("MockBTCOracle 已部署到:", oracle.address);
  
  // 部署 AntiBTC
  const AntiBTC = await ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(
    "AntiBTC",
    "aBTC",
    oracle.address,
    usdt.address
  );
  await antiBTC.deployed();
  console.log("AntiBTC 已部署到:", antiBTC.address);
  
  // 铸造测试 USDT
  const testAmount = ethers.utils.parseUnits("1000000", 6); // 1,000,000 USDT
  await usdt.mint(deployer.address, testAmount);
  console.log("已铸造 1,000,000 USDT 到部署者账户");
  
  // 保存合约地址
  const addresses = {
    USDT: usdt.address,
    BTCOracle: oracle.address,
    AntiBTC: antiBTC.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId
  };
  
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("合约地址已保存到 deployed-addresses.json");
  
  // 验证合约（如果需要）
  if (process.env.VERIFY_CONTRACT === 'true' && hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    console.log("等待区块确认，然后验证合约...");
    
    // 等待几个区块确认
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // 验证 USDT 合约
    await hre.run("verify:verify", {
      address: usdt.address,
      constructorArguments: ["Mock USDT", "USDT", 6],
    });
    
    // 验证 Oracle 合约
    await hre.run("verify:verify", {
      address: oracle.address,
      constructorArguments: [initialBTCPrice],
    });
    
    // 验证 AntiBTC 合约
    await hre.run("verify:verify", {
      address: antiBTC.address,
      constructorArguments: ["AntiBTC", "aBTC", oracle.address, usdt.address],
    });
    
    console.log("合约验证完成!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 