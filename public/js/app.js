/**
 * app.js - Streamlined application controller with dynamic module loading
 * Coordinates dashboard functionality with automatic module discovery
 */

import moduleLoader from './module-loader.js';
import { WidgetBase, showToast } from './widgets/widget-core.js';

// Global state
let authToken = localStorage.getItem('auth-token');
let currentUser = null;
let currentTheme = localStorage.getItem('dashboard-theme') || 'default';
let currentLayout = localStorage.getItem('dashboard-layout') || 'balanced';
let widgetInstances = new Map();
let gridLayout = null;
let isGridInitialized = false;
let isAppInitialized = false;

// Configuration
const CONFIG = {
  refreshInterval: parseInt(localStorage.getItem('refresh-interval')) || 60000,
  saveDelay: 1000,
  animations: localStorage.getItem('animations') !== 'false',
  autoSave: true,
  themes: ['default', 'dark', 'minimal', 'dense'],
  layouts: ['minimal', 'balanced', 'dense'],
  moduleLoader: {
    preloadDelay: 2000, // Delay before preloading non-essential modules
    maxConcurrentLoads: 3,
    enablePerformanceMonitoring: true
  }
};

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Dashboard application starting...');
  
  try {
    // Initialize module loader first
    await initializeModuleSystem();
    
    // Initialize theme
    initializeTheme();
    
    // Check authentication status
    const isAuthenticated = await checkAuthStatus();
    
    // Initialize UI components
    initializeUI();
    
    // Set up global event handlers
    setupGlobalEvents();
    
    // Initialize grid layout
    initializeGridLayout();
    
    // Load dashboard
    if (isAuthenticated) {
      await loadUserDashboard();
    } else {
      await loadDefaultDashboard();
    }
    
    // Set up auto-refresh
    setupAutoRefresh();
    
    // Start preloading non-essential modules
    scheduleModulePreloading();
    
    isAppInitialized = true;
    console.log('✅ Dashboard application initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize dashboard application:', error);
    showFallbackErrorInterface(error);
  }
});

/**
 * Initialize the module system
 */
async function initializeModuleSystem() {
  try {
    console.log('🔧 Initializing module system...');
    
    // Initialize module loader
    await moduleLoader.initialize();
    
    // Setup module loader event handlers
    moduleLoader.on('moduleLoaded', ({ type, loadTime }) => {
      console.log(`📦 Module ${type} loaded (${Math.round(loadTime)}ms)`);
    });
    
    moduleLoader.on('moduleLoadError', ({ type, error }) => {
      console.error(`❌ Failed to load module ${type}:`, error);
      showToast(`Module ${type} failed to load`, 'warning');
    });
    
    moduleLoader.on('modulesLoadFailed', (failedModules) => {
      if (failedModules.length > 0) {
        console.warn(`⚠️ ${failedModules.length} modules failed to load`);
      }
    });
    
    // Verify core widget system is available
    if (!window.WidgetRegistry || !window.WidgetBase) {
      throw new Error('Core widget system not available');
    }
    
    console.log('✅ Module system initialized');
    
  } catch (error) {
    console.error('❌ Module system initialization failed:', error);
    throw new Error('Critical: Module system failed to initialize');
  }
}

/**
 * Schedule preloading of non-essential modules
 */
function scheduleModulePreloading() {
  if (!CONFIG.moduleLoader.preloadDelay) return;
  
  setTimeout(async () => {
    try {
      console.log('⚡ Starting module preloading...');
      await moduleLoader.preloadModules();
      
      if (CONFIG.moduleLoader.enablePerformanceMonitoring) {
        logModulePerformanceMetrics();
      }
    } catch (error) {
      console.warn('⚠️ Module preloading failed:', error);
    }
  }, CONFIG.moduleLoader.preloadDelay);
}

/**
 * Log module performance metrics
 */
function logModulePerformanceMetrics() {
  const metrics = moduleLoader.getPerformanceMetrics();
  
  console.group('📊 Module Performance Metrics');
  console.log(`Total modules: ${metrics.totalModules}`);
  console.log(`Loaded modules: ${metrics.loadedModules}`);
  console.log(`Failed modules: ${metrics.erroredModules}`);
  console.log(`Average load time: ${metrics.averageLoadTime}ms`);
  
  if (metrics.slowestModule) {
    console.log(`Slowest module: ${metrics.slowestModule[0]} (${Math.round(metrics.slowestModule[1])}ms)`);
  }
  
  if (metrics.fastestModule) {
    console.log(`Fastest module: ${metrics.fastestModule[0]} (${Math.round(metrics.fastestModule[1])}ms)`);
  }
  
  console.groupEnd();
}

/**
 * Initialize theme system
 */
function initializeTheme() {
  document.body.dataset.theme = currentTheme;
  
  // Load theme CSS
  const themeLink = document.getElementById('theme-css');
  if (themeLink) {
    themeLink.href = `css/themes/${currentTheme}.css`;
  }
  
  // Apply theme class
  document.body.className = `theme-${currentTheme}`;
}

/**
 * Initialize UI components
 */
function initializeUI() {
  // Theme button
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', showThemeSelector);
  }
  
  // Layout button
  const layoutBtn = document.getElementById('layout-btn');
  if (layoutBtn) {
    layoutBtn.addEventListener('click', showLayoutSelector);
  }
  
  // Add widget button
  const addWidgetBtn = document.getElementById('add-widget');
  if (addWidgetBtn) {
    addWidgetBtn.addEventListener('click', showWidgetPicker);
  }
  
  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsModal);
  }
  
  // Authentication buttons
  setupAuthUI();
}

/**
 * Setup global event handlers
 */
function setupGlobalEvents() {
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key to close modals
    if (e.key === 'Escape') {
      const visibleModal = document.querySelector('.modal-overlay');
      if (visibleModal) {
        e.preventDefault();
        closeModal(visibleModal);
      }
    }
    
    // Ctrl+S to save dashboard
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveDashboardLayout();
      showToast('Dashboard saved');
    }
  });
  
  // Window resize events
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isGridInitialized && gridLayout) {
        updateGridColumns();
      }
    }, 250);
  });
  
  // Widget events
  window.addEventListener('widget:remove', (e) => {
    removeWidget(e.detail.id);
  });
  
  window.addEventListener('widget:updated', (e) => {
    saveDashboardLayout();
  });
}

/**
 * Check authentication status
 */
async function checkAuthStatus() {
  if (!authToken) {
    updateAuthUI(false);
    return false;
  }
  
  try {
    const response = await fetch('/api/auth/user', {
      headers: {
        'x-auth-token': authToken
      }
    });
    
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    
    const data = await response.json();
    currentUser = data;
    updateAuthUI(true);
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    authToken = null;
    localStorage.removeItem('auth-token');
    updateAuthUI(false);
    return false;
  }
}

/**
 * Setup authentication UI
 */
function setupAuthUI() {
  const devicesBtn = document.getElementById('devices-btn');
  if (devicesBtn) {
    devicesBtn.style.display = authToken ? 'inline-flex' : 'none';
  }
}

/**
 * Update authentication UI
 */
function updateAuthUI(isLoggedIn) {
  const authSection = document.getElementById('auth-section');
  const devicesBtn = document.getElementById('devices-btn');
  
  if (devicesBtn) {
    devicesBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
  }
  
  if (!authSection) return;
  
  if (isLoggedIn && currentUser) {
    authSection.innerHTML = `
      <div class="user-profile d-flex align-items-center gap-2">
        <span class="user-welcome">Welcome, ${currentUser.username}</span>
        <div class="dropdown">
          <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" id="userDropdown">
            <i class="fas fa-user-circle"></i>
          </button>
          <div class="dropdown-menu dropdown-menu-end" id="userDropdownMenu" style="display: none;">
            <a class="dropdown-item" href="#" id="profile-btn">
              <i class="fas fa-user me-2"></i>Profile
            </a>
            <a class="dropdown-item" href="#" id="saved-dashboards-btn">
              <i class="fas fa-save me-2"></i>Saved Dashboards
            </a>
            <div class="dropdown-divider"></div>
            <a class="dropdown-item" href="#" id="logout-btn">
              <i class="fas fa-sign-out-alt me-2"></i>Sign Out
            </a>
          </div>
        </div>
      </div>
    `;
    
    setupUserDropdown();
  } else {
    authSection.innerHTML = `
      <button id="login-btn" class="btn btn-outline-light btn-sm me-2">Sign In</button>
      <button id="register-btn" class="btn btn-primary btn-sm">Sign Up</button>
    `;
  }
}

/**
 * Setup user dropdown functionality
 */
function setupUserDropdown() {
  const toggle = document.getElementById('userDropdown');
  const menu = document.getElementById('userDropdownMenu');
  
  if (!toggle || !menu) return;

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('profile-btn')?.addEventListener('click', showProfileModal);
  document.getElementById('saved-dashboards-btn')?.addEventListener('click', showSavedDashboardsModal);
}

/**
 * Initialize grid layout - FIXED for GridStack compatibility
 */
function initializeGridLayout() {
  if (typeof GridStack === 'undefined') {
    console.warn('GridStack library not loaded. Using fallback layout.');
    return;
  }
  
  const gridContainer = document.getElementById('dashboard-grid');
  if (!gridContainer) return;
  
  const options = {
    cellHeight: getLayoutConfig().cellHeight,
    column: getLayoutConfig().columns,
    margin: getLayoutConfig().margin,
    float: true,
    animate: CONFIG.animations,
    resizable: {
      handles: 'all',
      autoHide: true
    },
    draggable: {
      handle: '.widget-header'
    }
  };
  
  gridLayout = GridStack.init(options, gridContainer);
  
  gridLayout.on('change', debounce(() => {
    if (CONFIG.autoSave) {
      saveDashboardLayout();
    }
  }, CONFIG.saveDelay));
  
  isGridInitialized = true;
  updateGridColumns();
}

/**
 * Get layout configuration based on current layout
 */
function getLayoutConfig() {
  const configs = {
    minimal: { cellHeight: 120, margin: 20, columns: 6 },
    balanced: { cellHeight: 100, margin: 15, columns: 12 },
    dense: { cellHeight: 80, margin: 8, columns: 16 }
  };
  return configs[currentLayout] || configs.balanced;
}

/**
 * Update grid columns based on screen size
 */
function updateGridColumns() {
  if (!gridLayout) return;
  
  const config = getLayoutConfig();
  let columns = config.columns;
  
  if (window.innerWidth < 576) {
    columns = 1;
  } else if (window.innerWidth < 768) {
    columns = Math.min(2, config.columns);
  } else if (window.innerWidth < 992) {
    columns = Math.min(Math.floor(config.columns / 2), config.columns);
  }
  
  gridLayout.column(columns);
}

/**
 * Show enhanced widget picker with dynamic module loading
 */
async function showWidgetPicker() {
  try {
    // Get available modules from module loader
    const availableModules = moduleLoader.getAvailableModules();
    const loadedModules = moduleLoader.getLoadedModules();
    
    // Group modules by category
    const modulesByCategory = {};
    availableModules.forEach(module => {
      const category = module.category || 'general';
      if (!modulesByCategory[category]) {
        modulesByCategory[category] = [];
      }
      modulesByCategory[category].push(module);
    });
    
    // Create category tabs
    const categories = Object.keys(modulesByCategory);
    const categoryTabs = categories.map(cat => 
      `<button class="btn btn-outline-primary ${cat === 'data' ? 'active' : ''}" data-category="${cat}">
        ${cat.charAt(0).toUpperCase() + cat.slice(1)}
      </button>`
    ).join('');
    
    // Create module grid
    let moduleGrid = '';
    for (const [category, modules] of Object.entries(modulesByCategory)) {
      const moduleItems = modules.map(module => {
        const isLoaded = loadedModules.includes(module.type);
        const loadingIndicator = isLoaded ? '' : '<div class="module-load-indicator">Will load on add</div>';
        
        return `
          <div class="widget-picker-item" data-type="${module.type}" data-category="${category}">
            <div class="widget-picker-icon">
              <i class="${getWidgetIcon(module.type)}"></i>
              ${isLoaded ? '<div class="loaded-badge">Ready</div>' : ''}
            </div>
            <h5>${module.name}</h5>
            <p>${module.description || `${module.name} widget`}</p>
            ${loadingIndicator}
            <div class="widget-picker-actions">
              <button class="btn btn-primary btn-sm add-widget-btn" data-type="${module.type}">
                <i class="fas fa-plus me-1"></i> Add
              </button>
            </div>
          </div>
        `;
      }).join('');
      
      moduleGrid += `
        <div class="widget-category-group" data-category="${category}" style="${category === 'data' ? '' : 'display: none;'}">
          ${moduleItems}
        </div>
      `;
    }
    
    const modal = createEnhancedModal('Add Widget', `
      <div class="widget-picker">
        <div class="widget-categories mb-3">
          ${categoryTabs}
        </div>
        
        <div class="widget-grid">
          ${moduleGrid}
        </div>
        
        <div class="picker-footer">
          <div class="performance-info">
            <small class="text-muted">
              ${loadedModules.length}/${availableModules.length} modules loaded
            </small>
          </div>
        </div>
      </div>
    `, 'large');
    
    // Category filtering
    modal.querySelectorAll('.widget-categories button').forEach(btn => {
      btn.addEventListener('click', function() {
        modal.querySelectorAll('.widget-categories button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const category = this.dataset.category;
        modal.querySelectorAll('.widget-category-group').forEach(group => {
          group.style.display = group.dataset.category === category ? '' : 'none';
        });
      });
    });
    
    // Widget selection with dynamic loading
    modal.querySelectorAll('.add-widget-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const type = this.dataset.type;
        const originalText = this.innerHTML;
        
        try {
          // Show loading state
          this.disabled = true;
          this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Loading...';
          
          // Ensure module is loaded
          if (!moduleLoader.isModuleLoaded(type)) {
            await moduleLoader.loadOnDemand(type);
          }
          
          // Close modal and add widget
          closeModal(modal);
          await addNewWidget(type);
          
        } catch (error) {
          console.error('Failed to add widget:', error);
          showToast(`Failed to add ${type} widget: ${error.message}`, 'error');
          
          // Restore button state
          this.disabled = false;
          this.innerHTML = originalText;
        }
      });
    });
    
  } catch (error) {
    console.error('Failed to show widget picker:', error);
    showToast('Failed to load widget picker', 'error');
  }
}

/**
 * Add a new widget with dynamic module loading
 */
async function addNewWidget(type) {
  try {
    // Ensure module is loaded
    if (!moduleLoader.isModuleLoaded(type)) {
      console.log(`Loading module on-demand: ${type}`);
      await moduleLoader.loadOnDemand(type);
    }
    
    // Verify widget is registered
    if (!window.WidgetRegistry || !window.WidgetRegistry.get(type)) {
      throw new Error(`Widget type ${type} not properly registered`);
    }
    
    // Create widget instance
    const widgetId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const widget = new WidgetBase(widgetId, type, {}, {});
    
    if (!widget) {
      throw new Error('Failed to create widget instance');
    }
    
    const element = widget.createElement();
    
    if (gridLayout) {
      const size = getDefaultWidgetSize(type);
      gridLayout.addWidget(element, {
        w: size.w,
        h: size.h,
        autoPosition: true
      });
    } else {
      document.getElementById('dashboard-grid').appendChild(element);
    }
    
    widgetInstances.set(widget.id, widget);
    
    // Load widget data
    await widget.loadData();
    
    saveDashboardLayout();
    
    const moduleInfo = moduleLoader.getModuleInfo(type);
    showToast(`${moduleInfo?.name || type} widget added`, 'success');
    
  } catch (error) {
    console.error('Error adding widget:', error);
    showToast(`Failed to add widget: ${error.message}`, 'error');
  }
}

/**
 * Load default dashboard with available modules
 */
async function loadDefaultDashboard() {
  try {
    console.log('📄 Loading default dashboard...');
    
    // Get available loaded modules
    const loadedModules = moduleLoader.getLoadedModules();
    
    if (loadedModules.length === 0) {
      console.warn('No modules loaded, showing empty dashboard');
      showEmptyDashboardMessage();
      return;
    }
    
    // Create default widgets from loaded modules
    const defaultWidgets = [];
    const defaultConfigs = {
      weather: { location: 'New York', detailLevel: 'normal' },
      stocks: { symbol: 'AAPL', detailLevel: 'normal' },
      crypto: { coin: 'bitcoin', detailLevel: 'normal' },
      countdown: { title: 'New Year 2026', targetDate: '2026-01-01T00:00:00', detailLevel: 'compact' },
      notes: { content: 'Welcome to your dashboard!\n\n• Fully customizable widgets\n• Multiple themes\n• Responsive layout\n• ESP32 support', detailLevel: 'compact' },
      todo: { items: [], detailLevel: 'compact' }
    };
    
    // Add widgets for loaded modules (max 6 for default dashboard)
    const layoutPositions = [
      { x: 0, y: 0, w: 4, h: 3 },
      { x: 4, y: 0, w: 4, h: 3 },
      { x: 8, y: 0, w: 4, h: 3 },
      { x: 0, y: 3, w: 6, h: 2 },
      { x: 6, y: 3, w: 6, h: 2 },
      { x: 0, y: 5, w: 4, h: 3 }
    ];
    
    let positionIndex = 0;
    for (const moduleType of loadedModules.slice(0, 6)) {
      const widgetId = `${moduleType}-default`;
      const config = defaultConfigs[moduleType] || {};
      const layout = layoutPositions[positionIndex] || { x: 0, y: positionIndex * 3, w: 4, h: 3 };
      
      defaultWidgets.push({
        id: widgetId,
        type: moduleType,
        config,
        layout
      });
      
      positionIndex++;
    }
    
    await renderDashboard(defaultWidgets);
    console.log('✅ Default dashboard loaded');
    
  } catch (error) {
    console.error('Failed to load default dashboard:', error);
    showFallbackErrorInterface(error);
  }
}

/**
 * Show empty dashboard message
 */
function showEmptyDashboardMessage() {
  const gridContainer = document.getElementById('dashboard-grid');
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div class="empty-dashboard">
        <div class="empty-dashboard-content">
          <i class="fas fa-puzzle-piece fa-4x text-muted mb-3"></i>
          <h3>No Widgets Available</h3>
          <p class="text-muted">Modules are still loading. Please wait or refresh the page.</p>
          <button class="btn btn-primary" onclick="location.reload()">
            <i class="fas fa-sync-alt me-1"></i> Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * Render dashboard with widgets
 */
async function renderDashboard(widgets) {
  if (gridLayout) {
    gridLayout.removeAll();
  } else {
    document.getElementById('dashboard-grid').innerHTML = '';
  }
  widgetInstances.clear();
  
  const renderPromises = widgets.map(async (widgetData) => {
    try {
      // Ensure module is loaded for this widget
      if (!moduleLoader.isModuleLoaded(widgetData.type)) {
        console.log(`Loading module for widget: ${widgetData.type}`);
        await moduleLoader.loadOnDemand(widgetData.type);
      }
      
      const widget = new WidgetBase(
        widgetData.id,
        widgetData.type,
        widgetData.config,
        widgetData.layout
      );
      
      const element = widget.createElement();
      
      if (gridLayout) {
        gridLayout.addWidget(element, {
          x: widgetData.layout.x,
          y: widgetData.layout.y,
          w: widgetData.layout.w,
          h: widgetData.layout.h,
          id: widgetData.id
        });
      } else {
        document.getElementById('dashboard-grid').appendChild(element);
      }
      
      widgetInstances.set(widget.id, widget);
      
      // Load widget data
      await widget.loadData();
      
    } catch (error) {
      console.error(`Failed to render widget ${widgetData.type}:`, error);
      // Continue with other widgets even if one fails
    }
  });
  
  // Wait for all widgets to render
  await Promise.allSettled(renderPromises);
}

/**
 * Load user dashboard
 */
async function loadUserDashboard() {
  try {
    if (!authToken) {
      loadDefaultDashboard();
      return;
    }
    
    const response = await fetch('/api/dashboards/current', {
      headers: {
        'x-auth-token': authToken
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.layout && data.layout.length > 0) {
        await renderDashboard(data.layout);
        return;
      }
    }
    
    const savedLayout = localStorage.getItem(`dashboard-layout-${currentUser?.id}`);
    if (savedLayout) {
      const widgets = JSON.parse(savedLayout);
      await renderDashboard(widgets);
    } else {
      await loadDefaultDashboard();
    }
  } catch (error) {
    console.error('Error loading user dashboard:', error);
    await loadDefaultDashboard();
  }
}

/**
 * Save dashboard layout - FIXED for GridStack compatibility
 */
function saveDashboardLayout() {
  const widgets = [];
  
  widgetInstances.forEach((widget, id) => {
    let layout = widget.layout;
    
    if (gridLayout) {
      // Use the correct GridStack API - save() method
      const gridData = gridLayout.save();
      const gridWidget = gridData.find(item => 
        item.id === widget.id || 
        (item.el && item.el.dataset && item.el.dataset.id === widget.id)
      );
      
      if (gridWidget) {
        layout = {
          x: gridWidget.x || 0,
          y: gridWidget.y || 0,
          w: gridWidget.w || 4,
          h: gridWidget.h || 3
        };
      }
    }
    
    widgets.push({
      id: widget.id,
      type: widget.type,
      config: widget.config,
      layout: layout
    });
  });
  
  localStorage.setItem('dashboard-layout', JSON.stringify(widgets));
  
  if (authToken && currentUser) {
    localStorage.setItem(`dashboard-layout-${currentUser.id}`, JSON.stringify(widgets));
    
    fetch('/api/dashboards/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': authToken
      },
      body: JSON.stringify({ layout: widgets })
    }).catch(error => {
      console.error('Failed to save to server:', error);
    });
  }
}

/**
 * Remove a widget
 */
function removeWidget(id) {
  const widget = widgetInstances.get(id);
  if (!widget) return;
  
  if (gridLayout) {
    gridLayout.removeWidget(widget.element);
  } else {
    widget.element.remove();
  }
  
  widgetInstances.delete(id);
  localStorage.removeItem(`widget-config-${id}`);
  saveDashboardLayout();
}

/**
 * Setup auto-refresh
 */
function setupAutoRefresh() {
  if (CONFIG.refreshInterval > 0) {
    setInterval(() => {
      widgetInstances.forEach(widget => {
        widget.refresh();
      });
    }, CONFIG.refreshInterval);
  }
}

/**
 * Show fallback error interface
 */
function showFallbackErrorInterface(error) {
  const gridContainer = document.getElementById('dashboard-grid');
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div class="error-dashboard">
        <div class="error-dashboard-content">
          <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
          <h3>Dashboard Failed to Load</h3>
          <p class="text-muted">${error.message || 'An unexpected error occurred'}</p>
          <div class="error-actions">
            <button class="btn btn-primary me-2" onclick="location.reload()">
              <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
            <button class="btn btn-outline-secondary" onclick="localStorage.clear(); location.reload()">
              <i class="fas fa-trash me-1"></i> Reset & Retry
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Utility functions
 */
function createEnhancedModal(title, content, size = 'normal') {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.modal-close').addEventListener('click', () => {
    closeModal(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
  
  return modal;
}

function closeModal(modal) {
  if (modal && modal.parentNode) {
    modal.classList.add('fade-out');
    setTimeout(() => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }, 150);
  }
}

function getWidgetIcon(type) {
  const iconMap = {
    'weather': 'fas fa-cloud-sun',
    'stocks': 'fas fa-chart-line',
    'crypto': 'fab fa-bitcoin',
    'countdown': 'fas fa-hourglass-half',
    'notes': 'fas fa-sticky-note',
    'todo': 'fas fa-tasks'
  };
  return iconMap[type] || 'fas fa-puzzle-piece';
}

function getDefaultWidgetSize(type) {
  const sizes = {
    'weather': { w: 4, h: 3 },
    'stocks': { w: 4, h: 3 },
    'crypto': { w: 4, h: 3 },
    'countdown': { w: 6, h: 2 },
    'notes': { w: 6, h: 4 },
    'todo': { w: 4, h: 4 }
  };
  return sizes[type] || { w: 4, h: 3 };
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('auth-token');
  updateAuthUI(false);
  loadDefaultDashboard();
  showToast('Logged out successfully');
}

function showProfileModal() {
  showToast('Profile functionality coming soon', 'info');
}

function showSavedDashboardsModal() {
  showToast('Saved dashboards functionality coming soon', 'info');
}

function showThemeSelector() {
  // Implementation for theme selection (placeholder)
  showToast('Theme selector coming soon', 'info');
}

function showLayoutSelector() {
  // Implementation for layout selection (placeholder)
  showToast('Layout selector coming soon', 'info');
}

function showSettingsModal() {
  const modal = createEnhancedModal('Dashboard Settings', `
    <form id="settings-form">
      <div class="form-group mb-3">
        <label for="refresh-interval" class="form-label">Auto-refresh Interval</label>
        <select class="form-control" id="refresh-interval" name="refreshInterval">
          <option value="0" ${CONFIG.refreshInterval === 0 ? 'selected' : ''}>Disabled</option>
          <option value="30000" ${CONFIG.refreshInterval === 30000 ? 'selected' : ''}>30 seconds</option>
          <option value="60000" ${CONFIG.refreshInterval === 60000 ? 'selected' : ''}>1 minute</option>
          <option value="300000" ${CONFIG.refreshInterval === 300000 ? 'selected' : ''}>5 minutes</option>
        </select>
      </div>
      
      <div class="form-group mb-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="animations" ${CONFIG.animations ? 'checked' : ''}>
          <label class="form-check-label" for="animations">Enable animations</label>
        </div>
      </div>
      
      <div class="form-group mb-3">
        <h5>Module Performance</h5>
        <div id="module-performance"></div>
      </div>
      
      <div class="d-flex justify-content-between">
        <button type="button" class="btn btn-outline-danger" id="reset-dashboard">Reset Dashboard</button>
        <div>
          <button type="button" class="btn btn-outline-secondary me-2" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </div>
    </form>
  `);
  
  // Show module performance
  const performanceDiv = modal.querySelector('#module-performance');
  if (performanceDiv) {
    const metrics = moduleLoader.getPerformanceMetrics();
    performanceDiv.innerHTML = `
      <div class="performance-metrics">
        <div class="metric">
          <span class="metric-label">Loaded Modules:</span>
          <span class="metric-value">${metrics.loadedModules}/${metrics.totalModules}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Average Load Time:</span>
          <span class="metric-value">${metrics.averageLoadTime}ms</span>
        </div>
        ${metrics.erroredModules > 0 ? `
          <div class="metric">
            <span class="metric-label">Failed Modules:</span>
            <span class="metric-value text-danger">${metrics.erroredModules}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Event handlers
  modal.querySelector('[data-close-modal]').addEventListener('click', () => {
    closeModal(modal);
  });
  
  modal.querySelector('#reset-dashboard').addEventListener('click', () => {
    if (confirm('Reset dashboard to default?')) {
      localStorage.removeItem('dashboard-layout');
      loadDefaultDashboard();
      closeModal(modal);
      showToast('Dashboard reset', 'success');
    }
  });
  
  modal.querySelector('#settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    CONFIG.refreshInterval = parseInt(formData.get('refreshInterval'));
    CONFIG.animations = formData.has('animations');
    
    localStorage.setItem('refresh-interval', CONFIG.refreshInterval);
    localStorage.setItem('animations', CONFIG.animations);
    
    if (gridLayout) {
      gridLayout.animate(CONFIG.animations);
    }
    
    closeModal(modal);
    showToast('Settings saved', 'success');
  });
}

// Export for use by other modules
window.dashboardApp = {
  widgetInstances,
  gridLayout,
  CONFIG,
  currentUser,
  authToken,
  moduleLoader,
  showToast,
  createEnhancedModal,
  saveDashboardLayout,
  updateAuthUI,
  closeModal,
  isAppInitialized: () => isAppInitialized
};
