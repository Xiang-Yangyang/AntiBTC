require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");

// 通用配置
const commonConfig = {
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
    }
  },
  mocha: {
    timeout: 40000
  }
};

module.exports = commonConfig; 