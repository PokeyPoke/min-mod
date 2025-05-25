// Main Dashboard Application
class Dashboard {
  constructor() {
    this.grid = null;
    this.widgets = new Map();
    this.theme = localStorage.getItem('dashboard-theme') || 'light';
    this.widgetCounter = 0;
    
    this.init();
  }
  
  init() {
    this.initializeTheme();
    this.initializeGrid();
    this.setupEventListeners();
    this.loadLayout();
    this.checkEmptyState();
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
      resizable: {
        handles: 'se'
      },
      draggable: {
        handle: '.widget-header'
      }
    });
    
    // Save layout on change
    this.grid.on('change', () => {
      this.saveLayout();
    });
  }
  
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
    
    // Widget picker events
    document.getElementById('close-picker')?.addEventListener('click', () => {
      this.hideWidgetPicker();
    });
    
    // Click outside modal to close
    document.getElementById('widget-picker')?.addEventListener('click', (e) => {
      if (e.target.id === 'widget-picker') {
        this.hideWidgetPicker();
      }
    });
    
    // Widget type selection
    document.querySelectorAll('.widget-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.type;
        this.addWidget(type);
        this.hideWidgetPicker();
      });
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
  
  showWidgetPicker() {
    document.getElementById('widget-picker').style.display = 'flex';
  }
  
  hideWidgetPicker() {
    document.getElementById('widget-picker').style.display = 'none';
  }
  
  async addWidget(type, config = {}, gridOptions = {}) {
    const module = WidgetModules[type];
    if (!module) {
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
          <i class="${module.icon}"></i>
          <span>${module.name}</span>
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
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    `;
    
    // Add to grid with default size
    const defaultSize = module.defaultSize || { w: 4, h: 3 };
    const gridItem = this.grid.addWidget(widgetEl, {
      w: gridOptions.w || defaultSize.w,
      h: gridOptions.h || defaultSize.h,
      x: gridOptions.x,
      y: gridOptions.y,
      autoPosition: !gridOptions.x && !gridOptions.y
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
    
    this.showToast(`Added ${module.name} widget`, 'success');
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
    
    const module = WidgetModules[widget.type];
    const contentEl = widget.element.querySelector('.widget-content');
    
    try {
      // Show loading
      contentEl.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      `;
      
      // Fetch data
      const data = await module.fetchData(widget.config);
      
      // Render widget
      module.render(contentEl, data);
      
    } catch (error) {
      console.error(`Error loading widget ${widget.type}:`, error);
      contentEl.innerHTML = `
        <div class="widget-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load data</p>
          <button class="btn btn-ghost" onclick="dashboard.loadWidgetData('${widgetId}')">
            Retry
          </button>
        </div>
      `;
      this.showToast(`Failed to load ${module.name}`, 'error');
    }
  }
  
  configureWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    const module = WidgetModules[widget.type];
    const newConfig = module.configure(widget.config);
    
    if (newConfig) {
      widget.config = { ...widget.config, ...newConfig };
      this.loadWidgetData(widgetId);
      this.saveLayout();
      this.showToast(`${module.name} configured`, 'success');
    }
  }
  
  removeWidget(widgetId) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    if (confirm(`Remove ${WidgetModules[widget.type].name} widget?`)) {
      this.grid.removeWidget(widget.element);
      this.widgets.delete(widgetId);
      this.checkEmptyState();
      this.saveLayout();
      this.showToast('Widget removed', 'info');
    }
  }
  
  saveLayout() {
    const layout = [];
    
    this.widgets.forEach((widget, widgetId) => {
      const gridNode = widget.element.gridstackNode;
      if (gridNode) {
        layout.push({
          id: widgetId,
          type: widget.type,
          config: widget.config,
          x: gridNode.x,
          y: gridNode.y,
          w: gridNode.w,
          h: gridNode.h
        });
      }
    });
    
    localStorage.setItem('dashboard-layout', JSON.stringify(layout));
  }
  
  loadLayout() {
    const saved = localStorage.getItem('dashboard-layout');
    if (!saved) return;
    
    try {
      const layout = JSON.parse(saved);
      
      // Sort by position to maintain order
      layout.sort((a, b) => a.y - b.y || a.x - b.x);
      
      layout.forEach(item => {
        this.addWidget(item.type, item.config, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h
        });
      });
    } catch (error) {
      console.error('Error loading layout:', error);
      this.showToast('Error loading saved layout', 'error');
    }
  }
  
  resetLayout() {
    // Remove all widgets
    this.widgets.forEach((widget) => {
      this.grid.removeWidget(widget.element);
    });
    this.widgets.clear();
    
    // Clear saved layout
    localStorage.removeItem('dashboard-layout');
    
    // Reset counter
    this.widgetCounter = 0;
    
    // Update UI
    this.checkEmptyState();
    this.showToast('Layout reset', 'info');
  }
  
  checkEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const hasWidgets = this.widgets.size > 0;
    
    if (emptyState) {
      emptyState.style.display = hasWidgets ? 'none' : 'flex';
    }
  }
  
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 3000);
  }
  
  // Auto-refresh widgets every 5 minutes
  startAutoRefresh() {
    setInterval(() => {
      this.widgets.forEach((widget, widgetId) => {
        // Skip notes and todo widgets from auto-refresh
        if (!['notes', 'todo'].includes(widget.type)) {
          this.loadWidgetData(widgetId);
        }
      });
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  // Add some default widgets for first-time users
  addDefaultWidgets() {
    if (this.widgets.size === 0 && !localStorage.getItem('dashboard-layout')) {
      setTimeout(() => {
        this.addWidget('weather');
        this.addWidget('crypto');
        this.addWidget('countdown', { 
          title: 'New Year 2025', 
          targetDate: '2025-01-01T00:00:00' 
        });
        this.addWidget('notes');
      }, 500);
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
  
  // Start auto-refresh
  dashboard.startAutoRefresh();
  
  // Add default widgets for new users
  dashboard.addDefaultWidgets();
  
  console.log('🚀 Dashboard initialized');
});

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  if (window.dashboard) {
    dashboard.showToast('An error occurred', 'error');
  }
});

// Handle page visibility changes to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.dashboard) {
    // Refresh widgets when page becomes visible
    setTimeout(() => {
      dashboard.widgets.forEach((widget, widgetId) => {
        if (!['notes', 'todo'].includes(widget.type)) {
          dashboard.loadWidgetData(widgetId);
        }
      });
    }, 1000);
  }
});