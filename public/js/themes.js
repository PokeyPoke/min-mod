/**
 * themes.css - Consolidated Theme System
 * All themes in a single file for better performance and maintainability
 */

/* ==========================================================================
   THEME ANIMATIONS & TRANSITIONS
   ========================================================================== */

/* Theme transition animations */
@keyframes themeTransition {
  0% { opacity: 0.8; }
  100% { opacity: 1; }
}

.theme-transitioning {
  animation: themeTransition 0.3s ease;
}

/* Smooth color transitions for all themed elements */
.widget,
.btn,
.form-control,
.modal,
.toast,
.header,
.dashboard-header {
  transition: 
    background-color var(--theme-transition),
    border-color var(--theme-transition),
    color var(--theme-transition),
    box-shadow var(--theme-transition);
}

/* ==========================================================================
   ACCESSIBILITY ENHANCEMENTS
   ========================================================================== */

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --widget-border: 2px solid;
    --widget-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  
  .widget {
    border-width: 2px;
  }
  
  .btn {
    border-width: 2px;
    font-weight: 600;
  }
  
  .theme-option {
    border-width: 3px;
  }
  
  .theme-toggle {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  :root {
    --theme-transition: none;
  }
  
  .widget:hover,
  .btn:hover,
  .theme-option:hover,
  .theme-toggle:hover {
    transform: none;
  }
  
  .theme-transitioning {
    animation: none;
  }
}

/* Focus indicators for better accessibility */
.theme-option:focus-visible,
.theme-toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ==========================================================================
   PRINT STYLES
   ========================================================================== */

@media print {
  /* Reset all themes to light for printing */
  body {
    --body-bg: white !important;
    --body-color: black !important;
    --surface-bg: white !important;
    --surface-border: #ccc !important;
    --widget-shadow: none !important;
  }
  
  .widget {
    box-shadow: none !important;
    border: 1px solid #ccc !important;
    break-inside: avoid;
  }
  
  .theme-selector,
  .theme-toggle {
    display: none !important;
  }
}

/* ==========================================================================
   THEME UTILITIES
   ========================================================================== */

/* Theme-aware text colors */
.text-themed-primary { color: var(--primary) !important; }
.text-themed-secondary { color: var(--secondary) !important; }
.text-themed-muted { color: var(--text-muted) !important; }
.text-themed-subtle { color: var(--text-subtle) !important; }

/* Theme-aware background colors */
.bg-themed-surface { background-color: var(--surface-bg) !important; }
.bg-themed-hover { background-color: var(--surface-hover) !important; }

/* Theme-aware borders */
.border-themed { border-color: var(--surface-border) !important; }
.border-themed-primary { border-color: var(--primary) !important; }

/* ==========================================================================
   PERFORMANCE OPTIMIZATIONS
   ========================================================================== */

/* GPU acceleration for smooth theme transitions */
.widget,
.theme-option,
.theme-toggle {
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Optimize repaints during theme changes */
.theme-transitioning * {
  will-change: background-color, border-color, color;
}

/* ==========================================================================
   BROWSER COMPATIBILITY
   ========================================================================== */

/* Fallback for browsers without CSS custom properties */
@supports not (color: var(--primary)) {
  /* Default theme fallback styles */
  body {
    background-color: #f9fafb;
    color: #111827;
  }
  
  .widget {
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
  }
  
  .btn-primary {
    background-color: #4361ee;
    border-color: #4361ee;
  }
}

/* Fallback for browsers without backdrop-filter */
@supports not (backdrop-filter: blur(10px)) {
  .modal-overlay {
    background: rgba(0, 0, 0, 0.7);
  }
}

/* ==========================================================================
   END OF CONSOLIDATED THEMES
   ========================================================================== */
   BASE THEME SYSTEM
   ========================================================================== */

:root {
  /* Theme transition properties */
  --theme-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Base color palette - will be overridden by themes */
  --primary: #4361ee;
  --secondary: #3f37c9;
  --success: #4cc9f0;
  --danger: #f72585;
  --warning: #f8961e;
  --info: #4895ef;
  
  /* Neutral colors */
  --white: #ffffff;
  --black: #000000;
  --transparent: transparent;
}

/* Smooth transitions for theme changes */
body {
  transition: var(--theme-transition);
}

.widget,
.modal,
.btn,
.form-control {
  transition: var(--theme-transition);
}

/* ==========================================================================
   DEFAULT THEME (Light)
   ========================================================================== */

body.theme-default,
[data-theme="default"] {
  /* Background and surface colors */
  --body-bg: #f9fafb;
  --body-bg-gradient: linear-gradient(315deg, #f9fafb 0%, #f3f4f6 100%);
  --surface-bg: #ffffff;
  --surface-border: #e5e7eb;
  --surface-hover: #f9fafb;
  
  /* Text colors */
  --body-color: #111827;
  --heading-color: #1f2937;
  --text-muted: #6b7280;
  --text-subtle: #9ca3af;
  
  /* Interactive colors */
  --primary: #4361ee;
  --secondary: #3f37c9;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
  
  /* Component-specific colors */
  --header-bg: linear-gradient(90deg, var(--primary), var(--secondary));
  --widget-bg: var(--surface-bg);
  --widget-header-bg: #f9fafb;
  --widget-border: 1px solid var(--surface-border);
  --widget-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --widget-shadow-hover: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Form colors */
  --form-bg: var(--surface-bg);
  --form-text: var(--body-color);
  --form-border: #d1d5db;
  --form-focus-border: var(--primary);
  --form-placeholder: var(--text-subtle);
  
  /* Status indicators */
  --status-online: #10b981;
  --status-offline: #6b7280;
  --status-away: #f59e0b;
  --status-busy: #ef4444;
}

/* ==========================================================================
   DARK THEME
   ========================================================================== */

body.theme-dark,
[data-theme="dark"] {
  /* Background and surface colors */
  --body-bg: #111827;
  --body-bg-gradient: linear-gradient(315deg, #111827 0%, #1f2937 100%);
  --surface-bg: #1f2937;
  --surface-border: #374151;
  --surface-hover: #2d3748;
  
  /* Text colors */
  --body-color: #f9fafb;
  --heading-color: #ffffff;
  --text-muted: #9ca3af;
  --text-subtle: #6b7280;
  
  /* Interactive colors - adjusted for dark theme */
  --primary: #4cc9f0;
  --secondary: #7678ed;
  --success: #06d6a0;
  --danger: #ef476f;
  --warning: #ffd166;
  --info: #118ab2;
  
  /* Component-specific colors */
  --header-bg: linear-gradient(90deg, #1f2937, #111827);
  --widget-bg: var(--surface-bg);
  --widget-header-bg: #111827;
  --widget-border: 1px solid var(--surface-border);
  --widget-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
  --widget-shadow-hover: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
  
  /* Form colors */
  --form-bg: #374151;
  --form-text: var(--body-color);
  --form-border: #4b5563;
  --form-focus-border: var(--primary);
  --form-placeholder: var(--text-subtle);
  
  /* Status indicators */
  --status-online: #06d6a0;
  --status-offline: #9ca3af;
  --status-away: #ffd166;
  --status-busy: #ef476f;
}

/* Dark theme specific adjustments */
.theme-dark .modal-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.theme-dark .loading-overlay {
  background: rgba(17, 24, 39, 0.9);
}

.theme-dark .toast {
  background: var(--surface-bg);
  border-color: var(--surface-border);
}

/* ==========================================================================
   MINIMAL THEME
   ========================================================================== */

body.theme-minimal,
[data-theme="minimal"] {
  /* Background and surface colors */
  --body-bg: #ffffff;
  --body-bg-gradient: linear-gradient(315deg, #ffffff 0%, #fafafa 100%);
  --surface-bg: #ffffff;
  --surface-border: #e2e8f0;
  --surface-hover: #f8fafc;
  
  /* Text colors */
  --body-color: #334155;
  --heading-color: #1e293b;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;
  
  /* Interactive colors - minimal palette */
  --primary: #2563eb;
  --secondary: #64748b;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
  
  /* Component-specific colors */
  --header-bg: linear-gradient(90deg, var(--primary), #1d4ed8);
  --widget-bg: var(--surface-bg);
  --widget-header-bg: #f8fafc;
  --widget-border: 1px solid var(--surface-border);
  --widget-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --widget-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  /* Form colors */
  --form-bg: var(--surface-bg);
  --form-text: var(--body-color);
  --form-border: #cbd5e1;
  --form-focus-border: var(--primary);
  --form-placeholder: var(--text-subtle);
  
  /* Minimal theme specific spacing */
  --widget-spacing: 24px;
  --widget-border-radius: 12px;
}

/* Minimal theme adjustments */
.theme-minimal .widget {
  border-radius: var(--widget-border-radius);
}

.theme-minimal .btn {
  border-radius: 8px;
}

.theme-minimal .form-control {
  border-radius: 8px;
}

/* ==========================================================================
   DENSE THEME
   ========================================================================== */

body.theme-dense,
[data-theme="dense"] {
  /* Background and surface colors */
  --body-bg: #fafbfc;
  --body-bg-gradient: linear-gradient(315deg, #fafbfc 0%, #f3f4f6 100%);
  --surface-bg: #ffffff;
  --surface-border: #e1e5e9;
  --surface-hover: #f7f8fa;
  
  /* Text colors */
  --body-color: #172b4d;
  --heading-color: #091e42;
  --text-muted: #5e6c84;
  --text-subtle: #8993a4;
  
  /* Interactive colors - vibrant for dense layouts */
  --primary: #7c3aed;
  --secondary: #6366f1;
  --success: #059669;
  --danger: #dc2626;
  --warning: #d97706;
  --info: #0284c7;
  
  /* Component-specific colors */
  --header-bg: linear-gradient(90deg, var(--primary), var(--secondary));
  --widget-bg: var(--surface-bg);
  --widget-header-bg: #f7f8fa;
  --widget-border: 1px solid var(--surface-border);
  --widget-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  --widget-shadow-hover: 0 8px 16px rgba(0, 0, 0, 0.15);
  
  /* Form colors */
  --form-bg: var(--surface-bg);
  --form-text: var(--body-color);
  --form-border: #dfe1e6;
  --form-focus-border: var(--primary);
  --form-placeholder: var(--text-subtle);
  
  /* Dense theme specific spacing */
  --widget-spacing: 8px;
  --widget-header-height: 32px;
  --widget-min-height: 120px;
  --widget-border-radius: 6px;
}

/* Dense theme adjustments */
.theme-dense .widget {
  border-radius: var(--widget-border-radius);
}

.theme-dense .widget-header {
  height: var(--widget-header-height);
  padding: 0 0.75rem;
}

.theme-dense .widget-title {
  font-size: 0.8125rem;
}

.theme-dense .widget-content {
  padding: var(--widget-spacing);
}

.theme-dense .btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.theme-dense .form-control {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

/* ==========================================================================
   THEME SELECTOR COMPONENT
   ========================================================================== */

.theme-selector {
  padding: 1rem;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.theme-option {
  background: var(--surface-bg);
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.theme-option:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--widget-shadow-hover);
}

.theme-option.active {
  border-color: var(--primary);
  background: rgba(67, 97, 238, 0.05);
  box-shadow: var(--widget-shadow);
}

.theme-preview {
  width: 60px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-preview.theme-default {
  background: linear-gradient(45deg, #f9fafb 50%, #ffffff 50%);
}

.theme-preview.theme-dark {
  background: linear-gradient(45deg, #111827 50%, #1f2937 50%);
}

.theme-preview.theme-minimal {
  background: linear-gradient(45deg, #ffffff 50%, #f8fafc 50%);
}

.theme-preview.theme-dense {
  background: linear-gradient(45deg, #fafbfc 50%, #f7f8fa 50%);
}

.theme-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
}

.theme-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--body-color);
}

/* ==========================================================================
   THEME TOGGLE COMPONENT
   ========================================================================== */

.theme-toggle {
  width: 44px;
  height: 44px;
  border: none;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--text-muted);
  box-shadow: var(--widget-shadow);
}

.theme-toggle:hover {
  background: var(--surface-hover);
  color: var(--primary);
  transform: translateY(-1px);
  box-shadow: var(--widget-shadow-hover);
}

.theme-toggle i {
  font-size: 1.25rem;
}

/* ==========================================================================
   RESPONSIVE THEME ADJUSTMENTS
   ========================================================================== */

@media (max-width: 768px) {
  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  
  .theme-option {
    padding: 0.75rem;
    gap: 0.5rem;
  }
  
  .theme-preview {
    width: 50px;
    height: 30px;
  }
  
  .theme-color {
    width: 16px;
    height: 16px;
  }
  
  .theme-name {
    font-size: 0.8125rem;
  }
  
  .theme-toggle {
    width: 40px;
    height: 40px;
  }
  
  .theme-toggle i {
    font-size: 1.125rem;
  }
}

@media (max-width: 480px) {
  .theme-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .theme-option {
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
  }
  
  .theme-preview {
    width: 40px;
    height: 24px;
  }
}

/* ==========================================================================
   THEME-SPECIFIC WIDGET GRADIENTS
   ========================================================================== */

/* Default theme widget backgrounds */
.theme-default .weather-widget {
  background: linear-gradient(135deg, #e6f1ff 0%, #cce7ff 100%);
}

.theme-default .crypto-widget {
  background: linear-gradient(135deg, #fff7e6 0%, #ffeccc 100%);
}

.theme-default .stocks-widget {
  background: linear-gradient(135deg, #e6fff1 0%, #ccffdd 100%);
}

.theme-default .countdown-widget {
  background: linear-gradient(135deg, #f5e6ff 0%, #e6ccff 100%);
}

.theme-default .notes-widget {
  background: linear-gradient(135deg, #ffefe6 0%, #ffd6cc 100%);
}

.theme-default .todo-widget {
  background: linear-gradient(135deg, #e6fffc 0%, #ccf7f0 100%);
}

/* Dark theme widget backgrounds */
.theme-dark .weather-widget {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6b 100%);
}

.theme-dark .crypto-widget {
  background: linear-gradient(135deg, #4a3728 0%, #5c4533 100%);
}

.theme-dark .stocks-widget {
  background: linear-gradient(135deg, #1f4a32 0%, #2d5a41 100%);
}

.theme-dark .countdown-widget {
  background: linear-gradient(135deg, #3d2a5f 0%, #4a3472 100%);
}

.theme-dark .notes-widget {
  background: linear-gradient(135deg, #5a3a28 0%, #6b4833 100%);
}

.theme-dark .todo-widget {
  background: linear-gradient(135deg, #1f4a47 0%, #2d5a54 100%);
}

/* Minimal theme widget backgrounds */
.theme-minimal .weather-widget,
.theme-minimal .crypto-widget,
.theme-minimal .stocks-widget,
.theme-minimal .countdown-widget,
.theme-minimal .notes-widget,
.theme-minimal .todo-widget {
  background: var(--surface-bg);
  border-left: 4px solid var(--primary);
}

/* Dense theme widget backgrounds */
.theme-dense .weather-widget {
  background: linear-gradient(135deg, #f0f3ff 0%, #e8efff 100%);
}

.theme-dense .crypto-widget {
  background: linear-gradient(135deg, #fff8f0 0%, #ffede0 100%);
}

.theme-dense .stocks-widget {
  background: linear-gradient(135deg, #f0fff5 0%, #e8ffe8 100%);
}

.theme-dense .countdown-widget {
  background: linear-gradient(135deg, #f8f0ff 0%, #f0e8ff 100%);
}

.theme-dense .notes-widget {
  background: linear-gradient(135deg, #fff5f0 0%, #ffe8e0 100%);
}

.theme-dense .todo-widget {
  background: linear-gradient(135deg, #f0fffd 0%, #e8fff8 100%);
}

/* ==========================================================================
