/**
 * module-core.js - Core module system for dashboard components
 * Provides unified module registration, lifecycle management, and shared utilities
 */

// Module registry to store all available modules
const ModuleRegistry = {
  // Map of module types (key: module type, value: module implementation)
  _modules: new Map(),
  _moduleInstances: new Map(),
  _lifecycleHooks: new Map(),
  
  // Register a module type
  register(type, implementation) {
    if (!type || typeof type !== 'string') {
      console.error('Module type must be a non-empty string');
      return false;
    }
    
    if (!implementation || typeof implementation !== 'object') {
      console.error(`Invalid implementation for module type: ${type}`);
      return false;
    }
    
    // Ensure required methods and properties exist
    const required = ['name', 'render', 'configure'];
    const missing = required.filter(prop => !implementation[prop]);
    
    if (missing.length > 0) {
      console.error(`Module implementation for "${type}" is missing required properties: ${missing.join(', ')}`);
      return false;
    }
    
    // Validate module structure
    if (!this.validateModuleStructure(implementation)) {
      console.error(`Module implementation for "${type}" has invalid structure`);
      return false;
    }
    
    this._modules.set(type, implementation);
    console.log(`✅ Module registered: ${type} (${implementation.name})`);
    
    // Trigger registration hooks
    this.triggerHook('onModuleRegistered', { type, implementation });
    
    return true;
  },
  
  // Validate module structure
  validateModuleStructure(implementation) {
    // Check for required properties
    if (!implementation.name || typeof implementation.name !== 'string') return false;
    if (!implementation.description || typeof implementation.description !== 'string') return false;
    if (!implementation.category || typeof implementation.category !== 'string') return false;
    
    // Check for required methods
    if (typeof implementation.render !== 'function') return false;
    if (typeof implementation.configure !== 'function') return false;
    
    // Validate config options if present
    if (implementation.configOptions && !Array.isArray(implementation.configOptions)) return false;
    
    return true;
  },
  
  // Get a module implementation by type
  get(type) {
    return this._modules.get(type);
  },
  
  // Get all registered module types
  getAll() {
    return Array.from(this._modules.entries()).map(([type, impl]) => ({
      type,
      name: impl.name,
      description: impl.description || `${impl.name} module`,
      category: impl.category || 'general',
      configOptions: impl.configOptions || [],
      version: impl.version || '1.0.0',
      author: impl.author || 'Unknown',
      icon: impl.icon || 'fas fa-puzzle-piece'
    }));
  },
  
  // Get modules by category
  getByCategory(category) {
    return this.getAll().filter(module => module.category === category);
  },
  
  // Check if module exists
  has(type) {
    return this._modules.has(type);
  },
  
  // Unregister a module
  unregister(type) {
    if (this._modules.has(type)) {
      // Clean up any instances
      this.destroyInstances(type);
      
      // Remove from registry
      this._modules.delete(type);
      
      console.log(`🗑️ Module unregistered: ${type}`);
      this.triggerHook('onModuleUnregistered', { type });
      
      return true;
    }
    return false;
  },
  
  // Lifecycle hooks management
  addHook(event, callback) {
    if (!this._lifecycleHooks.has(event)) {
      this._lifecycleHooks.set(event, []);
    }
    this._lifecycleHooks.get(event).push(callback);
  },
  
  triggerHook(event, data) {
    const hooks = this._lifecycleHooks.get(event) || [];
    hooks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} hook:`, error);
      }
    });
  },
  
  // Destroy instances of a specific type
  destroyInstances(type) {
    const instances = Array.from(this._moduleInstances.entries())
      .filter(([id, instance]) => instance.type === type);
    
    instances.forEach(([id, instance]) => {
      try {
        if (instance.destroy) {
          instance.destroy();
        }
        this._moduleInstances.delete(id);
      } catch (error) {
        console.error(`Error destroying instance ${id}:`, error);
      }
    });
  }
};

/**
 * Base class for all modules
 * Provides common functionality for module creation, rendering, and management
 */
class ModuleBase {
  /**
   * Create a module instance
   * @param {string} id - Unique module ID
   * @param {string} type - Module type
   * @param {Object} config - Module configuration
   * @param {Object} layout - Layout parameters
   */
  constructor(id, type, config = {}, layout = {}) {
    this.id = id;
    this.type = type;
    this.config = config;
    this.layout = layout;
    this.element = null;
    this.contentElement = null;
    this.detailLevel = config.detailLevel || 'compact';
    this.implementation = ModuleRegistry.get(type);
    this.isVisible = true;
    this.isLoading = false;
    this.lastError = null;
    this.refreshInterval = null;
    this.eventListeners = new Map();
    
    if (!this.implementation) {
      console.error(`No implementation found for module type: ${type}`);
      throw new Error(`Module type "${type}" is not registered`);
    }
    
    // Register instance
    ModuleRegistry._moduleInstances.set(id, this);
    
    // Trigger creation hook
    ModuleRegistry.triggerHook('onModuleCreated', { instance: this });
  }
  
  /**
   * Create the DOM element for this module
   * @returns {HTMLElement} The created module element
   */
  createElement() {
    // Create the main module element
    const module = document.createElement('div');
    module.className = 'module';
    module.dataset.id = this.id;
    module.dataset.type = this.type;
    module.dataset.detail = this.detailLevel;
    
    // Add module-specific classes
    if (this.implementation.cssClass) {
      module.classList.add(this.implementation.cssClass);
    }
    
    // Create module header
    const header = document.createElement('div');
    header.className = 'module-header draggable-handle';
    
    const title = document.createElement('h3');
    title.className = 'module-title';
    title.innerHTML = `
      <i class="${this.implementation.icon || 'fas fa-puzzle-piece'}"></i>
      <span>${this.implementation.name}</span>
    `;
    
    const actions = document.createElement('div');
    actions.className = 'module-actions';
    actions.innerHTML = `
      <button class="btn-refresh" aria-label="Refresh module" title="Refresh">
        <i class="fas fa-sync-alt"></i>
      </button>
      <button class="btn-details" aria-label="Toggle detail level" title="Details">
        <i class="fas fa-list"></i>
      </button>
      <button class="btn-configure" aria-label="Configure module" title="Configure">
        <i class="fas fa-cog"></i>
      </button>
      <button class="btn-remove" aria-label="Remove module" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    header.appendChild(title);
    header.appendChild(actions);
    
    // Create module content
    const content = document.createElement('div');
    content.className = 'module-content';
    content.innerHTML = '<div class="module-loading"><div class="spinner"></div></div>';
    
    // Assemble module
    module.appendChild(header);
    module.appendChild(content);
    
    // Store references
    this.element = module;
    this.contentElement = content;
    
    // Attach event handlers
    this.attachEventHandlers();
    
    // Apply custom styling
    this.applyCustomStyling();
    
    return module;
  }
  
  /**
   * Attach event handlers to module elements
   */
  attachEventHandlers() {
    if (!this.element) return;
    
    // Refresh button
    this.addEventListener('.btn-refresh', 'click', (e) => {
      e.stopPropagation();
      this.refresh();
    });
    
    // Configure button
    this.addEventListener('.btn-configure', 'click', (e) => {
      e.stopPropagation();
      this.configure();
    });
    
    // Detail level toggle button
    this.addEventListener('.btn-details', 'click', (e) => {
      e.stopPropagation();
      this.toggleDetailLevel();
    });
    
    // Remove button
    this.addEventListener('.btn-remove', 'click', (e) => {
      e.stopPropagation();
      this.confirmRemove();
    });
  }
  
  /**
   * Add event listener with automatic cleanup
   */
  addEventListener(selector, event, handler) {
    const element = typeof selector === 'string' ? 
      this.element.querySelector(selector) : selector;
    
    if (element) {
      element.addEventListener(event, handler);
      
      // Store for cleanup
      const key = `${selector}-${event}`;
      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }
      this.eventListeners.get(key).push({ element, event, handler });
    }
  }
  
  /**
   * Load module data and render content
   * @param {boolean} forceRefresh - Force a data refresh
   */
  async loadData(forceRefresh = false) {
    if (!this.contentElement) return;
    
    this.isLoading = true;
    this.lastError = null;
    
    // Show loading state for initial load
    if (!forceRefresh) {
      this.contentElement.innerHTML = '<div class="module-loading"><div class="spinner"></div></div>';
    } else {
      this.contentElement.classList.add('refreshing');
    }
    
    try {
      // Build query params
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(this.config)) {
        // Skip appearance config
        if (!['headerColor', 'textColor', 'customCSS', 'cssCode', 'detailLevel'].includes(key)) {
          params.append(key, value);
        }
      }
      
      // Add cache-busting parameter for forced refreshes
      if (forceRefresh) {
        params.append('_t', Date.now());
      }
      
      // Add detail level parameter
      params.append('detailLevel', this.detailLevel);
      
      // Fetch module data from server
      const response = await fetch(`/api/widget/${this.type}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Remove refreshing state
      this.contentElement.classList.remove('refreshing');
      
      // Render module content
      await this.render(result.data);
      
      // Apply custom styling
      this.applyCustomStyling();
      
      // Trigger data loaded hook
      ModuleRegistry.triggerHook('onModuleDataLoaded', { instance: this, data: result.data });
      
    } catch (error) {
      console.error(`Error loading module data (${this.type}):`, error);
      
      this.lastError = error;
      this.contentElement.classList.remove('refreshing');
      
      // Show error message
      this.renderError(error.message || 'Failed to load data');
      
      // Trigger error hook
      ModuleRegistry.triggerHook('onModuleError', { instance: this, error });
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Render module content with the provided data
   * @param {Object} data - Module data
   */
  async render(data) {
    if (!this.contentElement || !this.implementation) return;
    
    try {
      // Call the implementation's render method
      if (this.implementation.render.constructor.name === 'AsyncFunction') {
        await this.implementation.render(this.contentElement, data, this.detailLevel);
      } else {
        this.implementation.render(this.contentElement, data, this.detailLevel);
      }
      
      // Trigger render hook
      ModuleRegistry.triggerHook('onModuleRendered', { instance: this, data });
      
    } catch (error) {
      console.error(`Error rendering module (${this.type}):`, error);
      this.renderError('Failed to render module');
    }
  }
  
  /**
   * Render an error message
   * @param {string} message - Error message to display
   */
  renderError(message) {
    if (!this.contentElement) return;
    
    this.contentElement.innerHTML = `
      <div class="module-error">
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          ${message}
        </div>
        <button class="btn btn-outline-primary retry-btn mt-3">
          <i class="fas fa-sync-alt me-1"></i> Retry
        </button>
      </div>
    `;
    
    // Add retry button handler
    const retryBtn = this.contentElement.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.refresh());
    }
  }
  
  /**
   * Refresh module data
   */
  refresh() {
    // Find and animate the refresh button
    const refreshBtn = this.element?.querySelector('.btn-refresh');
    if (refreshBtn) {
      refreshBtn.classList.add('spin');
      setTimeout(() => refreshBtn.classList.remove('spin'), 1000);
    }
    
    // Reload data
    this.loadData(true);
    
    // Trigger refresh hook
    ModuleRegistry.triggerHook('onModuleRefreshed', { instance: this });
  }
  
  /**
   * Configure the module
   */
  configure() {
    if (!this.implementation) return;
    
    try {
      // Call the implementation's configure method
      this.implementation.configure(this.id, this.config, (newConfig) => {
        this.updateConfig(newConfig);
      });
      
      // Trigger configure hook
      ModuleRegistry.triggerHook('onModuleConfigured', { instance: this });
      
    } catch (error) {
      console.error(`Error configuring module (${this.type}):`, error);
      showToast('Failed to configure module', 'error');
    }
  }
  
  /**
   * Update module configuration
   * @param {Object} newConfig - New module configuration
   */
  updateConfig(newConfig) {
    if (!newConfig) return;
    
    const oldConfig = { ...this.config };
    
    // Update config
    this.config = { ...this.config, ...newConfig };
    
    // Update detail level if it changed
    if (newConfig.detailLevel) {
      this.detailLevel = newConfig.detailLevel;
      this.element.dataset.detail = this.detailLevel;
    }
    
    // Store the updated config
    this.element.dataset.config = JSON.stringify(this.config);
    localStorage.setItem(`module-config-${this.id}`, JSON.stringify(this.config));
    
    // Apply custom styling
    this.applyCustomStyling();
    
    // Refresh module content
    this.loadData(true);
    
    // Dispatch event for layout saving
    window.dispatchEvent(new CustomEvent('module:updated', { 
      detail: { 
        id: this.id, 
        oldConfig, 
        newConfig: this.config 
      } 
    }));
    
    // Trigger update hook
    ModuleRegistry.triggerHook('onModuleConfigUpdated', { 
      instance: this, 
      oldConfig, 
      newConfig: this.config 
    });
  }
  
  /**
   * Apply custom styling based on module configuration
   */
  applyCustomStyling() {
    if (!this.element) return;
    
    // Reset custom styles
    const existingStyle = this.element.querySelector('.module-custom-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Apply header color
    if (this.config.headerColor) {
      const header = this.element.querySelector('.module-header');
      if (header) {
        header.style.backgroundColor = this.config.headerColor;
        
        // Adjust text color for contrast
        const isLight = isLightColor(this.config.headerColor);
        header.style.color = isLight ? '#212529' : '#ffffff';
      }
    }
    
    // Apply text color
    if (this.config.textColor) {
      const content = this.element.querySelector('.module-content');
      if (content) {
        content.style.color = this.config.textColor;
      }
    }
    
    // Apply custom CSS if enabled
    if (this.config.customCSS && this.config.cssCode) {
      const styleTag = document.createElement('style');
      styleTag.className = 'module-custom-style';
      styleTag.textContent = `.module[data-id="${this.id}"] { ${this.config.cssCode} }`;
      this.element.appendChild(styleTag);
    }
  }
  
  /**
   * Toggle module detail level
   */
  toggleDetailLevel() {
    // Rotate through detail levels: compact -> normal -> expanded -> compact
    const levels = ['compact', 'normal', 'expanded'];
    const currentIndex = levels.indexOf(this.detailLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    this.detailLevel = levels[nextIndex];
    
    // Update element attribute
    this.element.dataset.detail = this.detailLevel;
    
    // Update config
    this.config.detailLevel = this.detailLevel;
    localStorage.setItem(`module-config-${this.id}`, JSON.stringify(this.config));
    
    // Update icon
    const detailsBtn = this.element.querySelector('.btn-details i');
    if (detailsBtn) {
      if (this.detailLevel === 'compact') {
        detailsBtn.className = 'fas fa-list';
      } else if (this.detailLevel === 'normal') {
        detailsBtn.className = 'fas fa-list-alt';
      } else {
        detailsBtn.className = 'fas fa-th-list';
      }
    }
    
    // Refresh data with new detail level
    this.loadData(true);
    
    // Trigger detail level change hook
    ModuleRegistry.triggerHook('onModuleDetailLevelChanged', { 
      instance: this, 
      detailLevel: this.detailLevel 
    });
  }
  
  /**
   * Confirm module removal
   */
  confirmRemove() {
    // Create confirmation dialog
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal small">
        <div class="modal-header">
          <h3>Remove Module</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to remove this module?</p>
          <div class="module-info">
            <strong>${this.implementation.name}</strong>
            <br>
            <small class="text-muted">${this.implementation.description}</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary cancel-btn">Cancel</button>
          <button class="btn btn-danger confirm-btn">Remove</button>
        </div>
      </div>
    `;
    
    // Add to DOM
    document.body.appendChild(modal);
    
    // Add event handlers
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.querySelector('.confirm-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.remove();
    });
    
    // Close on overlay click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
  
  /**
   * Remove this module
   */
  remove() {
    // Trigger module:remove event for the grid to handle
    window.dispatchEvent(new CustomEvent('module:remove', { detail: { id: this.id } }));
    
    // Trigger removal hook
    ModuleRegistry.triggerHook('onModuleRemoved', { instance: this });
    
    // Clean up
    this.destroy();
    
    // Show toast
    showToast('Module removed', 'success');
  }
  
  /**
   * Show/hide module
   */
  setVisibility(visible) {
    this.isVisible = visible;
    if (this.element) {
      this.element.style.display = visible ? '' : 'none';
    }
    
    // Trigger visibility change hook
    ModuleRegistry.triggerHook('onModuleVisibilityChanged', { 
      instance: this, 
      visible 
    });
  }
  
  /**
   * Set up auto-refresh
   */
  setupAutoRefresh(intervalMs) {
    this.clearAutoRefresh();
    
    if (intervalMs && intervalMs > 0) {
      this.refreshInterval = setInterval(() => {
        if (this.isVisible && !this.isLoading) {
          this.refresh();
        }
      }, intervalMs);
    }
  }
  
  /**
   * Clear auto-refresh
   */
  clearAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
  
  /**
   * Destroy this module instance
   */
  destroy() {
    // Clear auto-refresh
    this.clearAutoRefresh();
    
    // Remove event listeners
    this.eventListeners.forEach((listeners, key) => {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.eventListeners.clear();
    
    // Remove from registry
    ModuleRegistry._moduleInstances.delete(this.id);
    
    // Remove from local storage
    localStorage.removeItem(`module-config-${this.id}`);
    
    // Trigger destruction hook
    ModuleRegistry.triggerHook('onModuleDestroyed', { instance: this });
  }
}

/**
 * Create a new module instance
 * @param {string} type - Module type
 * @param {Object} config - Module configuration
 * @param {string} id - Module ID (optional, will generate if not provided)
 * @returns {ModuleBase} New module instance
 */
function createModule(type, config = {}, id = null) {
  // Ensure type is registered
  if (!ModuleRegistry.get(type)) {
    console.error(`Cannot create module: type "${type}" is not registered`);
    return null;
  }
  
  // Generate ID if not provided
  if (!id) {
    id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  
  // Create instance
  return new ModuleBase(id, type, config);
}

/**
 * Auto-discover and register modules
 */
async function autoDiscoverModules() {
  const moduleTypes = [
    'weather',
    'crypto', 
    'stocks',
    'countdown',
    'notes',
    'todo'
  ];
  
  const loadPromises = moduleTypes.map(async (type) => {
    try {
      const module = await import(`./modules/${type}.js`);
      // Module should auto-register itself
      console.log(`📦 Auto-discovered module: ${type}`);
    } catch (error) {
      console.warn(`⚠️ Failed to load module ${type}:`, error);
    }
  });
  
  await Promise.all(loadPromises);
}

/**
 * Module loading utilities
 */
const ModuleLoader = {
  async loadModule(type) {
    if (ModuleRegistry.has(type)) {
      return ModuleRegistry.get(type);
    }
    
    try {
      await import(`./modules/${type}.js`);
      return ModuleRegistry.get(type);
    } catch (error) {
      console.error(`Failed to load module ${type}:`, error);
      return null;
    }
  },
  
  async loadAllModules() {
    return autoDiscoverModules();
  },
  
  getLoadedModules() {
    return ModuleRegistry.getAll();
  }
};

/**
 * Check if a color is light or dark
 * @param {string} color - Color value
 * @returns {boolean} True if the color is light
 */
function isLightColor(color) {
  // Convert hex to RGB
  let r, g, b;
  
  if (color.startsWith('#')) {
    // Hex color
    const hex = color.substring(1);
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    // RGB color
    const rgb = color.match(/\d+/g);
    r = parseInt(rgb[0]);
    g = parseInt(rgb[1]);
    b = parseInt(rgb[2]);
  } else {
    // Default to dark
    return false;
  }
  
  // Calculate brightness (YIQ formula)
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 128;
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'success', duration = 3000) {
  // Check if toast container exists, create if not
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// Export the module system
export {
  ModuleRegistry,
  ModuleBase,
  createModule,
  ModuleLoader,
  showToast
};
