const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type, params) {
  return `${type}-${JSON.stringify(params)}`;
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_TTL;
}

// Helper function to get base URL
function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// Enhanced fetch with error handling
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 10000,
        headers: {
          'User-Agent': 'Dashboard-App/1.0',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.warn(`Fetch attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Weather API with OpenWeatherMap
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
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      const weatherData = {
        location: data.name,
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: Math.round(data.wind.speed),
        units: units,
        icon: data.weather[0].icon
      };
      
      cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
      res.json({ data: weatherData });
    } else {
      // Enhanced demo data
      const demoData = {
        location: location,
        temp: Math.floor(Math.random() * 30) + 50,
        condition: ['Clear', 'Clouds', 'Rain', 'Snow'][Math.floor(Math.random() * 4)],
        description: 'demo weather',
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

// Enhanced Crypto API with CoinGecko
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
    const response = await fetchWithRetry(url);
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

// Enhanced Stocks API with Alpha Vantage
app.get('/api/stocks', async (req, res) => {
  const { symbol = 'AAPL' } = req.query;
  const cacheKey = getCacheKey('stocks', { symbol });
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      // Using Alpha Vantage for real stock data
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error('Stock symbol not found or API limit reached');
      }
      
      const stockData = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']).toFixed(2),
        change: parseFloat(quote['09. change']).toFixed(2),
        changePercent: quote['10. change percent'].replace('%', '') + '%',
        volume: parseInt(quote['06. volume']),
        previousClose: parseFloat(quote['08. previous close']).toFixed(2),
        high: parseFloat(quote['03. high']).toFixed(2),
        low: parseFloat(quote['04. low']).toFixed(2)
      };
      
      cache.set(cacheKey, { data: stockData, timestamp: Date.now() });
      res.json({ data: stockData });
    } else if (process.env.FINNHUB_API_KEY) {
      // Alternative: Finnhub API
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const change = (data.c - data.pc).toFixed(2);
      const changePercent = ((change / data.pc) * 100).toFixed(2);
      
      const stockData = {
        symbol: symbol.toUpperCase(),
        price: data.c.toFixed(2),
        change: change,
        changePercent: `${changePercent}%`,
        volume: Math.floor(Math.random() * 1000000), // Finnhub doesn't provide volume in quote
        previousClose: data.pc.toFixed(2),
        high: data.h.toFixed(2),
        low: data.l.toFixed(2)
      };
      
      cache.set(cacheKey, { data: stockData, timestamp: Date.now() });
      res.json({ data: stockData });
    } else {
      // Enhanced demo data with more realistic values
      const basePrice = 100 + Math.random() * 200;
      const change = (Math.random() - 0.5) * 20;
      const changePercent = (change / basePrice * 100).toFixed(2);
      
      const demoData = {
        symbol: symbol.toUpperCase(),
        price: basePrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: `${changePercent}%`,
        volume: Math.floor(Math.random() * 10000000),
        previousClose: (basePrice - change).toFixed(2),
        high: (basePrice + Math.random() * 10).toFixed(2),
        low: (basePrice - Math.random() * 10).toFixed(2),
        demo: true
      };
      
      cache.set(cacheKey, { data: demoData, timestamp: Date.now() });
      res.json({ data: demoData });
    }
  } catch (error) {
    console.error('Stocks error:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Sports API (using demo data for now)
app.get('/api/sports', async (req, res) => {
  const { league = 'nfl', teams = '' } = req.query;
  const cacheKey = getCacheKey('sports', { league, teams });
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    // For now, return demo sports data
    // In production, you could use APIs like:
    // - ESPN API
    // - The Sports DB API
    // - RapidAPI Sports APIs
    
    const sportsData = {
      league: league.toUpperCase(),
      games: [
        {
          id: 1,
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          homeScore: Math.floor(Math.random() * 50),
          awayScore: Math.floor(Math.random() * 50),
          status: 'Final',
          date: new Date().toISOString()
        },
        {
          id: 2,
          homeTeam: 'Team C',
          awayTeam: 'Team D',
          homeScore: Math.floor(Math.random() * 50),
          awayScore: Math.floor(Math.random() * 50),
          status: 'Live',
          quarter: '3rd',
          timeRemaining: '12:34'
        }
      ],
      demo: true
    };
    
    cache.set(cacheKey, { data: sportsData, timestamp: Date.now() });
    res.json({ data: sportsData });
  } catch (error) {
    console.error('Sports error:', error);
    res.status(500).json({ error: 'Failed to fetch sports data' });
  }
});

// Search APIs for autocomplete functionality

// Weather/City search
app.get('/api/search/cities', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 2) {
    return res.json({ data: [] });
  }
  
  try {
    if (process.env.OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${process.env.OPENWEATHER_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      const cities = data.map(city => ({
        id: `${city.lat}-${city.lon}`,
        name: city.name,
        country: city.country,
        state: city.state,
        displayName: `${city.name}${city.state ? `, ${city.state}` : ''}, ${city.country}`
      }));
      
      res.json({ data: cities });
    } else {
      // Demo city data
      const demoCities = [
        { id: '1', name: 'New York', country: 'US', state: 'NY', displayName: 'New York, NY, US' },
        { id: '2', name: 'London', country: 'GB', displayName: 'London, GB' },
        { id: '3', name: 'Tokyo', country: 'JP', displayName: 'Tokyo, JP' },
        { id: '4', name: 'Paris', country: 'FR', displayName: 'Paris, FR' },
        { id: '5', name: 'Sydney', country: 'AU', displayName: 'Sydney, AU' }
      ].filter(city => city.name.toLowerCase().includes(query.toLowerCase()));
      
      res.json({ data: demoCities });
    }
  } catch (error) {
    console.error('City search error:', error);
    res.status(500).json({ error: 'Failed to search cities' });
  }
});

// Crypto search
app.get('/api/search/crypto', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 1) {
    return res.json({ data: [] });
  }
  
  try {
    // Get list of cryptocurrencies from CoinGecko
    const url = `https://api.coingecko.com/api/v3/coins/list`;
    const response = await fetchWithRetry(url);
    const coins = await response.json();
    
    const filteredCoins = coins
      .filter(coin => 
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10)
      .map(coin => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase()
      }));
    
    res.json({ data: filteredCoins });
  } catch (error) {
    console.error('Crypto search error:', error);
    
    // Fallback to demo data
    const demoCryptos = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
      { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
      { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
      { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
      { id: 'stellar', name: 'Stellar', symbol: 'XLM' }
    ].filter(crypto => 
      crypto.name.toLowerCase().includes(query.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json({ data: demoCryptos });
  }
});

// Stock search
app.get('/api/search/stocks', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 1) {
    return res.json({ data: [] });
  }
  
  try {
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      const stocks = data.bestMatches?.slice(0, 10).map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region']
      })) || [];
      
      res.json({ data: stocks });
    } else {
      // Demo stock data
      const demoStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'META', name: 'Meta Platforms Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'NFLX', name: 'Netflix Inc.', type: 'Equity', region: 'United States' }
      ].filter(stock => 
        stock.name.toLowerCase().includes(query.toLowerCase()) ||
        stock.symbol.toLowerCase().includes(query.toLowerCase())
      );
      
      res.json({ data: demoStocks });
    }
  } catch (error) {
    console.error('Stock search error:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
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

// Enhanced ESP32 endpoint with authentication support
app.get('/api/esp32/:deviceId?', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const baseUrl = getBaseUrl(req);
    
    // If deviceId is provided, you could customize the response for that specific device
    // For now, we'll return the same data for all devices
    
    // Get data for the main widgets
    const [weather, crypto, stocks, countdown] = await Promise.all([
      fetch(`${baseUrl}/api/weather`).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`${baseUrl}/api/crypto`).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`${baseUrl}/api/stocks`).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`${baseUrl}/api/countdown`).then(r => r.json()).catch(() => ({ data: null }))
    ]);
    
    const response = {
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString(),
      widgets: [
        weather.data ? { type: 'weather', data: weather.data } : null,
        crypto.data ? { type: 'crypto', data: crypto.data } : null,
        stocks.data ? { type: 'stocks', data: stocks.data } : null,
        countdown.data ? { type: 'countdown', data: countdown.data } : null
      ].filter(Boolean)
    };
    
    res.json(response);
  } catch (error) {
    console.error('ESP32 endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch widget data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      weather: !!process.env.OPENWEATHER_API_KEY,
      stocks: !!(process.env.ALPHA_VANTAGE_API_KEY || process.env.FINNHUB_API_KEY),
      crypto: true,
      sports: false // Demo data only
    }
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const docs = {
    endpoints: {
      'GET /api/weather': {
        description: 'Get weather data for a location',
        parameters: {
          location: 'City name (default: New York)',
          units: 'imperial or metric (default: imperial)'
        }
      },
      'GET /api/crypto': {
        description: 'Get cryptocurrency price data',
        parameters: {
          coin: 'Cryptocurrency ID (default: bitcoin)',
          currency: 'Currency code (default: usd)'
        }
      },
      'GET /api/stocks': {
        description: 'Get stock price data',
        parameters: {
          symbol: 'Stock symbol (default: AAPL)'
        }
      },
      'GET /api/sports': {
        description: 'Get sports data',
        parameters: {
          league: 'Sports league (default: nfl)',
          teams: 'Comma-separated team IDs'
        }
      },
      'GET /api/search/cities': {
        description: 'Search for cities',
        parameters: {
          q: 'Search query'
        }
      },
      'GET /api/search/crypto': {
        description: 'Search for cryptocurrencies',
        parameters: {
          q: 'Search query'
        }
      },
      'GET /api/search/stocks': {
        description: 'Search for stocks',
        parameters: {
          q: 'Search query'
        }
      },
      'GET /api/esp32/:deviceId': {
        description: 'Get widget data for ESP32 device',
        parameters: {
          deviceId: 'Optional ESP32 device ID'
        }
      }
    },
    environment: {
      'OPENWEATHER_API_KEY': 'Required for real weather data',
      'ALPHA_VANTAGE_API_KEY': 'Required for real stock data (primary)',
      'FINNHUB_API_KEY': 'Alternative for real stock data',
    }
  };
  
  res.json(docs);
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 ESP32 endpoint: http://localhost:${PORT}/api/esp32`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  console.log('\n🔑 API Key Status:');
  console.log(`   Weather (OpenWeather): ${process.env.OPENWEATHER_API_KEY ? '✅ Active' : '❌ Missing - using demo data'}`);
  console.log(`   Stocks (Alpha Vantage): ${process.env.ALPHA_VANTAGE_API_KEY ? '✅ Active' : '❌ Missing - using demo data'}`);
  console.log(`   Stocks (Finnhub): ${process.env.FINNHUB_API_KEY ? '✅ Active' : '❌ Missing'}`);
  console.log(`   Crypto (CoinGecko): ✅ Active (free API)`);
  console.log(`   Sports: ❌ Demo data only`);
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log('\n⚠️  To get real weather data:');
    console.log('   1. Sign up at https://openweathermap.org/api');
    console.log('   2. Add OPENWEATHER_API_KEY=your_key to .env file');
  }
  
  if (!process.env.ALPHA_VANTAGE_API_KEY && !process.env.FINNHUB_API_KEY) {
    console.log('\n⚠️  To get real stock data:');
    console.log('   Option 1 - Alpha Vantage (recommended):');
    console.log('   1. Sign up at https://www.alphavantage.co/support/#api-key');
    console.log('   2. Add ALPHA_VANTAGE_API_KEY=your_key to .env file');
    console.log('   Option 2 - Finnhub:');
    console.log('   1. Sign up at https://finnhub.io/register');
    console.log('   2. Add FINNHUB_API_KEY=your_key to .env file');
  }
});
