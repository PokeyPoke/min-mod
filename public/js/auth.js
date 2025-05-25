/**
 * auth.js - Authentication system for the dashboard
 * Handles user registration, login, logout, and session management
 */

(function() {
  'use strict';

  class AuthManager {
    constructor() {
      this.currentUser = null;
      this.authToken = localStorage.getItem('auth-token');
      this.callbacks = {
        onLogin: [],
        onLogout: [],
        onAuthStateChange: []
      };
      
      // Initialize authentication state on load
      this.initialize();
    }

    /**
     * Initialize authentication system
     */
    async initialize() {
      // Check existing token
      if (this.authToken) {
        try {
          await this.validateToken();
        } catch (error) {
          console.error('Token validation failed:', error);
          this.logout();
        }
      }
      
      // Setup UI event listeners
      this.setupEventListeners();
      
      // Update UI based on auth state
      this.updateUI();
    }

    /**
     * Setup authentication event listeners
     */
    setupEventListeners() {
      // Handle login button clicks
      document.addEventListener('click', (e) => {
        if (e.target.id === 'login-btn' || e.target.closest('#login-btn')) {
          e.preventDefault();
          this.showLoginModal();
        }
        
        if (e.target.id === 'register-btn' || e.target.closest('#register-btn')) {
          e.preventDefault();
          this.showRegisterModal();
        }
        
        if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
          e.preventDefault();
          this.showLogoutConfirmation();
        }
      });

      // Handle keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Ctrl+L for login
        if (e.ctrlKey && e.key === 'l' && !this.isAuthenticated()) {
          e.preventDefault();
          this.showLoginModal();
        }
      });
    }

    /**
     * Validate authentication token
     */
    async validateToken() {
      if (!this.authToken) {
        throw new Error('No token available');
      }

      const response = await fetch('/api/auth/user', {
        headers: {
          'x-auth-token': this.authToken
        }
      });

      if (!response.ok) {
        throw new Error('Token validation failed');
      }

      const userData = await response.json();
      this.currentUser = userData;
      
      return userData;
    }

    /**
     * Show login modal
     */
    showLoginModal() {
      const modal = this.createModal('Sign In', `
        <form id="login-form" class="auth-form">
          <div class="form-group mb-3">
            <label for="login-email" class="form-label">Email Address</label>
            <input type="email" class="form-control" id="login-email" name="email" required autofocus>
          </div>
          
          <div class="form-group mb-3">
            <label for="login-password" class="form-label">Password</label>
            <div class="input-group">
              <input type="password" class="form-control" id="login-password" name="password" required>
              <button class="btn btn-outline-secondary toggle-password" type="button" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="remember-me">
              <label class="form-check-label" for="remember-me">Remember me</label>
            </div>
            <a href="#" class="forgot-password-link">Forgot password?</a>
          </div>
          
          <div id="login-error" class="alert alert-danger d-none"></div>
          
          <div class="d-grid gap-2">
            <button type="submit" class="btn btn-primary" id="login-submit">
              <span class="spinner-border spinner-border-sm d-none me-2" role="status"></span>
              Sign In
            </button>
          </div>
          
          <div class="text-center mt-3">
            <span>Don't have an account? </span>
            <a href="#" class="switch-to-register">Create one</a>
          </div>
        </form>
      `);

      // Setup form handlers
      this.setupLoginForm(modal);
      this.setupPasswordToggle(modal);
      this.setupModalSwitching(modal);
    }

    /**
     * Show registration modal
     */
    showRegisterModal() {
      const modal = this.createModal('Create Account', `
        <form id="register-form" class="auth-form">
          <div class="form-group mb-3">
            <label for="register-username" class="form-label">Username</label>
            <input type="text" class="form-control" id="register-username" name="username" required autofocus>
            <div class="form-text">Choose a unique username for your account</div>
          </div>
          
          <div class="form-group mb-3">
            <label for="register-email" class="form-label">Email Address</label>
            <input type="email" class="form-control" id="register-email" name="email" required>
          </div>
          
          <div class="form-group mb-3">
            <label for="register-password" class="form-label">Password</label>
            <div class="input-group">
              <input type="password" class="form-control" id="register-password" name="password" required minlength="6">
              <button class="btn btn-outline-secondary toggle-password" type="button" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <div class="form-text">Password must be at least 6 characters long</div>
          </div>
          
          <div class="form-group mb-3">
            <label for="register-confirm-password" class="form-label">Confirm Password</label>
            <div class="input-group">
              <input type="password" class="form-control" id="register-confirm-password" name="confirmPassword" required minlength="6">
              <button class="btn btn-outline-secondary toggle-password" type="button" tabindex="-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="accept-terms" required>
            <label class="form-check-label" for="accept-terms">
              I agree to the <a href="#" class="terms-link">Terms of Service</a> and <a href="#" class="privacy-link">Privacy Policy</a>
            </label>
          </div>
          
          <div id="register-error" class="alert alert-danger d-none"></div>
          
          <div class="d-grid gap-2">
            <button type="submit" class="btn btn-primary" id="register-submit">
              <span class="spinner-border spinner-border-sm d-none me-2" role="status"></span>
              Create Account
            </button>
          </div>
          
          <div class="text-center mt-3">
            <span>Already have an account? </span>
            <a href="#" class="switch-to-login">Sign in</a>
          </div>
        </form>
      `);

      // Setup form handlers
      this.setupRegisterForm(modal);
      this.setupPasswordToggle(modal);
      this.setupModalSwitching(modal);
    }

    /**
     * Setup login form submission
     */
    setupLoginForm(modal) {
      const form = modal.querySelector('#login-form');
      const submitBtn = modal.querySelector('#login-submit');
      const spinner = submitBtn.querySelector('.spinner-border');
      const errorDiv = modal.querySelector('#login-error');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading state
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        errorDiv.classList.add('d-none');

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const rememberMe = formData.get('remember-me');

        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }

          // Store authentication data
          this.authToken = data.token;
          this.currentUser = data.user;
          localStorage.setItem('auth-token', this.authToken);

          // Handle remember me
          if (rememberMe) {
            localStorage.setItem('remember-email', email);
          } else {
            localStorage.removeItem('remember-email');
          }

          // Close modal and update UI
          this.closeModal(modal);
          this.updateUI();
          this.showToast('Successfully signed in!', 'success');
          
          // Trigger callbacks
          this.triggerCallbacks('onLogin', this.currentUser);
          this.triggerCallbacks('onAuthStateChange', { authenticated: true, user: this.currentUser });

        } catch (error) {
          this.showError(errorDiv, error.message);
        } finally {
          submitBtn.disabled = false;
          spinner.classList.add('d-none');
        }
      });

      // Pre-fill email if remembered
      const rememberedEmail = localStorage.getItem('remember-email');
      if (rememberedEmail) {
        form.querySelector('#login-email').value = rememberedEmail;
        form.querySelector('#remember-me').checked = true;
      }
    }

    /**
     * Setup registration form submission
     */
    setupRegisterForm(modal) {
      const form = modal.querySelector('#register-form');
      const submitBtn = modal.querySelector('#register-submit');
      const spinner = submitBtn.querySelector('.spinner-border');
      const errorDiv = modal.querySelector('#register-error');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate passwords match
        const password = form.querySelector('#register-password').value;
        const confirmPassword = form.querySelector('#register-confirm-password').value;
        
        if (password !== confirmPassword) {
          this.showError(errorDiv, 'Passwords do not match');
          return;
        }

        // Show loading state
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        errorDiv.classList.add('d-none');

        const formData = new FormData(form);
        const username = formData.get('username');
        const email = formData.get('email');

        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
          }

          // Store authentication data
          this.authToken = data.token;
          this.currentUser = data.user;
          localStorage.setItem('auth-token', this.authToken);

          // Close modal and update UI
          this.closeModal(modal);
          this.updateUI();
          this.showToast('Account created successfully!', 'success');
          
          // Trigger callbacks
          this.triggerCallbacks('onLogin', this.currentUser);
          this.triggerCallbacks('onAuthStateChange', { authenticated: true, user: this.currentUser });

          // Show welcome tutorial for new users
          setTimeout(() => this.showWelcomeTutorial(), 1000);

        } catch (error) {
          this.showError(errorDiv, error.message);
        } finally {
          submitBtn.disabled = false;
          spinner.classList.add('d-none');
        }
      });
    }

    /**
     * Setup password visibility toggle
     */
    setupPasswordToggle(modal) {
      modal.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
          const input = button.previousElementSibling;
          const icon = button.querySelector('i');
          
          if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        });
      });
    }

    /**
     * Setup modal switching between login and register
     */
    setupModalSwitching(modal) {
      const switchToRegister = modal.querySelector('.switch-to-register');
      const switchToLogin = modal.querySelector('.switch-to-login');
      
      if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeModal(modal);
          setTimeout(() => this.showRegisterModal(), 150);
        });
      }
      
      if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeModal(modal);
          setTimeout(() => this.showLoginModal(), 150);
        });
      }
    }

    /**
     * Show logout confirmation
     */
    showLogoutConfirmation() {
      const modal = this.createModal('Sign Out', `
        <div class="text-center">
          <div class="mb-3">
            <i class="fas fa-sign-out-alt fa-3x text-warning"></i>
          </div>
          <h5>Are you sure you want to sign out?</h5>
          <p class="text-muted">You'll need to sign in again to access your dashboard.</p>
          <div class="d-flex justify-content-center gap-2 mt-4">
            <button class="btn btn-outline-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" id="confirm-logout">Sign Out</button>
          </div>
        </div>
      `);

      modal.querySelector('#confirm-logout').addEventListener('click', () => {
        this.logout();
        this.closeModal(modal);
      });
    }

    /**
     * Logout user
     */
    logout() {
      this.authToken = null;
      this.currentUser = null;
      localStorage.removeItem('auth-token');
      
      this.updateUI();
      this.showToast('Successfully signed out', 'info');
      
      // Trigger callbacks
      this.triggerCallbacks('onLogout');
      this.triggerCallbacks('onAuthStateChange', { authenticated: false, user: null });
    }

    /**
     * Update UI based on authentication state
     */
    updateUI() {
      const authSection = document.getElementById('auth-section');
      const devicesBtn = document.getElementById('devices-btn');
      
      if (!authSection) return;

      if (this.isAuthenticated()) {
        // Show authenticated UI
        authSection.innerHTML = `
          <div class="user-profile">
            <span class="user-welcome">Welcome, ${this.currentUser.username}</span>
            <div class="dropdown">
              <button class="btn btn-outline-light dropdown-toggle" type="button" id="userDropdown">
                <i class="fas fa-user-circle"></i>
              </button>
              <div class="dropdown-menu dropdown-menu-end" id="userDropdownMenu">
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
        
        // Setup dropdown functionality
        this.setupUserDropdown();
        
        // Show devices button
        if (devicesBtn) {
          devicesBtn.style.display = 'inline-flex';
        }
        
      } else {
        // Show unauthenticated UI
        authSection.innerHTML = `
          <button id="login-btn" class="btn btn-outline-light btn-sm me-2">Sign In</button>
          <button id="register-btn" class="btn btn-primary btn-sm">Sign Up</button>
        `;
        
        // Hide devices button
        if (devicesBtn) {
          devicesBtn.style.display = 'none';
        }
      }
    }

    /**
     * Setup user dropdown functionality
     */
    setupUserDropdown() {
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

      // Handle dropdown menu items
      const profileBtn = document.getElementById('profile-btn');
      if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
          e.preventDefault();
          menu.style.display = 'none';
          this.showProfileModal();
        });
      }

      const dashboardsBtn = document.getElementById('saved-dashboards-btn');
      if (dashboardsBtn) {
        dashboardsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          menu.style.display = 'none';
          this.showSavedDashboardsModal();
        });
      }
    }

    /**
     * Show profile management modal
     */
    showProfileModal() {
      if (!this.currentUser) return;

      const modal = this.createModal('Your Profile', `
        <form id="profile-form">
          <div class="form-group mb-3">
            <label for="profile-username" class="form-label">Username</label>
            <input type="text" class="form-control" id="profile-username" name="username" value="${this.currentUser.username}" required>
          </div>
          
          <div class="form-group mb-3">
            <label for="profile-email" class="form-label">Email Address</label>
            <input type="email" class="form-control" id="profile-email" name="email" value="${this.currentUser.email}" readonly>
            <div class="form-text">Email cannot be changed</div>
          </div>
          
          <hr>
          
          <h5>Change Password</h5>
          <div class="form-group mb-3">
            <label for="current-password" class="form-label">Current Password</label>
            <input type="password" class="form-control" id="current-password" name="currentPassword">
          </div>
          
          <div class="form-group mb-3">
            <label for="new-password" class="form-label">New Password</label>
            <input type="password" class="form-control" id="new-password" name="newPassword" minlength="6">
          </div>
          
          <div class="form-group mb-3">
            <label for="confirm-new-password" class="form-label">Confirm New Password</label>
            <input type="password" class="form-control" id="confirm-new-password" name="confirmNewPassword" minlength="6">
          </div>
          
          <div id="profile-error" class="alert alert-danger d-none"></div>
          <div id="profile-success" class="alert alert-success d-none"></div>
          
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      `);

      // Setup profile form submission (placeholder - would need backend support)
      modal.querySelector('#profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this.showToast('Profile update feature coming soon', 'info');
      });
    }

    /**
     * Show saved dashboards modal
     */
    showSavedDashboardsModal() {
      const modal = this.createModal('Saved Dashboards', `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Your Dashboards</h5>
          <button class="btn btn-primary btn-sm" id="save-current-btn">
            <i class="fas fa-save me-1"></i>Save Current
          </button>
        </div>
        
        <div id="dashboards-list">
          <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            Dashboard management feature coming soon
          </div>
        </div>
      `);

      modal.querySelector('#save-current-btn').addEventListener('click', () => {
        this.showToast('Dashboard save feature coming soon', 'info');
      });
    }

    /**
     * Show welcome tutorial for new users
     */
    showWelcomeTutorial() {
      const modal = this.createModal('Welcome to Your Dashboard!', `
        <div class="text-center">
          <div class="mb-4">
            <i class="fas fa-rocket fa-4x text-primary"></i>
          </div>
          <h4>You're all set!</h4>
          <p class="text-muted mb-4">Your account has been created successfully. Here's what you can do next:</p>
          
          <div class="list-group list-group-flush">
            <div class="list-group-item border-0">
              <i class="fas fa-plus-circle text-primary me-3"></i>
              <strong>Add Widgets</strong> - Click "Add Widget" to customize your dashboard
            </div>
            <div class="list-group-item border-0">
              <i class="fas fa-palette text-primary me-3"></i>
              <strong>Choose Themes</strong> - Select from different visual themes
            </div>
            <div class="list-group-item border-0">
              <i class="fas fa-mobile-alt text-primary me-3"></i>
              <strong>Connect Devices</strong> - Link your ESP32 displays to show your dashboard
            </div>
          </div>
          
          <button class="btn btn-primary mt-4" onclick="this.closest('.modal-overlay').remove()">Get Started</button>
        </div>
      `, 'welcome-modal');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
      return !!(this.authToken && this.currentUser);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
      return this.currentUser;
    }

    /**
     * Get authentication token
     */
    getToken() {
      return this.authToken;
    }

    /**
     * Add authentication event callback
     */
    onAuthStateChange(callback) {
      if (typeof callback === 'function') {
        this.callbacks.onAuthStateChange.push(callback);
      }
    }

    /**
     * Add login callback
     */
    onLogin(callback) {
      if (typeof callback === 'function') {
        this.callbacks.onLogin.push(callback);
      }
    }

    /**
     * Add logout callback
     */
    onLogout(callback) {
      if (typeof callback === 'function') {
        this.callbacks.onLogout.push(callback);
      }
    }

    /**
     * Trigger callbacks
     */
    triggerCallbacks(type, data = null) {
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in ' + type + ' callback:', error);
          }
        });
      }
    }

    /**
     * Utility functions
     */

    createModal(title, content, className) {
      className = className || '';
      const modal = document.createElement('div');
      modal.className = 'modal-overlay ' + className;
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close handlers
      const closeBtn = modal.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.closeModal(modal);
        });
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });

      return modal;
    }

    closeModal(modal) {
      if (modal && modal.parentNode) {
        modal.classList.add('fade-out');
        setTimeout(() => {
          if (modal.parentNode) {
            document.body.removeChild(modal);
          }
        }, 150);
      }
    }

    showError(errorDiv, message) {
      errorDiv.textContent = message;
      errorDiv.classList.remove('d-none');
    }

    showToast(message, type) {
      type = type || 'info';
      // Use existing toast system if available
      if (window.showToast) {
        window.showToast(message, type);
      } else if (window.dashboardApp && window.dashboardApp.showToast) {
        window.dashboardApp.showToast(message, type);
      } else {
        console.log(type.toUpperCase() + ': ' + message);
      }
    }
  }

  // Initialize auth manager when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
  });

  // Make AuthManager available globally
  window.AuthManager = AuthManager;

})();
