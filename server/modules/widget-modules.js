/**
 * server/modules/widget-modules.js - Automatic widget module loading
 * This file auto-discovers and loads all widget modules
 */

const fs = require('fs');
const path = require('path');

class WidgetModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadAllModules();
  }

  loadAllModules() {
    const modulesDir = __dirname;
    const files = fs.readdirSync(modulesDir);
    
    // Find all widget module files
    const widgetFiles = files.filter(file => 
      file.startsWith('widget-') && 
      file.endsWith('.js') && 
      file !== 'widget-modules.js'
    );

    for (const file of widgetFiles) {
      try {
        const modulePath = path.join(modulesDir, file);
        const moduleExports = require(modulePath);
        
        // Extract widget type from filename (widget-weather.js -> weather)
        const widgetType = file.replace('widget-', '').replace('.js', '');
        
        this.modules.set(widgetType, moduleExports);
        console.log(`✅ Loaded widget module: ${widgetType}`);
      } catch (error) {
        console.error(`❌ Failed to load widget module ${file}:`, error);
      }
    }
  }

  getModule(widgetType) {
    return this.modules.get(widgetType);
  }

  getAllModules() {
    return Object.fromEntries(this.modules);
  }

  hasModule(widgetType) {
    return this.modules.has(widgetType);
  }

  getAvailableWidgets() {
    return Array.from(this.modules.keys());
  }
}

// Create singleton instance
const widgetLoader = new WidgetModuleLoader();

// Export the modules object for compatibility
module.exports = widgetLoader.getAllModules();
