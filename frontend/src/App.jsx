import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [price, setPrice] = useState('Loading...');
  const [priceChange, setPriceChange] = useState('Loading...');
  const [lastUpdate, setLastUpdate] = useState('-');
  const [utcOffset, setUtcOffset] = useState('');

  // Get local timezone UTC offset
  const getUTCOffset = () => {
    const offset = -(new Date().getTimezoneOffset());
    const hours = Math.abs(Math.floor(offset / 60));
    const sign = offset >= 0 ? '+' : '-';
    return `UTC${sign}${hours}`;
  };

  // Update time display
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
        console.error('WebSocket Error:', error);
        setPrice('Connection Error');
      };

      ws.onclose = () => {
        console.log('WebSocket connection lost, attempting to reconnect...');
        setPrice('Reconnecting...');
        
        // Clear previous reconnection timer
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Try to reconnect after 5 seconds
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };
    };

    // Initial connection
    connectWebSocket();

    // Cleanup function
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
      <h1>BTC Real-time Price</h1>
      <div className="price-box">
        <span className="label">BTC/USDT:</span>
        <span className={`price ${price !== 'Loading...' && price !== 'Connection Error' && price !== 'Connection Lost' ? 'price-update' : ''}`}>
          {price}
        </span>
      </div>
      <div className="change-box">
        <span className="label">24h Change:</span>
        <span className={`change ${parseFloat(priceChange) >= 0 ? 'positive' : 'negative'}`}>
          {priceChange}
        </span>
      </div>
      <div className="update-time">
        Current Time: {lastUpdate}
        {utcOffset}
      </div>
    </div>
  );
}

export default App; 