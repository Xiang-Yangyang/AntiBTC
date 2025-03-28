import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [price, setPrice] = useState('加载中...');
  const [priceChange, setPriceChange] = useState('加载中...');
  const [lastUpdate, setLastUpdate] = useState('-');
  const [utcOffset, setUtcOffset] = useState('');

  // 获取本地时区的UTC偏移
  const getUTCOffset = () => {
    const offset = -(new Date().getTimezoneOffset());
    const hours = Math.abs(Math.floor(offset / 60));
    const sign = offset >= 0 ? '+' : '-';
    return `UTC${sign}${hours}`;
  };

  // 更新时间显示
  const updateTimeDisplay = () => {
    const now = new Date();
    setLastUpdate(now.toLocaleTimeString());
    setUtcOffset(` (${getUTCOffset()})`);
  };

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const newPrice = parseFloat(data.c).toFixed(2);
        const newPriceChange = parseFloat(data.P).toFixed(2);
        
        setPrice(`$${newPrice}`);
        setPriceChange(`${newPriceChange}%`);
        updateTimeDisplay();
      };

      ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        setPrice('连接错误');
      };

      ws.onclose = () => {
        console.log('WebSocket连接已断开，尝试重新连接...');
        setPrice('正在重新连接...');
        
        // 清除之前的重连定时器
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // 5秒后尝试重新连接
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };
    };

    // 初始连接
    connectWebSocket();

    // 清理函数
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  return (
    <div className="container">
      <h1>BTC 实时价格</h1>
      <div className="price-box">
        <span className="label">BTC/USDT:</span>
        <span className={`price ${price !== '加载中...' && price !== '连接错误' && price !== '连接已断开' ? 'price-update' : ''}`}>
          {price}
        </span>
      </div>
      <div className="change-box">
        <span className="label">24小时涨跌幅：</span>
        <span className={`change ${parseFloat(priceChange) >= 0 ? 'positive' : 'negative'}`}>
          {priceChange}
        </span>
      </div>
      <div className="update-time">
        当前时间: {lastUpdate}
        {utcOffset}
      </div>
    </div>
  );
}

export default App; 