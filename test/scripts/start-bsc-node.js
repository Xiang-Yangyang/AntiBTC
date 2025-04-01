const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// 检查端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

// 检查节点是否已经启动
async function checkNodeRunning() {
  try {
    const response = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:8545', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log("正在检查端口 8545...");
  const isPortAvailable = await checkPort(8545);
  
  if (!isPortAvailable) {
    console.error("错误: 端口 8545 已被占用!");
    console.error("请确保没有其他 Hardhat 节点正在运行。");
    console.error("可以使用 'pkill -f \"hardhat node\"' 命令终止现有节点。");
    process.exit(1);
  }

  console.log("正在启动本地 BSC 节点...");
  
  // 启动 hardhat 节点
  const hardhat = spawn('npx', ['hardhat', 'node', '--config', 'hardhat.config.js'], {
    stdio: 'pipe'
  });

  // 修改输出，将 ETH 替换为 BNB
  hardhat.stdout.on('data', (data) => {
    const output = data.toString()
      .replace(/\(10000 ETH\)/g, '(10000 BNB)')
      .replace(/ETH/g, 'BNB');
    
    process.stdout.write(output);
  });

  hardhat.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // 等待节点启动
  console.log("等待节点启动...");
  let attempts = 0;
  const maxAttempts = 30; // 最多等待 30 秒
  
  while (attempts < maxAttempts) {
    if (await checkNodeRunning()) {
      console.log("\n本地 BSC 节点已成功启动!");
      console.log("RPC URL: http://127.0.0.1:8545");
      console.log("Chain ID: 31337");
      console.log("货币: BNB");
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.error("错误: 节点启动超时!");
    hardhat.kill();
    process.exit(1);
  }

  // 优雅地处理进程终止
  process.on('SIGINT', () => {
    console.log("\n正在关闭节点...");
    hardhat.kill();
    process.exit();
  });

  process.on('SIGTERM', () => {
    console.log("\n正在关闭节点...");
    hardhat.kill();
    process.exit();
  });
}

main().catch(error => {
  console.error("启动节点时发生错误:", error);
  process.exit(1);
}); 