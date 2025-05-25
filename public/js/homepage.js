/**
 * homepage.js - Homepage functionality with authentication and real API data
 */

// Global application state
const appState = {
  currentUser: null,
  theme: localStorage.getItem('homepage-theme') || 'light',
  layout: localStorage.getItem('homepage-layout') || 'balanced',
  isEditMode: false,
  widgets: new Map(),
  refreshInterval: null
};

// Widget templates with real API integration
const widgetTemplates = {
  weather: {
    type: 'weather',
    title: 'Weather',
    icon: 'fa-cloud-sun',
    gradient: 'linear-gradient(135deg, #e6f1ff 0%, #cce7ff 100%)',
    description: 'Real-time weather data for any location'
  },
  crypto: {
    type: 'crypto',
    title: 'Cryptocurrency',
    icon: 'fa-bitcoin',
    gradient: 'linear-gradient(135deg, #fff7e6 0%, #ffeccc 100%)',
    description: 'Live cryptocurrency prices and market data'
  },
  stocks: {
    type: 'stocks',
    title: 'Stocks',
    icon: 'fa-chart-line',
    gradient: 'linear-gradient(135deg, #e6fff1 0%, #ccffdd 100%)',
    description: 'Real-time stock prices and market information'
  },
  countdown: {
    type: 'countdown',
    title: 'Countdown',
    icon: 'fa-hourglass-half',
    gradient: 'linear-gradient(135deg, #f5e6ff 0%, #e6ccff 100%)',
    description: 'Count down to important events and dates'
  },
  notes: {
    type: 'notes',
    title: 'Notes',
    icon: 'fa-sticky-note',
    gradient: 'linear-gradient(135deg, #ffefe6 0%, #ffd6cc 100%)',
    description: 'Quick notes and reminders'
  },
  todo: {
    type: 'todo',
    title: 'To-Do List',
    icon: 'fa-tasks',
    gradient: 'linear-gradient(135deg, #e6fffc 0%, #ccf7f0 100%)',
    description: 'Task management and productivity'
  }
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  console.log('Homepage initializing...');
  
  // Load saved state
  loadAppState();
  
  // Apply theme
  applyTheme(appState.theme);
  
  // Apply layout
  applyLayout(appState.layout);
  
  // Setup event listeners
  setupEventListeners();
  
  // Check authentication status
  checkAuthStatus()
    .then(isAuthenticated => {
      if (isAuthenticated) {
        loadUserDashboard();
      } else {
        loadDefaultWidgets();
      }
    })
    .catch(error => {
      console.error('Authentication check failed:', error);
      loadDefaultWidgets();
    });
  
  // Setup auto-refresh for real-time data
  setupAutoRefresh();
  
  // Hide loading indicator
  hideLoadingIndicator();
});

// Authentication Functions
async function checkAuthStatus() {
  const token = localStorage.getItem('auth-token');
  if (!token) {
    updateUIByAuthState(false);
    return false;
  }
  
  try {
    const response = await fetch('/api/auth/user', {
      headers: {
        'x-auth-token': token
      }
    });
    
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    
    const userData = await response.json();
    appState.currentUser = userData;
    updateUIByAuthState(true);
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    localStorage.removeItem('auth-token');
    updateUIByAuthState(false);
    return false;
  }
}

function updateUIByAuthState(isAuthenticated) {
  const authSection = document.getElementById('auth-section');
  const customizeBtn = document.getElementById('customize-btn');
  
  if (isAuthenticated && appState.currentUser) {
    // Show authenticated UI
    authSection.innerHTML = `
      <div class="user-profile">
        <span class="user-welcome">Welcome, ${appState.currentUser.username}</span>
        <div class="dropdown">
          <button class="dropdown-toggle" id="userDropdown">
            <i class="fas fa-user-circle"></i>
          </button>
          <div class="dropdown-menu" id="userDropdownMenu">
            <button class="dropdown-item" id="profile-btn">
              <i class="fas fa-user me-2"></i>Profile
            </button>
            <button class="dropdown-item" id="saved-dashboards-btn">
              <i class="fas fa-save me-2"></i>Saved Dashboards
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" id="logout-btn">
              <i class="fas fa-sign-out-alt me-2"></i>Sign Out
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Show customize button
    if (customizeBtn) {
      customizeBtn.style.display = 'inline-flex';
    }
    
    // Setup dropdown functionality
    setupUserDropdown();
  } else {
    // Show unauthenticated UI
    authSection.innerHTML = `
      <button id="login-btn" class="btn btn-outline-light btn-sm me-2">Sign In</button>
      <button id="register-btn" class="btn btn-primary btn-sm">Sign Up</button>
    `;
    
    // Hide customize button
    if (customizeBtn) {
      customizeBtn.style.display = 'none';
    }
    
    // Setup auth button listeners
    setupAuthButtonListeners();
  }
}

function setupUserDropdown() {
  const toggle = document.getElementById('userDropdown');
  const menu = document.getElementById('userDropdownMenu');
  
  if (!toggle || !menu) return;

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // Setup menu items
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('profile-btn')?.addEventListener('click', () => {
    showToast('Profile functionality coming soon', 'info');
  });
  document.getElementById('saved-dashboards-btn')?.addEventListener('click', () => {
    showToast('Saved dashboards functionality coming soon', 'info');
  });
}

function setupAuthButtonListeners() {
  document.getElementById('login-btn')?.addEventListener('click', showLoginModal);
  document.getElementById('register-btn')?.addEventListener('click', showRegisterModal);
}

function showLoginModal() {
  const modalHTML = `
    <div class="modal-overlay" id="login-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>Sign In</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form class="auth-form" id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">Email Address</label>
              <input type="email" class="form-control" id="login-email" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <div class="input-group">
                <input type="password" class="form-control" id="login-password" required>
                <button class="btn btn-outline-secondary" type="button" id="toggle-login-password">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            
            <div id="login-error" class="error-message d-none"></div>
            
            <button type="submit" class="auth-btn login-btn">
              <span id="login-spinner" class="d-none">
                <i class="fas fa-spinner fa-spin me-2"></i>
              </span>
              Sign In
            </button>
            
            <div class="auth-switch">
              Don't have an account? <a href="#" id="switch-to-register">Sign up</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Setup event listeners
  const modal = document.getElementById('login-modal');
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#login-form').addEventListener('submit', handleLogin);
  modal.querySelector('#switch-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    modal.remove();
    showRegisterModal();
  });
  
  // Password toggle
  modal.querySelector('#toggle-login-password').addEventListener('click', function() {
    const passwordInput = modal.querySelector('#login-password');
    const icon = this.querySelector('i');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });
  
  // Focus email input
  modal.querySelector('#login-email').focus();
}

function showRegisterModal() {
  const modalHTML = `
    <div class="modal-overlay" id="register-modal">
      <div class="modal">
        <div class="modal-header">
          <h3>Create Account</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form class="auth-form" id="register-form">
            <div class="form-group">
              <label class="form-label" for="register-name">Username</label>
              <input type="text" class="form-control" id="register-name" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="register-email">Email Address</label>
              <input type="email" class="form-control" id="register-email" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="register-password">Password</label>
              <div class="input-group">
                <input type="password" class="form-control" id="register-password" required minlength="6">
                <button class="btn btn-outline-secondary" type="button" id="toggle-register-password">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
              <div class="form-text">Password must be at least 6 characters</div>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="register-confirm">Confirm Password</label>
              <input type="password" class="form-control" id="register-confirm" required minlength="6">
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="accept-terms" required>
              <label class="form-check-label" for="accept-terms">
                I agree to the Terms of Service
              </label>
            </div>
            
            <div id="register-error" class="error-message d-none"></div>
            
            <button type="submit" class="auth-btn register-btn">
              <span id="register-spinner" class="d-none">
                <i class="fas fa-spinner fa-spin me-2"></i>
              </span>
              Create Account
            </button>
            
            <div class="auth-switch">
              Already have an account? <a href="#" id="switch-to-login">Sign in</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Setup event listeners
  const modal = document.getElementById('register-modal');
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#register-form').addEventListener('submit', handleRegister);
  modal.querySelector('#switch-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    modal.remove();
    showLoginModal();
  });
  
  // Password toggle
  modal.querySelector('#toggle-register-password').addEventListener('click', function() {
    const passwordInput = modal.querySelector('#register-password');
    const icon = this.querySelector('i');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });
  
  // Focus username input
  modal.querySelector('#register-name').focus();
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const spinner = document.getElementById('login-spinner');
  
  // Show loading state
  submitBtn.disabled = true;
  spinner.classList.remove('d-none');
  errorDiv.classList.add('d-none');
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }
    
    const data = await response.json();
    
    // Store token and user data
    localStorage.setItem('auth-token', data.token);
    appState.currentUser = data.user;
    
    // Update UI
    updateUIByAuthState(true);
    
    // Close modal
    document.getElementById('login-modal').remove();
    
    // Show success toast
    showToast('Successfully signed in!', 'success');
    
    // Load user's dashboard
    loadUserDashboard();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('d-none');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const username = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  const errorDiv = document.getElementById('register-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const spinner = document.getElementById('register-spinner');
  
  // Validate passwords match
  if (password !== confirm) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.remove('d-none');
    return;
  }
  
  // Show loading state
  submitBtn.disabled = true;
  spinner.classList.remove('d-none');
  errorDiv.classList.add('d-none');
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Registration failed');
    }
    
    const data = await response.json();
    
    // Store token and user data
    localStorage.setItem('auth-token', data.token);
    appState.currentUser = data.user;
    
    // Update UI
    updateUIByAuthState(true);
    
    // Close modal
    document.getElementById('register-modal').remove();
    
    // Show success toast
    showToast('Account created successfully!', 'success');
    
    // Load default dashboard for new users
    loadDefaultWidgets();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('d-none');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
}

async function handleLogout() {
  try {
    const token = localStorage.getItem('auth-token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-auth-token': token
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local data
    localStorage.removeItem('auth-token');
    appState.currentUser = null;
    
    // Update UI
    updateUIByAuthState(false);
    
    // Show toast
    showToast('Successfully signed out', 'info');
    
    // Load default widgets
    loadDefaultWidgets();
  }
}

// Widget Loading Functions
async function loadUserDashboard() {
  try {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      loadDefaultWidgets();
      return;
    }
    
    const response = await fetch('/api/dashboards/current', {
      headers: {
        'x-auth-token': token
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.layout && data.layout.length > 0) {
        renderWidgets(data.layout);
        return;
      }
    }
    
    // Fallback to default widgets
    loadDefaultWidgets();
  } catch (error) {
    console.error('Error loading user dashboard:', error);
    loadDefaultWidgets();
  }
}

function loadDefaultWidgets() {
  const defaultWidgets = [
    { type: 'weather', config: { location: 'New York', units: 'imperial' } },
    { type: 'crypto', config: { coin: 'bitcoin', currency: 'usd' } },
    { type: 'stocks', config: { symbol: 'AAPL' } },
    { type: 'countdown', config: { title: 'New Year 2026', targetDate: '2026-01-01T00:00:00' } },
    { type: 'notes', config: { content: 'Welcome to your dashboard!\n\nThis is an interactive preview. Sign up to customize and save your own dashboard.', title: 'Welcome' } },
    { type: 'todo', config: { items: [
      { id: '1', text: 'Try the weather widget', completed: false },
      { id: '2', text: 'Check crypto prices', completed: false },
      { id: '3', text: 'Sign up for an account', completed: false }
    ] } }
  ];
  
  renderWidgets(defaultWidgets);
}

async function renderWidgets(widgets) {
  const grid = document.getElementById('widgets-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  appState.widgets.clear();
  
  for (const widget of widgets) {
    try {
      const widgetElement = await createWidgetElement(widget);
      if (widgetElement) {
        grid.appendChild(widgetElement);
        appState.widgets.set(widget.id || widget.type, widget);
      }
    } catch (error) {
      console.error(`Error creating widget ${widget.type}:`, error);
    }
  }
  
  // Setup widget listeners after rendering
  setupWidgetListeners();
}

async function createWidgetElement(widget) {
  const template = widgetTemplates[widget.type];
  if (!template) return null;
  
  const widgetId = widget.id || `${widget.type}-${Date.now()}`;
  
  // Create widget container
  const widgetEl = document.createElement('div');
  widgetEl.className = `widget ${widget.type}-widget`;
  widgetEl.style.background = template.gradient;
  widgetEl.dataset.type = widget.type;
  widgetEl.dataset.id = widgetId;
  
  // Create widget header
  const header = document.createElement('div');
  header.className = 'widget-header';
  header.innerHTML = `
    <div class="widget-title">
      <i class="widget-icon fas ${template.icon}"></i>
      <span>${template.title}</span>
    </div>
    <div class="widget-actions">
      <button class="widget-action" data-action="refresh" title="Refresh">
        <i class="fas fa-sync-alt"></i>
      </button>
      <button class="widget-action" data-action="configure" title="Configure">
        <i class="fas fa-cog"></i>
      </button>
    </div>
  `;
  
  // Create widget content
  const content = document.createElement('div');
  content.className = 'widget-content';
  content.innerHTML = '<div class="loading-spinner"></div>';
  
  widgetEl.appendChild(header);
  widgetEl.appendChild(content);
  
  // Load widget data
  loadWidgetData(widgetEl, widget);
  
  return widgetEl;
}

async function loadWidgetData(widgetElement, widget) {
  const content = widgetElement.querySelector('.widget-content');
  const config = widget.config || {};
  
  try {
    // Build query parameters
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(config)) {
      params.append(key, value);
    }
    
    const response = await fetch(`/api/widget/${widget.type}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Render widget content based on type
    renderWidgetContent(content, widget.type, result.data, config);
    
  } catch (error) {
    console.error(`Error loading ${widget.type} widget:`, error);
    content.innerHTML = `
      <div class="widget-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load data</p>
      </div>
    `;
  }
}

function renderWidgetContent(container, type, data, config) {
  switch (type) {
    case 'weather':
      renderWeatherWidget(container, data);
      break;
    case 'crypto':
      renderCryptoWidget(container, data);
      break;
    case 'stocks':
      renderStocksWidget(container, data);
      break;
    case 'countdown':
      renderCountdownWidget(container, data, config);
      break;
    case 'notes':
      renderNotesWidget(container, data, config);
      break;
    case 'todo':
      renderTodoWidget(container, data, config);
      break;
    default:
      container.innerHTML = '<p>Unknown widget type</p>';
  }
}

function renderWeatherWidget(container, data) {
  const temp = Math.round(data.temp);
  const unit = data.units === 'metric' ? '°C' : '°F';
  
  container.innerHTML = `
    <div class="weather-location">${data.location}</div>
    <div class="weather-main">
      <div class="weather-icon">
        <i class="fas fa-sun"></i>
      </div>
      <div class="weather-temp">${temp}${unit}</div>
    </div>
    <div class="weather-condition">${data.condition}</div>
    <div class="weather-details">
      <div class="weather-detail">
        <div class="weather-detail-label">Humidity</div>
        <div class="weather-detail-value">${data.humidity}%</div>
      </div>
      <div class="weather-detail">
        <div class="weather-detail-label">Wind</div>
        <div class="weather-detail-value">${data.wind} mph</div>
      </div>
      <div class="weather-detail">
        <div class="weather-detail-label">Pressure</div>
        <div class="weather-detail-value">${data.pressure} hPa</div>
      </div>
    </div>
  `;
}

function renderCryptoWidget(container, data) {
  const price = formatCryptoPrice(data.price, data.currency);
  const changeClass = parseFloat(data.change24h) >= 0 ? 'positive' : 'negative';
  const changeIcon = parseFloat(data.change24h) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
  const currencySymbol = getCurrencySymbol(data.currency);
  
  container.innerHTML = `
    <div class="crypto-symbol">${data.coin}</div>
    <div class="crypto-price">${currencySymbol}${price}</div>
    <div class="crypto-change ${changeClass}">
      <i class="fas ${changeIcon}"></i>
      ${data.change24h}% (24h)
    </div>
    <div class="crypto-stats">
      <div class="crypto-stat">
        <div class="crypto-stat-label">Market Cap</div>
        <div class="crypto-stat-value">${currencySymbol}${formatLargeNumber(data.marketCap)}</div>
      </div>
      <div class="crypto-stat">
        <div class="crypto-stat-label">Volume</div>
        <div class="crypto-stat-value">${currencySymbol}${formatLargeNumber(data.volume24h)}</div>
      </div>
    </div>
  `;
}

function renderStocksWidget(container, data) {
  const changeClass = parseFloat(data.change) >= 0 ? 'positive' : 'negative';
  const changeIcon = parseFloat(data.change) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
  
  container.innerHTML = `
    <div class="stock-symbol">${data.symbol}</div>
    <div class="stock-price">$${parseFloat(data.price).toFixed(2)}</div>
    <div class="stock-change ${changeClass}">
      <i class="fas ${changeIcon}"></i>
      ${data.change} (${data.changePercent})
    </div>
    <div class="stock-stats">
      <div class="stock-stat">
        <div class="stock-stat-label">Volume</div>
        <div class="stock-stat-value">${formatLargeNumber(data.volume)}</div>
      </div>
      <div class="stock-stat">
        <div class="stock-stat-label">Prev Close</div>
        <div class="stock-stat-value">$${parseFloat(data.previousClose).toFixed(2)}</div>
      </div>
    </div>
  `;
}

function renderCountdownWidget(container, data, config) {
  const targetDate = new Date(data.targetDate);
  const now = new Date();
  const diff = targetDate - now;
  
  if (diff <= 0) {
    container.innerHTML = `
      <div class="countdown-title">${data.title}</div>
      <div class="countdown-completed">
        <i class="fas fa-check-circle fa-3x text-success"></i>
        <div>Event Complete!</div>
      </div>
    `;
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  const widgetId = config.widgetId || 'countdown-default';
  
  container.innerHTML = `
    <div class="countdown-title">${data.title}</div>
    <div class="countdown-timer">
      <div class="countdown-unit">
        <span class="countdown-value" id="countdown-days-${widgetId}">${days}</span>
        <div class="countdown-label">Days</div>
      </div>
      <div class="countdown-unit">
        <span class="countdown-value" id="countdown-hours-${widgetId}">${hours.toString().padStart(2, '0')}</span>
        <div class="countdown-label">Hours</div>
      </div>
      <div class="countdown-unit">
        <span class="countdown-value" id="countdown-minutes-${widgetId}">${minutes.toString().padStart(2, '0')}</span>
        <div class="countdown-label">Minutes</div>
      </div>
      <div class="countdown-unit">
        <span class="countdown-value" id="countdown-seconds-${widgetId}">${seconds.toString().padStart(2, '0')}</span>
        <div class="countdown-label">Seconds</div>
      </div>
    </div>
  `;
  
  // Update countdown every second
  const countdownInterval = setInterval(() => {
    updateCountdownWidget(widgetId, { config: data });
  }, 1000);
  
  // Store interval for cleanup
  container.dataset.interval = countdownInterval;
}

function renderNotesWidget(container, data, config) {
  const content = data.content || '';
  const title = data.title || 'Notes';
  const widgetId = config.widgetId || 'notes-default';
  
  container.innerHTML = `
    <input type="text" class="notes-title-input" value="${title}" placeholder="Notes title...">
    <textarea class="notes-textarea" placeholder="Start typing your notes here...">${content}</textarea>
    <div class="notes-footer">
      <div id="notes-stats-${widgetId}">0 words, 0 characters</div>
      <div>Auto-save enabled</div>
    </div>
  `;
  
  // Setup notes functionality
  setupNotesListeners(widgetId, container);
  updateNotesWidget(widgetId, { config: data });
}

function renderTodoWidget(container, data, config) {
  const items = data.items || [];
  const title = data.title || 'To-Do List';
  const widgetId = config.widgetId || 'todo-default';
  
  const activeItems = items.filter(item => !item.completed);
  const completedCount = items.length - activeItems.length;
  
  let itemsHTML = '';
  if (items.length === 0) {
    itemsHTML = `
      <div class="todo-empty">
        <i class="fas fa-clipboard-check fa-2x"></i>
        <p>No tasks yet. Add one above!</p>
      </div>
    `;
  } else {
    itemsHTML = items.slice(0, 3).map(item => `
      <div class="todo-item ${item.completed ? 'completed' : ''}">
        <input type="checkbox" class="todo-checkbox" ${item.completed ? 'checked' : ''} data-id="${item.id}">
        <span class="todo-text">${escapeHtml(item.text)}</span>
      </div>
    `).join('');
    
    if (items.length > 3) {
      itemsHTML += `<div class="todo-more">+${items.length - 3} more tasks</div>`;
    }
  }
  
  container.innerHTML = `
    <div class="todo-header">
      <h4>${title}</h4>
      <div class="todo-stats">${activeItems.length} active${completedCount > 0 ? `, ${completedCount} done` : ''}</div>
    </div>
    <input type="text" class="todo-input" placeholder="Add a new task..." maxlength="100">
    <div class="todo-list">
      ${itemsHTML}
    </div>
  `;
  
  // Setup todo functionality
  setupTodoListeners(widgetId, container);
}

// Widget Update Functions
function updateCountdownWidget(widgetId, widget) {
  const targetDate = new Date(widget.config.targetDate || '2026-01-01T00:00:00');
  const now = new Date();
  const diff = targetDate - now;
  
  const daysEl = document.getElementById(`countdown-days-${widgetId}`);
  const hoursEl = document.getElementById(`countdown-hours-${widgetId}`);
  const minutesEl = document.getElementById(`countdown-minutes-${widgetId}`);
  const secondsEl = document.getElementById(`countdown-seconds-${widgetId}`);
  
  if (diff <= 0) {
    if (daysEl) daysEl.textContent = '00';
    if (hoursEl) hoursEl.textContent = '00';
    if (minutesEl) minutesEl.textContent = '00';
    if (secondsEl) secondsEl.textContent = '00';
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (daysEl) daysEl.textContent = days;
  if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
  if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
  if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
}

function updateNotesWidget(widgetId, widget) {
  const content = widget.config.content || '';
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const characters = content.length;
  
  const statsEl = document.getElementById(`notes-stats-${widgetId}`);
  if (statsEl) {
    statsEl.textContent = `${words} words, ${characters} characters`;
  }
}

// Widget Event Listeners
function setupNotesListeners(widgetId, container) {
  const textarea = container.querySelector('.notes-textarea');
  const titleInput = container.querySelector('.notes-title-input');
  
  if (textarea) {
    textarea.addEventListener('input', () => {
      updateNotesWidget(widgetId, {
        config: { content: textarea.value }
      });
    });
  }
  
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      // Handle title changes
    });
  }
}

function setupTodoListeners(widgetId, container) {
  const input = container.querySelector('.todo-input');
  const checkboxes = container.querySelectorAll('.todo-checkbox');
  
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        // Add new todo item (simplified for demo)
        showToast('Sign up to save todo items!', 'info');
        input.value = '';
      }
    });
  }
  
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // Handle checkbox changes (simplified for demo)
      showToast('Sign up to save changes!', 'info');
    });
  });
}

// Utility Functions
function formatLargeNumber(num) {
  if (num >= 1e12) {
    return (num / 1e12).toFixed(1) + 'T';
  } else if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  } else {
    return num.toString();
  }
}

function formatCryptoPrice(price, currency) {
  if (currency === 'btc' || currency === 'eth') {
    return parseFloat(price).toPrecision(6);
  }
  
  if (price >= 1000000) {
    return (price / 1000000).toFixed(2) + 'M';
  } else if (price >= 1000) {
    return (price / 1000).toFixed(2) + 'K';
  } else if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else {
    return price.toPrecision(4);
  }
}

function getCurrencySymbol(currency) {
  const symbols = {
    'usd': '$',
    'eur': '€',
    'btc': '₿',
    'eth': 'Ξ'
  };
  return symbols[currency] || ';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners Setup
function setupEventListeners() {
  // Theme switcher
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const theme = this.dataset.theme;
      applyTheme(theme);
      
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      showToast(`Theme changed to ${theme}`, 'success');
    });
  });
  
  // Layout switcher
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const layout = this.dataset.layout;
      applyLayout(layout);
      
      document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      showToast(`Layout changed to ${layout}`, 'success');
    });
  });
  
  // Customize button
  document.getElementById('customize-btn')?.addEventListener('click', showDashboardCustomizer);
}

function setupWidgetListeners() {
  // Widget action buttons
  document.querySelectorAll('.widget-action').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const action = this.dataset.action;
      const widget = this.closest('.widget');
      const widgetType = widget.dataset.type;
      
      if (action === 'refresh') {
        refreshWidget(widget);
      } else if (action === 'configure') {
        showToast('Sign up to configure widgets!', 'info');
      }
    });
  });
}

async function refreshWidget(widgetElement) {
  const widgetType = widgetElement.dataset.type;
  const widgetId = widgetElement.dataset.id;
  const widget = appState.widgets.get(widgetId) || { type: widgetType, config: {} };
  
  // Show refresh animation
  const refreshBtn = widgetElement.querySelector('[data-action="refresh"]');
  if (refreshBtn) {
    refreshBtn.querySelector('i').classList.add('fa-spin');
    setTimeout(() => {
      refreshBtn.querySelector('i').classList.remove('fa-spin');
    }, 1000);
  }
  
  // Reload widget data
  await loadWidgetData(widgetElement, widget);
  showToast('Widget refreshed', 'success');
}

// Theme and Layout Functions
function applyTheme(theme) {
  appState.theme = theme;
  localStorage.setItem('homepage-theme', theme);
  
  document.body.className = document.body.className.replace(/theme-\w+/g, '');
  document.body.classList.add(`theme-${theme}`);
}

function applyLayout(layout) {
  appState.layout = layout;
  localStorage.setItem('homepage-layout', layout);
  
  const grid = document.getElementById('widgets-grid');
  if (grid) {
    grid.className = grid.className.replace(/grid-\w+/g, '');
    grid.classList.add(`grid-${layout}`);
  }
}

function loadAppState() {
  // Load theme preference
  const savedTheme = localStorage.getItem('homepage-theme');
  if (savedTheme) {
    appState.theme = savedTheme;
    document.querySelector(`[data-theme="${savedTheme}"]`)?.classList.add('active');
    document.querySelector('[data-theme]:not([data-theme="' + savedTheme + '"])')?.classList.remove('active');
  }
  
  // Load layout preference
  const savedLayout = localStorage.getItem('homepage-layout');
  if (savedLayout) {
    appState.layout = savedLayout;
    document.querySelector(`[data-layout="${savedLayout}"]`)?.classList.add('active');
    document.querySelectorAll('[data-layout]:not([data-layout="' + savedLayout + '"])').forEach(btn => {
      btn.classList.remove('active');
    });
  }
}

// Auto-refresh Functions
function setupAutoRefresh() {
  // Refresh widgets every 5 minutes
  appState.refreshInterval = setInterval(() => {
    refreshAllWidgets();
  }, 5 * 60 * 1000);
}

async function refreshAllWidgets() {
  const widgets = document.querySelectorAll('.widget');
  for (const widget of widgets) {
    const widgetType = widget.dataset.type;
    const widgetId = widget.dataset.id;
    const widgetData = appState.widgets.get(widgetId);
    
    if (widgetData) {
      await loadWidgetData(widget, widgetData);
    }
  }
  console.log('All widgets refreshed');
}

// Dashboard Customizer (Placeholder)
function showDashboardCustomizer() {
  showToast('Dashboard customization coming soon! Try the full dashboard for advanced features.', 'info');
}

// Toast System
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // Auto-remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Loading Indicator
function hideLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (appState.refreshInterval) {
    clearInterval(appState.refreshInterval);
  }
  
  // Clear any countdown intervals
  document.querySelectorAll('.widget-content[data-interval]').forEach(content => {
    const interval = content.dataset.interval;
    if (interval) {
      clearInterval(parseInt(interval));
    }
  });
});
