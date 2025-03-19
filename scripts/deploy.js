const hre = require("hardhat");

async function main() {
  // 部署模拟 BTC 预言机
  const MockBTCOracle = await hre.ethers.getContractFactory("MockBTCOracle");
  const initialBTCPrice = hre.ethers.utils.parseUnits("20000", 8); // 假设BTC初始价格为 $20,000
  const mockOracle = await MockBTCOracle.deploy(initialBTCPrice);
  await mockOracle.deployed();
  console.log("MockBTCOracle deployed to:", mockOracle.address);

  // 部署 AntiBTC 合约
  const AntiBTC = await hre.ethers.getContractFactory("AntiBTC");
  const antiBTC = await AntiBTC.deploy(mockOracle.address);
  await antiBTC.deployed();
  console.log("AntiBTC deployed to:", antiBTC.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 