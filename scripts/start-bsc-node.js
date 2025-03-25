const { spawn } = require('child_process');
const path = require('path');

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

// 优雅地处理进程终止
process.on('SIGINT', () => {
  hardhat.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  hardhat.kill();
  process.exit();
}); 