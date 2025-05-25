/**
 * module-loader.js - Dynamic Module Discovery and Loading System
 * Automatically discovers, loads, and manages frontend modules
 */

class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadedModules = new Set();
    this.loadingPromises = new Map();
    this.erroredModules = new Set();
    this.moduleCache = new Map();
    this.discoveredModules = [];
    this.isInitialized = false;
    
    // Performance monitoring
    this.loadTimes = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    
    // Module configuration
    this.moduleBasePath = '/js/widgets/';
    this.coreModulePath = '/js/widgets/widget-core.js';
    this.fallbackTimeout = 10000; // 10 seconds
    
    // Events
    this.eventListeners = new Map();
    
    console.log('🔧 Module Loader initialized');
  }

  /**
   * Initialize the module loader
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('Module loader already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing module loader...');
      
      // Load core module system first
      await this.loadCoreModule();
      
      // Discover available modules
      await this.discoverModules();
      
      // Load essential modules
      await this.loadEssentialModules();
      
      this.isInitialized = true;
      this.emit('initialized', { modules: this.discoveredModules });
      
      console.log('✅ Module loader initialized successfully');
      console.log(`📦 Discovered ${this.discoveredModules.length} modules`);
      
    } catch (error) {
      console.error('❌ Failed to initialize module loader:', error);
      this.emit('error', { type: 'initialization', error });
      throw error;
    }
  }

  /**
   * Load the core module system
   */
  async loadCoreModule() {
    try {
      console.log('📥 Loading core module system...');
      
      const coreModule = await this.loadScript(this.coreModulePath);
      
      // Verify core module loaded properly
      if (!window.WidgetRegistry || !window.WidgetBase) {
        throw new Error('Core module system failed to load properly');
      }
      
      console.log('✅ Core module system loaded');
      return coreModule;
      
    } catch (error) {
      console.error('❌ Failed to load core module system:', error);
      throw new Error('Core module system is required for module loading');
    }
  }

  /**
   * Discover available modules from server
   */
  async discoverModules() {
    try {
      console.log('🔍 Discovering available modules...');
      
      // Get module list from server
      const response = await fetch('/api/modules/list', {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.discoveredModules = data.modules || [];
        console.log(`📋 Server provided ${this.discoveredModules.length} modules`);
      } else {
        console.warn('Server module discovery failed, using fallback');
        this.discoveredModules = await this.fallbackModuleDiscovery();
      }
      
      // Validate discovered modules
      this.discoveredModules = this.discoveredModules.filter(this.validateModuleInfo);
      
      console.log(`✅ Discovered ${this.discoveredModules.length} valid modules:`, 
        this.discoveredModules.map(m => m.type).join(', '));
      
    } catch (error) {
      console.warn('Module discovery from server failed, using fallback:', error);
      this.discoveredModules = await this.fallbackModuleDiscovery();
    }
  }

  /**
   * Fallback module discovery using known module types
   */
  async fallbackModuleDiscovery() {
    const knownModules = [
      { type: 'weather', name: 'Weather', category: 'data', essential: true },
      { type: 'crypto', name: 'Cryptocurrency', category: 'data', essential: false },
      { type: 'stocks', name: 'Stocks', category: 'data', essential: false },
      { type: 'countdown', name: 'Countdown', category: 'tools', essential: false },
      { type: 'notes', name: 'Notes', category: 'tools', essential: true },
      { type: 'todo', name: 'Todo List', category: 'tools', essential: false }
    ];
    
    console.log('📋 Using fallback module discovery');
    
    // Test which modules actually exist
    const availableModules = [];
    
    for (const module of knownModules) {
      try {
        const testResponse = await fetch(`${this.moduleBasePath}${module.type}.js`, { 
          method: 'HEAD' 
        });
        
        if (testResponse.ok) {
          availableModules.push({
            ...module,
            path: `${this.moduleBasePath}${module.type}.js`,
            version: '2.0.0',
            status: 'available'
          });
        }
      } catch (error) {
        console.warn(`Module ${module.type} not available:`, error);
      }
    }
    
    return availableModules;
  }

  /**
   * Validate module information
   */
  validateModuleInfo(module) {
    if (!module || typeof module !== 'object') return false;
    if (!module.type || typeof module.type !== 'string') return false;
    if (!module.name || typeof module.name !== 'string') return false;
    
    // Set defaults for missing properties
    module.category = module.category || 'general';
    module.version = module.version || '1.0.0';
    module.path = module.path || `${this.moduleBasePath}${module.type}.js`;
    module.essential = module.essential || false;
    
    return true;
  }

  /**
   * Load essential modules for initial dashboard
   */
  async loadEssentialModules() {
    const essentialModules = this.discoveredModules.filter(m => m.essential);
    
    if (essentialModules.length === 0) {
      console.log('ℹ️ No essential modules defined, loading first 3 available');
      // Load first 3 modules as fallback
      const fallbackModules = this.discoveredModules.slice(0, 3);
      await this.loadModules(fallbackModules.map(m => m.type));
    } else {
      console.log(`📥 Loading ${essentialModules.length} essential modules...`);
      await this.loadModules(essentialModules.map(m => m.type));
    }
  }

  /**
   * Load multiple modules concurrently
   */
  async loadModules(moduleTypes, options = {}) {
    if (!Array.isArray(moduleTypes)) {
      moduleTypes = [moduleTypes];
    }
    
    const { timeout = this.fallbackTimeout, parallel = true } = options;
    
    console.log(`📦 Loading modules: ${moduleTypes.join(', ')}`);
    
    if (parallel) {
      // Load modules in parallel for better performance
      const loadPromises = moduleTypes.map(type => 
        this.loadModule(type, { timeout })
      );
      
      const results = await Promise.allSettled(loadPromises);
      
      // Process results
      const successful = [];
      const failed = [];
      
      results.forEach((result, index) => {
        const moduleType = moduleTypes[index];
        if (result.status === 'fulfilled') {
          successful.push(moduleType);
        } else {
          failed.push({ type: moduleType, error: result.reason });
          console.error(`Failed to load module ${moduleType}:`, result.reason);
        }
      });
      
      if (successful.length > 0) {
        console.log(`✅ Successfully loaded modules: ${successful.join(', ')}`);
      }
      
      if (failed.length > 0) {
        console.warn(`⚠️ Failed to load modules:`, failed);
        this.emit('modulesLoadFailed', failed);
      }
      
      return { successful, failed };
      
    } else {
      // Load modules sequentially
      const results = [];
      
      for (const moduleType of moduleTypes) {
        try {
          await this.loadModule(moduleType, { timeout });
          results.push({ type: moduleType, status: 'success' });
        } catch (error) {
          results.push({ type: moduleType, status: 'error', error });
          console.error(`Failed to load module ${moduleType}:`, error);
        }
      }
      
      return results;
    }
  }

  /**
   * Load a single module with retry logic
   */
  async loadModule(moduleType, options = {}) {
    const { timeout = this.fallbackTimeout, forceReload = false } = options;
    
    // Check if already loaded
    if (!forceReload && this.loadedModules.has(moduleType)) {
      console.log(`📋 Module ${moduleType} already loaded`);
      return this.modules.get(moduleType);
    }

    // Check if currently loading
    if (this.loadingPromises.has(moduleType)) {
      console.log(`⏳ Module ${moduleType} already loading, waiting...`);
      return this.loadingPromises.get(moduleType);
    }

    // Check retry limit
    const retryCount = this.retryAttempts.get(moduleType) || 0;
    if (retryCount >= this.maxRetries) {
      const error = new Error(`Module ${moduleType} exceeded maximum retry attempts (${this.maxRetries})`);
      this.erroredModules.add(moduleType);
      throw error;
    }

    // Start loading
    const startTime = performance.now();
    console.log(`📥 Loading module: ${moduleType} (attempt ${retryCount + 1})`);

    const loadPromise = this.performModuleLoad(moduleType, timeout);
    this.loadingPromises.set(moduleType, loadPromise);

    try {
      const module = await loadPromise;
      
      // Success
      const loadTime = performance.now() - startTime;
      this.loadTimes.set(moduleType, loadTime);
      this.loadedModules.add(moduleType);
      this.modules.set(moduleType, module);
      this.retryAttempts.delete(moduleType);
      
      console.log(`✅ Module ${moduleType} loaded successfully (${Math.round(loadTime)}ms)`);
      this.emit('moduleLoaded', { type: moduleType, module, loadTime });
      
      return module;
      
    } catch (error) {
      // Handle failure
      this.retryAttempts.set(moduleType, retryCount + 1);
      
      if (retryCount < this.maxRetries - 1) {
        console.warn(`⚠️ Module ${moduleType} failed to load, retrying... (${retryCount + 1}/${this.maxRetries})`);
        
        // Exponential backoff for retries
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.loadModule(moduleType, options);
      } else {
        this.erroredModules.add(moduleType);
        console.error(`❌ Module ${moduleType} failed to load after ${this.maxRetries} attempts:`, error);
        this.emit('moduleLoadError', { type: moduleType, error, attempts: this.maxRetries });
        throw error;
      }
    } finally {
      this.loadingPromises.delete(moduleType);
    }
  }

  /**
   * Perform the actual module loading
   */
  async performModuleLoad(moduleType, timeout) {
    const moduleInfo = this.discoveredModules.find(m => m.type === moduleType);
    
    if (!moduleInfo) {
      throw new Error(`Module information not found for: ${moduleType}`);
    }

    const modulePath = moduleInfo.path || `${this.moduleBasePath}${moduleType}.js`;
    
    // Load with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Module ${moduleType} load timeout (${timeout}ms)`)), timeout);
    });

    const loadPromise = this.loadScript(modulePath);
    
    await Promise.race([loadPromise, timeoutPromise]);
    
    // Verify module registered with widget system
    if (!window.WidgetRegistry || !window.WidgetRegistry.get(moduleType)) {
      throw new Error(`Module ${moduleType} failed to register with widget system`);
    }
    
    return window.WidgetRegistry.get(moduleType);
  }

  /**
   * Load a script dynamically
   */
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
          resolve(existingScript);
          return;
        }
      }

      const script = document.createElement('script');
      script.src = src;
      script.type = 'module';
      script.async = true;
      
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve(script);
      };
      
      script.onerror = (error) => {
        document.head.removeChild(script);
        reject(new Error(`Failed to load script: ${src}`));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load module on demand (lazy loading)
   */
  async loadOnDemand(moduleType) {
    try {
      if (this.loadedModules.has(moduleType)) {
        return this.modules.get(moduleType);
      }
      
      console.log(`🔄 Loading module on demand: ${moduleType}`);
      return await this.loadModule(moduleType);
      
    } catch (error) {
      console.error(`Failed to load module on demand: ${moduleType}`, error);
      throw error;
    }
  }

  /**
   * Preload modules for better user experience
   */
  async preloadModules(moduleTypes = null) {
    if (!moduleTypes) {
      // Preload all non-essential modules
      moduleTypes = this.discoveredModules
        .filter(m => !m.essential && !this.loadedModules.has(m.type))
        .map(m => m.type);
    }
    
    if (moduleTypes.length === 0) {
      console.log('ℹ️ No modules to preload');
      return;
    }
    
    console.log(`⚡ Preloading modules: ${moduleTypes.join(', ')}`);
    
    // Load with lower priority (sequential, with delays)
    for (const moduleType of moduleTypes) {
      try {
        await this.loadModule(moduleType);
        // Small delay between preloads to not block UI
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Preload failed for ${moduleType}:`, error);
      }
    }
    
    console.log('⚡ Module preloading completed');
  }

  /**
   * Get module information
   */
  getModuleInfo(moduleType) {
    return this.discoveredModules.find(m => m.type === moduleType);
  }

  /**
   * Get all available modules
   */
  getAvailableModules() {
    return [...this.discoveredModules];
  }

  /**
   * Get loaded modules
   */
  getLoadedModules() {
    return Array.from(this.loadedModules);
  }

  /**
   * Get modules by category
   */
  getModulesByCategory(category) {
    return this.discoveredModules.filter(m => m.category === category);
  }

  /**
   * Check if module is loaded
   */
  isModuleLoaded(moduleType) {
    return this.loadedModules.has(moduleType);
  }

  /**
   * Check if module is available
   */
  isModuleAvailable(moduleType) {
    return this.discoveredModules.some(m => m.type === moduleType);
  }

  /**
   * Unload a module
   */
  unloadModule(moduleType) {
    if (!this.loadedModules.has(moduleType)) {
      console.warn(`Module ${moduleType} is not loaded`);
      return false;
    }
    
    try {
      // Unregister from widget system
      if (window.WidgetRegistry) {
        window.WidgetRegistry.unregister(moduleType);
      }
      
      // Remove from our tracking
      this.loadedModules.delete(moduleType);
      this.modules.delete(moduleType);
      this.moduleCache.delete(moduleType);
      this.loadTimes.delete(moduleType);
      this.retryAttempts.delete(moduleType);
      this.erroredModules.delete(moduleType);
      
      console.log(`🗑️ Module ${moduleType} unloaded`);
      this.emit('moduleUnloaded', { type: moduleType });
      
      return true;
      
    } catch (error) {
      console.error(`Failed to unload module ${moduleType}:`, error);
      return false;
    }
  }

  /**
   * Reload a module
   */
  async reloadModule(moduleType) {
    console.log(`🔄 Reloading module: ${moduleType}`);
    
    // Unload first
    this.unloadModule(moduleType);
    
    // Remove script tag to force fresh load
    const scriptSrc = `${this.moduleBasePath}${moduleType}.js`;
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existingScript) {
      document.head.removeChild(existingScript);
    }
    
    // Load again
    return this.loadModule(moduleType, { forceReload: true });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {
      totalModules: this.discoveredModules.length,
      loadedModules: this.loadedModules.size,
      erroredModules: this.erroredModules.size,
      loadTimes: Object.fromEntries(this.loadTimes),
      retryAttempts: Object.fromEntries(this.retryAttempts),
      averageLoadTime: 0,
      slowestModule: null,
      fastestModule: null
    };
    
    if (this.loadTimes.size > 0) {
      const times = Array.from(this.loadTimes.values());
      metrics.averageLoadTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      metrics.slowestModule = Array.from(this.loadTimes.entries())
        .reduce((max, curr) => curr[1] > max[1] ? curr : max);
      metrics.fastestModule = Array.from(this.loadTimes.entries())
        .reduce((min, curr) => curr[1] < min[1] ? curr : min);
    }
    
    return metrics;
  }

  /**
   * Clear module cache
   */
  clearCache() {
    this.moduleCache.clear();
    console.log('🧹 Module cache cleared');
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Clear all modules
    for (const moduleType of this.loadedModules) {
      this.unloadModule(moduleType);
    }
    
    // Clear caches and state
    this.modules.clear();
    this.loadedModules.clear();
    this.loadingPromises.clear();
    this.erroredModules.clear();
    this.moduleCache.clear();
    this.loadTimes.clear();
    this.retryAttempts.clear();
    this.eventListeners.clear();
    
    this.isInitialized = false;
    
    console.log('🗑️ Module loader destroyed');
  }
}

// Create and export singleton instance
const moduleLoader = new ModuleLoader();

// Make available globally for debugging and external access
window.moduleLoader = moduleLoader;

export default moduleLoader;
