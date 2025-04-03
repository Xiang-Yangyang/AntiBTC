const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");  // Use standard ethers instead of hardhat's ethers

// Compiled contract JSONs
const MockERC20Json = require("../../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json");
const MockBTCOracleJson = require("../../artifacts/contracts/mocks/MockBTCOracle.sol/MockBTCOracle.json");
const AntiBTCJson = require("../../artifacts/contracts/AntiBTC.sol/AntiBTC.json");

async function checkNodeRunning() {
  try {
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    await provider.getNetwork();
    return provider;  // Return provider object
  } catch (error) {
    return null;
  }
}

async function main() {
  // Check if local node is running
  const provider = await checkNodeRunning();
  if (!provider) {
    console.error("\nError: Local node is not running!");
    console.error("Please run first: node test/scripts/start-bsc-node.js");
    process.exit(1);
  }

  const network = await provider.getNetwork();
  console.log("\n=== BSC Testnet Environment ===");
  console.log("Chain ID:", network.chainId);
  console.log("Network:", "BSC Testnet");
  console.log("Currency:", "BNB");

  // Use first account as deployer
  const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat default first account private key
  const deployer = new ethers.Wallet(deployerPrivateKey, provider);
  
  console.log("\nDeployer Address:", deployer.address);
  console.log("Account Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");

  // Deploy contracts
  console.log("\nStarting contract deployment...");

  // Deploy mock USDT
  const MockUSDTFactory = new ethers.ContractFactory(
    MockERC20Json.abi,
    MockERC20Json.bytecode,
    deployer
  );
  const mockUSDT = await MockUSDTFactory.deploy("USD Tether", "USDT", 6);
  await mockUSDT.deployed();
  console.log("USDT deployed to:", mockUSDT.address);

  // Deploy mock BTC oracle
  const MockBTCOracleFactory = new ethers.ContractFactory(
    MockBTCOracleJson.abi,
    MockBTCOracleJson.bytecode,
    deployer
  );
  const mockOracle = await MockBTCOracleFactory.deploy(ethers.utils.parseUnits("20000", "8"));
  await mockOracle.deployed();
  console.log("BTC Oracle deployed to:", mockOracle.address);

  // Deploy AntiBTC
  const AntiBTCFactory = new ethers.ContractFactory(
    AntiBTCJson.abi,
    AntiBTCJson.bytecode,
    deployer
  );
  const antiBTC = await AntiBTCFactory.deploy(
    "AntiBTC",
    "AntiBTC",
    mockOracle.address,
    mockUSDT.address
  );
  await antiBTC.deployed();
  console.log("AntiBTC deployed to:", antiBTC.address);

  // Mint test USDT
  const testAmount = ethers.utils.parseUnits("1000000", "6"); // 1,000,000 USDT
  const mintTx = await mockUSDT.mint(deployer.address, testAmount);
  await mintTx.wait();
  console.log("\nMinted", ethers.utils.formatUnits(testAmount, 6), "USDT to deployer account");

  // Save contract addresses
  const addresses = {
    USDT: mockUSDT.address,
    BTCOracle: mockOracle.address,
    AntiBTC: antiBTC.address
  };
  
  // Use path relative to project root
  const addressesPath = path.join(__dirname, '../../deployed-addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("\nContract addresses saved to deployed-addresses.json");

  console.log("\n=== MetaMask Configuration ===");
  console.log("Network Name: BSC Testnet");
  console.log("RPC URL: http://127.0.0.1:8545");
  console.log("Chain ID:", network.chainId);
  console.log("Currency Symbol: BNB");
  console.log("\nToken Contract Addresses:");
  console.log("USDT:", mockUSDT.address);
  console.log("AntiBTC:", antiBTC.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 