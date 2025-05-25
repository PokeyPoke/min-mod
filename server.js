/**
 * Enhanced Dashboard Server - Optimized for Heroku with Authentication
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

// Simple user storage (replace with real database in production)
const users = new Map();
const sessions = new Map();

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

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function hashPassword(password) {
  // Simple hash for demo - use bcrypt in production
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
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

// ===== AUTHENTICATION ENDPOINTS =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user already exists
    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = {
      id: Date.now().toString(),
      email: email,
      name: name || email.split('@')[0],
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
      dashboardLayout: null
    };
    
    users.set(email, user);
    
    // Create session
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      userId: user.id,
      email: user.email,
      createdAt: Date.now()
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = users.get(email);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      userId: user.id,
      email: user.email,
      createdAt: Date.now()
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const { sessionId } = req.body;
  
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  
  res.json({ success: true });
});

app.get('/api/auth/verify', (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  const session = sessions.get(sessionId);
  const user = Array.from(users.values()).find(u => u.id === session.userId);
  
  if (!user) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

// Middleware to check authentication for protected routes
function requireAuth(req, res, next) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const session = sessions.get(sessionId);
  const user = Array.from(users.values()).find(u => u.id === session.userId);
  
  if (!user) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: 'User not found' });
  }
  
  req.user = user;
  req.sessionId = sessionId;
  next();
}

// ===== USER DASHBOARD ENDPOINTS =====
app.get('/api/user/dashboard', requireAuth, (req, res) => {
  res.json({
    success: true,
    layout: req.user.dashboardLayout
  });
});

app.post('/api/user/dashboard', requireAuth, (req, res) => {
  const { layout } = req.body;
  
  // Update user's dashboard layout
  req.user.dashboardLayout = layout;
  users.set(req.user.email, req.user);
  
  res.json({ success: true });
});

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
      authentication: true,
      weather: !!process.env.OPENWEATHER_API_KEY,
      stocks: !!process.env.ALPHA_VANTAGE_API_KEY,
      crypto: true, // CoinGecko free API
      userDashboards: true
    },
    cache: {
      entries: cache.size,
      rateLimitEntries: RATE_LIMIT_CACHE.size
    },
    users: {
      registered: users.size,
      activeSessions: sessions.size
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
    description: 'REST API for the Enhanced Dashboard application with authentication',
    baseUrl: `${req.protocol}://${req.get('host')}`,
    authentication: {
      'POST /api/auth/register': {
        description: 'Register a new user account',
        body: { email: 'string', password: 'string', name: 'string (optional)' }
      },
      'POST /api/auth/login': {
        description: 'Login with email and password',
        body: { email: 'string', password: 'string' }
      },
      'POST /api/auth/logout': {
        description: 'Logout and invalidate session',
        body: { sessionId: 'string' }
      },
      'GET /api/auth/verify': {
        description: 'Verify session token',
        headers: { Authorization: 'Bearer <sessionId>' }
      }
    },
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
      'GET /api/countdown': {
        description: 'Create countdown timers',
        parameters: {
          title: 'Event title (default: New Year)',
          targetDate: 'ISO date string (default: 2025-12-31T23:59:59)',
          timezone: 'Timezone (default: UTC)'
        }
      },
      'GET /api/user/dashboard': {
        description: 'Get user dashboard layout (requires authentication)',
        headers: { Authorization: 'Bearer <sessionId>' }
      },
              'POST /api/user/dashboard': {
        description: 'Save user dashboard layout (requires authentication)',
        headers: { Authorization: 'Bearer <sessionId>' },
        body: { layout: 'array of widget configurations' }
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
// Clean up cache, rate limit data, and expired sessions periodically
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
  
  // Clean expired sessions (24 hours)
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      sessions.delete(sessionId);
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
  console.log(`   ✅ Authentication: ACTIVE (In-memory storage)`);
  console.log(`   ✅ User Dashboards: ACTIVE`);
  
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
  
  console.log('\n🔐 Authentication Features:');
  console.log('   • User registration and login');
  console.log('   • Session-based authentication');
  console.log('   • Personal dashboard layouts');
  console.log('   • Demo mode for unauthenticated users');
  
  console.log('\n🚀 Server ready for requests!');
});
