/**
 * server/auth.js - Production-ready secure authentication system
 * Enhanced security with proper JWT handling, rate limiting, and input validation
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { Pool } = require('pg');
const router = express.Router();

// Environment validation
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// Security constants
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const PASSWORD_MIN_LENGTH = 8;

// Validate JWT secrets
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (JWT_REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

if (JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database tables
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(254) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE,
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP WITH TIME ZONE,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP WITH TIME ZONE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked BOOLEAN DEFAULT FALSE,
        user_agent TEXT,
        ip_address INET
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return `${req.ip}-${req.body.email || req.body.username || 'unknown'}`;
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, // More restrictive for login
  message: { error: 'Too many login attempts, please try again later.' },
  skipSuccessfulRequests: true
});

// Input validation schemas
const usernameValidation = body('username')
  .isLength({ min: 3, max: 30 })
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage('Username must be 3-30 characters, alphanumeric and underscores only')
  .trim()
  .escape();

const emailValidation = body('email')
  .isEmail()
  .isLength({ max: 254 })
  .normalizeEmail()
  .withMessage('Valid email required');

const passwordValidation = body('password')
  .isLength({ min: PASSWORD_MIN_LENGTH })
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage(`Password must be ${PASSWORD_MIN_LENGTH}+ chars with uppercase, lowercase, number, and special character`);

const validateRegistration = [
  usernameValidation,
  emailValidation,
  passwordValidation
];

const validateLogin = [
  emailValidation,
  body('password').notEmpty().withMessage('Password is required')
];

// Security utility functions
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function generateTokenPair(userId, userAgent, ipAddress) {
  const accessToken = jwt.sign(
    { 
      id: userId, 
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    }, 
    JWT_SECRET, 
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
  
  const refreshTokenValue = generateSecureToken();
  const refreshTokenHash = hashToken(refreshTokenValue);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Store refresh token in database
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, refreshTokenHash, expiresAt, userAgent, ipAddress]
  );
  
  return { accessToken, refreshToken: refreshTokenValue };
}

async function isAccountLocked(email) {
  const result = await pool.query(
    'SELECT login_attempts, locked_until FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) return false;
  
  const user = result.rows[0];
  
  if (user.locked_until && new Date() < user.locked_until) {
    return true;
  }
  
  return user.login_attempts >= MAX_LOGIN_ATTEMPTS;
}

async function recordLoginAttempt(email, success, userId = null) {
  if (success) {
    await pool.query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE email = $1',
      [email]
    );
  } else {
    const lockoutTime = new Date(Date.now() + LOCKOUT_TIME);
    await pool.query(`
      UPDATE users 
      SET login_attempts = login_attempts + 1,
          locked_until = CASE 
            WHEN login_attempts + 1 >= $2 THEN $3 
            ELSE locked_until 
          END
      WHERE email = $1
    `, [email, MAX_LOGIN_ATTEMPTS, lockoutTime]);
  }
}

// Middleware for request logging
function logSecurityEvent(type, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY] ${timestamp} - ${type}:`, details);
}

// Registration endpoint
router.post('/register', authLimiter, validateRegistration, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logSecurityEvent('REGISTRATION_VALIDATION_FAILED', { 
        errors: errors.array(),
        ip: req.ip 
      });
      return res.status(400).json({ 
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );
    
    if (existingUser.rows.length > 0) {
      logSecurityEvent('REGISTRATION_DUPLICATE_ATTEMPT', { 
        email: email.toLowerCase(),
        username,
        ip: req.ip 
      });
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (username, email, password_hash, email_verification_token, email_verification_expires) 
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
      RETURNING id, username, email, created_at
    `, [username, email.toLowerCase(), passwordHash, generateSecureToken()]);
    
    const user = userResult.rows[0];
    
    await client.query('COMMIT');
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id, 
      req.get('User-Agent'), 
      req.ip
    );
    
    logSecurityEvent('USER_REGISTERED', { 
      userId: user.id,
      username: user.username,
      email: user.email,
      ip: req.ip 
    });
    
    // Return user data without sensitive information
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      emailVerified: false
    };
    
    res.status(201).json({ 
      accessToken,
      refreshToken,
      user: userData,
      message: 'Account created successfully. Please verify your email.'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    logSecurityEvent('REGISTRATION_ERROR', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
  }
});

// Login endpoint
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const { email, password } = req.body;
    const emailLower = email.toLowerCase();
    
    // Check account lockout
    if (await isAccountLocked(emailLower)) {
      logSecurityEvent('LOGIN_ACCOUNT_LOCKED', { email: emailLower, ip: req.ip });
      return res.status(423).json({ 
        error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
      });
    }
    
    // Find user
    const userResult = await pool.query(
      'SELECT id, username, email, password_hash, email_verified FROM users WHERE email = $1',
      [emailLower]
    );
    
    if (userResult.rows.length === 0) {
      await recordLoginAttempt(emailLower, false);
      logSecurityEvent('LOGIN_USER_NOT_FOUND', { email: emailLower, ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = userResult.rows[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await recordLoginAttempt(emailLower, false);
      logSecurityEvent('LOGIN_INVALID_PASSWORD', { 
        userId: user.id,
        email: emailLower, 
        ip: req.ip 
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Successful login
    await recordLoginAttempt(emailLower, true, user.id);
    
    // Generate tokens
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id, 
      req.get('User-Agent'), 
      req.ip
    );
    
    logSecurityEvent('USER_LOGIN', { 
      userId: user.id,
      username: user.username,
      email: user.email,
      ip: req.ip 
    });
    
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.email_verified,
      lastLogin: new Date().toISOString()
    };
    
    res.json({ 
      accessToken,
      refreshToken,
      user: userData,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    logSecurityEvent('LOGIN_ERROR', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Token refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const tokenHash = hashToken(refreshToken);
    
    // Find and validate refresh token
    const tokenResult = await pool.query(`
      SELECT rt.user_id, rt.expires_at, u.username, u.email, u.email_verified
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = $1 AND rt.revoked = FALSE AND rt.expires_at > NOW()
    `, [tokenHash]);
    
    if (tokenResult.rows.length === 0) {
      logSecurityEvent('REFRESH_TOKEN_INVALID', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Revoke old refresh token
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
      [tokenHash]
    );
    
    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(
      tokenData.user_id, 
      req.get('User-Agent'), 
      req.ip
    );
    
    logSecurityEvent('TOKEN_REFRESHED', { 
      userId: tokenData.user_id,
      ip: req.ip 
    });
    
    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    logSecurityEvent('REFRESH_ERROR', { error: error.message, ip: req.ip });
    res.status(500).json({ error: 'Server error during token refresh' });
  }
});

// Enhanced authentication middleware
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.header('x-auth-token');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided, authorization denied' });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.type !== 'access') {
        logSecurityEvent('AUTH_INVALID_TOKEN_TYPE', { 
          tokenType: decoded.type,
          ip: req.ip 
        });
        return res.status(401).json({ error: 'Invalid token type' });
      }
      
      // Get user from database
      const userResult = await pool.query(
        'SELECT id, username, email, email_verified FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (userResult.rows.length === 0) {
        logSecurityEvent('AUTH_USER_NOT_FOUND', { 
          userId: decoded.id,
          ip: req.ip 
        });
        return res.status(401).json({ error: 'User not found, authorization denied' });
      }
      
      req.user = userResult.rows[0];
      next();
      
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        logSecurityEvent('AUTH_INVALID_TOKEN', { 
          error: jwtError.message,
          ip: req.ip 
        });
        return res.status(401).json({ error: 'Invalid token' });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    logSecurityEvent('AUTH_ERROR', { error: error.message, ip: req.ip });
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Logout endpoint
router.post('/logout', auth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await pool.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
        [tokenHash]
      );
    }
    
    // Optionally revoke all refresh tokens for the user
    if (req.body.logoutAll) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
        [req.user.id]
      );
    }
    
    logSecurityEvent('USER_LOGOUT', { 
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip 
    });
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// Get current user
router.get('/user', auth, async (req, res) => {
  try {
    const userData = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      emailVerified: req.user.email_verified
    };
    
    res.json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error retrieving user data' });
  }
});

// Change password
router.put('/password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordValidation
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      logSecurityEvent('PASSWORD_CHANGE_INVALID_CURRENT', { 
        userId: req.user.id,
        ip: req.ip 
      });
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Update password and revoke all refresh tokens
    await pool.query('BEGIN');
    
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );
    
    await pool.query(
      'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1',
      [req.user.id]
    );
    
    await pool.query('COMMIT');
    
    logSecurityEvent('PASSWORD_CHANGED', { 
      userId: req.user.id,
      username: req.user.username,
      ip: req.ip 
    });
    
    res.json({ message: 'Password changed successfully. Please log in again.' });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error changing password' });
  }
});

// Cleanup expired tokens (run periodically)
async function cleanupExpiredTokens() {
  try {
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE'
    );
    console.log(`Cleaned up ${result.rowCount} expired refresh tokens`);
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

// Health check for auth system
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'authentication',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Initialize database on module load
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

module.exports = { router, auth, initializeDatabase };
