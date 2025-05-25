/**
 * grid.js - Advanced Grid Layout Management
 * Handles responsive grid layouts with different density levels
 */

class DashboardGrid {
  constructor() {
    this.grid = null;
    this.isInitialized = false;
    this.currentLayout = localStorage.getItem('dashboard-layout-type') || 'balanced';
    this.breakpoints = {
      xs: 480,
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
      xxl: 1400
    };
  }

  /**
   * Initialize the grid system
   */
  initialize(container, options = {}) {
    if (this.isInitialized) {
      console.warn('Grid already initialized');
      return;
    }

    if (typeof GridStack === 'undefined') {
      console.error('GridStack library not loaded');
      return;
    }

    const gridContainer = container || document.getElementById('dashboard-grid');
    if (!gridContainer) {
      console.error('Grid container not found');
      return;
    }

    // Get layout configuration
    const layoutConfig = this.getLayoutConfig(this.currentLayout);
    
    // Default grid options
    const defaultOptions = {
      cellHeight: layoutConfig.cellHeight,
      column: layoutConfig.columns,
      margin: layoutConfig.margin,
      float: false,
      animate: true,
      resizable: {
        handles: 'all',
        autoHide: true
      },
      draggable: {
        handle: '.widget-header'
      },
      removable: false,
      acceptWidgets: true,
      disableResize: false,
      disableDrag: false,
      ...options
    };

    // Initialize GridStack
    this.grid = GridStack.init(defaultOptions, gridContainer);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Make responsive
    this.makeResponsive();
    
    this.isInitialized = true;
    console.log('Grid initialized with layout:', this.currentLayout);
    
    return this.grid;
  }

  /**
   * Setup grid event handlers
   */
  setupEventHandlers() {
    if (!this.grid) return;

    // Layout change events
    this.grid.on('change', (event, items) => {
      this.onLayoutChange(items);
    });

    // Resize events
    this.grid.on('resizestop', (event, el) => {
      this.onWidgetResize(el);
    });

    // Drag events
    this.grid.on('dragstop', (event, el) => {
      this.onWidgetDragStop(el);
    });

    // Window resize
    window.addEventListener('resize', this.debounce(() => {
      this.handleWindowResize();
    }, 250));
  }

  /**
   * Get layout configuration for different density levels
   */
  getLayoutConfig(layout) {
    const configs = {
      minimal: {
        cellHeight: 120,
        margin: 20,
        columns: 6,
        description: 'Spacious layout with large widgets'
      },
      balanced: {
        cellHeight: 100,
        margin: 15,
        columns: 12,
        description: 'Perfect balance of content and space'
      },
      dense: {
        cellHeight: 80,
        margin: 8,
        columns: 16,
        description: 'Maximum information density'
      },
      ultra_dense: {
        cellHeight: 60,
        margin: 4,
        columns: 20,
        description: 'Ultra-compact for power users'
      }
    };

    return configs[layout] || configs.balanced;
  }

  /**
   * Change grid layout
   */
  changeLayout(newLayout) {
    if (!this.grid) return;

    const config = this.getLayoutConfig(newLayout);
    
    // Update grid properties
    this.grid.cellHeight(config.cellHeight);
    this.grid.margin(config.margin);
    
    // Update columns with animation
    this.grid.column(config.columns, true);
    
    this.currentLayout = newLayout;
    localStorage.setItem('dashboard-layout-type', newLayout);
    
    // Trigger responsive update
    this.makeResponsive();
    
    console.log('Layout changed to:', newLayout);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('grid:layoutChanged', {
      detail: { layout: newLayout, config }
    }));
  }

  /**
   * Make grid responsive
   */
  makeResponsive() {
    if (!this.grid) return;

    const config = this.getLayoutConfig(this.currentLayout);
    const width = window.innerWidth;
    let columns = config.columns;

    // Adjust columns based on screen size
    if (width < this.breakpoints.sm) {
      columns = 1; // Single column on mobile
    } else if (width < this.breakpoints.md) {
      columns = Math.min(2, config.columns); // Max 2 columns on small tablets
    } else if (width < this.breakpoints.lg) {
      columns = Math.min(Math.ceil(config.columns / 2), config.columns); // Half columns on tablets
    } else if (width < this.breakpoints.xl) {
      columns = Math.min(Math.ceil(config.columns * 0.75), config.columns); // 75% columns on small desktops
    }

    this.grid.column(columns);
  }

  /**
   * Add widget to grid
   */
  addWidget(element, options = {}) {
    if (!this.grid) return null;

    const defaultOptions = {
      w: 4,
      h: 3,
      autoPosition: true,
      minW: 2,
      minH: 2,
      maxW: this.getLayoutConfig(this.currentLayout).columns,
      ...options
    };

    return this.grid.addWidget(element, defaultOptions);
  }

  /**
   * Remove widget from grid
   */
  removeWidget(element, removeDOM = true) {
    if (!this.grid) return;
    
    this.grid.removeWidget(element, removeDOM);
  }

  /**
   * Remove all widgets
   */
  removeAll() {
    if (!this.grid) return;
    
    this.grid.removeAll();
  }

  /**
   * Get widget element by ID
   */
  getWidget(id) {
    if (!this.grid) return null;
    
    const element = document.querySelector(`[data-id="${id}"]`);
    return element ? this.grid.getWidget(element) : null;
  }

  /**
   * Update widget
   */
  updateWidget(element, options) {
    if (!this.grid) return;
    
    this.grid.update(element, options);
  }

  /**
   * Enable/disable grid
   */
  setStatic(staticValue) {
    if (!this.grid) return;
    
    this.grid.setStatic(staticValue);
  }

  /**
   * Get current layout data
   */
  getLayoutData() {
    if (!this.grid) return [];
    
    return this.grid.save();
  }

  /**
   * Load layout data
   */
  loadLayout(layout) {
    if (!this.grid) return;
    
    this.grid.load(layout);
  }

  /**
   * Batch update (performance optimization)
   */
  batchUpdate(fn) {
    if (!this.grid) return;
    
    this.grid.batchUpdate();
    try {
      fn();
    } finally {
      this.grid.commit();
    }
  }

  /**
   * Event handlers
   */
  onLayoutChange(items) {
    // Debounced save
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveLayout();
    }, 1000);
  }

  onWidgetResize(element) {
    const widgetId = element.dataset.id;
    if (widgetId) {
      // Trigger widget refresh after resize
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('widget:resized', {
          detail: { id: widgetId, element }
        }));
      }, 100);
    }
  }

  onWidgetDragStop(element) {
    const widgetId = element.dataset.id;
    if (widgetId) {
      // Trigger widget position update
      window.dispatchEvent(new CustomEvent('widget:moved', {
        detail: { id: widgetId, element }
      }));
    }
  }

  handleWindowResize() {
    this.makeResponsive();
  }

  /**
   * Save current layout
   */
  saveLayout() {
    if (!this.grid) return;
    
    const layout = this.getLayoutData();
    localStorage.setItem('dashboard-grid-layout', JSON.stringify(layout));
    
    // Dispatch save event
    window.dispatchEvent(new CustomEvent('grid:layoutSaved', {
      detail: { layout }
    }));
  }

  /**
   * Get optimal widget size for type
   */
  getOptimalWidgetSize(widgetType, layout = this.currentLayout) {
    const config = this.getLayoutConfig(layout);
    
    const sizes = {
      minimal: {
        weather: { w: 3, h: 3 },
        crypto: { w: 3, h: 3 },
        stocks: { w: 3, h: 3 },
        countdown: { w: 4, h: 2 },
        notes: { w: 4, h: 4 },
        todo: { w: 3, h: 4 }
      },
      balanced: {
        weather: { w: 4, h: 3 },
        crypto: { w: 4, h: 3 },
        stocks: { w: 4, h: 3 },
        countdown: { w: 6, h: 2 },
        notes: { w: 6, h: 4 },
        todo: { w: 4, h: 4 }
      },
      dense: {
        weather: { w: 4, h: 4 },
        crypto: { w: 4, h: 4 },
        stocks: { w: 4, h: 4 },
        countdown: { w: 8, h: 3 },
        notes: { w: 8, h: 5 },
        todo: { w: 6, h: 5 }
      },
      ultra_dense: {
        weather: { w: 5, h: 4 },
        crypto: { w: 5, h: 4 },
        stocks: { w: 5, h: 4 },
        countdown: { w: 10, h: 3 },
        notes: { w: 10, h: 6 },
        todo: { w: 8, h: 6 }
      }
    };

    return sizes[layout]?.[widgetType] || { w: 4, h: 3 };
  }

  /**
   * Utility functions
   */
  debounce(func, wait) {
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

  /**
   * Destroy grid
   */
  destroy() {
    if (this.grid) {
      this.grid.destroy();
      this.grid = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get grid statistics
   */
  getStats() {
    if (!this.grid) return null;
    
    const widgets = document.querySelectorAll('.widget');
    const layout = this.getLayoutData();
    
    return {
      widgetCount: widgets.length,
      layout: this.currentLayout,
      columns: this.grid.getColumn(),
      cellHeight: this.grid.getCellHeight(),
      margin: this.grid.getMargin(),
      gridData: layout
    };
  }
}

// Export for global use
window.DashboardGrid = DashboardGrid;
export default DashboardGrid;
