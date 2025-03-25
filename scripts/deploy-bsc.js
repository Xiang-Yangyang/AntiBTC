const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
  console.log("\n=== BSC 主网环境 ===");
  console.log("Chain ID:", 56);
  console.log("网络:", "BSC Mainnet");
  console.log("货币:", "BNB");

  // 获取账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n部署账户:", deployer.address);
  console.log("账户余额:", hre.ethers.utils.formatEther(await deployer.getBalance()), "BNB");

  // 检查账户余额
  const balance = await deployer.getBalance();
  if (balance.lt(hre.ethers.utils.parseEther("0.1"))) {
    throw new Error("账户余额不足，请确保有足够的 BNB 支付 gas 费用");
  }

  // 部署合约
  console.log("\n开始部署合约...");

  // 部署 AntiBTC
  const AntiBTC = await hre.ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(
    "AntiBTC",
    "aBTC",
    process.env.BTC_ORACLE_ADDRESS, // BSC 主网 BTC 预言机地址
    process.env.USDT_ADDRESS,       // BSC 主网 USDT 地址
    process.env.PRICE_FEED_ADDRESS  // BSC 主网价格预言机地址
  );
  await antiBTC.deployed();
  console.log("AntiBTC 已部署到:", antiBTC.address);

  // 保存合约地址
  const addresses = {
    AntiBTC: antiBTC.address
  };
  fs.writeFileSync("deployed-addresses-bsc.json", JSON.stringify(addresses, null, 2));
  console.log("\n合约地址已保存到 deployed-addresses-bsc.json");

  console.log("\n=== 部署完成 ===");
  console.log("AntiBTC 合约地址:", antiBTC.address);
  console.log("\n请等待区块确认后验证合约...");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 