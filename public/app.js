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
    document.getElementById('user-email').textContent = this.currentUser?.email || 'user@example.com';
  }

  setupAuthListeners() {
    const authForm = document.getElementById('auth-form');
    const authSwitch = document.getElementById('auth-switch');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authSubmit = document.getElementById('auth-submit');
    const authSwitchText = document.getElementById('auth-switch-text');
    const confirmPasswordGroup = document.getElementById('confirm-password-group');

    let isSignUp = false;

    const toggleAuthMode = (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;

      if (isSignUp) {
        authTitle.textContent = 'Sign Up';
        authSubtitle.textContent = 'Create your dashboard account';
        authSubmit.innerHTML = '<i class="fas fa-user-plus"></i><span>Sign Up</span>';
        authSwitchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Sign in</a>';
        confirmPasswordGroup.classList.remove('hidden');
      } else {
        authTitle.textContent = 'Sign In';
        authSubtitle.textContent = 'Access your personalized dashboard';
        authSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Sign In</span>';
        authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
        confirmPasswordGroup.classList.add('hidden');
      }

      // Re-attach listener to the new switch link
      document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    };

    authSwitch.addEventListener('click', toggleAuthMode);

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
        // Mock authentication
        const userData = { email, id: Date.now().toString() }; // Ensure ID is a string if used in localStorage keys often
        const token = 'mock-token-' + Date.now();

        localStorage.setItem('dashboard-token', token);
        localStorage.setItem('dashboard-user', JSON.stringify(userData));

        this.currentUser = userData;
        this.showDashboard();
        this.init(); // Initialize dashboard components after successful auth

        this.showToast(isSignUp ? 'Account created successfully!' : 'Welcome back!', 'success');
      } catch (error) {
        this.showToast('Authentication failed', 'error');
        console.error('Authentication error:', error);
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
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Add widget buttons
    document.getElementById('add-widget')?.addEventListener('click', () => {
      this.showWidgetPicker();
    });

    document.getElementById('add-first-widget')?.addEventListener('click', () => {
      this.showWidgetPicker();
    });

    // Reset layout
    document.getElementById('reset-layout')?.addEventListener('click', () => {
      if (confirm('Reset layout? This will remove all widgets.')) {
        this.resetLayout();
      }
    });

    // User menu
    document.getElementById('user-menu-button')?.addEventListener('click', () => {
      const dropdown = document.getElementById('user-dropdown');
      dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('show');
      }
    });

    // Logout
    document.getElementById('logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.logout();
    });

    // ESP32 management
    document.getElementById('manage-esp32')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showESP32Modal();
    });

    // Modal controls
    this.setupModalListeners();

    // Widget picker
    this.setupWidgetPickerListeners();
  }

  setupModalListeners() {
    // Modal close buttons
    document.getElementById('close-picker')?.addEventListener('click', () => {
      this.hideWidgetPicker();
    });

    document.getElementById('close-config')?.addEventListener('click', () => {
      this.hideConfigModal();
    });

    document.getElementById('close-esp32')?.addEventListener('click', () => {
      this.hideESP32Modal();
    });

    // Click outside to close modals
    document.getElementById('widget-picker')?.addEventListener('click', (e) => {
      if (e.target.id === 'widget-picker') {
        this.hideWidgetPicker();
      }
    });

    document.getElementById('widget-config-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'widget-config-modal') {
        this.hideConfigModal();
      }
    });

    document.getElementById('esp32-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'esp32-modal') {
        this.hideESP32Modal();
      }
    });
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
    if (themeIcon) {
      themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    this.showToast(`Switched to ${this.theme} theme`, 'info');
  }

  // ===== MODAL METHODS =====

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

    // Setup ESP32 device addition
    const addButton = document.getElementById('add-esp32');
    // Ensure onclick is fresh or use addEventListener with removal if needed
    addButton.onclick = () => this.addESP32Device();
  }

  hideESP32Modal() {
    document.getElementById('esp32-modal').classList.add('hidden');
  }

  // ===== WIDGET CONFIGURATION METHODS =====

  async configureAndAddWidget(type) {
    this.hideWidgetPicker();

    // Show configuration modal for widgets that need it
    if (['weather', 'crypto', 'stocks', 'sports'].includes(type)) {
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
      case 'weather':
        configHTML = this.generateWeatherConfig();
        break;
      case 'crypto':
        configHTML = this.generateCryptoConfig();
        break;
      case 'stocks':
        configHTML = this.generateStocksConfig();
        break;
      case 'sports':
        configHTML = this.generateSportsConfig();
        break;
    }

    configContent.innerHTML = configHTML;
    this.showConfigModal();
    this.setupConfigurationLogic(type);
  }

  generateWeatherConfig() {
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
        <button id="save-weather-config" class="btn btn-primary">
          <i class="fas fa-save"></i>
          Add Weather Widget
        </button>
      </div>
    `;
  }

  generateCryptoConfig() {
    return `
      <div class="form-group">
        <label class="form-label">Cryptocurrencies</label>
        <div style="position: relative;">
          <input type="text" id="crypto-search" class="form-input" placeholder="Search cryptocurrencies..." autocomplete="off">
          <div id="crypto-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 200px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-cryptos" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
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
          <i class="fas fa-save"></i>
          Add Crypto Widget
        </button>
      </div>
    `;
  }

  generateStocksConfig() {
    return `
      <div class="form-group">
        <label class="form-label">Stocks</label>
        <div style="position: relative;">
          <input type="text" id="stocks-search" class="form-input" placeholder="Search stocks..." autocomplete="off">
          <div id="stocks-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 200px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-stocks" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
      </div>
      
      <div class="form-group">
        <button id="save-stocks-config" class="btn btn-primary">
          <i class="fas fa-save"></i>
          Add Stocks Widget
        </button>
      </div>
    `;
  }

  generateSportsConfig() {
    return `
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
          <div id="teams-results" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--surface-elevated); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); max-height: 200px; overflow-y: auto; z-index: 1000; display: none;"></div>
        </div>
        <div id="selected-teams" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
      </div>
      
      <div class="form-group">
        <button id="save-sports-config" class="btn btn-primary">
          <i class="fas fa-save"></i>
          Add Sports Widget
        </button>
      </div>
    `;
  }

  setupConfigurationLogic(type) {
    switch (type) {
      case 'weather':
        this.setupWeatherConfig();
        break;
      case 'crypto':
        this.setupCryptoConfig();
        break;
      case 'stocks':
        this.setupStocksConfig();
        break;
      case 'sports':
        this.setupSportsConfig();
        break;
    }
  }

  setupWeatherConfig() {
    const searchInput = document.getElementById('weather-search');
    const resultsDiv = document.getElementById('weather-results');
    const saveButton = document.getElementById('save-weather-config');

    let selectedCity = null;

    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
      }

      try {
        const response = await fetch(`/api/search/cities?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        const cities = result.data || [];

        if (cities.length > 0) {
          resultsDiv.innerHTML = cities.map(city => `
            <div style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: var(--transition); display: flex; justify-content: space-between; align-items: center;" 
                 data-city-name="${city.name}" 
                 onmouseover="this.style.background='var(--border-light)'" 
                 onmouseout="this.style.background='transparent'">
              <div>
                <div style="font-weight: 500;">${city.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${city.country}</div>
              </div>
            </div>
          `).join('');

          resultsDiv.style.display = 'block';

          resultsDiv.querySelectorAll('[data-city-name]').forEach(result => {
            result.addEventListener('click', () => {
              selectedCity = cities.find(c => c.name === result.dataset.cityName);
              searchInput.value = selectedCity.displayName || selectedCity.name;
              resultsDiv.style.display = 'none';
            });
          });
        } else {
          resultsDiv.style.display = 'none';
        }
      } catch (error) {
        console.error('City search error:', error);
        resultsDiv.style.display = 'none';
      }
    });

    // Hide results when clicking outside search input or results
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });

    saveButton.addEventListener('click', () => {
      const units = document.getElementById('weather-units').value;
      const config = {
        location: selectedCity?.name || searchInput.value || 'New York',
        units: units
      };

      this.addWidget('weather', config);
      this.hideConfigModal();
    });
  }

  setupCryptoConfig() {
    const searchInput = document.getElementById('crypto-search');
    const resultsDiv = document.getElementById('crypto-results');
    const selectedDiv = document.getElementById('selected-cryptos');
    const saveButton = document.getElementById('save-crypto-config');

    let selectedCryptos = [];

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

        if (cryptos.length > 0) {
          resultsDiv.innerHTML = cryptos.map(crypto => `
            <div style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: var(--transition); display: flex; justify-content: space-between; align-items: center;" 
                 data-crypto-id="${crypto.id}" 
                 onmouseover="this.style.background='var(--border-light)'" 
                 onmouseout="this.style.background='transparent'">
              <div>
                <div style="font-weight: 500;">${crypto.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${crypto.symbol}</div>
              </div>
            </div>
          `).join('');

          resultsDiv.style.display = 'block';

          resultsDiv.querySelectorAll('[data-crypto-id]').forEach(result => {
            result.addEventListener('click', () => {
              const crypto = cryptos.find(c => c.id === result.dataset.cryptoId);
              if (crypto && !selectedCryptos.find(c => c.id === crypto.id)) {
                selectedCryptos.push(crypto);
                this.renderSelectedItems(selectedDiv, selectedCryptos, 'crypto', (items) => { selectedCryptos = items; });
              }
              searchInput.value = '';
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

  setupStocksConfig() {
    const searchInput = document.getElementById('stocks-search');
    const resultsDiv = document.getElementById('stocks-results');
    const selectedDiv = document.getElementById('selected-stocks');
    const saveButton = document.getElementById('save-stocks-config');

    let selectedStocks = [];

    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
      }

      try {
        const response = await fetch(`/api/search/stocks?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        const stocks = result.data || [];

        if (stocks.length > 0) {
          resultsDiv.innerHTML = stocks.map(stock => `
            <div style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: var(--transition); display: flex; justify-content: space-between; align-items: center;" 
                 data-stock-symbol="${stock.symbol}" 
                 onmouseover="this.style.background='var(--border-light)'" 
                 onmouseout="this.style.background='transparent'">
              <div>
                <div style="font-weight: 500;">${stock.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${stock.symbol}</div>
              </div>
            </div>
          `).join('');

          resultsDiv.style.display = 'block';

          resultsDiv.querySelectorAll('[data-stock-symbol]').forEach(result => {
            result.addEventListener('click', () => {
              const stock = stocks.find(s => s.symbol === result.dataset.stockSymbol);
              if (stock && !selectedStocks.find(s => s.symbol === stock.symbol)) {
                selectedStocks.push(stock);
                this.renderSelectedItems(selectedDiv, selectedStocks, 'stock', (items) => { selectedStocks = items; });
              }
              searchInput.value = '';
              resultsDiv.style.display = 'none';
            });
          });
        } else {
          resultsDiv.style.display = 'none';
        }
      } catch (error) {
        console.error('Stock search error:', error);
        resultsDiv.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
    
    saveButton.addEventListener('click', () => {
      const config = {
        stocks: selectedStocks.length ? selectedStocks : [{ symbol: 'AAPL', name: 'Apple Inc.' }]
      };

      this.addWidget('stocks', config);
      this.hideConfigModal();
    });
  }

  setupSportsConfig() {
    const leagueSelect = document.getElementById('sports-league');
    const searchInput = document.getElementById('teams-search');
    const resultsDiv = document.getElementById('teams-results');
    const selectedDiv = document.getElementById('selected-teams');
    const saveButton = document.getElementById('save-sports-config');

    let selectedTeams = [];

    // Mock team data - in a real app, this would come from an API
    const getTeamsForLeague = (league) => {
      const teamsData = {
        nfl: [
          { id: 'ne', name: 'New England Patriots', city: 'New England' },
          { id: 'dal', name: 'Dallas Cowboys', city: 'Dallas' },
          { id: 'gb', name: 'Green Bay Packers', city: 'Green Bay' }
        ],
        nba: [
          { id: 'lal', name: 'Los Angeles Lakers', city: 'Los Angeles' },
          { id: 'gsw', name: 'Golden State Warriors', city: 'Golden State' },
          { id: 'bos', name: 'Boston Celtics', city: 'Boston' }
        ],
        mlb: [
          { id: 'nyy', name: 'New York Yankees', city: 'New York' },
          { id: 'lad', name: 'Los Angeles Dodgers', city: 'Los Angeles' },
          { id: 'bos', name: 'Boston Red Sox', city: 'Boston' }
        ],
        nhl: [], // Add NHL teams if needed
        soccer: [] // Add Soccer teams if needed
      };
      return teamsData[league] || [];
    };

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const league = leagueSelect.value;

      if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
      }

      const teams = getTeamsForLeague(league).filter(team =>
        team.name.toLowerCase().includes(query) ||
        team.city.toLowerCase().includes(query)
      );

      if (teams.length > 0) {
        resultsDiv.innerHTML = teams.map(team => `
          <div style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: var(--transition); display: flex; justify-content: space-between; align-items: center;" 
               data-team-id="${team.id}" 
               onmouseover="this.style.background='var(--border-light)'" 
               onmouseout="this.style.background='transparent'">
            <div>
              <div style="font-weight: 500;">${team.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${team.city}</div>
            </div>
          </div>
        `).join('');

        resultsDiv.style.display = 'block';

        resultsDiv.querySelectorAll('[data-team-id]').forEach(result => {
          result.addEventListener('click', () => {
            const team = teams.find(t => t.id === result.dataset.teamId);
            if (team && !selectedTeams.find(t => t.id === team.id)) {
              selectedTeams.push(team);
              this.renderSelectedItems(selectedDiv, selectedTeams, 'team', (items) => { selectedTeams = items; });
            }
            searchInput.value = '';
            resultsDiv.style.display = 'none';
          });
        });
      } else {
        resultsDiv.style.display = 'none';
      }
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });

    saveButton.addEventListener('click', () => {
      const league = leagueSelect.value;
      const config = {
        league: league,
        teams: selectedTeams // Use the current state of selectedTeams
      };

      this.addWidget('sports', config);
      this.hideConfigModal();
    });
  }

  renderSelectedItems(container, items, type, onUpdate) {
    const getDisplayName = (item) => {
      switch (type) {
        case 'crypto': return `${item.name} (${item.symbol.toUpperCase()})`;
        case 'stock': return `${item.name} (${item.symbol.toUpperCase()})`;
        case 'team': return item.name;
        default: return item.name || item.id;
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
        if (onUpdate) onUpdate(items); // Update the parent component's state
        this.renderSelectedItems(container, items, type, onUpdate); // Re-render
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

    // Create widget element
    const widgetEl = document.createElement('div');
    widgetEl.className = `widget ${type}-widget`;
    widgetEl.dataset.widgetId = widgetId;
    widgetEl.dataset.widgetType = type;

    // Create widget structure
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
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 2rem;">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    `;

    // Add to grid with default size
    const defaultSize = widgetInfo.defaultSize || { w: 4, h: 3 };
    if (!this.grid) {
        console.error("Grid is not initialized. Cannot add widget.");
        this.showToast("Error: Dashboard layout not ready.", "error");
        return;
    }
    this.grid.addWidget(widgetEl, {
      w: gridOptions.w || defaultSize.w,
      h: gridOptions.h || defaultSize.h,
      x: gridOptions.x, // Let GridStack handle autoPosition if x,y are undefined
      y: gridOptions.y,
      autoPosition: gridOptions.x === undefined && gridOptions.y === undefined
    });

    // Setup widget actions
    this.setupWidgetActions(widgetEl);

    // Store widget info
    this.widgets.set(widgetId, {
      id: widgetId,
      type: type,
      config: config,
      element: widgetEl
    });

    // Load widget data
    this.loadWidgetData(widgetId);

    // Update empty state
    this.checkEmptyState();

    this.showToast(`Added ${widgetInfo.name} widget`, 'success');
  }

  setupWidgetActions(widgetEl) {
    const widgetId = widgetEl.dataset.widgetId;

    // Refresh button
    widgetEl.querySelector('.refresh-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadWidgetData(widgetId);
    });

    // Configure button
    widgetEl.querySelector('.configure-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.configureWidget(widgetId);
    });

    // Remove button
    widgetEl.querySelector('.remove-widget')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeWidget(widgetId);
    });
  }

  async loadWidgetData(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    const widgetInfo = this.getWidgetInfo(widget.type);
    const contentEl = widget.element.querySelector('.widget-content');

    try {
      // Show loading
      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 2rem;">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      `;

      // Fetch data
      const data = await this.fetchWidgetData(widget.type, widget.config);

      // Render widget
      this.renderWidget(widget.type, contentEl, data, widget.config);

    } catch (error) {
      console.error(`Error loading widget ${widget.type} (${widgetId}):`, error);
      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-muted); padding: 1rem; text-align: center;">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--error);"></i>
          <p>Failed to load data</p>
          <button class="btn btn-ghost retry-widget-load">
            Retry
          </button>
        </div>
      `;
      // Add event listener for the new retry button
      contentEl.querySelector('.retry-widget-load')?.addEventListener('click', () => {
          this.loadWidgetData(widgetId);
      });
      this.showToast(`Failed to load ${widgetInfo.name}`, 'error');
    }
  }

  async fetchWidgetData(type, config) {
    const baseUrl = window.location.origin; // Use for relative API paths

    switch (type) {
      case 'weather':
        const { location = 'New York', units = 'imperial' } = config;
        const weatherResponse = await fetch(`${baseUrl}/api/weather?location=${encodeURIComponent(location)}&units=${units}`);
        if (!weatherResponse.ok) {
            const weatherError = await weatherResponse.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(weatherError.error || `HTTP error ${weatherResponse.status}`);
        }
        const weatherResult = await weatherResponse.json();
        return weatherResult.data;

      case 'crypto':
        const { coins = [{ id: 'bitcoin' }], currency = 'usd' } = config;
        return Promise.all(coins.map(async coin => {
          const cryptoResponse = await fetch(`${baseUrl}/api/crypto?coin=${coin.id}¤cy=${currency}`);
          if (!cryptoResponse.ok) {
            const cryptoError = await cryptoResponse.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(cryptoError.error || `HTTP error ${cryptoResponse.status}`);
          }
          const cryptoResult = await cryptoResponse.json();
          return { ...cryptoResult.data, ...coin }; // Combine API data with original coin info
        }));

      case 'stocks':
        const { stocks = [{ symbol: 'AAPL' }] } = config;
        return Promise.all(stocks.map(async stock => {
          const stockResponse = await fetch(`${baseUrl}/api/stocks?symbol=${stock.symbol}`);
          if (!stockResponse.ok) {
            const stockError = await stockResponse.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(stockError.error || `HTTP error ${stockResponse.status}`);
          }
          const stockResult = await stockResponse.json();
          return { ...stockResult.data, ...stock }; // Combine API data with original stock info
        }));

      case 'sports':
        const { league = 'nfl', teams = [] } = config;
        const teamsQuery = teams.map(t => t.id).join(',');
        const sportsResponse = await fetch(`${baseUrl}/api/sports?league=${league}&teams=${teamsQuery}`);
        if (!sportsResponse.ok) {
            const sportsError = await sportsResponse.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(sportsError.error || `HTTP error ${sportsResponse.status}`);
        }
        const sportsResult = await sportsResponse.json();
        return sportsResult.data;

      case 'countdown':
        // Countdown can be client-side, but if API call is intended:
        const { title = 'New Year', targetDate = '2025-12-31T23:59:59' } = config;
        // Assuming a simple return for client-side processing
        return { title, targetDate, completed: new Date(targetDate) < new Date() };
        // If an API call is truly needed:
        // const countdownResponse = await fetch(`${baseUrl}/api/countdown?title=${encodeURIComponent(title)}&targetDate=${encodeURIComponent(targetDate)}`);
        // if (!countdownResponse.ok) throw new Error(await countdownResponse.text());
        // return await countdownResponse.json();

      case 'notes':
        // Notes are typically client-side
        return { title: config.title || 'Notes', content: config.content || '' };

      case 'todo':
        // Todo is typically client-side
        return { title: config.title || 'Todo List', items: config.items || [] }; // items can be loaded from localStorage in render

      default:
        throw new Error(`Unknown widget type: ${type}`);
    }
  }

  renderWidget(type, container, data, config) {
    switch (type) {
      case 'weather':
        this.renderWeatherWidget(container, data);
        break;
      case 'crypto':
        this.renderCryptoWidget(container, data);
        break;
      case 'stocks':
        this.renderStocksWidget(container, data);
        break;
      case 'sports':
        this.renderSportsWidget(container, data);
        break;
      case 'countdown':
        this.renderCountdownWidget(container, data);
        break;
      case 'notes':
        this.renderNotesWidget(container, data, config); // Pass config for notes widgetId
        break;
      case 'todo':
        this.renderTodoWidget(container, data, config); // Pass config for todo widgetId
        break;
      default:
        container.innerHTML = `<p>Error: Unknown widget type "${type}"</p>`;
    }
  }

  // ===== WIDGET RENDERERS =====

  renderWeatherWidget(container, data) {
    if (!data) {
        container.innerHTML = `<p>No weather data available.</p>`;
        return;
    }
    const tempUnit = data.units === 'metric' ? '°C' : '°F';
    container.innerHTML = `
      <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 2rem; font-weight: 300; margin-bottom: 0.5rem; color: var(--text);">${data.temp}${tempUnit}</div>
        <div style="font-size: 0.875rem; opacity: 0.8; margin-bottom: 0.5rem;">${data.condition}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">${data.location}</div>
        ${data.demo ? '<div style="font-size: 0.75rem; color: var(--text-muted);">Demo Data</div>' : ''}
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.75rem;">
          <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
            <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Humidity</span>
            <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${data.humidity}%</span>
          </div>
          <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
            <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Wind</span>
            <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${data.wind} ${data.units === 'metric' ? 'km/h' : 'mph'}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderCryptoWidget(container, dataArray) {
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<p>No crypto data available.</p>`;
        return;
    }
    if (dataArray.length === 1) {
      // Single crypto display
      const data = dataArray[0];
      const changeClass = parseFloat(data.change24h) >= 0 ? 'positive' : 'negative';
      const changeIcon = parseFloat(data.change24h) >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
      const currencySymbol = data.currency === 'usd' ? '$' : data.currency.toUpperCase();

      container.innerHTML = `
        <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 2rem; font-weight: 300; margin-bottom: 0.5rem; color: var(--text);">${currencySymbol}${parseFloat(data.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: data.price > 1 ? 2 : 8 })}</div>
          <div style="font-size: 0.875rem; opacity: 0.8; margin-bottom: 0.5rem;">
            <i class="fas ${changeIcon}"></i>
            <span class="${changeClass}">${data.change24h}%</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">${data.name || data.id}</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.75rem;">
            <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
              <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Market Cap</span>
              <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${currencySymbol}${this.formatNumber(data.marketCap)}</span>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
              <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Volume</span>
              <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${currencySymbol}${this.formatNumber(data.volume24h)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Multi-crypto display
      const currencySymbol = dataArray[0].currency === 'usd' ? '$' : dataArray[0].currency.toUpperCase();
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 100%; overflow-y: auto; padding: 0.5rem;">
          ${dataArray.map(data => {
            const changeClass = parseFloat(data.change24h) >= 0 ? 'positive' : 'negative';
            const changeIcon = parseFloat(data.change24h) >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';

            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; transition: var(--transition);">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <div style="font-weight: 600; font-size: 0.875rem;">${data.name || data.id}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${data.symbol ? data.symbol.toUpperCase() : data.id.toUpperCase()}</div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 0.25rem;">
                  <div style="font-weight: 600; font-size: 0.875rem;">${currencySymbol}${parseFloat(data.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: data.price > 1 ? 2 : 8 })}</div>
                  <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem;" class="${changeClass}">
                    <i class="fas ${changeIcon}"></i>
                    ${data.change24h}%
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  renderStocksWidget(container, dataArray) {
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = `<p>No stock data available.</p>`;
        return;
    }
    if (dataArray.length === 1) {
      // Single stock display
      const data = dataArray[0];
      const changeClass = parseFloat(data.change) >= 0 ? 'positive' : 'negative';
      const changeIcon = parseFloat(data.change) >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';

      container.innerHTML = `
        <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 2rem; font-weight: 300; margin-bottom: 0.5rem; color: var(--text);">${parseFloat(data.price).toFixed(2)}</div>
          <div style="font-size: 0.875rem; opacity: 0.8; margin-bottom: 0.5rem;">
            <i class="fas ${changeIcon}"></i>
            <span class="${changeClass}">${parseFloat(data.change).toFixed(2)} (${data.changePercent})</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">${data.name || data.symbol}</div>
          ${data.demo ? '<div style="font-size: 0.75rem; color: var(--text-muted);">Demo Data</div>' : ''}
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.75rem;">
            <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
              <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Volume</span>
              <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${this.formatNumber(data.volume)}</span>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: var(--surface); border-radius: 4px; border: 1px solid var(--border);">
              <span style="opacity: 0.7; display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.5px;">Prev Close</span>
              <span style="font-weight: 600; font-size: 0.875rem; margin-top: 0.25rem;">${parseFloat(data.previousClose).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Multi-stock display
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 100%; overflow-y: auto; padding: 0.5rem;">
          ${dataArray.map(data => {
            const changeClass = parseFloat(data.change) >= 0 ? 'positive' : 'negative';
            const changeIcon = parseFloat(data.change) >= 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down';

            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; transition: var(--transition);">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <div style="font-weight: 600; font-size: 0.875rem;">${data.name || data.symbol}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${data.symbol}</div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 0.25rem;">
                  <div style="font-weight: 600; font-size: 0.875rem;">${parseFloat(data.price).toFixed(2)}</div>
                  <div style="font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem;" class="${changeClass}">
                    <i class="fas ${changeIcon}"></i>
                    ${data.changePercent}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  renderSportsWidget(container, data) {
    if (!data || !data.games || data.games.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5rem; color: var(--text-muted); padding: 1rem;">
                <i class="fas fa-futbol" style="font-size: 2rem;"></i>
                <span>No sports data for ${data.league?.toUpperCase() || 'selected league'}.</span>
            </div>`;
        return;
    }
    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; padding: 0.5rem;">
        <h4 style="text-align: center; margin-bottom: 0.5rem; text-transform: uppercase;">${data.league} Scores</h4>
        <div style="flex-grow: 1; overflow-y: auto;">
          ${data.games.map(game => `
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>${game.home_team}</span>
                <span>${game.home_score}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>${game.away_team}</span>
                <span>${game.away_score}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${game.status}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderCountdownWidget(container, data) {
    if (!data || !data.targetDate) {
        container.innerHTML = `<p>Countdown data is missing.</p>`;
        return;
    }

    const updateCountdown = () => {
        const diff = new Date(data.targetDate) - new Date();
        if (diff <= 0) {
          container.innerHTML = `
            <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
              <div style="font-size: 2rem; font-weight: 300; margin-bottom: 0.5rem;">🎉</div>
              <div style="font-size: 0.875rem; opacity: 0.8; margin-bottom: 0.5rem;">${data.title}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Completed!</div>
            </div>
          `;
          if (this.countdownInterval) clearInterval(this.countdownInterval); // Assuming interval stored on 'this'
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        container.innerHTML = `
          <div style="text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 0.875rem; opacity: 0.8; margin-bottom: 1rem;">${data.title}</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin: 1rem 0;">
              <div style="text-align: center; background: var(--surface); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <span style="display: block; font-size: 1.5rem; font-weight: 600;">${days}</span>
                <span style="font-size: 0.75rem; opacity: 0.8;">Days</span>
              </div>
              <div style="text-align: center; background: var(--surface); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <span style="display: block; font-size: 1.5rem; font-weight: 600;">${hours.toString().padStart(2, '0')}</span>
                <span style="font-size: 0.75rem; opacity: 0.8;">Hours</span>
              </div>
              <div style="text-align: center; background: var(--surface); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <span style="display: block; font-size: 1.5rem; font-weight: 600;">${minutes.toString().padStart(2, '0')}</span>
                <span style="font-size: 0.75rem; opacity: 0.8;">Min</span>
              </div>
              <div style="text-align: center; background: var(--surface); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border);">
                <span style="display: block; font-size: 1.5rem; font-weight: 600;">${seconds.toString().padStart(2, '0')}</span>
                <span style="font-size: 0.75rem; opacity: 0.8;">Sec</span>
              </div>
            </div>
          </div>
        `;
    };
    
    updateCountdown(); // Initial render
    // Clear any existing interval for this widget before setting a new one
    const widgetId = container.closest('.widget')?.dataset.widgetId;
    if (widgetId && this.widgets.get(widgetId)?.countdownInterval) {
        clearInterval(this.widgets.get(widgetId).countdownInterval);
    }
    const intervalId = setInterval(() => {
        // Check if widget still exists
        if (!document.body.contains(container) || new Date(data.targetDate) - new Date() <=0) {
            clearInterval(intervalId);
            if (widgetId && this.widgets.get(widgetId)) this.widgets.get(widgetId).countdownInterval = null;
            return;
        }
        updateCountdown();
    }, 1000);
    if(widgetId && this.widgets.get(widgetId)) this.widgets.get(widgetId).countdownInterval = intervalId;
  }

  renderNotesWidget(container, data, config) {
    const widgetEl = container.closest('.widget');
    const widgetId = widgetEl?.dataset.widgetId;
    const noteStorageKey = `notes-${widgetId || 'default'}`; // Use widgetId for unique storage

    const savedContent = localStorage.getItem(noteStorageKey) || data.content || '';

    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column;">
        <textarea 
          style="flex: 1; width: 100%; border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem; font-family: inherit; font-size: 0.875rem; background: var(--background); color: var(--text); resize: none;" 
          placeholder="Enter your notes here..."
          class="notes-textarea"
        >${savedContent}</textarea>
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-align: right;">
          <span class="word-count">0 words</span>
        </div>
      </div>
    `;

    const textarea = container.querySelector('.notes-textarea');
    const wordCountEl = container.querySelector('.word-count');

    const updateStats = () => {
      const text = textarea.value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      wordCountEl.textContent = `${words} words`;
      localStorage.setItem(noteStorageKey, text);
    };

    textarea.addEventListener('input', updateStats);
    updateStats(); // Initial count
  }

  renderTodoWidget(container, data, config) {
    const widgetEl = container.closest('.widget');
    const widgetId = widgetEl?.dataset.widgetId;
    const todoStorageKey = `todos-${widgetId || 'default'}`;

    let todos = JSON.parse(localStorage.getItem(todoStorageKey) || JSON.stringify(data.items || []));

    const saveTodos = () => {
      localStorage.setItem(todoStorageKey, JSON.stringify(todos));
    };
    
    const rerender = () => {
        const activeCount = todos.filter(t => !t.completed).length;
        const completedCount = todos.filter(t => t.completed).length;

        const todoListHTML = todos.map((todo, index) => `
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--border); ${todo.completed ? 'opacity: 0.6;' : ''}">
            <input 
                type="checkbox" 
                class="todo-checkbox"
                style="accent-color: var(--primary);"
                ${todo.completed ? 'checked' : ''}
                data-index="${index}"
            >
            <span style="flex: 1; font-size: 0.875rem; ${todo.completed ? 'text-decoration: line-through;' : ''}">${todo.text}</span>
            <button class="todo-remove-btn" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: var(--transition);" 
                    data-index="${index}"
                    onmouseover="this.style.background='var(--border-light)'"
                    onmouseout="this.style.background='transparent'">
                <i class="fas fa-times"></i>
            </button>
            </div>
        `).join('');

        container.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column;">
            <input 
                type="text" 
                class="todo-input"
                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--background); color: var(--text); margin-bottom: 0.75rem;" 
                placeholder="Add new task..."
            >
            <div style="flex: 1; overflow-y: auto; max-height: calc(100% - 80px);"> <!-- Adjust max-height as needed -->
                ${todoListHTML}
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-align: right;">
                ${activeCount} active, ${completedCount} completed
            </div>
            </div>
        `;
        attachTodoListeners();
    };

    function attachTodoListeners() {
        const input = container.querySelector('.todo-input');
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
            todos.push({ text: input.value.trim(), completed: false });
            input.value = '';
            saveTodos();
            rerender();
            }
        });

        container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            todos[index].completed = e.target.checked;
            saveTodos();
            rerender();
            });
        });

        container.querySelectorAll('.todo-remove-btn').forEach(button => {
            button.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            todos.splice(index, 1);
            saveTodos();
            rerender();
            });
        });
    }
    rerender();
  }


  // ===== UTILITY METHODS =====

  configureWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    // For now, let's assume re-showing the config modal is enough
    // More complex logic might involve pre-filling the modal with current config
    this.showWidgetConfiguration(widget.type);
  }

  removeWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    const widgetInfo = this.getWidgetInfo(widget.type);
    if (confirm(`Remove ${widgetInfo.name} widget?`)) {
      this.grid.removeWidget(widget.element);
      this.widgets.delete(widgetId);
      if (widget.countdownInterval) clearInterval(widget.countdownInterval); // Clear countdown interval
      this.checkEmptyState();
      this.saveLayout(); // Save after removal
      this.showToast('Widget removed', 'info');
    }
  }

  getWidgetInfo(type) {
    const widgetsData = {
      weather: { name: 'Weather', icon: 'fas fa-cloud-sun', defaultSize: { w: 4, h: 3 } },
      crypto: { name: 'Crypto', icon: 'fab fa-bitcoin', defaultSize: { w: 4, h: 3 } },
      stocks: { name: 'Stocks', icon: 'fas fa-chart-line', defaultSize: { w: 4, h: 3 } },
      sports: { name: 'Sports', icon: 'fas fa-futbol', defaultSize: { w: 4, h: 3 } },
      countdown: { name: 'Countdown', icon: 'fas fa-hourglass-half', defaultSize: { w: 6, h: 3 } },
      notes: { name: 'Notes', icon: 'fas fa-sticky-note', defaultSize: { w: 4, h: 4 } },
      todo: { name: 'Todo', icon: 'fas fa-tasks', defaultSize: { w: 4, h: 4 } }
    };
    return widgetsData[type];
  }

  getWidgetName(type) {
    const info = this.getWidgetInfo(type);
    return info ? info.name : type.charAt(0).toUpperCase() + type.slice(1);
  }

  formatNumber(num) {
    if (num === null || num === undefined || isNaN(parseFloat(num))) return 'N/A';
    num = parseFloat(num);
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
  }

  // ===== LAYOUT MANAGEMENT =====

  saveLayout() {
    if (!this.currentUser || !this.grid) return;

    const layout = this.grid.save(false); // Save without saving GridStack nodes, just positions & sizes
    
    // Enhance layout with widget-specific config
    const serializableLayout = layout.map(item => {
        const widgetEl = item.el; // GridStack stores the element as 'el' if serialized with content
        const widgetId = widgetEl.dataset.widgetId;
        const widget = this.widgets.get(widgetId);
        if (widget) {
            return {
                id: widgetId, // Use widgetId as the GridStack item id
                type: widget.type,
                config: widget.config,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h
            };
        }
        return null; // Should not happen if widgets map is consistent
    }).filter(item => item !== null);

    localStorage.setItem(`dashboard-layout-${this.currentUser.id}`, JSON.stringify(serializableLayout));
  }

  loadLayout() {
    if (!this.currentUser) return;

    const saved = localStorage.getItem(`dashboard-layout-${this.currentUser.id}`);
    if (!saved) return;

    try {
      const layoutItems = JSON.parse(saved);
      // GridStack's load method expects items to be added later or specific format
      // We will add widgets one by one using our addWidget method with gridOptions
      
      // Sort to roughly maintain order, though GridStack might adjust
      layoutItems.sort((a, b) => a.y - b.y || a.x - b.x);
      
      // Temporarily disable saving during load to prevent multiple saves
      const originalGridOnChange = this.grid.opts.onChange;
      this.grid.off('change'); // Remove existing 'change' listeners

      layoutItems.forEach(item => {
        // Ensure widgetCounter is updated to avoid ID collisions if some widgets are not in layout
        const idNumMatch = item.id ? item.id.match(/\d+$/) : null;
        if (idNumMatch) {
            this.widgetCounter = Math.max(this.widgetCounter, parseInt(idNumMatch[0]));
        }
        
        this.addWidget(item.type, item.config, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          // id: item.id // Gridstack will assign its own internal ID, we use widgetId for our tracking
        });
      });

      // Re-enable saving
      this.grid.on('change', () => this.saveLayout());

    } catch (error) {
      console.error('Error loading layout:', error);
      this.showToast('Error loading saved layout', 'error');
      // Optionally, clear broken layout
      // localStorage.removeItem(`dashboard-layout-${this.currentUser.id}`);
    }
  }

  resetLayout() {
    if (this.grid) {
      this.grid.removeAll(); // Clears GridStack items
    }
    this.widgets.forEach(widget => {
        if (widget.countdownInterval) clearInterval(widget.countdownInterval);
    });
    this.widgets.clear(); // Clears our widget map

    if (this.currentUser) {
      localStorage.removeItem(`dashboard-layout-${this.currentUser.id}`);
    }
    this.widgetCounter = 0; // Reset counter
    this.checkEmptyState();
    this.showToast('Layout reset', 'info');
  }

  checkEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const hasWidgets = this.widgets.size > 0;

    if (emptyState) {
      emptyState.classList.toggle('hidden', hasWidgets);
    }
  }

  // ===== ESP32 DEVICE MANAGEMENT =====

  loadESP32Devices() {
    if (!this.currentUser) return;

    const saved = localStorage.getItem(`esp32-devices-${this.currentUser.id}`);
    if (saved) {
      try {
        const devices = JSON.parse(saved);
        devices.forEach(device => {
          this.esp32Devices.set(device.id, device);
        });
      } catch (error) {
        console.error('Error loading ESP32 devices:', error);
      }
    }
  }

  renderESP32Devices() {
    const container = document.getElementById('esp32-devices');
    if (!container) return;
    const devices = Array.from(this.esp32Devices.values());

    if (devices.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No ESP32 devices registered</p>';
    } else {
      container.innerHTML = devices.map(device => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem;">
          <div>
            <div style="font-weight: 600;">${device.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${device.id}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Added: ${new Date(device.dateAdded).toLocaleDateString()}</div>
          </div>
          <button class="remove-esp32-btn" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: var(--transition);" 
                  data-device-id="${device.id}"
                  onmouseover="this.style.background='var(--border-light)'"
                  onmouseout="this.style.background='transparent'">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
      
      // Add event listeners for remove buttons
      container.querySelectorAll('.remove-esp32-btn').forEach(button => {
          button.addEventListener('click', (e) => {
              const deviceId = e.currentTarget.dataset.deviceId;
              this.removeESP32Device(deviceId);
          });
      });
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
      id: id,
      name: name,
      dateAdded: new Date().toISOString(),
      userId: this.currentUser.id // Associate with current user
    };

    this.esp32Devices.set(id, device);
    this.saveESP32Devices();
    this.renderESP32Devices(); // Re-render the list

    nameInput.value = ''; // Clear inputs
    idInput.value = '';

    this.showToast(`Device "${name}" registered successfully`, 'success');
  }

  removeESP32Device(deviceId) {
    const device = this.esp32Devices.get(deviceId);
    if (!device) return;

    if (confirm(`Remove device "${device.name}"?`)) {
      this.esp32Devices.delete(deviceId);
      this.saveESP32Devices();
      this.renderESP32Devices(); // Re-render the list
      this.showToast('Device removed', 'info');
    }
  }

  saveESP32Devices() {
    if (!this.currentUser) return;

    const devices = Array.from(this.esp32Devices.values());
    localStorage.setItem(`esp32-devices-${this.currentUser.id}`, JSON.stringify(devices));
  }


  // ===== NOTIFICATIONS =====

  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn("Toast container not found. Message:", message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // e.g., 'info', 'success', 'error'
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Trigger fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);


    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300); // Matches CSS transition time
    }, 3000); // Toast visible for 3 seconds
  }

  // ===== AUTO REFRESH =====

  startAutoRefresh() {
    // Refresh widgets every 5 minutes
    this.autoRefreshInterval = setInterval(() => {
      if (document.hidden) return; // Don't refresh if tab is not visible

      this.widgets.forEach((widget, widgetId) => {
        // Avoid refreshing widgets that are primarily user-input driven or have their own refresh logic
        if (!['notes', 'todo', 'countdown'].includes(widget.type)) {
          console.log(`Auto-refreshing widget: ${widgetId}`);
          this.loadWidgetData(widgetId);
        }
      });
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Check GridStack loading
  if (typeof GridStack === 'undefined') {
    console.error('GridStack failed to load!');
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 2rem; background-color: #f8f9fa; color: #333;">
        <div>
          <h1 style="color: #dc3545; margin-bottom: 1rem;">Error: Dashboard Core Component Failed to Load</h1>
          <p style="color: #6c757d;">The dashboard layout system (GridStack.js) could not be initialized. Please check your internet connection, ensure JavaScript is enabled, and try refreshing the page. If the problem persists, contact support.</p>
        </div>
      </div>
    `;
    return;
  }

  // Initialize dashboard
  window.dashboard = new EnhancedDashboard();

  console.log('🚀 Enhanced Dashboard initialized');
  if(GridStack.version) console.log('✅ GridStack loaded successfully:', GridStack.version);
});

// ===== GLOBAL ERROR HANDLING =====

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error, 'at', e.filename, e.lineno, ':', e.colno);
  if (window.dashboard && typeof window.dashboard.showToast === 'function') {
    window.dashboard.showToast('A critical error occurred. Some features may not work.', 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.dashboard && typeof window.dashboard.showToast === 'function') {
    window.dashboard.showToast('An unexpected error occurred.', 'error');
  }
});


// ===== PAGE VISIBILITY HANDLING =====

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.dashboard && window.dashboard.currentUser) {
    // Optionally, refresh some data when page becomes visible after being hidden
    console.log("Dashboard tab became visible. Checking for data refresh...");
    // Example: refresh non-interactive widgets immediately
    setTimeout(() => {
      window.dashboard.widgets.forEach((widget, widgetId) => {
        if (!['notes', 'todo', 'countdown'].includes(widget.type)) {
          window.dashboard.loadWidgetData(widgetId);
        }
      });
    }, 1000); // Delay slightly
  }
});
