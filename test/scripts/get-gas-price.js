const { ethers } = require("hardhat");

async function main() {
    try {
        // 连接到 BSC 主网
        const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        
        // 获取当前 gas price
        const gasPrice = await provider.getGasPrice();
        
        // 获取当前区块
        const block = await provider.getBlock("latest");
        
        // 获取当前时间
        const now = new Date();
        
        console.log("\n=== BSC 主网 Gas 价格信息 ===");
        console.log("时间:", now.toLocaleString());
        console.log("区块号:", block.number);
        console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Gas Price:", ethers.utils.formatEther(gasPrice), "BNB");
        
        // 假设 1 BNB = 2000 USDT 计算 USDT 价格
        const gasPriceInUsdt = gasPrice.mul(2000).div(ethers.utils.parseEther("1"));
        console.log("Gas Price:", ethers.utils.formatUnits(gasPriceInUsdt, 6), "USDT");
        
        // 获取最近几个区块的 gas 使用情况
        const recentBlocks = await Promise.all([
            provider.getBlock(block.number - 1),
            provider.getBlock(block.number - 2),
            provider.getBlock(block.number - 3)
        ]);
        
        console.log("\n=== 最近区块 Gas 使用情况 ===");
        recentBlocks.forEach((block, index) => {
            console.log(`区块 ${block.number}:`);
            console.log("Gas Used:", block.gasUsed.toString());
            console.log("Gas Limit:", block.gasLimit.toString());
            console.log("使用率:", ((block.gasUsed / block.gasLimit) * 100).toFixed(2) + "%\n");
        });
        
        // 获取当前网络状态
        const network = await provider.getNetwork();
        console.log("\n=== 网络信息 ===");
        console.log("Chain ID:", network.chainId);
        console.log("网络名称:", network.name);
        
    } catch (error) {
        console.error("获取 gas price 时出错:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 