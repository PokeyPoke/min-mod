/**
 * server/utils/env-validator.js - Environment validation utility
 * Ensures all required environment variables are properly configured
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
      console.error('❌ Environment validation failed:');
      this.errors.forEach(error => console.error(`  • ${error}`));
      throw new Error('Environment validation failed. Please check your .env file.');
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️ Environment validation warnings:');
      this.warnings.forEach(warning => console.warn(`  • ${warning}`));
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
      
      // Database pool configuration
      .validateNumber('DB_POOL_MAX', 5, 100, 'Database connection pool max size', false)
      .validateNumber('DB_POOL_MIN', 1, 20, 'Database connection pool min size', false)
      
      // Validate that JWT secrets are different
      .validateDifferentSecrets()
      
      // Production-specific warnings
      .addProductionWarnings()
      
      .validate();
  }

  validateDifferentSecrets() {
    if (process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET && 
        process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      this.errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
    return this;
  }

  addProductionWarnings() {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.OPENWEATHER_API_KEY) {
        this.warn('OPENWEATHER_API_KEY not set - weather widget will not work');
      }
      
      if (!process.env.ALPHAVANTAGE_API_KEY && !process.env.FINNHUB_API_KEY) {
        this.warn('No stock API keys set - stock widget will not work');
      }
      
      if (!process.env.REDIS_URL) {
        this.warn('REDIS_URL not set - consider using Redis for better performance');
      }
      
      if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === '*') {
        this.warn('ALLOWED_ORIGINS should be set to specific domains in production');
      }
      
      if (process.env.CORS_CREDENTIALS === 'true' && 
          (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.includes('*'))) {
        this.errors.push('CORS credentials enabled with wildcard origins is a security risk');
      }

      if (!process.env.TRUST_PROXY && process.env.NODE_ENV === 'production') {
        this.warn('TRUST_PROXY should be enabled when behind a reverse proxy');
      }

      if (!process.env.SECURITY_WEBHOOK_URL) {
        this.warn('SECURITY_WEBHOOK_URL not set - security events will only be logged locally');
      }
    }

    // Development warnings
    if (process.env.NODE_ENV === 'development') {
      if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-here') {
        this.warn('Using default JWT_SECRET - change this for security');
      }
    }

    return this;
  }

  static validateDevelopment() {
    return new EnvValidator()
      // Required for development
      .validateRequired('JWT_SECRET', 'JWT access token secret')
      .validateRequired('JWT_REFRESH_SECRET', 'JWT refresh token secret')
      .validateRequired('DATABASE_URL', 'PostgreSQL connection string')
      
      // Minimum security requirements
      .validateMinLength('JWT_SECRET', 16, 'JWT secret minimum security')
      .validateMinLength('JWT_REFRESH_SECRET', 16, 'JWT refresh secret minimum security')
      
      // Different secrets
      .validateDifferentSecrets()
      
      .validate();
  }

  static validateTest() {
    return new EnvValidator()
      // Test environment requirements
      .validateRequired('DATABASE_URL', 'Test database connection string')
      .validateRequired('JWT_SECRET', 'JWT secret for testing')
      .validateRequired('JWT_REFRESH_SECRET', 'JWT refresh secret for testing')
      
      .validateDifferentSecrets()
      
      .validate();
  }

  static validateEnvironment() {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return EnvValidator.validateProduction();
      case 'test':
        return EnvValidator.validateTest();
      case 'development':
      default:
        return EnvValidator.validateDevelopment();
    }
  }
}

module.exports = { EnvValidator };
