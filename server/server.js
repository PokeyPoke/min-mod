const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Cache for API responses (5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type, params) {
  return `${type}-${JSON.stringify(params)}`;
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_TTL;
}

// Weather API
app.get('/api/weather', async (req, res) => {
  const { location = 'New York', units = 'imperial' } = req.query;
  const cacheKey = getCacheKey('weather', { location, units });
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    if (process.env.OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${process.env.OPENWEATHER_API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Weather API error');
      }
      
      const data = await response.json();
      const weatherData = {
        location: data.name,
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: data.wind.speed,
        units: units
      };
      
      cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
      res.json({ data: weatherData });
    } else {
      // Demo data
      const demoData = {
        location: location,
        temp: Math.floor(Math.random() * 30) + 50,
        condition: 'Clear',
        description: 'clear sky',
        humidity: Math.floor(Math.random() * 40) + 40,
        pressure: Math.floor(Math.random() * 50) + 1000,
        wind: Math.floor(Math.random() * 15) + 5,
        units: units,
        demo: true
      };
      
      cache.set(cacheKey, { data: demoData, timestamp: Date.now() });
      res.json({ data: demoData });
    }
  } catch (error) {
    console.error('Weather error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Crypto API
app.get('/api/crypto', async (req, res) => {
  const { coin = 'bitcoin', currency = 'usd' } = req.query;
  const cacheKey = getCacheKey('crypto', { coin, currency });
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Crypto API error');
    }
    
    const data = await response.json();
    const coinData = data[coin];
    
    if (!coinData) {
      throw new Error('Coin not found');
    }
    
    const cryptoData = {
      coin: coin,
      price: coinData[currency],
      change24h: coinData[`${currency}_24h_change`]?.toFixed(2) || '0.00',
      marketCap: coinData[`${currency}_market_cap`],
      volume24h: coinData[`${currency}_24h_vol`],
      currency: currency
    };
    
    cache.set(cacheKey, { data: cryptoData, timestamp: Date.now() });
    res.json({ data: cryptoData });
  } catch (error) {
    console.error('Crypto error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto data' });
  }
});

// Stocks API (using free tier of API)
app.get('/api/stocks', async (req, res) => {
  const { symbol = 'AAPL' } = req.query;
  const cacheKey = getCacheKey('stocks', { symbol });
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    // Demo data (replace with real API if you have a key)
    const demoData = {
      symbol: symbol.toUpperCase(),
      price: (Math.random() * 200 + 100).toFixed(2),
      change: (Math.random() * 20 - 10).toFixed(2),
      changePercent: (Math.random() * 10 - 5).toFixed(2) + '%',
      volume: Math.floor(Math.random() * 1000000),
      previousClose: (Math.random() * 200 + 100).toFixed(2),
      demo: true
    };
    
    cache.set(cacheKey, { data: demoData, timestamp: Date.now() });
    res.json({ data: demoData });
  } catch (error) {
    console.error('Stocks error:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Countdown API
app.get('/api/countdown', async (req, res) => {
  const { 
    title = 'New Year', 
    targetDate = '2025-01-01T00:00:00',
    timezone = 'UTC'
  } = req.query;
  
  try {
    const target = new Date(targetDate);
    const now = new Date();
    const diff = target - now;
    
    const countdownData = {
      title: title,
      targetDate: targetDate,
      timezone: timezone,
      completed: diff <= 0,
      timeRemaining: Math.max(0, diff)
    };
    
    res.json({ data: countdownData });
  } catch (error) {
    console.error('Countdown error:', error);
    res.status(500).json({ error: 'Invalid date format' });
  }
});

// Notes API
app.get('/api/notes', (req, res) => {
  const { title = 'Notes', content = '' } = req.query;
  
  const notesData = {
    title: title,
    content: content,
    showWordCount: true,
    autoSave: true
  };
  
  res.json({ data: notesData });
});

// Todo API
app.get('/api/todo', (req, res) => {
  const { title = 'To-Do List' } = req.query;
  
  const todoData = {
    title: title,
    items: [],
    showCompleted: true,
    maxItems: 10
  };
  
  res.json({ data: todoData });
});

// ESP32 endpoint - returns first 4 widgets
app.get('/api/esp32', async (req, res) => {
  try {
    // Get data for the 4 main widgets
    const weather = await fetch(`http://localhost:${PORT}/api/weather`).then(r => r.json());
    const crypto = await fetch(`http://localhost:${PORT}/api/crypto`).then(r => r.json());
    const stocks = await fetch(`http://localhost:${PORT}/api/stocks`).then(r => r.json());
    const countdown = await fetch(`http://localhost:${PORT}/api/countdown`).then(r => r.json());
    
    res.json({
      widgets: [
        { type: 'weather', data: weather.data },
        { type: 'crypto', data: crypto.data },
        { type: 'stocks', data: stocks.data },
        { type: 'countdown', data: countdown.data }
      ]
    });
  } catch (error) {
    console.error('ESP32 endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch widget data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 ESP32 endpoint: http://localhost:${PORT}/api/esp32`);
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log('⚠️  No OpenWeather API key - using demo weather data');
  }
});