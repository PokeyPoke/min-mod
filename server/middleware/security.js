/**
 * server/middleware/security.js - Enhanced security middleware
 */

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { body, query, validationResult } = require('express-validator');

// Input sanitization utility
class InputSanitizer {
  static sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/[<>\"'&]/g, (match) => ({
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      })[match]);
  }

  static sanitizeEmail(email) {
    if (typeof email !== 'string') return '';
    
    return email
      .toLowerCase()
      .trim()
      .slice(0, 254);
  }

  static sanitizeNumeric(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input, 10);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, num));
  }

  static sanitizeBoolean(input) {
    return input === 'true' || input === true;
  }

  static sanitizeEnum(input, allowedValues, defaultValue) {
    return allowedValues.includes(input) ? input : defaultValue;
  }
}

// Security event logger
class SecurityLogger {
  static log(event, details = {}, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      level,
      ...details
    };

    // In production, send to your logging service
    console.log(`[SECURITY-${level.toUpperCase()}] ${JSON.stringify(logEntry)}`);

    // Optional: Send to external monitoring service
    if (process.env.SECURITY_WEBHOOK_URL) {
      this.sendToWebhook(logEntry).catch(console.error);
    }
  }

  static async sendToWebhook(logEntry) {
    try {
      const fetch = require('node-fetch');
      await fetch(process.env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
        timeout: 5000
      });
    } catch (error) {
      console.error('Failed to send security log to webhook:', error);
    }
  }
}

// Rate limiting configurations
const createRateLimit = (options) => rateLimit({
  windowMs: options.windowMs || 15 * 60 * 1000,
  max: options.max || 100,
  message: { error: options.message || 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  keyGenerator: options.keyGenerator || ((req) => req.ip),
  onLimitReached: (req, res, options) => {
    SecurityLogger.log('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      limit: options.max,
      windowMs: options.windowMs
    }, 'warn');
  }
});

// Different rate limits for different endpoints
const rateLimits = {
  // General API rate limit
  api: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many API requests, please try again later.'
  }),

  // Authentication endpoints (more restrictive)
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => `${req.ip}-${req.body.email || req.body.username || 'unknown'}`
  }),

  // Widget endpoints
  widget: createRateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many widget requests, please wait a moment.'
  }),

  // Password reset (very restrictive)
  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password reset attempts, please try again later.'
  })
};

// Request speed limiting
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500,
  maxDelayMs: 20000,
  onLimitReached: (req, res, options) => {
    SecurityLogger.log('SPEED_LIMIT_TRIGGERED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    }, 'warn');
  }
});

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // CSP nonce generation
  res.locals.nonce = require('crypto').randomBytes(16).toString('base64');
  
  // Apply helmet with custom CSP
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          `'nonce-${res.locals.nonce}'`,
          "'unsafe-inline'", // Required for some widgets
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],
        connectSrc: [
          "'self'",
          "https://api.openweathermap.org",
          "https://api.coingecko.com",
          "https://www.alphavantage.co",
          "https://finnhub.io"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production'
      }
    },
    crossOriginEmbedderPolicy: false, // Allows external API calls
    xssFilter: true,
    noSniff: true,
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })(req, res, next);
};

// Request validation middleware
const validateRequest = (validations) => {
  return async (req, res, next) => {
    // Run validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      SecurityLogger.log('VALIDATION_FAILED', {
        ip: req.ip,
        endpoint: req.originalUrl,
        errors: errors.array(),
        userAgent: req.get('User-Agent')
      }, 'warn');

      return res.status(400).json({
        error: 'Invalid request data',
        details: errors.array()
      });
    }

    next();
  };
};

// Common validation schemas
const validationSchemas = {
  widgetParams: [
    query('detailLevel').optional().isIn(['compact', 'normal', 'expanded']),
    query('location').optional().isLength({ max: 100 }).trim(),
    query('symbol').optional().isLength({ max: 10 }).matches(/^[A-Z0-9.]+$/),
    query('coin').optional().isLength({ max: 50 }).matches(/^[a-z0-9-]+$/),
    query('currency').optional().isIn(['usd', 'eur', 'btc', 'eth']),
    query('units').optional().isIn(['metric', 'imperial']),
    query('title').optional().isLength({ max: 100 }).trim(),
    query('targetDate').optional().isISO8601(),
    query('timezone').optional().isLength({ max: 50 }),
    query('content').optional().isLength({ max: 10000 }),
    query('items').optional().isJSON(),
    query('maxItems').optional().isInt({ min: 1, max: 50 }),
    query('sortBy').optional().isIn(['newest', 'oldest', 'alphabetical', 'priority'])
  ]
};

// IP whitelist/blacklist middleware
const ipFilter = (req, res, next) => {
  const clientIP = req.ip;
  
  // Check IP blacklist
  const blacklistedIPs = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
  if (blacklistedIPs.includes(clientIP)) {
    SecurityLogger.log('IP_BLACKLISTED', { ip: clientIP }, 'error');
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check IP whitelist (if defined)
  const whitelistedIPs = (process.env.IP_WHITELIST || '').split(',').filter(Boolean);
  if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
    SecurityLogger.log('IP_NOT_WHITELISTED', { ip: clientIP }, 'warn');
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

// User agent validation
const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    SecurityLogger.log('MISSING_USER_AGENT', { ip: req.ip }, 'warn');
    return res.status(400).json({ error: 'User-Agent header required' });
  }

  // Block known malicious user agents
  const maliciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burpsuite/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i
  ];

  if (maliciousPatterns.some(pattern => pattern.test(userAgent))) {
    SecurityLogger.log('MALICIOUS_USER_AGENT', { 
      ip: req.ip, 
      userAgent 
    }, 'error');
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

// Request size limiting
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxBytes = typeof maxSize === 'string' 
      ? parseInt(maxSize) * (maxSize.includes('mb') ? 1024 * 1024 : 1024)
      : maxSize;

    if (contentLength > maxBytes) {
      SecurityLogger.log('REQUEST_SIZE_EXCEEDED', {
        ip: req.ip,
        contentLength,
        maxBytes,
        endpoint: req.originalUrl
      }, 'warn');
      return res.status(413).json({ error: 'Request too large' });
    }

    next();
  };
};

// CORS configuration with security
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      SecurityLogger.log('CORS_VIOLATION', { 
        origin, 
        allowedOrigins 
      }, 'warn');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-auth-token'
  ]
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: req.get('Content-Length'),
      referer: req.get('Referer')
    };

    // Log suspicious activity
    if (res.statusCode >= 400) {
      SecurityLogger.log('HTTP_ERROR_RESPONSE', logData, 'warn');
    } else if (duration > 10000) {
      SecurityLogger.log('SLOW_REQUEST', logData, 'info');
    }

    // Regular request logging
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_REQUEST_LOGGING === 'true') {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`);
    }
  });

  next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (validApiKey && apiKey !== validApiKey) {
    SecurityLogger.log('INVALID_API_KEY', {
      ip: req.ip,
      providedKey: apiKey ? 'provided' : 'missing',
      endpoint: req.originalUrl
    }, 'warn');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Honeypot middleware (detect automated attacks)
const honeypot = (req, res, next) => {
  // Check for common attack patterns
  const suspiciousPatterns = [
    /\.php$/,
    /\.asp$/,
    /\.jsp$/,
    /wp-admin/,
    /wp-login/,
    /admin\.php/,
    /phpMyAdmin/,
    /\.env$/,
    /\.git/,
    /config\.json$/,
    /database\.yml$/
  ];

  const path = req.path.toLowerCase();
  
  if (suspiciousPatterns.some(pattern => pattern.test(path))) {
    SecurityLogger.log('HONEYPOT_TRIGGERED', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      method: req.method
    }, 'error');

    // Return fake response to waste attacker's time
    return res.status(404).send('Not Found');
  }

  next();
};

// Maintenance mode middleware
const maintenanceMode = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    const maintenanceMessage = process.env.MAINTENANCE_MESSAGE || 
      'The dashboard is temporarily unavailable for maintenance.';
    
    // Allow health checks during maintenance
    if (req.path === '/api/health') {
      return next();
    }

    return res.status(503).json({
      error: 'Service Unavailable',
      message: maintenanceMessage,
      retryAfter: process.env.MAINTENANCE_RETRY_AFTER || '3600'
    });
  }

  next();
};

// Error handling middleware with security logging
const securityErrorHandler = (err, req, res, next) => {
  // Log security-relevant errors
  SecurityLogger.log('APPLICATION_ERROR', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    ip: req.ip,
    endpoint: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent')
  }, 'error');

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });
};

// Export all middleware
module.exports = {
  InputSanitizer,
  SecurityLogger,
  rateLimits,
  speedLimiter,
  securityHeaders,
  validateRequest,
  validationSchemas,
  ipFilter,
  validateUserAgent,
  requestSizeLimit,
  corsOptions,
  requestLogger,
  validateApiKey,
  honeypot,
  maintenanceMode,
  securityErrorHandler
};

/**
 * server/utils/env-validator.js - Environment validation utility
 */

class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateRequired(varName, description) {
    if (!process.env[varName]) {
      this.errors.push(`Missing required environment variable: ${varName} (${description})`);
    }
    return this;
  }

  validateMinLength(varName, minLength, description) {
    const value = process.env[varName];
    if (value && value.length < minLength) {
      this.errors.push(`${varName} must be at least ${minLength} characters long (${description})`);
    }
    return this;
  }

  validateEnum(varName, allowedValues, description) {
    const value = process.env[varName];
    if (value && !allowedValues.includes(value)) {
      this.errors.push(`${varName} must be one of: ${allowedValues.join(', ')} (${description})`);
    }
    return this;
  }

  validateUrl(varName, description, required = false) {
    const value = process.env[varName];
    if (!value && required) {
      this.errors.push(`Missing required environment variable: ${varName} (${description})`);
    } else if (value) {
      try {
        new URL(value);
      } catch {
        this.errors.push(`${varName} must be a valid URL (${description})`);
      }
    }
    return this;
  }

  validateNumber(varName, min, max, description, required = false) {
    const value = process.env[varName];
    if (!value && required) {
      this.errors.push(`Missing required environment variable: ${varName} (${description})`);
    } else if (value) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < min || num > max) {
        this.errors.push(`${varName} must be a number between ${min} and ${max} (${description})`);
      }
    }
    return this;
  }

  warn(message) {
    this.warnings.push(message);
    return this;
  }

  validate() {
    if (this.errors.length > 0) {
      console.error('Environment validation failed:');
      this.errors.forEach(error => console.error(`  ❌ ${error}`));
      throw new Error('Environment validation failed. Please check your .env file.');
    }

    if (this.warnings.length > 0) {
      console.warn('Environment validation warnings:');
      this.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }

    console.log('✅ Environment validation passed');
    return true;
  }

  static validateProduction() {
    return new EnvValidator()
      // Required security variables
      .validateRequired('JWT_SECRET', 'JWT access token secret')
      .validateRequired('JWT_REFRESH_SECRET', 'JWT refresh token secret')
      .validateRequired('DATABASE_URL', 'PostgreSQL connection string')
      
      // JWT secret validation
      .validateMinLength('JWT_SECRET', 32, 'JWT secret security')
      .validateMinLength('JWT_REFRESH_SECRET', 32, 'JWT refresh secret security')
      
      // Environment validation
      .validateEnum('NODE_ENV', ['development', 'production', 'test'], 'Node environment')
      
      // Optional but recommended
      .validateUrl('REDIS_URL', 'Redis connection for sessions/cache', false)
      
      // Security configuration
      .validateNumber('SALT_ROUNDS', 10, 15, 'Password hashing rounds', false)
      .validateNumber('MAX_LOGIN_ATTEMPTS', 3, 10, 'Maximum login attempts', false)
      .validateNumber('RATE_LIMIT_MAX', 50, 1000, 'Rate limit maximum requests', false)
      
      // Validate that JWT secrets are different
      .validateDifferentSecrets()
      
      // Production-specific warnings
      .addProductionWarnings()
      
      .validate();
  }

  validateDifferentSecrets() {
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      this.errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
    return this;
  }

  addProductionWarnings() {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.OPENWEATHER_API_KEY) {
        this.warn('OPENWEATHER_API_KEY not set - weather widget will not work');
      }
      
      if (!process.env.REDIS_URL) {
        this.warn('REDIS_URL not set - consider using Redis for better performance');
      }
      
      if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === '*') {
        this.warn('ALLOWED_ORIGINS should be set to specific domains in production');
      }
      
      if (process.env.CORS_CREDENTIALS === 'true' && (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.includes('*'))) {
        this.errors.push('CORS credentials enabled with wildcard origins is a security risk');
      }
    }
    return this;
  }
}

module.exports = { EnvValidator };
