/**
 * theme-manager.js - Simplified Theme Management System
 * Lightweight, efficient theme switching with built-in themes
 */

class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('dashboard-theme') || 'default';
    this.isInitialized = false;
    
    // Built-in themes configuration
    this.themes = {
      default: {
        name: 'Default',
        description: 'Clean, professional light theme',
        category: 'light',
        primary: '#4361ee',
        isDark: false
      },
      dark: {
        name: 'Dark',
        description: 'Sleek dark theme for low light',
        category: 'dark', 
        primary: '#4cc9f0',
        isDark: true
      },
      minimal: {
        name: 'Minimal',
        description: 'Clean, spacious design',
        category: 'light',
        primary: '#2563eb',
        isDark: false
      },
      dense: {
        name: 'Dense',
        description: 'Compact layout for maximum density',
        category: 'light',
        primary: '#7c3aed',
        isDark: false
      }
    };
    
    this.initialize();
  }

  /**
   * Initialize theme system
   */
  initialize() {
    if (this.isInitialized) return;
    
    // Apply current theme immediately
    this.applyTheme(this.currentTheme, false);
    
    // Setup system theme detection
    this.setupSystemThemeDetection();
    
    this.isInitialized = true;
    console.log('✅ Theme system initialized with theme:', this.currentTheme);
  }

  /**
   * Apply a theme
   */
  applyTheme(themeName, animate = true) {
    if (!this.themes[themeName]) {
      console.warn(`Theme "${themeName}" not found, falling back to default`);
      themeName = 'default';
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = themeName;
    const theme = this.themes[themeName];
    
    // Update body attributes
    document.body.dataset.theme = themeName;
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);
    
    // Update primary color CSS variable
    document.documentElement.style.setProperty('--primary', theme.primary);
    
    // Save preference
    localStorage.setItem('dashboard-theme', themeName);
    
    // Animate transition if requested
    if (animate && previousTheme !== themeName) {
      this.animateTransition();
    }
    
    // Dispatch theme change event
    this.dispatchThemeChange(previousTheme, themeName);
    
    return true;
  }

  /**
   * Get theme information
   */
  getTheme(themeName) {
    return this.themes[themeName] || null;
  }

  /**
   * Get all available themes
   */
  getAllThemes() {
    return Object.entries(this.themes).map(([id, theme]) => ({
      id,
      ...theme
    }));
  }

  /**
   * Get themes by category
   */
  getThemesByCategory(category) {
    return this.getAllThemes().filter(theme => theme.category === category);
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Toggle between light and dark themes
   */
  toggleDarkMode() {
    const currentTheme = this.themes[this.currentTheme];
    const targetTheme = currentTheme.isDark ? 'default' : 'dark';
    this.applyTheme(targetTheme);
  }

  /**
   * Check if current theme is dark
   */
  isDarkTheme() {
    return this.themes[this.currentTheme]?.isDark || false;
  }

  /**
   * Setup system theme detection
   */
  setupSystemThemeDetection() {
    if (!window.matchMedia) return;
    
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Apply system theme if no user preference
    if (!localStorage.getItem('dashboard-theme')) {
      const systemTheme = darkModeQuery.matches ? 'dark' : 'default';
      this.applyTheme(systemTheme, false);
    }
    
    // Listen for system theme changes
    darkModeQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't explicitly set a preference
      if (!localStorage.getItem('user-theme-override')) {
        const systemTheme = e.matches ? 'dark' : 'default';
        this.applyTheme(systemTheme);
      }
    });
  }

  /**
   * Set user theme override (prevents auto-switching)
   */
  setUserOverride(themeName) {
    localStorage.setItem('user-theme-override', 'true');
    this.applyTheme(themeName);
  }

  /**
   * Clear user override (allows auto-switching)
   */
  clearUserOverride() {
    localStorage.removeItem('user-theme-override');
  }

  /**
   * Animate theme transition
   */
  animateTransition() {
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  }

  /**
   * Dispatch theme change event
   */
  dispatchThemeChange(previousTheme, currentTheme) {
    const event = new CustomEvent('theme:changed', {
      detail: { 
        previous: previousTheme,
        current: currentTheme,
        theme: this.themes[currentTheme]
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Create theme selector UI
   */
  createThemeSelector(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    
    if (!container) {
      console.error('Theme selector container not found');
      return;
    }

    const themes = this.getAllThemes();
    
    container.innerHTML = `
      <div class="theme-selector">
        <div class="theme-grid">
          ${themes.map(theme => `
            <button class="theme-option ${this.currentTheme === theme.id ? 'active' : ''}" 
                    data-theme="${theme.id}"
                    title="${theme.description}">
              <div class="theme-preview theme-${theme.id}">
                <div class="theme-color" style="background-color: ${theme.primary}"></div>
              </div>
              <span class="theme-name">${theme.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Add event listeners
    container.querySelectorAll('.theme-option').forEach(button => {
      button.addEventListener('click', () => {
        const themeName = button.dataset.theme;
        this.setUserOverride(themeName);
        
        // Update active state
        container.querySelectorAll('.theme-option').forEach(btn => 
          btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show feedback
        this.showToast(`Theme changed to ${this.themes[themeName].name}`, 'success');
      });
    });
  }

  /**
   * Create simple theme toggle button
   */
  createThemeToggle(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    
    if (!container) {
      console.error('Theme toggle container not found');
      return;
    }

    container.innerHTML = `
      <button class="theme-toggle" title="Toggle dark mode">
        <i class="fas ${this.isDarkTheme() ? 'fa-sun' : 'fa-moon'}"></i>
      </button>
    `;

    const toggleButton = container.querySelector('.theme-toggle');
    toggleButton.addEventListener('click', () => {
      this.toggleDarkMode();
      
      // Update icon
      const icon = toggleButton.querySelector('i');
      icon.className = `fas ${this.isDarkTheme() ? 'fa-sun' : 'fa-moon'}`;
    });
  }

  /**
   * Get theme recommendations based on system preferences
   */
  getRecommendations() {
    const recommendations = [];
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    
    if (systemDark) {
      recommendations.push({
        id: 'dark',
        reason: 'Matches your system dark mode preference'
      });
    } else {
      recommendations.push({
        id: 'default',
        reason: 'Matches your system light mode preference'
      });
    }
    
    // Add other recommendations
    recommendations.push({
      id: 'minimal',
      reason: 'Clean and distraction-free'
    });
    
    return recommendations.map(rec => ({
      ...rec,
      ...this.themes[rec.id]
    }));
  }

  /**
   * Reset to system default
   */
  resetToSystem() {
    this.clearUserOverride();
    const systemTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
    this.applyTheme(systemTheme);
    this.showToast('Theme reset to system default', 'info');
  }

  /**
   * Show toast notification (if available)
   */
  showToast(message, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else if (window.dashboardApp?.showToast) {
      window.dashboardApp.showToast(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Get theme export data
   */
  exportTheme() {
    return {
      currentTheme: this.currentTheme,
      userOverride: localStorage.getItem('user-theme-override') === 'true',
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
  }

  /**
   * Import theme data
   */
  importTheme(data) {
    if (!data || !data.currentTheme || !this.themes[data.currentTheme]) {
      throw new Error('Invalid theme data');
    }
    
    if (data.userOverride) {
      this.setUserOverride(data.currentTheme);
    } else {
      this.applyTheme(data.currentTheme);
    }
    
    this.showToast('Theme settings imported', 'success');
  }
}

// Create and export singleton instance
const themeManager = new ThemeManager();

// Make available globally for easy access
window.themeManager = themeManager;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = themeManager;
}
