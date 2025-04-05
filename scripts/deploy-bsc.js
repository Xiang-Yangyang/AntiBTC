const hre = require("hardhat");
const fs = require("fs");
require('dotenv').config();

async function main() {
  // Get environment variables
  const btcPriceFeedAddress = process.env.BTC_PRICE_FEED_ADDRESS;
  const usdtAddress = process.env.USDT_ADDRESS;
  
  if (!btcPriceFeedAddress || !usdtAddress) {
    throw new Error("Please set BTC_PRICE_FEED_ADDRESS and USDT_ADDRESS in .env file");
  }
  
  console.log("Deploying to BSC network...");
  console.log("Using BTC Price Feed:", btcPriceFeedAddress);
  console.log("Using USDT:", usdtAddress);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  
  console.log(
    "Using account address:",
    deployer.address
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Deploy AntiBTC
  const AntiBTC = await ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(
    "AntiBTC",
    "aBTC",
    btcPriceFeedAddress,
    usdtAddress
  );
  await antiBTC.deployed();
  console.log("AntiBTC deployed to:", antiBTC.address);
  
  // Save contract addresses
  const addresses = {
    USDT: usdtAddress,
    BTCOracle: btcPriceFeedAddress,
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
    
    // Verify AntiBTC contract
    await hre.run("verify:verify", {
      address: antiBTC.address,
      constructorArguments: ["AntiBTC", "aBTC", btcPriceFeedAddress, usdtAddress],
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