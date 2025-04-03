const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
  // Get environment variables
  const initialBTCPrice = process.env.INITIAL_BTC_PRICE || "2000000000000";
  
  console.log("Deploying to BSC network...");
  console.log("Initial BTC price:", ethers.utils.formatUnits(initialBTCPrice, 8), "USD");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  
  console.log(
    "Using account address:",
    deployer.address
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Deploy MockUSDT
  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const usdt = await MockUSDT.deploy("Mock USDT", "USDT", 6);
  await usdt.deployed();
  console.log("MockUSDT deployed to:", usdt.address);
  
  // Deploy MockBTCOracle
  const MockBTCOracle = await ethers.getContractFactory("MockBTCOracle");
  const oracle = await MockBTCOracle.deploy(initialBTCPrice);
  await oracle.deployed();
  console.log("MockBTCOracle deployed to:", oracle.address);
  
  // Deploy AntiBTC
  const AntiBTC = await ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(
    "AntiBTC",
    "aBTC",
    oracle.address,
    usdt.address
  );
  await antiBTC.deployed();
  console.log("AntiBTC deployed to:", antiBTC.address);
  
  // Mint test USDT
  const testAmount = ethers.utils.parseUnits("1000000", 6); // 1,000,000 USDT
  await usdt.mint(deployer.address, testAmount);
  console.log("Minted 1,000,000 USDT to deployer account");
  
  // Save contract addresses
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
  console.log("Contract addresses saved to deployed-addresses.json");
  
  // Verify contracts (if needed)
  if (process.env.VERIFY_CONTRACT === 'true' && hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    console.log("Waiting for block confirmations, then verifying contracts...");
    
    // Wait for a few block confirmations
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Verify USDT contract
    await hre.run("verify:verify", {
      address: usdt.address,
      constructorArguments: ["Mock USDT", "USDT", 6],
    });
    
    // Verify Oracle contract
    await hre.run("verify:verify", {
      address: oracle.address,
      constructorArguments: [initialBTCPrice],
    });
    
    // Verify AntiBTC contract
    await hre.run("verify:verify", {
      address: antiBTC.address,
      constructorArguments: ["AntiBTC", "aBTC", oracle.address, usdt.address],
    });
    
    console.log("Contract verification completed!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 