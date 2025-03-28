// 获取显示元素
const btcPriceElement = document.getElementById('btcPrice');
const priceChangeElement = document.getElementById('priceChange');
const lastUpdateElement = document.getElementById('lastUpdate');
const utcOffsetElement = document.getElementById('utcOffset');

// 获取本地时区的UTC偏移
function getUTCOffset() {
    const offset = -(new Date().getTimezoneOffset());
    const hours = Math.abs(Math.floor(offset / 60));
    const sign = offset >= 0 ? '+' : '-';
    return `UTC${sign}${hours}`;
}

// 更新价格显示
function updatePriceDisplay(price, change) {
    btcPriceElement.textContent = `$${price}`;
    
    const changeText = `${change}%`;
    priceChangeElement.textContent = changeText;
    priceChangeElement.className = 'change ' + (parseFloat(change) >= 0 ? 'positive' : 'negative');
    
    // 添加动画效果
    btcPriceElement.classList.add('price-update');
    setTimeout(() => {
        btcPriceElement.classList.remove('price-update');
    }, 500);
}

// 更新时间显示
function updateTimeDisplay() {
    const now = new Date();
    lastUpdateElement.textContent = now.toLocaleTimeString();
    utcOffsetElement.textContent = ` (${getUTCOffset()})`;
}

// Binance WebSocket连接 - 使用ticker流，它直接提供24小时统计数据
const wsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@ticker';
const ws = new WebSocket(wsUrl);

// 处理WebSocket消息
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // c: 最新价格
    // P: 24小时价格变化百分比
    const price = parseFloat(data.c).toFixed(2);
    const priceChange = parseFloat(data.P).toFixed(2);
    
    // 更新显示
    updatePriceDisplay(price, priceChange);
    updateTimeDisplay();
};

// 定时更新时间显示（每秒）
setInterval(updateTimeDisplay, 1000);

// WebSocket错误处理
ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
    btcPriceElement.textContent = '连接错误';
};

// WebSocket连接关闭处理
ws.onclose = () => {
    console.log('WebSocket连接已关闭');
    btcPriceElement.textContent = '连接已断开';
    
    // 5秒后尝试重新连接
    setTimeout(() => {
        location.reload();
    }, 5000);
}; 