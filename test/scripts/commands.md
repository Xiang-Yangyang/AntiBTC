# AntiBTC 项目部署与交互指南

本文档提供了在本地测试环境中部署和交互 AntiBTC 项目的完整步骤。

## 1. 环境准备

确保已经安装了所有依赖：

```bash
npm install
```

## 2. 编译合约

首先编译智能合约以生成必要的 ABI 和字节码：

```bash
npx hardhat compile
```

## 3. 启动本地节点

运行以下命令启动本地 BSC 测试节点（将在 8545 端口运行）：

```bash
node test/scripts/start-bsc-node.js
```

此命令会启动一个本地节点，模拟 BSC 测试网环境。**请保持此窗口运行**，不要关闭。

## 4. 部署合约

在新的终端窗口中，运行以下命令将合约部署到本地节点：

```bash
node test/scripts/deploy-bsc-test.js
```

部署成功后，你将看到合约地址，并且这些地址会保存在项目根目录的 `deployed-addresses.json` 文件中。

## 5. 与合约交互

### 使用 Hardhat 控制台交互

在新的终端窗口中，运行以下命令打开交互控制台：

```bash
npx hardhat console --network localhost
```

在控制台中，可以执行以下命令来交互：

```javascript
// 1. 获取签名者
const [owner] = await ethers.getSigners()

// 2. 连接到 USDT 合约
const MockUSDT = await ethers.getContractFactory("MockERC20")
const usdt = await MockUSDT.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3")

// 3. 查询 USDT 余额
await usdt.balanceOf(owner.address)

// 4. 连接到 AntiBTC 合约
const AntiBTC = await ethers.getContractFactory("AntiBTC")
const antiBtc = await AntiBTC.attach("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")

// 5. 查看 BTC 价格
await antiBtc.lastBTCPrice()

// 6. 查看反向 BTC 价格
await antiBtc.calculateAntiPrice(await antiBtc.lastBTCPrice())

// 7. 批准 USDT 使用额度
await usdt.approve(antiBtc.address, ethers.utils.parseUnits("1000", 6))

// 8. 购买 AntiBTC 代币
await antiBtc.buyTokens(ethers.utils.parseUnits("1000", 6))

// 9. 查看 AntiBTC 余额
await antiBtc.balanceOf(owner.address)
```

### 其他常用命令

```javascript
// 查看合约名称和符号
await antiBtc.name()
await antiBtc.symbol()

// 查看流动性池状态
await antiBtc.poolTokens()
await antiBtc.poolUSDT()

// 添加流动性
await usdt.approve(antiBtc.address, ethers.utils.parseUnits("10000", 6))
await antiBtc.addLiquidity(ethers.utils.parseUnits("10000", 6))

// 卖出 AntiBTC
const tokensToSell = await antiBtc.balanceOf(owner.address)
await antiBtc.sellTokens(tokensToSell)
```

## 6. 使用其他测试账户

在控制台中，可以使用不同的测试账户：

```javascript
// 获取所有测试账户
const [owner, user1, user2] = await ethers.getSigners()

// 向测试用户转账 USDT
await usdt.transfer(user1.address, ethers.utils.parseUnits("1000", 6))

// 使用测试用户发送交易
await usdt.connect(user1).approve(antiBtc.address, ethers.utils.parseUnits("100", 6))
await antiBtc.connect(user1).buyTokens(ethers.utils.parseUnits("100", 6))
```

## 7. 清理和关闭

当测试完成后：

1. 退出控制台：按 `Ctrl+C` 或输入 `.exit`
2. 关闭本地节点：在运行节点的终端窗口按 `Ctrl+C`

## 注意事项

1. 每次重启节点，都需要重新部署合约
2. `deployed-addresses.json` 文件中的地址仅对当前运行的节点有效
3. 使用标准 ethers.js 库的脚本不会创建新的区块链实例
4. 所有交易都是在内存中进行的，节点关闭后数据会丢失
