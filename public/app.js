/**
 * Enhanced Dashboard Application
 * Clean, organized structure with clear separation of concerns
 */

class EnhancedDashboard {
  constructor() {
    this.grid = null;
    this.widgets = new Map();
    this.theme = localStorage.getItem('dashboard-theme') || 'light';
    this.widgetCounter = 0;
    this.currentUser = null;
    this.esp32Devices = new Map();
    
    this.checkAuth();
  }

  // ==================== AUTHENTICATION ====================
  
  checkAuth() {
    const token = localStorage.getItem('dashboard-token');
    const userData = localStorage.getItem('dashboard-user');
    
    if (token && userData) {
      try {
        this.currentUser = JSON.parse(userData);
        this.showDashboard();
        this.init();
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.showAuth();
      }
    } else {
      this.showAuth();
    }
  }
  
  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    this.setupAuthListeners();
  }
  
  showDashboard() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('user-email').textContent = this.currentUser?.email || 'user@example.com';
  }
  
  setupAuthListeners() {
    const authForm = document.getElementById('auth-form');
    const authSwitch = document.getElementById('auth-switch');
    let isSignUp = false;
    
    const toggleAuthMode = (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      this.updateAuthUI(isSignUp);
      document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    };
    
    authSwitch.addEventListener('click', toggleAuthMode);
    authForm.addEventListener('submit', (e) => this.handleAuth(e, isSignUp));
  }

  updateAuthUI(isSignUp) {
    const elements = {
      title: document.getElementById('auth-title'),
      subtitle: document.getElementById('auth-subtitle'),
      submit: document.getElementById('auth-submit'),
      switchText: document.getElementById('auth-switch-text'),
      confirmGroup: document.getElementById('confirm-password-group')
    };
    
    if (isSignUp) {
      elements.title.textContent = 'Sign Up';
      elements.subtitle.textContent = 'Create your dashboard account';
      elements.submit.innerHTML = '<i class="fas fa-user-plus"></i><span>Sign Up</span>';
      elements.switchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Sign in</a>';
      elements.confirmGroup.classList.remove('hidden');
    } else {
      elements.title.textContent = 'Sign In';
      elements.subtitle.textContent = 'Access your personalized dashboard';
      elements.submit.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Sign In</span>';
      elements.switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
      elements.confirmGroup.classList.add('hidden');
    }
  }

  async handleAuth(e, isSignUp) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (isSignUp && password !== confirmPassword) {
      this.showToast('Passwords do not match', 'error');
      return;
    }
    
    try {
      const userData = { email, id: Date.now() };
      const token = 'mock-token-' + Date.now();
      
      localStorage.setItem('dashboard-token', token);
      localStorage.setItem('dashboard-user', JSON.stringify(userData));
      
      this.currentUser = userData;
      this.showDashboard();
      this.init();
      
      this.showToast(isSignUp ? 'Account created successfully!' : 'Welcome back!', 'success');
    } catch (error) {
      this.showToast('Authentication failed', 'error');
    }
  }

  logout() {
    localStorage.removeItem('dashboard-token');
    localStorage.removeItem('dashboard-user');
    this.currentUser = null;
    this.widgets.clear();
    if (this.grid) this.grid.removeAll();
    this.showAuth();
    this.showToast('Logged out successfully', 'info');
  }

  // ==================== INITIALIZATION ====================
  
  init() {
    this.initializeTheme();
    this.initializeGrid();
    this.setupEventListeners();
    this.loadLayout();
    this.loadESP32Devices();
    this.checkEmptyState();
    this.startAutoRefresh();
  }
  
  initializeTheme() {
    document.body.dataset.theme = this.theme;
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
  
  initializeGrid() {
    this.grid = GridStack.init({
      cellHeight: 100,
      margin: 16,
      float: false,
      animate: true,
      resizable: { handles: 'se' },
      draggable: { handle: '.widget-header' }
    });
    
    this.grid.on('change', () => this.saveLayout());
  }

  // ==================== EVENT LISTENERS ====================
  
  setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    
    // Widget management
    document.getElementById('add-widget')?.addEventListener('click', () => this.showWidgetPicker());
    document.getElementById('add-first-widget')?.addEventListener('click', () => this.showWidgetPicker());
    document.getElementById('reset-layout')?.addEventListener('click', () => this.resetLayout());
    
    // User menu
    document.getElementById('user-menu-button')?.addEventListener('click', () => this.toggleUserMenu());
    document.getElementById('logout')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    document.getElementById('manage-esp32')?.addEventListener('click', (e) => { e.preventDefault(); this.showESP32Modal(); });
    
    // Modal controls
    document.getElementById('close-picker')?.addEventListener('click', () => this.hideWidgetPicker());
    document.getElementById('close-config')?.addEventListener('click', () => this.hideConfigModal());
    document.getElementById('close-esp32')?.addEventListener('click', () => this.hideESP32Modal());
    
    // Widget picker
    document.querySelectorAll('.widget-option').forEach(option => {
      option.addEventListener('click', () => this.configureAndAddWidget(option.dataset.type));
    });
    
    // Close dropdowns/modals on outside click
    this.setupOutsideClickHandlers();
  }

  setupOutsideClickHandlers() {
    // User menu
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        document.getElementById('user-dropdown').classList.remove('show');
      }
    });
    
    // Modals
    ['widget-picker', 'widget-config-modal', 'esp32-modal'].forEach(modalId => {
      document.getElementById(modalId)?.addEventListener('mousedown', (e) => {
        if (e.target.id === modalId) {
          e.preventDefault();
          this[`hide${modalId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`]();
        }
      });
    });
    
    // Modal content shouldn't close modals
    document.querySelectorAll('.modal-content').forEach(content => {
      content.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = this.theme;
    localStorage.setItem('dashboard-theme', this.theme);
    
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    this.showToast(`Switched to ${this.theme} theme`, 'info');
  }

  toggleUserMenu() {
    document.getElementById('user-dropdown').classList.toggle('show');
  }

  resetLayout() {
    if (confirm('Reset layout? This will remove all widgets.')) {
      this.widgets.forEach((widget) => this.grid.removeWidget(widget.element));
      this.widgets.clear();
      if (this.currentUser) {
        localStorage.removeItem(`dashboard-layout-${this.currentUser.id}`);
      }
      this.widgetCounter = 0;
      this.checkEmptyState();
      this.showToast('Layout reset', 'info');
    }
  }

  // ==================== MODAL MANAGEMENT ====================
  
  showWidgetPicker() {
    document.getElementById('widget-picker').classList.remove('hidden');
  }
  
  hideWidgetPicker() {
    document.getElementById('widget-picker').classList.add('hidden');
  }
  
  showConfigModal() {
    document.getElementById('widget-config-modal').classList.remove('hidden');
  }
  
  hideConfigModal() {
    document.getElementById('widget-config-modal').classList.add('hidden');
  }
  
  showESP32Modal() {
    this.renderESP32Devices();
    document.getElementById('esp32-modal').classList.remove('hidden');
    document.getElementById('add-esp32').onclick = () => this.addESP32Device();
  }
  
  hideESP32Modal() {
    document.getElementById('esp32-modal').classList.add('hidden');
  }

  // ==================== WIDGET CONFIGURATION ====================
  
  async configureAndAddWidget(type) {
    this.hideWidgetPicker();
    
    if (['weather', 'crypto', 'stocks', 'sports', 'countdown'].includes(type)) {
      await this.showWidgetConfiguration(type);
    } else {
      this.addWidget(type);
    }
  }
  
  async showWidgetConfiguration(type) {
    document.getElementById('config-title').textContent = `Configure ${this.getWidgetName(type)} Widget`;
    document.getElementById('config-content').innerHTML = this.getConfigHTML(type);
    this.showConfigModal();
    this.setupConfigLogic(type);
  }

  getConfigHTML(type) {
    const configs = {
      weather: `
        <div class="form-group">
          <label class="form-label">City</label>
          <div style="position: relative;">
            <input type="text" id="weather-search" class="form-input" placeholder="Search for a city..." autocomplete="off">
            <div id="weather-results" class="search-dropdown"></div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Temperature Unit</label>
          <select id="weather-units" class="form-input">
            <option value="imperial">Fahrenheit (°F)</option>
            <option value="metric">Celsius (°C)</option>
          </select>
        </div>
        <div class="form-group">
          <button id="save-weather-config" class="btn btn-primary">
            <i class="fas fa-save"></i> Add Weather Widget
          </button>
        </div>
      `,
      crypto: `
        <div class="form-group">
          <label class="form-label">Cryptocurrencies</label>
          <div style="position: relative;">
            <input type="text" id="crypto-search" class="form-input" placeholder="Search cryptocurrencies..." autocomplete="off">
            <div id="crypto-results" class="search-dropdown-large"></div>
          </div>
          <div id="selected-cryptos" class="selected-items"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select id="crypto-currency" class="form-input">
            <option value="usd">USD ($)</option>
            <option value="eur">EUR (€)</option>
            <option value="btc">BTC (₿)</option>
          </select>
        </div>
        <div class="form-group">
          <button id="save-crypto-config" class="btn btn-primary">
            <i class="fas fa-save"></i> Add Crypto Widget
          </button>
        </div>
      `,
      stocks: `
        <div class="form-group">
          <label class="form-label">Stocks</label>
          <div style="position: relative;">
            <input type="text" id="stocks-search" class="form-input" placeholder="Search stocks..." autocomplete="off">
            <div id="stocks-results" class="search-dropdown-large"></div>
          </div>
          <div id="selected-stocks" class="selected-items"></div>
        </div>
        <div class="form-group">
          <button id="save-stocks-config" class="btn btn-primary">
            <i class="fas fa-save"></i> Add Stocks Widget
          </button>
        </div>
      `,
      sports: `
        <div class="form-group">
          <label class="form-label">Sports League</label>
          <select id="sports-league" class="form-input">
            <option value="nfl">NFL</option>
            <option value="nba">NBA</option>
            <option value="mlb">MLB</option>
            <option value="nhl">NHL</option>
            <option value="soccer">Soccer/Football</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Favorite Teams</label>
          <div style="position: relative;">
            <input type="text" id="teams-search" class="form-input" placeholder="Search teams..." autocomplete="off">
            <div id="teams-results" class="search-dropdown-medium"></div>
          </div>
          <div id="selected-teams" class="selected-items"></div>
        </div>
        <div class="form-group">
          <button id="save-sports-config" class="btn btn-primary">
            <i class="fas fa-save"></i> Add Sports Widget
          </button>
        </div>
      `,
      countdown: `
        <div class="form-group">
          <label class="form-label">Event Title</label>
          <input type="text" id="countdown-title" class="form-input" placeholder="New Year 2026" value="New Year 2026">
        </div>
        <div class="form-group">
          <label class="form-label">Target Date</label>
          <input type="date" id="countdown-date" class="form-input" value="2025-12-31">
        </div>
        <div class="form-group">
          <label class="form-label">Target Time</label>
          <input type="time" id="countdown-time" class="form-input" value="23:59">
        </div>
        <div class="form-group">
          <button id="save-countdown-config" class="btn btn-primary">
            <i class="fas fa-save"></i> Add Countdown Widget
          </button>
        </div>
      `
    };
    
    return configs[type] || '';
  }

  setupConfigLogic(type) {
    const handlers = {
      weather: () => this.setupSearchConfig('weather', 'cities', 'weather-search', 'weather-results', 'save-weather-config'),
      crypto: () => this.setupMultiSelectConfig('crypto', 'crypto-search', 'crypto-results', 'selected-cryptos', 'save-crypto-config'),
      stocks: () => this.setupMultiSelectConfig('stocks', 'stocks-search', 'stocks-results', 'selected-stocks', 'save-stocks-config'),
      sports: () => this.setupSportsConfig(),
      countdown: () => this.setupCountdownConfig()
    };
    
    handlers[type]?.();
  }

  // ==================== WIDGET MANAGEMENT ====================
  
  async addWidget(type, config = {}, gridOptions = {}) {
    const widgetInfo = this.getWidgetInfo(type);
    if (!widgetInfo) {
      this.showToast(`Widget type "${type}" not found`, 'error');
      return;
    }
    
    const widgetId = `widget-${type}-${++this.widgetCounter}`;
    const widgetEl = this.createWidgetElement(widgetId, type, widgetInfo);
    
    this.addToGrid(widgetEl, widgetInfo, gridOptions);
    this.setupWidgetActions(widgetEl);
    this.storeWidget(widgetId, type, config, widgetEl);
    this.loadWidgetData(widgetId);
    this.checkEmptyState();
    
    this.showToast(`Added ${widgetInfo.name} widget`, 'success');
  }

  createWidgetElement(widgetId, type, widgetInfo) {
    const widgetEl = document.createElement('div');
    widgetEl.className = `widget ${type}-widget`;
    widgetEl.dataset.widgetId = widgetId;
    widgetEl.dataset.widgetType = type;
    
    widgetEl.innerHTML = `
      <div class="widget-header">
        <div class="widget-title">
          <i class="${widgetInfo.icon}"></i>
          <span>${widgetInfo.name}</span>
        </div>
        <div class="widget-actions">
          <button class="widget-action refresh-widget" title="Refresh">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="widget-action configure-widget" title="Configure">
            <i class="fas fa-cog"></i>
          </button>
          <button class="widget-action remove-widget" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="widget-content">
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    `;
    
    return widgetEl;
  }

  addToGrid(widgetEl, widgetInfo, gridOptions) {
    const defaultSize = widgetInfo.defaultSize || { w: 4, h: 3 };
    this.grid.addWidget(widgetEl, {
      w: gridOptions.w || defaultSize.w,
      h: gridOptions.h || defaultSize.h,
      x: gridOptions.x,
      y: gridOptions.y,
      autoPosition: !gridOptions.x && !gridOptions.y
    });
  }

  setupWidgetActions(widgetEl) {
    const widgetId = widgetEl.dataset.widgetId;
    
    widgetEl.querySelector('.refresh-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadWidgetData(widgetId);
    });
    
    widgetEl.querySelector('.configure-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.configureWidget(widgetId);
    });
    
    widgetEl.querySelector('.remove-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeWidget(widgetId);
    });
  }

  storeWidget(widgetId, type, config, element) {
    this.widgets.set(widgetId, {
      id: widgetId,
      type: type,
      config: config,
      element: element
    });
  }

  configureWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      this.showWidgetConfiguration(widget.type);
    }
  }

  removeWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    const widgetInfo = this.getWidgetInfo(widget.type);
    if (confirm(`Remove ${widgetInfo.name} widget?`)) {
      this.grid.removeWidget(widget.element);
      this.widgets.delete(widgetId);
      this.checkEmptyState();
      this.saveLayout();
      this.showToast('Widget removed', 'info');
    }
  }

  // ==================== DATA & RENDERING ====================
  
  async loadWidgetData(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    const contentEl = widget.element.querySelector('.widget-content');
    
    try {
      contentEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading...</span></div>';
      const data = await this.fetchWidgetData(widget.type, widget.config);
      this.renderWidget(widget.type, contentEl, data);
    } catch (error) {
      console.error(`Error loading widget ${widget.type}:`, error);
      contentEl.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load data</p>
          <button class="btn btn-ghost" onclick="dashboard.loadWidgetData('${widgetId}')">Retry</button>
        </div>
      `;
      this.showToast(`Failed to load ${this.getWidgetName(widget.type)}`, 'error');
    }
  }

  async fetchWidgetData(type, config) {
    const baseUrl = window.location.origin;
    const fetchers = {
      weather: () => this.fetchWeatherData(baseUrl, config),
      crypto: () => this.fetchCryptoData(baseUrl, config),
      stocks: () => this.fetchStocksData(baseUrl, config),
      sports: () => this.fetchSportsData(baseUrl, config),
      countdown: () => this.fetchCountdownData(baseUrl, config),
      notes: () => ({ title: config.title || 'Notes', content: config.content || '' }),
      todo: () => ({ title: config.title || 'Todo List', items: [] })
    };
    
    return fetchers[type]?.() || Promise.reject(new Error('Unknown widget type'));
  }

  // ==================== UTILITY METHODS ====================
  
  getWidgetInfo(type) {
    const widgets = {
      weather: { name: 'Weather', icon: 'fas fa-cloud-sun', defaultSize: { w: 4, h: 3 } },
      crypto: { name: 'Crypto', icon: 'fab fa-bitcoin', defaultSize: { w: 4, h: 3 } },
      stocks: { name: 'Stocks', icon: 'fas fa-chart-line', defaultSize: { w: 4, h: 3 } },
      sports: { name: 'Sports', icon: 'fas fa-futbol', defaultSize: { w: 4, h: 3 } },
      countdown: { name: 'Countdown', icon: 'fas fa-hourglass-half', defaultSize: { w: 6, h: 3 } },
      notes: { name: 'Notes', icon: 'fas fa-sticky-note', defaultSize: { w: 4, h: 4 } },
      todo: { name: 'Todo', icon: 'fas fa-tasks', defaultSize: { w: 4, h: 4 } }
    };
    return widgets[type];
  }

  getWidgetName(type) {
    return this.getWidgetInfo(type)?.name || type;
  }

  formatNumber(num) {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  }

  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.parentNode?.removeChild(toast), 300);
      }
    }, 3000);
  }

  checkEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const hasWidgets = this.widgets.size > 0;
    
    if (emptyState) {
      emptyState.classList.toggle('hidden', hasWidgets);
    }
  }

  // ==================== LAYOUT MANAGEMENT ====================
  
  saveLayout() {
    if (!this.currentUser) return;
    
    const layout = [];
    this.widgets.forEach((widget) => {
      if (widget.element?.gridstackNode) {
        const gridNode = widget.element.gridstackNode;
        layout.push({
          id: widget.id,
          type: widget.type,
          config: widget.config,
          x: gridNode.x,
          y: gridNode.y,
          w: gridNode.w,
          h: gridNode.h
        });
      }
    });
    
    localStorage.setItem(`dashboard-layout-${this.currentUser.id}`, JSON.stringify(layout));
  }

  loadLayout() {
    if (!this.currentUser) return;
    
    const saved = localStorage.getItem(`dashboard-layout-${this.currentUser.id}`);
    if (!saved) return;
    
    try {
      const layout = JSON.parse(saved);
      layout.sort((a, b) => a.y - b.y || a.x - b.x);
      
      layout.forEach(item => {
        this.addWidget(item.type, item.config, {
          x: item.x, y: item.y, w: item.w, h: item.h
        });
      });
    } catch (error) {
      console.error('Error loading layout:', error);
      this.showToast('Error loading saved layout', 'error');
    }
  }

  // ==================== AUTO REFRESH ====================
  
  startAutoRefresh() {
    setInterval(() => {
      this.widgets.forEach((widget, widgetId) => {
        if (!['notes', 'todo'].includes(widget.type)) {
          this.loadWidgetData(widgetId);
        }
      });
    }, 5 * 60 * 1000);
  }

  // ==================== ESP32 MANAGEMENT ====================
  
  loadESP32Devices() {
    if (!this.currentUser) return;
    
    const saved = localStorage.getItem(`esp32-devices-${this.currentUser.id}`);
    if (saved) {
      try {
        const devices = JSON.parse(saved);
        devices.forEach(device => this.esp32Devices.set(device.id, device));
      } catch (error) {
        console.error('Error loading ESP32 devices:', error);
      }
    }
  }

  renderESP32Devices() {
    const container = document.getElementById('esp32-devices');
    const devices = Array.from(this.esp32Devices.values());
    
    if (devices.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No ESP32 devices registered</p>';
    } else {
      container.innerHTML = devices.map(device => `
        <div class="esp32-device">
          <div>
            <div style="font-weight: 600;">${device.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${device.id}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Added: ${new Date(device.dateAdded).toLocaleDateString()}</div>
          </div>
          <button class="remove-item" onclick="dashboard.removeESP32Device('${device.id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
    }
  }

  addESP32Device() {
    const nameInput = document.getElementById('device-name');
    const idInput = document.getElementById('device-id');
    
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    
    if (!name || !id) {
      this.showToast('Please enter both device name and ID', 'error');
      return;
    }
    
    if (this.esp32Devices.has(id)) {
      this.showToast('Device ID already exists', 'error');
      return;
    }
    
    const device = {
      id, name,
      dateAdded: new Date().toISOString(),
      userId: this.currentUser.id
    };
    
    this.esp32Devices.set(id, device);
    this.saveESP32Devices();
    this.renderESP32Devices();
    
    nameInput.value = '';
    idInput.value = '';
    
    this.showToast(`Device "${name}" registered successfully`, 'success');
  }

  removeESP32Device(deviceId) {
    const device = this.esp32Devices.get(deviceId);
    if (!device) return;
    
    if (confirm(`Remove device "${device.name}"?`)) {
      this.esp32Devices.delete(deviceId);
      this.saveESP32Devices();
      this.renderESP32Devices();
      this.showToast('Device removed', 'info');
    }
  }

  saveESP32Devices() {
    if (!this.currentUser) return;
    const devices = Array.from(this.esp32Devices.values());
    localStorage.setItem(`esp32-devices-${this.currentUser.id}`, JSON.stringify(devices));
  }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof GridStack === 'undefined') {
    console.error('GridStack failed to load!');
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 2rem;">
        <div>
          <h1 style="color: var(--error); margin-bottom: 1rem;">Error: GridStack library failed to load</h1>
          <p style="color: var(--text-muted);">Please check your internet connection and refresh the page.</p>
        </div>
      </div>
    `;
    return;
  }
  
  window.dashboard = new EnhancedDashboard();
  console.log('🚀 Enhanced Dashboard initialized');
});

// ==================== GLOBAL ERROR HANDLING ====================

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  if (window.dashboard) {
    dashboard.showToast('An error occurred', 'error');
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  if (window.dashboard) {
    dashboard.showToast('An error occurred', 'error');
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.dashboard && dashboard.currentUser) {
    setTimeout(() => {
      dashboard.widgets.forEach((widget, widgetId) => {
        if (!['notes', 'todo'].includes(widget.type)) {
          dashboard.loadWidgetData(widgetId);
        }
      });
    }, 1000);
  }
});