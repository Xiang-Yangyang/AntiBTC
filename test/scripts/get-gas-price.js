const { ethers } = require("hardhat");

async function main() {
    try {
        // Connect to BSC mainnet
        const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        
        // Get current gas price
        const gasPrice = await provider.getGasPrice();
        
        // Get current block
        const block = await provider.getBlock("latest");
        
        // Get current time
        const now = new Date();
        
        console.log("\n=== BSC Mainnet Gas Price Information ===");
        console.log("Time:", now.toLocaleString());
        console.log("Block Number:", block.number);
        console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Gas Price:", ethers.utils.formatEther(gasPrice), "BNB");
        
        // Calculate USDT price assuming 1 BNB = 2000 USDT
        const gasPriceInUsdt = gasPrice.mul(2000).div(ethers.utils.parseEther("1"));
        console.log("Gas Price:", ethers.utils.formatUnits(gasPriceInUsdt, 6), "USDT");
        
        // Get gas usage from recent blocks
        const recentBlocks = await Promise.all([
            provider.getBlock(block.number - 1),
            provider.getBlock(block.number - 2),
            provider.getBlock(block.number - 3)
        ]);
        
        console.log("\n=== Recent Blocks Gas Usage ===");
        recentBlocks.forEach((block, index) => {
            console.log(`Block ${block.number}:`);
            console.log("Gas Used:", block.gasUsed.toString());
            console.log("Gas Limit:", block.gasLimit.toString());
            console.log("Usage Rate:", ((block.gasUsed / block.gasLimit) * 100).toFixed(2) + "%\n");
        });
        
        // Get current network status
        const network = await provider.getNetwork();
        console.log("\n=== Network Information ===");
        console.log("Chain ID:", network.chainId);
        console.log("Network Name:", network.name);
        
    } catch (error) {
        console.error("Error getting gas price:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 