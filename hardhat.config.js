require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config();

// 获取环境变量或使用默认值
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BSC_TESTNET_URL = process.env.BSC_TESTNET_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/";
const BSC_MAINNET_URL = process.env.BSC_MAINNET_URL || "https://bsc-dataseed.binance.org/";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

// 通用配置
const commonConfig = {
  // 指定项目目录结构
  paths: {
    sources: "./contracts",        // Solidity 合约源文件目录
    artifacts: "./artifacts",      // 编译后的文件存放目录
    cache: "./cache",             // 缓存目录
    tests: "./test",              // 测试文件目录
    scripts: "./scripts"          // 脚本文件目录
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'USD',
    gasPrice: 10,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  networks: {
    // 本地节点配置
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 97,  // 使用 BSC 测试网的 chainId
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        accountsBalance: "10000000000000000000000" // 10000 BNB
      },
      mining: {
        auto: true,
        interval: 0
      },
      gasPrice: 10000000000,  // 10 Gwei
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      hardfork: "london",
      networkCheckTimeout: 10000
    },
    // 测试网配置
    hardhat: {
      chainId: 97,
      accounts: {
        accountsBalance: "10000000000000000000000", // 10000 BNB
        count: 20
      },
      mining: {
        auto: true,
        interval: 0
      },
      gasPrice: 10000000000,  // 10 Gwei
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      hardfork: "london"
    },
    // BSC 测试网
    bscTestnet: {
      url: BSC_TESTNET_URL,
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gasPrice: 10000000000, // 10 Gwei
      blockGasLimit: 30000000,
    },
    // BSC 主网
    bsc: {
      url: BSC_MAINNET_URL,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice: 5000000000, // 5 Gwei
      blockGasLimit: 30000000,
    }
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY
    }
  },
  mocha: {
    timeout: 40000
  }
};

module.exports = commonConfig; 