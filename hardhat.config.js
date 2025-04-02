require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config();

// 通用配置
const commonConfig = {
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
    tests: "./test",
    scripts: "./scripts"
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
    enabled: true,
    currency: 'USD',
    gasPrice: 5,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  bnbUsdtPrice: 600,  // 1 BNB = 600 USDT
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
      custom: {
        nativeCurrency: {
          name: "BNB",
          symbol: "BNB",
          decimals: 18
        }
      }
    },
    hardhat: {
      chainId: 31337,
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
      blockGasLimit: 30000000
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: {
        mnemonic: "your mnemonic here"  // 如果你需要发送交易，需要添加助记词
      }
    }
  },
  mocha: {
    timeout: 40000
  }
};

module.exports = commonConfig; 