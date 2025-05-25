// Load and validate environment variables first
require('dotenv').config();
const { EnvValidator } = require('./utils/env-validator');

// Validate environment before starting
try {
  EnvValidator.validateProduction();
} catch (error) {
  console.error('❌ Server startup failed due to environment validation errors');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Import database layer
const { db } = require('./database');

// Import security middleware
const {
  rateLimits,
  speedLimiter,
  securityHeaders,
  validateRequest,
  validationSchemas,
  validateUserAgent,
  requestSizeLimit,
  corsOptions,
  requestLogger,
  honeypot,
  maintenanceMode,
  securityErrorHandler,
  SecurityLogger
} = require('./middleware/security');

// Import authentication
const { router: authRouter, auth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy settings for production
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Maintenance mode check (highest priority)
app.use(maintenanceMode);

// Security headers (early in middleware stack)
app.use(securityHeaders);

// Request logging
app.use(requestLogger);

// Honeypot for detecting attacks
app.use(honeypot);

// User agent validation
app.use(validateUserAgent);

// Request size limiting
app.use(requestSizeLimit('10mb'));

// Compression for production
if (process.env.NODE_ENV === 'production') {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024
  }));
}

// CORS configuration
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Log large requests
    if (buf.length > 1024 * 1024) { // 1MB
      SecurityLogger.log('LARGE_REQUEST_BODY', {
        size: buf.length,
        endpoint: req.originalUrl,
        ip: req.ip
      }, 'info');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving with security
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Security headers for static files
    if (path.endsWith('.html')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    }
  }
}));

// Rate limiting for different endpoint types
app.use('/api/', rateLimits.api);
app.use('/api/widget/', rateLimits.widget);
app.use('/api/auth/', rateLimits.auth);
app.use('/api/auth/', speedLimiter);

// Health check endpoint (before auth)
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await db.getHealthInfo();
    
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      database: {
        status: dbHealth.status,
        isConnected: dbHealth.isConnected,
        pool: dbHealth.pool,
        totalQueries: dbHealth.totalQueries,
        errorCount: dbHealth.errorCount
      }
    };

    // Optional: Include more detailed health for authenticated requests
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      // Add more detailed health information for authenticated requests
      healthData.detailed = {
        apiKeys: {
          openweather: !!process.env.OPENWEATHER_API_KEY,
          alphavantage: !!process.env.ALPHAVANTAGE_API_KEY,
          finnhub: !!process.env.FINNHUB_API_KEY
        },
        features: {
          redis: !!process.env.REDIS_URL,
          email: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
          monitoring: !!process.env.SECURITY_WEBHOOK_URL
        },
        database: dbHealth
      };
    }

    res.json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * Add this to your server.js file to support dynamic module discovery
 * Place this before the existing widget endpoints
 */

// Dynamic module discovery endpoint
app.get('/api/modules/list', async (req, res) => {
  try {
    console.log('📋 Module list requested');
    
    // Get available widget modules from the modules directory
    const widgetModules = require('./modules/widget-modules');
    const availableModules = [];
    
    // Process each module
    for (const [moduleType, moduleImpl] of Object.entries(widgetModules)) {
      try {
        // Basic module info
        const moduleInfo = {
          type: moduleType,
          name: moduleImpl.name || moduleType.charAt(0).toUpperCase() + moduleType.slice(1),
          description: moduleImpl.description || `${moduleImpl.name || moduleType} widget`,
          category: moduleImpl.category || 'general',
          version: moduleImpl.version || '2.0.0',
          priority: moduleImpl.priority || 50,
          enabled: moduleImpl.enabled !== false,
          path: `/js/widgets/${moduleType}.js`,
          
          // Frontend module info
          icon: getModuleIcon(moduleType),
          essential: isEssentialModule(moduleType),
          
          // Server-side availability
          serverSupport: true,
          apiEndpoint: `/api/widget/${moduleType}`,
          
          // Dependencies (if any)
          dependencies: moduleImpl.dependencies || [],
          
          // Configuration options
          configurable: true,
          
          // Performance hints
          loadPriority: getLoadPriority(moduleType),
          estimatedSize: getEstimatedModuleSize(moduleType)
        };
        
        // Check if module has special requirements
        if (moduleType === 'weather' && !process.env.OPENWEATHER_API_KEY) {
          moduleInfo.warning = 'API key required for full functionality';
          moduleInfo.demoMode = true;
        }
        
        if (moduleType === 'stocks' && !process.env.ALPHAVANTAGE_API_KEY && !process.env.FINNHUB_API_KEY) {
          moduleInfo.warning = 'API key required for real data';
          moduleInfo.demoMode = true;
        }
        
        availableModules.push(moduleInfo);
        
      } catch (error) {
        console.warn(`⚠️ Error processing module ${moduleType}:`, error);
        // Add module with error state
        availableModules.push({
          type: moduleType,
          name: moduleType,
          description: 'Module configuration error',
          category: 'general',
          version: '2.0.0',
          enabled: false,
          error: error.message,
          path: `/js/widgets/${moduleType}.js`
        });
      }
    }
    
    // Sort modules by priority and name
    availableModules.sort((a, b) => {
      if (a.priority !== b.priority) {
        return (a.priority || 50) - (b.priority || 50);
      }
      return a.name.localeCompare(b.name);
    });
    
    // Filter out disabled modules unless explicitly requested
    const includeDisabled = req.query.includeDisabled === 'true';
    const filteredModules = includeDisabled ? 
      availableModules : 
      availableModules.filter(m => m.enabled !== false);
    
    // Add metadata
    const response = {
      modules: filteredModules,
      meta: {
        total: availableModules.length,
        enabled: availableModules.filter(m => m.enabled !== false).length,
        disabled: availableModules.filter(m => m.enabled === false).length,
        categories: [...new Set(availableModules.map(m => m.category))],
        serverInfo: {
          nodeVersion: process.version,
          uptime: Math.floor(process.uptime()),
          environment: process.env.NODE_ENV || 'development'
        },
        capabilities: {
          weather: !!process.env.OPENWEATHER_API_KEY,
          stocks: !!(process.env.ALPHAVANTAGE_API_KEY || process.env.FINNHUB_API_KEY),
          crypto: true, // CoinGecko doesn't require API key
          database: true,
          authentication: true,
          esp32Support: true
        }
      }
    };
    
    // Cache headers for performance
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('X-Module-Count', filteredModules.length);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Module list endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve module list',
      message: error.message,
      modules: [], // Fallback empty array
      meta: {
        total: 0,
        enabled: 0,
        error: true
      }
    });
  }
});

// Module configuration endpoint
app.get('/api/modules/:moduleType/config', async (req, res) => {
  try {
    const { moduleType } = req.params;
    const widgetModules = require('./modules/widget-modules');
    
    if (!widgetModules[moduleType]) {
      return res.status(404).json({
        error: 'Module not found',
        type: moduleType
      });
    }
    
    const module = widgetModules[moduleType];
    
    // Get module configuration schema
    const configSchema = getModuleConfigSchema(moduleType, module);
    
    res.json({
      type: moduleType,
      name: module.name || moduleType,
      configSchema,
      defaults: getModuleDefaults(moduleType),
      validation: getModuleValidation(moduleType),
      examples: getModuleExamples(moduleType)
    });
    
  } catch (error) {
    console.error(`Module config error for ${req.params.moduleType}:`, error);
    res.status(500).json({
      error: 'Failed to get module configuration',
      message: error.message
    });
  }
});

// Module health check endpoint
app.get('/api/modules/:moduleType/health', async (req, res) => {
  try {
    const { moduleType } = req.params;
    const widgetModules = require('./modules/widget-modules');
    
    if (!widgetModules[moduleType]) {
      return res.status(404).json({
        error: 'Module not found',
        type: moduleType,
        healthy: false
      });
    }
    
    const module = widgetModules[moduleType];
    
    // Perform health checks
    const healthCheck = await performModuleHealthCheck(moduleType, module);
    
    res.json({
      type: moduleType,
      name: module.name || moduleType,
      healthy: healthCheck.healthy,
      checks: healthCheck.checks,
      lastChecked: new Date().toISOString(),
      version: module.version || '2.0.0'
    });
    
  } catch (error) {
    console.error(`Module health check error for ${req.params.moduleType}:`, error);
    res.status(500).json({
      type: req.params.moduleType,
      healthy: false,
      error: error.message,
      lastChecked: new Date().toISOString()
    });
  }
});

/**
 * Helper functions for module management
 */

function getModuleIcon(moduleType) {
  const iconMap = {
    weather: 'fas fa-cloud-sun',
    crypto: 'fab fa-bitcoin', 
    stocks: 'fas fa-chart-line',
    countdown: 'fas fa-hourglass-half',
    notes: 'fas fa-sticky-note',
    todo: 'fas fa-tasks',
    clock: 'fas fa-clock',
    calendar: 'fas fa-calendar-alt',
    rss: 'fas fa-rss',
    system: 'fas fa-server'
  };
  return iconMap[moduleType] || 'fas fa-puzzle-piece';
}

function isEssentialModule(moduleType) {
  // Define which modules are essential for the default dashboard
  const essentialModules = ['weather', 'notes'];
  return essentialModules.includes(moduleType);
}

function getLoadPriority(moduleType) {
  // Higher priority = loads first
  const priorities = {
    weather: 1,    // Weather is most commonly used
    notes: 2,      // Notes is simple and useful
    todo: 3,       // Todo is productivity focused
    stocks: 4,     // Financial data
    crypto: 5,     // Crypto data
    countdown: 6   // Countdown is less frequently used
  };
  return priorities[moduleType] || 10;
}

function getEstimatedModuleSize(moduleType) {
  // Estimated JavaScript bundle size in KB
  const sizes = {
    weather: 12,
    crypto: 8,
    stocks: 10,
    countdown: 6,
    notes: 5,
    todo: 8
  };
  return sizes[moduleType] || 8;
}

function getModuleConfigSchema(moduleType, module) {
  // Define configuration schemas for each module type
  const schemas = {
    weather: {
      location: {
        type: 'string',
        required: true,
        default: 'New York',
        description: 'City name or coordinates (lat,lon)',
        validation: { minLength: 2, maxLength: 100 }
      },
      units: {
        type: 'select',
        required: false,
        default: 'imperial',
        options: [
          { value: 'imperial', label: 'Fahrenheit (°F)' },
          { value: 'metric', label: 'Celsius (°C)' },
          { value: 'kelvin', label: 'Kelvin (K)' }
        ],
        description: 'Temperature units'
      },
      detailLevel: {
        type: 'select',
        required: false,
        default: 'compact',
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'expanded', label: 'Expanded' }
        ],
        description: 'Amount of detail to display'
      },
      showForecast: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Show 5-day forecast'
      }
    },
    
    crypto: {
      coin: {
        type: 'string',
        required: true,
        default: 'bitcoin',
        description: 'Cryptocurrency to display',
        validation: { minLength: 2, maxLength: 50 }
      },
      currency: {
        type: 'select',
        required: false,
        default: 'usd',
        options: [
          { value: 'usd', label: 'US Dollar' },
          { value: 'eur', label: 'Euro' },
          { value: 'btc', label: 'Bitcoin' },
          { value: 'eth', label: 'Ethereum' }
        ],
        description: 'Display currency'
      },
      detailLevel: {
        type: 'select',
        required: false,
        default: 'compact',
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'expanded', label: 'Expanded' }
        ]
      }
    },
    
    stocks: {
      symbol: {
        type: 'string',
        required: true,
        default: 'AAPL',
        description: 'Stock symbol to display',
        validation: { minLength: 1, maxLength: 10, pattern: '^[A-Z0-9.]+ }
      },
      detailLevel: {
        type: 'select',
        required: false,
        default: 'compact',
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'expanded', label: 'Expanded' }
        ]
      }
    },
    
    countdown: {
      title: {
        type: 'string',
        required: true,
        default: 'New Year',
        description: 'Countdown title',
        validation: { minLength: 1, maxLength: 100 }
      },
      targetDate: {
        type: 'datetime',
        required: true,
        default: '2026-01-01T00:00:00',
        description: 'Target date and time'
      },
      timezone: {
        type: 'string',
        required: false,
        default: 'UTC',
        description: 'Timezone for the countdown'
      }
    },
    
    notes: {
      title: {
        type: 'string',
        required: false,
        default: 'Notes',
        description: 'Notes title',
        validation: { maxLength: 100 }
      },
      content: {
        type: 'textarea',
        required: false,
        default: '',
        description: 'Note content',
        validation: { maxLength: 10000 }
      }
    },
    
    todo: {
      title: {
        type: 'string',
        required: false,
        default: 'To-Do List',
        description: 'Todo list title',
        validation: { maxLength: 100 }
      },
      maxItems: {
        type: 'number',
        required: false,
        default: 10,
        description: 'Maximum number of items',
        validation: { min: 1, max: 50 }
      },
      showCompleted: {
        type: 'boolean',
        required: false,
        default: true,
        description: 'Show completed items'
      }
    }
  };
  
  return schemas[moduleType] || {};
}

function getModuleDefaults(moduleType) {
  const defaults = {
    weather: { location: 'New York', units: 'imperial', detailLevel: 'compact' },
    crypto: { coin: 'bitcoin', currency: 'usd', detailLevel: 'compact' },
    stocks: { symbol: 'AAPL', detailLevel: 'compact' },
    countdown: { title: 'New Year', targetDate: '2026-01-01T00:00:00', timezone: 'UTC' },
    notes: { title: 'Notes', content: '' },
    todo: { title: 'To-Do List', maxItems: 10, showCompleted: true }
  };
  return defaults[moduleType] || {};
}

function getModuleValidation(moduleType) {
  // Return validation rules for the module
  const validations = {
    weather: {
      location: { required: true, minLength: 2, maxLength: 100 },
      units: { enum: ['imperial', 'metric', 'kelvin'] }
    },
    crypto: {
      coin: { required: true, minLength: 2, maxLength: 50 },
      currency: { enum: ['usd', 'eur', 'btc', 'eth'] }
    },
    stocks: {
      symbol: { required: true, pattern: '^[A-Z0-9.]+, maxLength: 10 }
    },
    countdown: {
      title: { required: true, maxLength: 100 },
      targetDate: { required: true, type: 'datetime' }
    },
    notes: {
      content: { maxLength: 10000 }
    },
    todo: {
      maxItems: { min: 1, max: 50 }
    }
  };
  return validations[moduleType] || {};
}

function getModuleExamples(moduleType) {
  const examples = {
    weather: [
      { location: 'London', units: 'metric' },
      { location: 'Tokyo', units: 'metric', detailLevel: 'expanded' },
      { location: '40.7128,-74.0060', units: 'imperial' } // NYC coordinates
    ],
    crypto: [
      { coin: 'ethereum', currency: 'usd' },
      { coin: 'cardano', currency: 'eur' },
      { coin: 'dogecoin', currency: 'btc' }
    ],
    stocks: [
      { symbol: 'GOOGL' },
      { symbol: 'MSFT', detailLevel: 'expanded' },
      { symbol: 'TSLA' }
    ],
    countdown: [
      { title: 'Christmas 2025', targetDate: '2025-12-25T00:00:00' },
      { title: 'Project Deadline', targetDate: '2025-06-01T09:00:00' },
      { title: 'Vacation', targetDate: '2025-07-15T00:00:00' }
    ]
  };
  return examples[moduleType] || [];
}

async function performModuleHealthCheck(moduleType, module) {
  const checks = [];
  let healthy = true;
  
  try {
    // Basic module structure check
    checks.push({
      name: 'module_structure',
      status: 'pass',
      message: 'Module structure is valid'
    });
    
    // Check module dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      const missingDeps = module.dependencies.filter(dep => {
        // Check if dependency is available
        return !process.env[dep] && !require('./modules/widget-modules')[dep];
      });
      
      if (missingDeps.length > 0) {
        checks.push({
          name: 'dependencies',
          status: 'warning',
          message: `Missing dependencies: ${missingDeps.join(', ')}`
        });
      } else {
        checks.push({
          name: 'dependencies',
          status: 'pass',
          message: 'All dependencies satisfied'
        });
      }
    }
    
    // Module-specific health checks
    if (moduleType === 'weather') {
      if (process.env.OPENWEATHER_API_KEY) {
        checks.push({
          name: 'api_key',
          status: 'pass',
          message: 'API key configured'
        });
      } else {
        checks.push({
          name: 'api_key',
          status: 'warning',
          message: 'No API key - using demo data'
        });
      }
    }
    
    if (moduleType === 'stocks') {
      const hasStockAPI = !!(process.env.ALPHAVANTAGE_API_KEY || process.env.FINNHUB_API_KEY);
      if (hasStockAPI) {
        checks.push({
          name: 'api_key',
          status: 'pass',
          message: 'Stock API configured'
        });
      } else {
        checks.push({
          name: 'api_key',
          status: 'warning',
          message: 'No stock API key configured'
        });
        healthy = false;
      }
    }
    
    // Test module initialization
    if (typeof module.initialize === 'function') {
      checks.push({
        name: 'initialization',
        status: 'pass',
        message: 'Module can be initialized'
      });
    } else {
      checks.push({
        name: 'initialization',
        status: 'fail',
        message: 'Module missing initialize function'
      });
      healthy = false;
    }
    
  } catch (error) {
    checks.push({
      name: 'general_health',
      status: 'fail',
      message: error.message
    });
    healthy = false;
  }
  
  return { healthy, checks };
}

// Authentication routes
app.use('/api/auth', authRouter);

// Load widget modules dynamically
const widgetModules = require('./modules/widget-modules');

// Enhanced cache for widget data using database
async function getCacheKey(type, params) {
  return `widget:${type}:${require('crypto')
    .createHash('md5')
    .update(JSON.stringify(params))
    .digest('hex')}`;
}

async function getCachedData(key) {
  try {
    return await db.getCachedWidget(key);
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setCachedData(key, data, ttl = 300) {
  try {
    await db.setCachedWidget(key, data, ttl);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

// Create widget endpoints dynamically
const availableWidgets = Object.keys(widgetModules);
console.log(`📦 Available widgets: ${availableWidgets.join(', ')}`);

availableWidgets.forEach(widgetType => {
  const module = widgetModules[widgetType];
  
  app.get(`/api/widget/${widgetType}`, 
    validateRequest(validationSchemas.widgetParams),
    async (req, res) => {
      try {
        // Create context for the module
        const context = {
          app,
          req,
          res,
          getCachedData,
          setCachedData,
          getCacheKey,
          db // Provide database access to widgets
        };
        
        // Initialize and run the module
        await module.initialize(context);
      } catch (error) {
        console.error(`${widgetType} widget error:`, error);
        res.status(500).json({ 
          error: `${widgetType} service temporarily unavailable` 
        });
      }
    }
  );
});

// Dashboard management endpoints (authenticated)
app.get('/api/dashboards/current', auth, async (req, res) => {
  try {
    const layout = await db.getDashboardLayout(req.user.id);
    
    if (layout) {
      res.json({ layout });
    } else {
      // Return empty layout to trigger default dashboard
      res.json({ layout: [] });
    }
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    await db.logSecurityEvent('DASHBOARD_FETCH_ERROR', {
      error: error.message,
      userId: req.user.id
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

app.post('/api/dashboards/save', auth, async (req, res) => {
  try {
    const { layout, name = 'Default Dashboard' } = req.body;
    
    if (!Array.isArray(layout)) {
      return res.status(400).json({ error: 'Invalid layout data' });
    }

    // Validate and sanitize layout structure
    const validatedLayout = layout.map(widget => {
      if (!widget.id || !widget.type) {
        throw new Error('Widget must have id and type');
      }
      
      return {
        id: widget.id.toString().substring(0, 100), // Limit ID length
        type: widget.type.toString().substring(0, 50), // Limit type length
        config: typeof widget.config === 'object' ? widget.config : {},
        layout: typeof widget.layout === 'object' ? widget.layout : { x: 0, y: 0, w: 4, h: 3 }
      };
    });

    // Limit number of widgets
    if (validatedLayout.length > 50) {
      return res.status(400).json({ error: 'Too many widgets (max 50)' });
    }

    await db.saveDashboardLayout(req.user.id, validatedLayout, name);
    
    // Log dashboard save event
    await db.logSecurityEvent('DASHBOARD_SAVED', {
      widgetCount: validatedLayout.length,
      dashboardName: name
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.json({ 
      success: true, 
      message: 'Dashboard saved successfully',
      widgets: validatedLayout.length 
    });
  } catch (error) {
    console.error('Dashboard save error:', error);
    await db.logSecurityEvent('DASHBOARD_SAVE_ERROR', {
      error: error.message
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.status(500).json({ error: 'Failed to save dashboard' });
  }
});

// Device management endpoints (authenticated)
app.get('/api/devices', auth, async (req, res) => {
  try {
    const devices = await db.getUserDevices(req.user.id);
    res.json({ devices });
  } catch (error) {
    console.error('Devices fetch error:', error);
    await db.logSecurityEvent('DEVICES_FETCH_ERROR', {
      error: error.message
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

app.post('/api/devices/register', auth, async (req, res) => {
  try {
    const { deviceName, deviceType } = req.body;
    
    if (!deviceName || !deviceType) {
      return res.status(400).json({ error: 'Device name and type are required' });
    }

    // Validate input lengths
    if (deviceName.length > 100 || deviceType.length > 50) {
      return res.status(400).json({ error: 'Device name or type too long' });
    }

    // Check if user has reached device limit
    const existingDevices = await db.getUserDevices(req.user.id);
    const maxDevices = parseInt(process.env.MAX_DEVICES_PER_USER) || 10;
    
    if (existingDevices.length >= maxDevices) {
      return res.status(400).json({ 
        error: `Maximum ${maxDevices} devices allowed per user` 
      });
    }

    // Generate device credentials
    const deviceId = require('crypto').randomUUID();
    const deviceToken = require('crypto').randomBytes(32).toString('hex');
    const tokenHash = require('crypto').createHash('sha256').update(deviceToken).digest('hex');

    const device = await db.registerDevice(req.user.id, {
      deviceName: deviceName.trim(),
      deviceType: deviceType.trim(),
      deviceId,
      tokenHash
    });

    // Log device registration
    await db.logSecurityEvent('DEVICE_REGISTERED', {
      deviceId,
      deviceName: deviceName.trim(),
      deviceType: deviceType.trim()
    }, req.user.id, req.ip, req.get('User-Agent'));

    res.json({
      deviceId,
      deviceToken,
      device,
      message: 'Device registered successfully'
    });
  } catch (error) {
    console.error('Device registration error:', error);
    await db.logSecurityEvent('DEVICE_REGISTRATION_ERROR', {
      error: error.message,
      deviceName: req.body.deviceName,
      deviceType: req.body.deviceType
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.status(500).json({ error: 'Failed to register device' });
  }
});

app.delete('/api/devices/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Validate device ID format
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
      return res.status(400).json({ error: 'Invalid device ID' });
    }

    // Verify device belongs to user and deactivate it
    const result = await db.query(
      'UPDATE esp32_devices SET is_active = FALSE WHERE device_id = $1 AND user_id = $2 RETURNING device_name',
      [deviceId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Log device removal
    await db.logSecurityEvent('DEVICE_REMOVED', {
      deviceId,
      deviceName: result.rows[0].device_name
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.json({ message: 'Device removed successfully' });
  } catch (error) {
    console.error('Device deletion error:', error);
    await db.logSecurityEvent('DEVICE_DELETION_ERROR', {
      error: error.message,
      deviceId: req.params.deviceId
    }, req.user.id, req.ip, req.get('User-Agent'));
    
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Dashboard API',
    version: '2.0.0',
    description: 'Secure, scalable dashboard API with real-time widgets and ESP32 integration',
    endpoints: {
      authentication: {
        'POST /api/auth/register': 'Register new user account',
        'POST /api/auth/login': 'User login with credentials',
        'POST /api/auth/refresh': 'Refresh access token',
        'POST /api/auth/logout': 'User logout and token revocation',
        'GET /api/auth/user': 'Get current user information',
        'PUT /api/auth/password': 'Change user password'
      },
      widgets: {
        'GET /api/widget/weather': 'Get weather data for location',
        'GET /api/widget/crypto': 'Get cryptocurrency market data',
        'GET /api/widget/stocks': 'Get stock market data',
        'GET /api/widget/countdown': 'Get countdown timer data',
        'GET /api/widget/notes': 'Get notes widget data',
        'GET /api/widget/todo': 'Get todo list data'
      },
      dashboards: {
        'GET /api/dashboards/current': 'Get current dashboard layout',
        'POST /api/dashboards/save': 'Save dashboard layout'
      },
      devices: {
        'GET /api/devices': 'Get user ESP32 devices',
        'POST /api/devices/register': 'Register new ESP32 device',
        'DELETE /api/devices/:id': 'Remove ESP32 device'
      },
      system: {
        'GET /api/health': 'System health and status check',
        'GET /api/docs': 'API documentation and endpoints'
      }
    },
    security: {
      authentication: 'JWT tokens with secure refresh mechanism',
      rateLimit: 'Multiple rate limits based on endpoint sensitivity',
      validation: 'Comprehensive input validation and sanitization',
      cors: 'Configurable CORS policy with domain whitelist',
      headers: 'Security headers via Helmet middleware',
      audit: 'Security event logging and monitoring',
      encryption: 'bcrypt password hashing with high salt rounds'
    },
    database: {
      connectionPooling: 'PostgreSQL connection pooling with auto-retry',
      transactions: 'ACID-compliant transactions with rollback',
      caching: 'Database-backed widget caching with TTL',
      cleanup: 'Automatic cleanup of expired data',
      monitoring: 'Real-time connection and query monitoring'
    },
    features: {
      widgets: availableWidgets,
      themes: ['default', 'dark', 'minimal', 'dense'],
      layouts: ['minimal', 'balanced', 'dense'],
      devices: 'ESP32 CYD support with secure registration'
    }
  });
});

// Admin endpoints (if admin functionality is needed)
if (process.env.ENABLE_ADMIN_ENDPOINTS === 'true') {
  // Admin middleware to check for admin role
  const adminAuth = async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user has admin privileges (you'd implement this based on your needs)
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);
      if (!adminEmails.includes(req.user.email)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Admin authentication failed' });
    }
  };

  // Get system statistics
  app.get('/api/admin/stats', auth, adminAuth, async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
          (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
          (SELECT COUNT(*) FROM dashboard_layouts) as total_dashboards,
          (SELECT COUNT(*) FROM esp32_devices WHERE is_active = TRUE) as active_devices,
          (SELECT COUNT(*) FROM security_audit_log WHERE created_at > NOW() - INTERVAL '24 hours') as security_events_24h
      `);

      const dbHealth = await db.getHealthInfo();

      res.json({
        statistics: stats.rows[0],
        database: dbHealth,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '2.0.0'
        }
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });
}

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'dashboard.html'));
});

// Security middleware for error handling
app.use(securityErrorHandler);

// 404 handler
app.use((req, res) => {
  SecurityLogger.log('404_NOT_FOUND', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent')
  }, 'info');

  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
});

// Start server with database initialization
async function startServer() {
  try {
    // Initialize database first
    console.log('🗄️ Initializing database...');
    await db.initialize();
    
    // Set up periodic cleanup
    setInterval(async () => {
      try {
        await db.cleanup();
      } catch (error) {
        console.error('Periodic cleanup error:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    const server = app.listen(PORT, () => {
      console.log('🚀 Dashboard server started successfully');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: Connected with connection pooling`);
      console.log(`🔒 Security: Enhanced security enabled`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      
      // Log available APIs
      const hasWeatherAPI = !!process.env.OPENWEATHER_API_KEY;
      const hasStockAPI = !!(process.env.ALPHAVANTAGE_API_KEY || process.env.FINNHUB_API_KEY);
      
      console.log(`🌤️  Weather API: ${hasWeatherAPI ? 'Enabled' : 'Disabled (missing OPENWEATHER_API_KEY)'}`);
      console.log(`📈 Stock API: ${hasStockAPI ? 'Enabled' : 'Disabled (missing API keys)'}`);
      console.log(`₿ Crypto API: Enabled (CoinGecko - no key required)`);
      
      if (process.env.ENABLE_ADMIN_ENDPOINTS === 'true') {
        console.log(`👑 Admin endpoints: Enabled`);
      }
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async (err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ HTTP server closed');
        
        try {
          // Close database connections
          await db.close();
          console.log('✅ Database connections closed');
          
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (cleanupError) {
          console.error('❌ Error during cleanup:', cleanupError);
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Global error handlers
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  
  try {
    await db.logSecurityEvent('UNCAUGHT_EXCEPTION', {
      error: error.message,
      stack: error.stack
    });
  } catch (logError) {
    console.error('Failed to log uncaught exception:', logError);
  }
  
  SecurityLogger.log('UNCAUGHT_EXCEPTION', {
    error: error.message,
    stack: error.stack
  }, 'error');
  
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  
  try {
    await db.logSecurityEvent('UNHANDLED_REJECTION', {
      reason: reason?.toString(),
      promise: promise?.toString()
    });
  } catch (logError) {
    console.error('Failed to log unhandled rejection:', logError);
  }
});

// Make database available globally for other modules that might need it
global.db = db;

// Start the server
startServer();
