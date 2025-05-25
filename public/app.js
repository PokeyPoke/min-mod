/**
 * Enhanced Dashboard Application
 * Optimized for Heroku deployment with Alpha Vantage API
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

  // ===== AUTHENTICATION METHODS =====
  
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
    if (this.currentUser) { // Ensure currentUser is not null
        document.getElementById('user-email').textContent = this.currentUser.email || 'user@example.com';
    }
  }
  
  setupAuthListeners() {
    const authForm = document.getElementById('auth-form');
    const authSwitch = document.getElementById('auth-switch'); // Initial switch link
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authSubmit = document.getElementById('auth-submit');
    const authSwitchTextContainer = document.getElementById('auth-switch-text'); // Container for switch text
    const confirmPasswordGroup = document.getElementById('confirm-password-group');
    
    let isSignUp = false;
    
    const toggleAuthMode = (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      
      if (isSignUp) {
        authTitle.textContent = 'Sign Up';
        authSubtitle.textContent = 'Create your dashboard account';
        authSubmit.innerHTML = '<i class="fas fa-user-plus"></i><span>Sign Up</span>';
        authSwitchTextContainer.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Sign in</a>';
        confirmPasswordGroup.classList.remove('hidden');
      } else {
        authTitle.textContent = 'Sign In';
        authSubtitle.textContent = 'Access your personalized dashboard';
        authSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Sign In</span>';
        authSwitchTextContainer.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
        confirmPasswordGroup.classList.add('hidden');
      }
      // Re-attach listener to the new dynamically created switch link
      document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    };
    
    authSwitch.addEventListener('click', toggleAuthMode); // Attach to initial link
    
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      if (isSignUp && password !== confirmPassword) {
        this.showToast('Passwords do not match', 'error');
        return;
      }
      
      try {
        const userData = { email, id: Date.now().toString() }; // Mock user data
        const token = 'mock-token-' + Date.now(); // Mock token
        
        localStorage.setItem('dashboard-token', token);
        localStorage.setItem('dashboard-user', JSON.stringify(userData));
        
        this.currentUser = userData;
        this.showDashboard();
        this.init(); // Initialize after successful login/signup
        
        this.showToast(isSignUp ? 'Account created successfully!' : 'Welcome back!', 'success');
      } catch (error) {
        this.showToast('Authentication failed', 'error');
      }
    });
  }

  logout() {
    localStorage.removeItem('dashboard-token');
    localStorage.removeItem('dashboard-user');
    this.currentUser = null;
    this.widgets.clear();
    if (this.grid) {
      this.grid.removeAll();
    }
    this.showAuth();
    this.showToast('Logged out successfully', 'info');
  }

  // ===== INITIALIZATION METHODS =====
  
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
    if (typeof GridStack === 'undefined') {
        console.error('GridStack is not loaded!');
        this.showToast('Error: Dashboard layout system failed to load.', 'error');
        return;
    }
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

  // ===== EVENT LISTENERS =====
  
  setupEventListeners() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('add-widget')?.addEventListener('click', () => this.showWidgetPicker());
    document.getElementById('add-first-widget')?.addEventListener('click', () => this.showWidgetPicker());
    document.getElementById('reset-layout')?.addEventListener('click', () => {
      if (confirm('Reset layout? This will remove all widgets.')) this.resetLayout();
    });
    document.getElementById('user-menu-button')?.addEventListener('click', () => {
      document.getElementById('user-dropdown').classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('show');
      }
    });
    document.getElementById('logout')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    document.getElementById('manage-esp32')?.addEventListener('click', (e) => { e.preventDefault(); this.showESP32Modal(); });
    this.setupModalListeners();
    this.setupWidgetPickerListeners();
  }

  setupModalListeners() {
    document.getElementById('close-picker')?.addEventListener('click', () => this.hideWidgetPicker());
    document.getElementById('close-config')?.addEventListener('click', () => this.hideConfigModal());
    document.getElementById('close-esp32')?.addEventListener('click', () => this.hideESP32Modal());
    document.getElementById('widget-picker')?.addEventListener('click', (e) => { if (e.target.id === 'widget-picker') this.hideWidgetPicker(); });
    document.getElementById('widget-config-modal')?.addEventListener('click', (e) => { if (e.target.id === 'widget-config-modal') this.hideConfigModal(); });
    document.getElementById('esp32-modal')?.addEventListener('click', (e) => { if (e.target.id === 'esp32-modal') this.hideESP32Modal(); });
  }

  setupWidgetPickerListeners() {
    document.querySelectorAll('.widget-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.type;
        this.configureAndAddWidget(type);
      });
    });
  }

  // ===== THEME METHODS =====
  
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = this.theme;
    localStorage.setItem('dashboard-theme', this.theme);
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    this.showToast(`Switched to ${this.theme} theme`, 'info');
  }

  // ===== MODAL METHODS =====
  
  showWidgetPicker() { document.getElementById('widget-picker').classList.remove('hidden'); }
  hideWidgetPicker() { document.getElementById('widget-picker').classList.add('hidden'); }
  showConfigModal() { document.getElementById('widget-config-modal').classList.remove('hidden'); }
  hideConfigModal() { document.getElementById('widget-config-modal').classList.add('hidden'); }
  
  showESP32Modal() {
    this.renderESP32Devices();
    document.getElementById('esp32-modal').classList.remove('hidden');
    const addButton = document.getElementById('add-esp32');
    // Use a fresh listener to avoid multiple calls if modal is shown multiple times
    addButton.onclick = () => this.addESP32Device(); 
  }
  hideESP32Modal() { document.getElementById('esp32-modal').classList.add('hidden'); }

  // ===== WIDGET CONFIGURATION METHODS =====
  
  async configureAndAddWidget(type) {
    this.hideWidgetPicker();
    if (['weather', 'crypto', 'stocks', 'sports', 'countdown'].includes(type)) { // Added countdown
      await this.showWidgetConfiguration(type);
    } else {
      this.addWidget(type);
    }
  }
  
  async showWidgetConfiguration(type) {
    const configTitle = document.getElementById('config-title');
    const configContent = document.getElementById('config-content');
    configTitle.textContent = `Configure ${this.getWidgetName(type)} Widget`;
    let configHTML = '';
    switch (type) {
      case 'weather': configHTML = this.generateWeatherConfig(); break;
      case 'crypto': configHTML = this.generateCryptoConfig(); break;
      case 'stocks': configHTML = this.generateStocksConfig(); break;
      case 'sports': configHTML = this.generateSportsConfig(); break;
      case 'countdown': configHTML = this.generateCountdownConfig(); break; // Added countdown
    }
    configContent.innerHTML = configHTML;
    this.showConfigModal();
    this.setupConfigurationLogic(type);
  }

  generateWeatherConfig() { /* ... (same as before) ... */ 
    return `
      <div class="form-group">
        <label class="form-label">City</label>
        <div style="position: relative;">
          <input type="text" id="weather-search" class="form-input" placeholder="Search for a city..." autocomplete="off">
          <div id="weather-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 200px; overflow-y: auto; z-index: 1000; display: none;"></div>
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
        <button id="save-weather-config" class="btn btn-primary"><i class="fas fa-save"></i> Add Weather Widget</button>
      </div>`;
  }
  
  generateCryptoConfig() { /* ... (same as before, ensure crypto-results max-height is sufficient) ... */ 
    return `
      <div class="form-group">
        <label class="form-label">Cryptocurrencies</label>
        <div style="position: relative;">
          <input type="text" id="crypto-search" class="form-input" placeholder="Search cryptocurrencies..." autocomplete="off">
          <div id="crypto-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 400px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-cryptos" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Currency</label>
        <select id="crypto-currency" class="form-input">
          <option value="usd">USD ($)</option> <option value="eur">EUR (€)</option> <option value="btc">BTC (₿)</option>
        </select>
      </div>
      <div class="form-group">
        <button id="save-crypto-config" class="btn btn-primary"><i class="fas fa-save"></i> Add Crypto Widget</button>
      </div>`;
  }
  
  generateStocksConfig() { /* ... (same as before, ensure stocks-results max-height is sufficient) ... */ 
    return `
      <div class="form-group">
        <label class="form-label">Stocks</label>
        <div style="position: relative;">
          <input type="text" id="stocks-search" class="form-input" placeholder="Search stocks..." autocomplete="off">
          <div id="stocks-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 400px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-stocks" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
      </div>
      <div class="form-group">
        <button id="save-stocks-config" class="btn btn-primary"><i class="fas fa-save"></i> Add Stocks Widget</button>
      </div>`;
  }

  generateCountdownConfig() { // Added
    return `
      <div class="form-group">
        <label class="form-label">Event Title</label>
        <input type="text" id="countdown-title" class="form-input" placeholder="New Year 2026" value="New Year">
      </div>
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input type="date" id="countdown-date" class="form-input" value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label class="form-label">Target Time</label>
        <input type="time" id="countdown-time" class="form-input" value="23:59">
      </div>
      <div class="form-group">
        <button id="save-countdown-config" class="btn btn-primary"><i class="fas fa-save"></i> Add Countdown Widget</button>
      </div>`;
  }
  
  generateSportsConfig() { /* ... (same as before, ensure teams-results max-height is sufficient) ... */ 
    return `
      <div class="form-group">
        <label class="form-label">Sports League</label>
        <select id="sports-league" class="form-input">
          <option value="nfl">NFL</option> <option value="nba">NBA</option> <option value="mlb">MLB</option> <option value="nhl">NHL</option> <option value="soccer">Soccer/Football</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Favorite Teams</label>
        <div style="position: relative;">
          <input type="text" id="teams-search" class="form-input" placeholder="Search teams..." autocomplete="off">
          <div id="teams-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 300px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-teams" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;"></div>
      </div>
      <div class="form-group">
        <button id="save-sports-config" class="btn btn-primary"><i class="fas fa-save"></i> Add Sports Widget</button>
      </div>`;
  }

  setupConfigurationLogic(type) {
    switch (type) {
      case 'weather': this.setupWeatherConfig(); break;
      case 'crypto': this.setupCryptoConfig(); break;
      case 'stocks': this.setupStocksConfig(); break;
      case 'sports': this.setupSportsConfig(); break;
      case 'countdown': this.setupCountdownConfig(); break; // Added
    }
  }

  setupWeatherConfig() { /* ... (same as before) ... */ 
    const searchInput = document.getElementById('weather-search');
    const resultsDiv = document.getElementById('weather-results');
    const saveButton = document.getElementById('save-weather-config');
    let selectedCity = null;
    searchInput.addEventListener('input', async (e) => { /* ... */ });
    document.addEventListener('click', (e) => { if (!e.target.closest('#weather-search') && !e.target.closest('#weather-results')) resultsDiv.style.display = 'none'; });
    saveButton.addEventListener('click', () => { /* ... */ });
  }

  setupCryptoConfig() {
    const searchInput = document.getElementById('crypto-search');
    const resultsDiv = document.getElementById('crypto-results');
    const selectedDiv = document.getElementById('selected-cryptos');
    const saveButton = document.getElementById('save-crypto-config');
    
    let selectedCryptos = []; // This must be scoped here
    
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
      }
      
      try {
        const response = await fetch(`/api/search/crypto?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        const cryptos = result.data || [];
        
        // This is the updated block from the prompt
        if (cryptos.length > 0) {
          resultsDiv.innerHTML = cryptos.map(crypto => `
            <div style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: var(--transition); display: flex; justify-content: space-between; align-items: center;" 
                 data-crypto-id="${crypto.id}" 
                 onmouseover="this.style.background='var(--border-light)'" 
                 onmouseout="this.style.background='transparent'">
              <div>
                <div style="font-weight: 500;">${crypto.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${crypto.symbol.toUpperCase()}</div>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">#${crypto.marketCapRank || '?'}</div>
            </div>
          `).join('');
          
          resultsDiv.style.display = 'block';
          
          resultsDiv.querySelectorAll('[data-crypto-id]').forEach(result => {
            result.addEventListener('click', () => {
              const crypto = cryptos.find(c => c.id === result.dataset.cryptoId);
              if (crypto && !selectedCryptos.find(c => c.id === crypto.id)) {
                selectedCryptos.push(crypto);
                // Pass callback to update selectedCryptos in this scope
                this.renderSelectedItems(selectedDiv, selectedCryptos, 'crypto', (updatedItems) => {
                    selectedCryptos = updatedItems;
                });
              }
              searchInput.value = ''; // Clear search input
              resultsDiv.style.display = 'none';
            });
          });
        } else {
          resultsDiv.style.display = 'none';
        }
      } catch (error) {
        console.error('Crypto search error:', error);
        resultsDiv.style.display = 'none';
      }
    });
    
    document.addEventListener('click', (e) => {
        // Hide results if click is outside the search input and results container
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
    
    saveButton.addEventListener('click', () => {
      const currency = document.getElementById('crypto-currency').value;
      const config = {
        coins: selectedCryptos.length ? selectedCryptos : [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' }],
        currency: currency
      };
      
      this.addWidget('crypto', config);
      this.hideConfigModal();
    });
  }

  setupStocksConfig() { /* ... (same as before, ensure to pass callback to renderSelectedItems if needed) ... */ 
    const searchInput = document.getElementById('stocks-search');
    const resultsDiv = document.getElementById('stocks-results');
    const selectedDiv = document.getElementById('selected-stocks');
    const saveButton = document.getElementById('save-stocks-config');
    let selectedStocks = [];
    searchInput.addEventListener('input', async (e) => { /* ... */ });
    document.addEventListener('click', (e) => { if (!e.target.closest('#stocks-search') && !e.target.closest('#stocks-results')) resultsDiv.style.display = 'none'; });
    saveButton.addEventListener('click', () => { /* ... */ });
  }

  setupCountdownConfig() { // Added
    const titleInput = document.getElementById('countdown-title');
    const dateInput = document.getElementById('countdown-date');
    const timeInput = document.getElementById('countdown-time');
    const saveButton = document.getElementById('save-countdown-config');
    
    saveButton.addEventListener('click', () => {
      const title = titleInput.value.trim() || 'New Year';
      const date = dateInput.value;
      const time = timeInput.value || "00:00"; // Default time if none selected
      
      if (!date) {
        this.showToast('Please select a date', 'error');
        return;
      }
      
      const targetDate = `${date}T${time}:00`; // Ensure seconds are included
      const config = {
        title: title,
        targetDate: targetDate
      };
      
      this.addWidget('countdown', config);
      this.hideConfigModal();
    });
  }

  setupSportsConfig() { /* ... (same as before, ensure to pass callback to renderSelectedItems if needed) ... */ 
    const leagueSelect = document.getElementById('sports-league');
    const searchInput = document.getElementById('teams-search');
    const resultsDiv = document.getElementById('teams-results');
    const selectedDiv = document.getElementById('selected-teams');
    const saveButton = document.getElementById('save-sports-config');
    let selectedTeams = [];

    // Mock team data
    const getTeamsForLeague = (league) => { /* ... (Use the extensive list from before) ... */
        const teamsData = {
            nfl: [ { id: 'patriots', name: 'New England Patriots', city: 'New England' }, /* ... more NFL ... */ ],
            nba: [ { id: 'lakers', name: 'Los Angeles Lakers', city: 'Los Angeles' }, /* ... more NBA ... */ ],
            mlb: [ { id: 'yankees', name: 'New York Yankees', city: 'New York' }, /* ... more MLB ... */ ],
            nhl: [ { id: 'bruins', name: 'Boston Bruins', city: 'Boston' }, /* ... more NHL ... */ ],
            soccer: [ { id: 'arsenal', name: 'Arsenal', city: 'London' }, /* ... more Soccer ... */ ]
        };
        return teamsData[league] || [];
    };
    searchInput.addEventListener('input', (e) => { /* ... (Ensure correct filtering and display) ... */ });
    document.addEventListener('click', (e) => { if (!e.target.closest('#teams-search') && !e.target.closest('#teams-results')) resultsDiv.style.display = 'none'; });
    saveButton.addEventListener('click', () => { /* ... */ });
  }

  renderSelectedItems(container, items, type, onUpdateCallback) {
    const getDisplayName = (item) => {
      switch (type) {
        case 'crypto': return `${item.name} (${item.symbol.toUpperCase()})`;
        case 'stock': return `${item.name} (${item.symbol.toUpperCase()})`;
        case 'team': return item.name;
        default: return item.name || item.id || 'Unknown Item';
      }
    };
    
    container.innerHTML = items.map((item, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px;">
        <span>${getDisplayName(item)}</span>
        <button class="remove-selected-item-btn" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: var(--transition);" 
                data-index="${index}"
                onmouseover="this.style.background='var(--border-light)'"
                onmouseout="this.style.background='transparent'">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
    
    container.querySelectorAll('.remove-selected-item-btn').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.dataset.index);
        items.splice(index, 1);
        if (onUpdateCallback) onUpdateCallback(items); // Call back to update the original array
        this.renderSelectedItems(container, items, type, onUpdateCallback); // Re-render
      });
    });
  }

  // ===== WIDGET MANAGEMENT =====
  
  async addWidget(type, config = {}, gridOptions = {}) {
    const widgetInfo = this.getWidgetInfo(type);
    if (!widgetInfo) {
      this.showToast(`Widget type "${type}" not found`, 'error');
      return;
    }
    
    const widgetId = `widget-${type}-${++this.widgetCounter}`;
    const widgetEl = document.createElement('div');
    widgetEl.className = `widget ${type}-widget`;
    widgetEl.dataset.widgetId = widgetId;
    widgetEl.dataset.widgetType = type;
    
    widgetEl.innerHTML = `
      <div class="widget-header">
        <div class="widget-title"><i class="${widgetInfo.icon}"></i><span>${widgetInfo.name}</span></div>
        <div class="widget-actions">
          <button class="widget-action refresh-widget" title="Refresh"><i class="fas fa-sync-alt"></i></button>
          <button class="widget-action configure-widget" title="Configure"><i class="fas fa-cog"></i></button>
          <button class="widget-action remove-widget" title="Remove"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="widget-content">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 2rem;">
          <div class="spinner"></div><span>Loading...</span>
        </div>
      </div>`;
    
    const defaultSize = widgetInfo.defaultSize || { w: 4, h: 3 };
    if (!this.grid) {
        console.error("Grid is not initialized. Cannot add widget.");
        this.showToast("Error: Dashboard layout not ready.", "error");
        return;
    }
    this.grid.addWidget(widgetEl, {
      w: gridOptions.w || defaultSize.w, h: gridOptions.h || defaultSize.h,
      x: gridOptions.x, y: gridOptions.y,
      autoPosition: gridOptions.x === undefined && gridOptions.y === undefined
    });
    
    this.setupWidgetActions(widgetEl);
    this.widgets.set(widgetId, { id: widgetId, type: type, config: config, element: widgetEl });
    this.loadWidgetData(widgetId);
    this.checkEmptyState();
    this.showToast(`Added ${widgetInfo.name} widget`, 'success');
  }

  setupWidgetActions(widgetEl) {
    const widgetId = widgetEl.dataset.widgetId;
    widgetEl.querySelector('.refresh-widget')?.addEventListener('click', (e) => { e.stopPropagation(); this.loadWidgetData(widgetId); });
    widgetEl.querySelector('.configure-widget')?.addEventListener('click', (e) => { e.stopPropagation(); this.configureWidget(widgetId); });
    widgetEl.querySelector('.remove-widget')?.addEventListener('click', (e) => { e.stopPropagation(); this.removeWidget(widgetId); });
  }

  async loadWidgetData(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    const widgetInfo = this.getWidgetInfo(widget.type);
    const contentEl = widget.element.querySelector('.widget-content');
    
    try {
      contentEl.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 2rem;"><div class="spinner"></div><span>Loading...</span></div>`;
      const data = await this.fetchWidgetData(widget.type, widget.config);
      this.renderWidget(widget.type, contentEl, data, widget.config);
    } catch (error) {
      console.error(`Error loading widget ${widget.type} (${widgetId}):`, error);
      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 1rem; text-align: center;">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--error);"></i>
          <p>Failed to load data</p>
          <button class="btn btn-ghost retry-widget-load">Retry</button>
        </div>`;
      contentEl.querySelector('.retry-widget-load')?.addEventListener('click', () => this.loadWidgetData(widgetId));
      this.showToast(`Failed to load ${widgetInfo.name}`, 'error');
    }
  }

  async fetchWidgetData(type, config) {
    const baseUrl = window.location.origin;
    let response, result;
    switch (type) {
      case 'weather':
        const { location = 'New York', units = 'imperial' } = config;
        response = await fetch(`${baseUrl}/api/weather?location=${encodeURIComponent(location)}&units=${units}`);
        result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`); return result.data;
      case 'crypto':
        const { coins = [{ id: 'bitcoin' }], currency = 'usd' } = config;
        return Promise.all(coins.map(async coin => {
          response = await fetch(`${baseUrl}/api/crypto?coin=${encodeURIComponent(coin.id)}¤cy=${encodeURIComponent(currency)}`);
          result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`); return { ...result.data, ...coin };
        }));
      case 'stocks':
        const { stocks = [{ symbol: 'AAPL' }] } = config;
        return Promise.all(stocks.map(async stock => {
          response = await fetch(`${baseUrl}/api/stocks?symbol=${stock.symbol}`);
          result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`); return { ...result.data, ...stock };
        }));
      case 'sports':
        const { league = 'nfl', teams = [] } = config;
        response = await fetch(`${baseUrl}/api/sports?league=${league}&teams=${teams.map(t => t.id).join(',')}`);
        result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`); return result.data;
      case 'countdown': // Countdown data is now primarily client-side, generated from config
        const { title = 'New Year', targetDate = '2025-12-31T23:59:59' } = config;
        return { title, targetDate, completed: new Date(targetDate) < new Date() };
      case 'notes': return { title: config.title || 'Notes', content: config.content || '' };
      case 'todo': return { title: config.title || 'Todo List', items: [] }; // Items managed by renderTodoWidget
      default: throw new Error(`Unknown widget type: ${type}`);
    }
  }

  renderWidget(type, container, data, config) {
    switch (type) {
      case 'weather': this.renderWeatherWidget(container, data); break;
      case 'crypto': this.renderCryptoWidget(container, data); break;
      case 'stocks': this.renderStocksWidget(container, data); break;
      case 'sports': this.renderSportsWidget(container, data); break;
      case 'countdown': this.renderCountdownWidget(container, data); break;
      case 'notes': this.renderNotesWidget(container, data, config); break;
      case 'todo': this.renderTodoWidget(container, data, config); break;
      default: container.innerHTML = `<p>Error: Unknown widget type "${type}"</p>`;
    }
  }

  // ===== WIDGET RENDERERS =====

  renderWeatherWidget(container, data) { /* ... (same as before) ... */ }
  renderCryptoWidget(container, dataArray) { /* ... (combined single and multi display, same as before) ... */ }
  renderStocksWidget(container, dataArray) { /* ... (combined single and multi display, same as before) ... */ }

  renderSportsWidget(container, data) { // Using the more detailed version
    if (data && data.games && data.games.length > 0) {
      container.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column;">
          <div style="text-align: center; margin-bottom: 1rem; font-weight: 600; color: var(--primary); text-transform: uppercase;">${data.league || 'Sports'}</div>
          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding: 0 0.5rem;">
            ${data.games.map(game => {
              let gameInfo = '';
              if (game.status === 'Live') {
                gameInfo = `<span style="color: var(--error); font-weight: 600;">LIVE</span> ${game.quarter || ''} ${game.timeRemaining || ''}`;
              } else if (game.status === 'Final') {
                gameInfo = '<span style="color: var(--text-muted);">Final</span>';
              } else { // Scheduled or other states
                gameInfo = `<span style="color: var(--text-muted);">${game.status || 'Scheduled'}</span>`;
              }
              
              return `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="font-size: 0.75rem;">${gameInfo}</div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                      <div style="font-size: 0.875rem; font-weight: 500;">${game.awayTeam || 'Away'}</div>
                      <div style="font-size: 0.875rem; font-weight: 500; margin-top: 0.25rem;">${game.homeTeam || 'Home'}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 0.875rem; font-weight: 600;">${game.awayScore !== null ? game.awayScore : '-'}</div>
                      <div style="font-size: 0.875rem; font-weight: 600; margin-top: 0.25rem;">${game.homeScore !== null ? game.homeScore : '-'}</div>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
          ${data.demo ? '<div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Demo Data</div>' : ''}
        </div>`;
    } else {
      container.innerHTML = `
        <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5rem; color: var(--text-muted); padding: 1rem;">
          <i class="fas fa-futbol" style="font-size: 2rem;"></i>
          <span>No games for ${data.league?.toUpperCase() || 'selected league'}.</span>
        </div>`;
    }
  }

  renderCountdownWidget(container, data) { /* ... (same as before, managing its own interval) ... */ }
  renderNotesWidget(container, data, config) { /* ... (same as before, using widgetId for storage key) ... */ }
  renderTodoWidget(container, data, config) { /* ... (same as before, using widgetId for storage key and self-contained rerender/listeners) ... */ }

  // ===== UTILITY METHODS =====

  configureWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    // For widgets with config forms, show the form again. Might need to prefill.
    if (['weather', 'crypto', 'stocks', 'sports', 'countdown'].includes(widget.type)) {
      this.showWidgetConfiguration(widget.type); 
      // TODO: Prefill config modal with widget.config
    } else {
      this.showToast(`${this.getWidgetName(widget.type)} has no custom configuration.`, 'info');
    }
  }

  removeWidget(widgetId) { /* ... (same as before, ensuring countdown interval is cleared) ... */ }
  getWidgetInfo(type) { /* ... (same as before) ... */ }
  getWidgetName(type) { /* ... (same as before) ... */ }
  formatNumber(num) { /* ... (same as before) ... */ }

  // ===== LAYOUT MANAGEMENT =====

  saveLayout() { /* ... (same as before, using grid.save(false) and serializing with config) ... */ }
  loadLayout() { /* ... (same as before, being careful with widgetCounter and grid events) ... */ }
  resetLayout() { /* ... (same as before, clearing intervals) ... */ }
  checkEmptyState() { /* ... (same as before) ... */ }

  // ===== ESP32 DEVICE MANAGEMENT =====

  loadESP32Devices() { /* ... (same as before) ... */ }
  renderESP32Devices() { /* ... (same as before, ensuring event listeners for remove are correctly attached) ... */ }
  addESP32Device() { /* ... (same as before) ... */ }
  removeESP32Device(deviceId) { /* ... (same as before) ... */ }
  saveESP32Devices() { /* ... (same as before) ... */ }

  // ===== NOTIFICATIONS =====

  showToast(message, type = 'info') { /* ... (same as before) ... */ }

  // ===== AUTO REFRESH =====

  startAutoRefresh() { /* ... (same as before, checking document.hidden) ... */ }
}

// ===== INITIALIZATION, GLOBAL ERROR HANDLING, PAGE VISIBILITY =====
// ... (All same as before)

document.addEventListener('DOMContentLoaded', () => {
  if (typeof GridStack === 'undefined') {
    console.error('GridStack failed to load!');
    document.body.innerHTML = `<div style="/* error message styles */">Error: Core component failed.</div>`;
    return;
  }
  window.dashboard = new EnhancedDashboard();
  console.log('🚀 Enhanced Dashboard initialized');
  if(GridStack.version) console.log('✅ GridStack loaded:', GridStack.version);
});

window.addEventListener('error', (e) => { /* ... */ });
window.addEventListener('unhandledrejection', (event) => { /* ... */ });
document.addEventListener('visibilitychange', () => { /* ... */ });
