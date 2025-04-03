const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// Check if port is occupied
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

// Check if node is already running
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
  console.log("Checking port 8545...");
  const isPortAvailable = await checkPort(8545);
  
  if (!isPortAvailable) {
    console.error("Error: Port 8545 is already in use!");
    console.error("Please ensure no other Hardhat node is running.");
    console.error("You can use 'pkill -f \"hardhat node\"' command to terminate existing nodes.");
    process.exit(1);
  }

  console.log("Starting local BSC node...");
  
  // Start hardhat node
  const hardhat = spawn('npx', ['hardhat', 'node', '--config', 'hardhat.config.js'], {
    stdio: 'pipe'
  });

  // Modify output, replace ETH with BNB
  hardhat.stdout.on('data', (data) => {
    const output = data.toString()
      .replace(/\(10000 ETH\)/g, '(10000 BNB)')
      .replace(/ETH/g, 'BNB');
    
    process.stdout.write(output);
  });

  hardhat.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Wait for node to start
  console.log("Waiting for node to start...");
  let attempts = 0;
  const maxAttempts = 30; // Maximum wait time: 30 seconds
  
  while (attempts < maxAttempts) {
    if (await checkNodeRunning()) {
      console.log("\nLocal BSC node started successfully!");
      console.log("RPC URL: http://127.0.0.1:8545");
      console.log("Chain ID: 31337");
      console.log("Currency: BNB");
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.error("Error: Node startup timeout!");
    hardhat.kill();
    process.exit(1);
  }

  // Gracefully handle process termination
  process.on('SIGINT', () => {
    console.log("\nShutting down node...");
    hardhat.kill();
    process.exit();
  });

  process.on('SIGTERM', () => {
    console.log("\nShutting down node...");
    hardhat.kill();
    process.exit();
  });
}

main().catch(error => {
  console.error("Error occurred while starting node:", error);
  process.exit(1);
}); 