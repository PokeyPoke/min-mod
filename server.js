/**
 * Enhanced Dashboard Server - Optimized for Heroku
 * Configured for Alpha Vantage stock API
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_CACHE = new Map();

// Helper functions
function getCacheKey(type, params) {
  return `${type}-${JSON.stringify(params)}`;
}

function isCacheValid(timestamp) {
  return Date.now() - timestamp < CACHE_TTL;
}

function isRateLimited(key, limit = 5, window = 60000) {
  const now = Date.now();
  const requests = RATE_LIMIT_CACHE.get(key) || [];
  
  // Clean old requests
  const validRequests = requests.filter(time => now - time < window);
  
  if (validRequests.length >= limit) {
    return true;
  }
  
  validRequests.push(now);
  RATE_LIMIT_CACHE.set(key, validRequests);
  return false;
}

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Dashboard-App/2.0',
          ...options.headers
        }
      });
      
      clearTimeout(timeout);
      
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

// ===== WEATHER API =====
app.get('/api/weather', async (req, res) => {
  const { location = 'New York', units = 'imperial' } = req.query;
  const cacheKey = getCacheKey('weather', { location, units });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    if (process.env.OPENWEATHER_API_KEY) {
      if (isRateLimited(`weather-${req.ip}`, 10, 60000)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${process.env.OPENWEATHER_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      const weatherData = {
        location: data.name + (data.sys?.country ? `, ${data.sys.country}` : ''),
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: Math.round(data.wind?.speed || 0),
        units: units,
        icon: data.weather[0].icon
      };
      
      cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
      res.json({ data: weatherData });
    } else {
      // Enhanced demo data with more variety
      const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Mist'];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      
      const demoData = {
        location: location,
        temp: Math.floor(Math.random() * 35) + 45, // 45-80°F
        condition: condition,
        description: condition.toLowerCase(),
        humidity: Math.floor(Math.random() * 40) + 30, // 30-70%
        pressure: Math.floor(Math.random() * 50) + 1000, // 1000-1050 hPa
        wind: Math.floor(Math.random() * 20) + 2, // 2-22 mph
        units: units,
        demo: true
      };
      
      cache.set(cacheKey, { data: demoData, timestamp: Date.now() });
      res.json({ data: demoData });
    }
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// ===== CRYPTOCURRENCY API =====
app.get('/api/crypto', async (req, res) => {
  const { coin = 'bitcoin', currency = 'usd' } = req.query;
  const cacheKey = getCacheKey('crypto', { coin, currency });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    if (isRateLimited(`crypto-${req.ip}`, 20, 60000)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const response = await fetchWithRetry(url);
    const data = await response.json();
    const coinData = data[coin];
    
    if (!coinData) {
      throw new Error('Cryptocurrency not found');
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
    console.error('Crypto API error:', error);
    res.status(500).json({ error: 'Failed to fetch cryptocurrency data' });
  }
});

// ===== STOCKS API (Alpha Vantage Optimized) =====
app.get('/api/stocks', async (req, res) => {
  const { symbol = 'AAPL' } = req.query;
  const cacheKey = getCacheKey('stocks', { symbol: symbol.toUpperCase() });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      // Rate limiting for Alpha Vantage (5 calls per minute)
      if (isRateLimited(`stocks-${req.ip}`, 4, 70000)) { // Slightly under limit
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      // Check for API errors
      if (data['Error Message']) {
        throw new Error('Invalid stock symbol');
      }
      
      if (data['Note']) {
        throw new Error('API call frequency limit reached');
      }
      
      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error('Stock data not available');
      }
      
      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = quote['10. change percent'].replace('%', '');
      
      const stockData = {
        symbol: quote['01. symbol'],
        price: price.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent + '%',
        volume: parseInt(quote['06. volume']) || 0,
        previousClose: parseFloat(quote['08. previous close']).toFixed(2),
        high: parseFloat(quote['03. high']).toFixed(2),
        low: parseFloat(quote['04. low']).toFixed(2),
        lastUpdated: quote['07. latest trading day']
      };
      
      cache.set(cacheKey, { data: stockData, timestamp: Date.now() });
      res.json({ data: stockData });
    } else {
      // Enhanced demo data with realistic stock movements
      const basePrice = 150 + Math.random() * 200; // $150-350 range
      const changePercent = (Math.random() - 0.5) * 8; // -4% to +4%
      const change = (basePrice * changePercent / 100);
      const previousClose = basePrice - change;
      
      const demoData = {
        symbol: symbol.toUpperCase(),
        price: basePrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: `${changePercent.toFixed(2)}%`,
        volume: Math.floor(Math.random() * 50000000) + 1000000, // 1M-50M
        previousClose: previousClose.toFixed(2),
        high: (basePrice + Math.random() * 10).toFixed(2),
        low: (basePrice - Math.random() * 10).toFixed(2),
        lastUpdated: new Date().toISOString().split('T')[0],
        demo: true
      };
      
      cache.set(cacheKey, { data: demoData, timestamp: Date.now() });
      res.json({ data: demoData });
    }
  } catch (error) {
    console.error('Stocks API error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stock data' });
  }
});

// ===== SEARCH APIS =====

// City search for weather
app.get('/api/search/cities', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 2) {
    return res.json({ data: [] });
  }
  
  try {
    if (process.env.OPENWEATHER_API_KEY && query.length >= 3) {
      if (isRateLimited(`city-search-${req.ip}`, 10, 60000)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=8&appid=${process.env.OPENWEATHER_API_KEY}`;
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
      // Comprehensive demo cities
      const demoCities = [
        { id: '1', name: 'New York', country: 'US', state: 'NY', displayName: 'New York, NY, US' },
        { id: '2', name: 'Los Angeles', country: 'US', state: 'CA', displayName: 'Los Angeles, CA, US' },
        { id: '3', name: 'London', country: 'GB', displayName: 'London, GB' },
        { id: '4', name: 'Tokyo', country: 'JP', displayName: 'Tokyo, JP' },
        { id: '5', name: 'Paris', country: 'FR', displayName: 'Paris, FR' },
        { id: '6', name: 'Sydney', country: 'AU', displayName: 'Sydney, AU' },
        { id: '7', name: 'Toronto', country: 'CA', displayName: 'Toronto, CA' },
        { id: '8', name: 'Berlin', country: 'DE', displayName: 'Berlin, DE' },
        { id: '9', name: 'Mumbai', country: 'IN', displayName: 'Mumbai, IN' },
        { id: '10', name: 'Singapore', country: 'SG', displayName: 'Singapore, SG' }
      ].filter(city => 
        city.name.toLowerCase().includes(query.toLowerCase()) ||
        city.country.toLowerCase().includes(query.toLowerCase())
      );
      
      res.json({ data: demoCities });
    }
  } catch (error) {
    console.error('City search error:', error);
    res.status(500).json({ error: 'Failed to search cities' });
  }
});

// Cryptocurrency search
app.get('/api/search/crypto', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 1) {
    return res.json({ data: [] });
  }
  
  try {
    // Use cached list or fetch from CoinGecko
    let coinsList = cache.get('crypto-list');
    
    if (!coinsList || !isCacheValid(coinsList.timestamp)) {
      if (isRateLimited(`crypto-list-${req.ip}`, 2, 300000)) { // 2 calls per 5 min
        // Fallback to demo data
        coinsList = { data: null };
      } else {
        try {
          const url = 'https://api.coingecko.com/api/v3/coins/list';
          const response = await fetchWithRetry(url);
          const data = await response.json();
          coinsList = { data, timestamp: Date.now() };
          cache.set('crypto-list', coinsList);
        } catch (error) {
          coinsList = { data: null };
        }
      }
    }
    
    let coins;
    if (coinsList.data) {
      coins = coinsList.data
        .filter(coin => 
          coin.name.toLowerCase().includes(query.toLowerCase()) ||
          coin.symbol.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 15)
        .map(coin => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase()
        }));
    } else {
      // Demo cryptocurrency data
      coins = [
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
        { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
        { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
        { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
        { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
        { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
        { id: 'stellar', name: 'Stellar', symbol: 'XLM' },
        { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
        { id: 'solana', name: 'Solana', symbol: 'SOL' },
        { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' }
      ].filter(crypto => 
        crypto.name.toLowerCase().includes(query.toLowerCase()) ||
        crypto.symbol.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    res.json({ data: coins });
  } catch (error) {
    console.error('Crypto search error:', error);
    res.status(500).json({ error: 'Failed to search cryptocurrencies' });
  }
});

// Stock search (Alpha Vantage optimized)
app.get('/api/search/stocks', async (req, res) => {
  const { q: query } = req.query;
  
  if (!query || query.length < 1) {
    return res.json({ data: [] });
  }
  
  try {
    if (process.env.ALPHA_VANTAGE_API_KEY && query.length >= 2) {
      // Conservative rate limiting for Alpha Vantage search
      if (isRateLimited(`stock-search-${req.ip}`, 2, 70000)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
      
      const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const response = await fetchWithRetry(url);
      const data = await response.json();
      
      if (data['Note']) {
        throw new Error('API call frequency limit reached');
      }
      
      const stocks = (data.bestMatches || []).slice(0, 12).map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region']
      }));
      
      res.json({ data: stocks });
    } else {
      // Comprehensive demo stock data
      const demoStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', type: 'Equity', region: 'United States' },
        { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'META', name: 'Meta Platforms Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'NFLX', name: 'Netflix Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'INTC', name: 'Intel Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'CRM', name: 'Salesforce Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'ORCL', name: 'Oracle Corporation', type: 'Equity', region: 'United States' },
        { symbol: 'IBM', name: 'International Business Machines Corp.', type: 'Equity', region: 'United States' },
        { symbol: 'UBER', name: 'Uber Technologies Inc.', type: 'Equity', region: 'United States' },
        { symbol: 'SPOT', name: 'Spotify Technology S.A.', type: 'Equity', region: 'United States' },
        { symbol: 'SQ', name: 'Block Inc.', type: 'Equity', region: 'United States' }
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

// ===== SPORTS API =====
app.get('/api/sports', async (req, res) => {
  const { league = 'nfl', teams = '' } = req.query;
  const cacheKey = getCacheKey('sports', { league, teams });
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return res.json({ data: cached.data });
  }

  try {
    // Demo sports data with more realistic structure
    const leagueNames = {
      nfl: 'NFL',
      nba: 'NBA',
      mlb: 'MLB',
      nhl: 'NHL',
      soccer: 'Premier League'
    };
    
    const teamsByLeague = {
      nfl: ['Patriots', 'Cowboys', 'Packers', 'Chiefs', '49ers'],
      nba: ['Lakers', 'Warriors', 'Celtics', 'Bulls', 'Heat'],
      mlb: ['Yankees', 'Dodgers', 'Red Sox', 'Cubs', 'Giants'],
      nhl: ['Bruins', 'Rangers', 'Blackhawks', 'Kings', 'Penguins'],
      soccer: ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Man United']
    };
    
    const leagueTeams = teamsByLeague[league] || teamsByLeague.nfl;
    
    const games = Array.from({ length: 3 }, (_, i) => {
      const homeTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)];
      let awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)];
      while (awayTeam === homeTeam) {
        awayTeam = leagueTeams[Math.floor(Math.random() * leagueTeams.length)];
      }
      
      const homeScore = Math.floor(Math.random() * 50) + 10;
      const awayScore = Math.floor(Math.random() * 50) + 10;
      const status = i === 0 ? 'Live' : (i === 1 ? 'Final' : 'Scheduled');
      
      return {
        id: i + 1,
        homeTeam,
        awayTeam,
        homeScore: status === 'Scheduled' ? null : homeScore,
        awayScore: status === 'Scheduled' ? null : awayScore,
        status,
        quarter: status === 'Live' ? `${Math.floor(Math.random() * 4) + 1}Q` : null,
        timeRemaining: status === 'Live' ? `${Math.floor(Math.random() * 15)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : null,
        date: new Date(Date.now() + (i - 1) * 24 * 60 * 60 * 1000).toISOString()
      };
    });
    
    const sportsData = {
      league: leagueNames[league] || 'NFL',
      games,
      lastUpdated: new Date().toISOString(),
      demo: true
    };
    
    cache.set(cacheKey, { data: sportsData, timestamp: Date.now() });
    res.json({ data: sportsData });
  } catch (error) {
    console.error('Sports API error:', error);
    res.status(500).json({ error: 'Failed to fetch sports data' });
  }
});

// ===== COUNTDOWN API =====
app.get('/api/countdown', async (req, res) => {
  const { 
    title = 'New Year', 
    targetDate = '2025-12-31T23:59:59',
    timezone = 'UTC'
  } = req.query;
  
  try {
    const target = new Date(targetDate);
    const now = new Date();
    
    // Validate date
    if (isNaN(target.getTime())) {
      throw new Error('Invalid date format');
    }
    
    const diff = target - now;
    
    const countdownData = {
      title: title,
      targetDate: targetDate,
      timezone: timezone,
      completed: diff <= 0,
      timeRemaining: Math.max(0, diff),
      daysRemaining: Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
    };
    
    res.json({ data: countdownData });
  } catch (error) {
    console.error('Countdown API error:', error);
    res.status(400).json({ error: error.message || 'Invalid date format' });
  }
});

// ===== NOTES API =====
app.get('/api/notes', (req, res) => {
  const { title = 'Notes', content = '' } = req.query;
  
  const notesData = {
    title: title,
    content: content,
    showWordCount: true,
    autoSave: true,
    lastModified: new Date().toISOString()
  };
  
  res.json({ data: notesData });
});

// ===== TODO API =====
app.get('/api/todo', (req, res) => {
  const { title = 'To-Do List' } = req.query;
  
  const todoData = {
    title: title,
    items: [],
    showCompleted: true,
    maxItems: 20,
    createdAt: new Date().toISOString()
  };
  
  res.json({ data: todoData });
});

// ===== ESP32 ENDPOINT =====
app.get('/api/esp32/:deviceId?', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Rate limiting for ESP32 devices
    if (isRateLimited(`esp32-${deviceId || req.ip}`, 10, 60000)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Parallel fetch for better performance
    const [weather, crypto, stocks, countdown] = await Promise.allSettled([
      fetch(`${baseUrl}/api/weather?location=New York&units=imperial`).then(r => r.json()),
      fetch(`${baseUrl}/api/crypto?coin=bitcoin&currency=usd`).then(r => r.json()),
      fetch(`${baseUrl}/api/stocks?symbol=AAPL`).then(r => r.json()),
      fetch(`${baseUrl}/api/countdown?title=New Year&targetDate=2025-12-31T23:59:59`).then(r => r.json())
    ]);
    
    const response = {
      deviceId: deviceId || 'unknown',
      timestamp: new Date().toISOString(),
      widgets: [
        weather.status === 'fulfilled' && weather.value.data ? { type: 'weather', data: weather.value.data } : null,
        crypto.status === 'fulfilled' && crypto.value.data ? { type: 'crypto', data: crypto.value.data } : null,
        stocks.status === 'fulfilled' && stocks.value.data ? { type: 'stocks', data: stocks.value.data } : null,
        countdown.status === 'fulfilled' && countdown.value.data ? { type: 'countdown', data: countdown.value.data } : null
      ].filter(Boolean),
      status: 'success'
    };
    
    res.json(response);
  } catch (error) {
    console.error('ESP32 endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch widget data',
      deviceId: req.params.deviceId || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      weather: !!process.env.OPENWEATHER_API_KEY,
      stocks: !!process.env.ALPHA_VANTAGE_API_KEY,
      crypto: true, // CoinGecko free API
      sports: 'demo', // Demo data only
      search: true
    },
    cache: {
      entries: cache.size,
      rateLimitEntries: RATE_LIMIT_CACHE.size
    },
    uptime: process.uptime()
  };
  
  res.json(health);
});

// ===== API DOCUMENTATION =====
app.get('/api/docs', (req, res) => {
  const docs = {
    title: 'Enhanced Dashboard API',
    version: '2.0.0',
    description: 'REST API for the Enhanced Dashboard application',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    endpoints: {
      'GET /api/weather': {
        description: 'Get current weather data for a location',
        parameters: {
          location: 'City name (default: New York)',
          units: 'imperial or metric (default: imperial)'
        },
        rateLimit: '10 requests per minute per IP'
      },
      'GET /api/crypto': {
        description: 'Get cryptocurrency price data',
        parameters: {
          coin: 'Cryptocurrency ID from CoinGecko (default: bitcoin)',
          currency: 'Currency code like usd, eur, btc (default: usd)'
        },
        rateLimit: '20 requests per minute per IP'
      },
      'GET /api/stocks': {
        description: 'Get real-time stock price data via Alpha Vantage',
        parameters: {
          symbol: 'Stock symbol like AAPL, GOOGL (default: AAPL)'
        },
        rateLimit: '4 requests per minute per IP (Alpha Vantage limit)',
        note: 'Requires ALPHA_VANTAGE_API_KEY environment variable'
      },
      'GET /api/sports': {
        description: 'Get sports scores and schedules (demo data)',
        parameters: {
          league: 'Sports league: nfl, nba, mlb, nhl, soccer (default: nfl)',
          teams: 'Comma-separated team IDs (optional)'
        }
      },
      'GET /api/search/cities': {
        description: 'Search for cities for weather widgets',
        parameters: {
          q: 'Search query (minimum 2 characters)'
        }
      },
      'GET /api/search/crypto': {
        description: 'Search for cryptocurrencies',
        parameters: {
          q: 'Search query (minimum 1 character)'
        }
      },
      'GET /api/search/stocks': {
        description: 'Search for stocks via Alpha Vantage',
        parameters: {
          q: 'Search query (minimum 1 character)'
        },
        rateLimit: '2 requests per minute per IP'
      },
      'GET /api/countdown': {
        description: 'Create countdown timers',
        parameters: {
          title: 'Event title (default: New Year)',
          targetDate: 'ISO date string (default: 2025-12-31T23:59:59)',
          timezone: 'Timezone (default: UTC)'
        }
      },
      'GET /api/esp32/:deviceId': {
        description: 'Get all widget data for ESP32 devices',
        parameters: {
          deviceId: 'Optional ESP32 device identifier'
        },
        rateLimit: '10 requests per minute per device'
      }
    },
    environment: {
      required: {
        'ALPHA_VANTAGE_API_KEY': 'Required for real stock data - Get from https://www.alphavantage.co/support/#api-key'
      },
      optional: {
        'OPENWEATHER_API_KEY': 'For real weather data - Get from https://openweathermap.org/api'
      }
    },
    herokuDeployment: {
      configVars: [
        'ALPHA_VANTAGE_API_KEY',
        'OPENWEATHER_API_KEY (optional)'
      ],
      buildpacks: ['heroku/nodejs'],
      dynos: 'Works on free tier with hobby dynos'
    }
  };
  
  res.json(docs);
});

// ===== STATIC ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for single page app
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// ===== CLEANUP =====
// Clean up cache and rate limit data periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean expired cache entries
  for (const [key, value] of cache.entries()) {
    if (!isCacheValid(value.timestamp)) {
      cache.delete(key);
    }
  }
  
  // Clean old rate limit entries
  for (const [key, requests] of RATE_LIMIT_CACHE.entries()) {
    const validRequests = requests.filter(time => now - time < 300000); // 5 minutes
    if (validRequests.length === 0) {
      RATE_LIMIT_CACHE.delete(key);
    } else {
      RATE_LIMIT_CACHE.set(key, validRequests);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

// ===== SERVER STARTUP =====
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Dashboard Server running on port ${PORT}`);
  console.log(`🌐 Dashboard: ${process.env.NODE_ENV === 'production' ? 'https://your-app-name.herokuapp.com' : `http://localhost:${PORT}`}`);
  console.log(`📊 ESP32 endpoint: /api/esp32/YOUR_DEVICE_ID`);
  console.log(`📚 API docs: /api/docs`);
  console.log(`❤️  Health check: /health`);
  
  console.log('\n🔑 API Configuration:');
  console.log(`   ✅ Alpha Vantage (Stocks): ${process.env.ALPHA_VANTAGE_API_KEY ? 'ACTIVE' : 'MISSING - Using demo data'}`);
  console.log(`   ${process.env.OPENWEATHER_API_KEY ? '✅' : '⚠️ '} OpenWeather (Weather): ${process.env.OPENWEATHER_API_KEY ? 'ACTIVE' : 'MISSING - Using demo data'}`);
  console.log(`   ✅ CoinGecko (Crypto): ACTIVE (Free API)`);
  console.log(`   ⚠️  Sports: Demo data only`);
  
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    console.log('\n⚠️  To enable real stock data:');
    console.log('   Heroku: heroku config:set ALPHA_VANTAGE_API_KEY=your_key_here');
    console.log('   Local: Add ALPHA_VANTAGE_API_KEY=your_key to .env file');
    console.log('   Get key: https://www.alphavantage.co/support/#api-key');
  }
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log('\n⚠️  To enable real weather data:');
    console.log('   Heroku: heroku config:set OPENWEATHER_API_KEY=your_key_here');
    console.log('   Local: Add OPENWEATHER_API_KEY=your_key to .env file');
    console.log('   Get key: https://openweathermap.org/api');
  }
  
  console.log('\n🚀 Server ready for requests!');
});
