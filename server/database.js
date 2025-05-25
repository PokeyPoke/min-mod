/**
 * server/database.js - Centralized database operations with connection pooling
 * Provides efficient, secure, and maintainable database access
 */

const { Pool } = require('pg');
const crypto = require('crypto');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
    
    // Health monitoring
    this.healthStatus = {
      status: 'initializing',
      lastCheck: null,
      connectionCount: 0,
      totalQueries: 0,
      errorCount: 0
    };
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      return this.pool;
    }

    try {
      // Validate required environment variables
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is required');
      }

      // Create connection pool with optimized settings
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        
        // Connection pool settings
        max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum connections
        min: parseInt(process.env.DB_POOL_MIN) || 2,  // Minimum connections
        idleTimeoutMillis: 30000,    // Close idle connections after 30s
        connectionTimeoutMillis: 5000, // Timeout connection attempts after 5s
        maxUses: 7500,               // Close connections after 7500 uses
        
        // Query settings
        allowExitOnIdle: true,
        statement_timeout: 30000,    // 30s query timeout
        query_timeout: 30000,
        
        // Error handling
        application_name: 'dashboard-app',
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      // Set up pool event handlers
      this.setupPoolEventHandlers();

      // Test connection and create schema
      await this.testConnection();
      await this.initializeSchema();
      
      this.isInitialized = true;
      this.connectionRetries = 0;
      this.updateHealthStatus('connected');
      
      console.log('✅ Database initialized successfully');
      return this.pool;
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      this.updateHealthStatus('error', error.message);
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        const delay = this.retryDelay * Math.pow(2, this.connectionRetries - 1);
        console.log(`🔄 Retrying database connection in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initialize();
      }
      
      throw error;
    }
  }

  /**
   * Setup pool event handlers for monitoring and logging
   */
  setupPoolEventHandlers() {
    this.pool.on('connect', (client) => {
      this.healthStatus.connectionCount++;
      console.log('📦 Database client connected');
    });

    this.pool.on('acquire', (client) => {
      console.log('🔒 Database client acquired from pool');
    });

    this.pool.on('release', (client) => {
      console.log('🔓 Database client released back to pool');
    });

    this.pool.on('remove', (client) => {
      this.healthStatus.connectionCount--;
      console.log('🗑️ Database client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      this.healthStatus.errorCount++;
      this.updateHealthStatus('error', err.message);
      console.error('💥 Database pool error:', err);
    });
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as timestamp, version() as version');
      client.release();
      
      console.log('🔗 Database connection successful');
      console.log(`📅 Server time: ${result.rows[0].timestamp}`);
      console.log(`🗄️ PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);
      
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Users table with enhanced security features
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(30) UNIQUE NOT NULL,
          email VARCHAR(254) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email_verified BOOLEAN DEFAULT FALSE,
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          two_factor_secret VARCHAR(32),
          backup_codes TEXT[],
          
          -- Security tracking
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login TIMESTAMP WITH TIME ZONE,
          login_attempts INTEGER DEFAULT 0,
          locked_until TIMESTAMP WITH TIME ZONE,
          last_password_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Password reset
          password_reset_token VARCHAR(255),
          password_reset_expires TIMESTAMP WITH TIME ZONE,
          
          -- Email verification
          email_verification_token VARCHAR(255),
          email_verification_expires TIMESTAMP WITH TIME ZONE,
          
          -- User preferences
          preferences JSONB DEFAULT '{}',
          
          -- Soft delete
          deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // Refresh tokens table
      await client.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          revoked BOOLEAN DEFAULT FALSE,
          revoked_at TIMESTAMP WITH TIME ZONE,
          user_agent TEXT,
          ip_address INET,
          last_used TIMESTAMP WITH TIME ZONE
        );
      `);

      // Dashboard layouts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS dashboard_layouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL DEFAULT 'Default Dashboard',
          layout_data JSONB NOT NULL,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          UNIQUE(user_id, name)
        );
      `);

      // ESP32 devices table
      await client.query(`
        CREATE TABLE IF NOT EXISTS esp32_devices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          device_id VARCHAR(255) UNIQUE NOT NULL,
          device_name VARCHAR(100) NOT NULL,
          device_type VARCHAR(50) NOT NULL,
          device_token_hash VARCHAR(255) NOT NULL,
          
          -- Status tracking
          is_active BOOLEAN DEFAULT TRUE,
          last_connected TIMESTAMP WITH TIME ZONE,
          last_ip_address INET,
          firmware_version VARCHAR(20),
          
          -- Configuration
          display_config JSONB DEFAULT '{}',
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Security audit log
      await client.query(`
        CREATE TABLE IF NOT EXISTS security_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          event_type VARCHAR(50) NOT NULL,
          event_data JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Widget cache table (optional - for persistent caching)
      await client.query(`
        CREATE TABLE IF NOT EXISTS widget_cache (
          cache_key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for performance
      await this.createIndexes(client);

      // Create triggers for updated_at timestamps
      await this.createTriggers(client);

      await client.query('COMMIT');
      console.log('✅ Database schema initialized');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Schema initialization failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create database indexes for performance
   */
  async createIndexes(client) {
    const indexes = [
      // Users table indexes
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified)',
      'CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL',
      
      // Refresh tokens indexes
      'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked) WHERE revoked = FALSE',
      
      // Dashboard layouts indexes
      'CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_default ON dashboard_layouts(user_id, is_default) WHERE is_default = TRUE',
      
      // ESP32 devices indexes
      'CREATE INDEX IF NOT EXISTS idx_esp32_devices_user_id ON esp32_devices(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_esp32_devices_device_id ON esp32_devices(device_id)',
      'CREATE INDEX IF NOT EXISTS idx_esp32_devices_active ON esp32_devices(is_active) WHERE is_active = TRUE',
      
      // Security audit log indexes
      'CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON security_audit_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON security_audit_log(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON security_audit_log(created_at)',
      
      // Widget cache indexes
      'CREATE INDEX IF NOT EXISTS idx_widget_cache_expires ON widget_cache(expires_at)'
    ];

    for (const indexSQL of indexes) {
      try {
        await client.query(indexSQL);
      } catch (error) {
        console.warn(`⚠️ Index creation warning: ${error.message}`);
      }
    }
  }

  /**
   * Create database triggers for automatic timestamp updates
   */
  async createTriggers(client) {
    // Create update timestamp function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for tables with updated_at columns
    const tables = ['users', 'dashboard_layouts', 'esp32_devices'];
    
    for (const table of tables) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
  }

  /**
   * Execute a query with automatic retry and error handling
   */
  async query(text, params = [], options = {}) {
    const startTime = Date.now();
    let client;
    let retries = 0;
    const maxRetries = options.maxRetries || 3;

    while (retries <= maxRetries) {
      try {
        client = await this.pool.connect();
        const result = await client.query(text, params);
        
        // Update metrics
        this.healthStatus.totalQueries++;
        const duration = Date.now() - startTime;
        
        if (duration > 1000) {
          console.warn(`🐌 Slow query detected (${duration}ms): ${text.substring(0, 100)}...`);
        }
        
        return result;
        
      } catch (error) {
        this.healthStatus.errorCount++;
        retries++;
        
        // Log error with context
        console.error(`❌ Database query error (attempt ${retries}/${maxRetries + 1}):`, {
          error: error.message,
          query: text.substring(0, 100),
          params: params?.length ? '[REDACTED]' : 'none'
        });

        // Check if it's a retryable error
        if (this.isRetryableError(error) && retries <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000); // Exponential backoff, max 5s
          console.log(`🔄 Retrying query in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      } finally {
        if (client) {
          client.release();
        }
      }
    }
  }

  /**
   * Execute a transaction with automatic retry and rollback
   */
  async transaction(callback, options = {}) {
    const client = await this.pool.connect();
    let retries = 0;
    const maxRetries = options.maxRetries || 2;

    while (retries <= maxRetries) {
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
        
      } catch (error) {
        await client.query('ROLLBACK');
        retries++;
        
        console.error(`❌ Transaction error (attempt ${retries}/${maxRetries + 1}):`, error.message);
        
        if (this.isRetryableError(error) && retries <= maxRetries) {
          const delay = Math.min(500 * Math.pow(2, retries - 1), 2000);
          console.log(`🔄 Retrying transaction in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      } finally {
        client.release();
      }
    }
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      '53300', // too_many_connections
      '53400', // configuration_limit_exceeded
      '40001', // serialization_failure
      '40P01'  // deadlock_detected
    ];
    
    return retryableCodes.some(code => 
      error.code === code || error.message.includes(code)
    );
  }

  /**
   * Update health status
   */
  updateHealthStatus(status, error = null) {
    this.healthStatus.status = status;
    this.healthStatus.lastCheck = new Date().toISOString();
    
    if (error) {
      this.healthStatus.lastError = error;
    }
  }

  /**
   * Get database health information
   */
  async getHealthInfo() {
    try {
      const poolInfo = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      // Get database statistics
      const result = await this.query(`
        SELECT 
          current_database() as database_name,
          current_user as current_user,
          version() as version,
          NOW() as server_time
      `);

      return {
        ...this.healthStatus,
        pool: poolInfo,
        database: result.rows[0],
        isConnected: this.isInitialized
      };
      
    } catch (error) {
      return {
        ...this.healthStatus,
        error: error.message,
        isConnected: false
      };
    }
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    try {
      await this.transaction(async (client) => {
        // Clean expired refresh tokens
        const expiredTokens = await client.query(
          'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE RETURNING id'
        );
        
        // Clean expired widget cache
        const expiredCache = await client.query(
          'DELETE FROM widget_cache WHERE expires_at < NOW() RETURNING cache_key'
        );
        
        // Clean old audit logs (keep last 30 days)
        const oldLogs = await client.query(
          'DELETE FROM security_audit_log WHERE created_at < NOW() - INTERVAL \'30 days\' RETURNING id'
        );

        console.log(`🧹 Cleanup completed: ${expiredTokens.rowCount} tokens, ${expiredCache.rowCount} cache entries, ${oldLogs.rowCount} audit logs`);
      });
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Gracefully close all connections
   */
  async close() {
    if (this.pool) {
      console.log('🔌 Closing database connections...');
      try {
        await this.pool.end();
        this.isInitialized = false;
        console.log('✅ Database connections closed');
      } catch (error) {
        console.error('❌ Error closing database connections:', error);
        throw error;
      }
    }
  }

  /**
   * High-level query methods for common operations
   */

  // User operations
  async findUserByEmail(email) {
    const result = await this.query(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );
    return result.rows[0];
  }

  async findUserById(id) {
    const result = await this.query(
      'SELECT id, username, email, email_verified, preferences FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0];
  }

  async createUser(userData) {
    const { username, email, passwordHash } = userData;
    const result = await this.query(`
      INSERT INTO users (username, email, password_hash, email_verification_token, email_verification_expires)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
      RETURNING id, username, email, created_at
    `, [username, email.toLowerCase(), passwordHash, crypto.randomBytes(32).toString('hex')]);
    
    return result.rows[0];
  }

  // Dashboard operations
  async saveDashboardLayout(userId, layoutData, name = 'Default Dashboard') {
    return await this.transaction(async (client) => {
      // First, unset any existing default if this is being set as default
      await client.query(
        'UPDATE dashboard_layouts SET is_default = FALSE WHERE user_id = $1 AND name = $2',
        [userId, name]
      );

      // Insert or update the layout
      const result = await client.query(`
        INSERT INTO dashboard_layouts (user_id, name, layout_data, is_default)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (user_id, name)
        DO UPDATE SET layout_data = $3, updated_at = NOW()
        RETURNING id
      `, [userId, name, JSON.stringify(layoutData)]);

      return result.rows[0];
    });
  }

  async getDashboardLayout(userId, name = 'Default Dashboard') {
    const result = await this.query(
      'SELECT layout_data FROM dashboard_layouts WHERE user_id = $1 AND name = $2',
      [userId, name]
    );
    
    return result.rows[0]?.layout_data || null;
  }

  // Device operations
  async registerDevice(userId, deviceData) {
    const { deviceName, deviceType, deviceId, tokenHash } = deviceData;
    const result = await this.query(`
      INSERT INTO esp32_devices (user_id, device_id, device_name, device_type, device_token_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, device_id, device_name, device_type, created_at
    `, [userId, deviceId, deviceName, deviceType, tokenHash]);
    
    return result.rows[0];
  }

  async getUserDevices(userId) {
    const result = await this.query(
      'SELECT device_id, device_name, device_type, is_active, last_connected, created_at FROM esp32_devices WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows;
  }

  // Cache operations
  async getCachedWidget(cacheKey) {
    const result = await this.query(
      'SELECT data FROM widget_cache WHERE cache_key = $1 AND expires_at > NOW()',
      [cacheKey]
    );
    
    return result.rows[0]?.data || null;
  }

  async setCachedWidget(cacheKey, data, ttlSeconds = 300) {
    await this.query(`
      INSERT INTO widget_cache (cache_key, data, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '${ttlSeconds} seconds')
      ON CONFLICT (cache_key)
      DO UPDATE SET data = $2, expires_at = NOW() + INTERVAL '${ttlSeconds} seconds', created_at = NOW()
    `, [cacheKey, JSON.stringify(data)]);
  }

  // Security audit
  async logSecurityEvent(eventType, eventData, userId = null, ipAddress = null, userAgent = null) {
    await this.query(
      'INSERT INTO security_audit_log (user_id, event_type, event_data, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [userId, eventType, JSON.stringify(eventData), ipAddress, userAgent]
    );
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Export both the class and singleton instance
module.exports = {
  DatabaseManager,
  db: dbManager
};
