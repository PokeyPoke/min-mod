/**
 * devices.js - ESP32 Device Management System
 * Handles device registration, management, and ESP32 CYD integration
 */

class DeviceManager {
  constructor() {
    this.devices = [];
    this.isInitialized = false;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  /**
   * Initialize device management system
   */
  initialize() {
    if (this.isInitialized) return;
    
    // Check for authentication before initializing
    this.checkAuthAndSetup();
    
    // Listen for auth state changes
    window.addEventListener('auth:login', () => this.onAuthChange(true));
    window.addEventListener('auth:logout', () => this.onAuthChange(false));
    
    this.isInitialized = true;
  }

  /**
   * Check authentication and setup device management
   */
  checkAuthAndSetup() {
    const token = localStorage.getItem('auth-token');
    if (token) {
      this.setupDeviceManagement();
    }
  }

  /**
   * Handle authentication state changes
   */
  onAuthChange(isAuthenticated) {
    const devicesBtn = document.getElementById('devices-btn');
    if (devicesBtn) {
      devicesBtn.style.display = isAuthenticated ? 'inline-flex' : 'none';
    }

    if (isAuthenticated) {
      this.setupDeviceManagement();
    } else {
      this.cleanup();
    }
  }

  /**
   * Setup device management functionality
   */
  setupDeviceManagement() {
    const devicesBtn = document.getElementById('devices-btn');
    if (!devicesBtn) {
      console.warn('Devices button not found, creating it...');
      this.createDevicesButton();
      return;
    }

    // Show the button
    devicesBtn.style.display = 'inline-flex';
    
    // Remove existing event listeners to prevent duplicates
    devicesBtn.replaceWith(devicesBtn.cloneNode(true));
    const newDevicesBtn = document.getElementById('devices-btn');
    
    // Add click handler
    newDevicesBtn.addEventListener('click', () => this.showDeviceManagementModal());
  }

  /**
   * Create devices button if it doesn't exist
   */
  createDevicesButton() {
    const settingsBtn = document.getElementById('settings-btn');
    if (!settingsBtn) return;

    const devicesBtn = document.createElement('button');
    devicesBtn.id = 'devices-btn';
    devicesBtn.className = 'btn btn-outline-secondary';
    devicesBtn.title = 'Manage ESP32 Devices';
    devicesBtn.innerHTML = `
      <i class="fas fa-mobile-alt me-1"></i>
      <span>Devices</span>
    `;

    // Insert before settings button
    settingsBtn.parentNode.insertBefore(devicesBtn, settingsBtn);
    
    // Add click handler
    devicesBtn.addEventListener('click', () => this.showDeviceManagementModal());
  }

  /**
   * Show device management modal
   */
  async showDeviceManagementModal() {
    try {
      // Show loading first
      const loadingModal = this.createModal('Device Management', `
        <div class="text-center">
          <div class="spinner mb-3"></div>
          <p>Loading your devices...</p>
        </div>
      `);

      // Fetch devices
      const devices = await this.fetchUserDevices();
      
      // Close loading modal
      this.closeModal(loadingModal);

      // Show main device management modal
      this.showMainDeviceModal(devices);

    } catch (error) {
      console.error('Error showing device management modal:', error);
      this.showToast('Failed to load device management', 'error');
    }
  }

  /**
   * Show main device management modal
   */
  showMainDeviceModal(devices) {
    const modal = this.createModal('Device Management', `
      <div class="device-management-container">
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="device-list-tab" data-tab="device-list">
              <i class="fas fa-list me-1"></i> My Devices
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="add-device-tab" data-tab="add-device">
              <i class="fas fa-plus me-1"></i> Add Device
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="device-help-tab" data-tab="device-help">
              <i class="fas fa-question-circle me-1"></i> Help
            </button>
          </li>
        </ul>
        
        <div class="tab-content">
          <div class="tab-pane active" id="device-list-content">
            <div class="device-list-container">
              ${this.renderDeviceList(devices)}
            </div>
          </div>
          
          <div class="tab-pane" id="add-device-content">
            ${this.renderAddDeviceForm()}
          </div>
          
          <div class="tab-pane" id="device-help-content">
            ${this.renderHelpContent()}
          </div>
        </div>
      </div>
    `, 'large');

    this.setupModalTabs(modal);
    this.setupDeviceManagementHandlers(modal);
  }

  /**
   * Render device list
   */
  renderDeviceList(devices) {
    if (!devices || devices.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-mobile-alt fa-3x text-muted"></i>
          </div>
          <h3 class="text-muted">No Devices Yet</h3>
          <p class="text-muted mb-4">You haven't registered any ESP32 devices yet.</p>
          <button class="btn btn-primary switch-to-add">
            <i class="fas fa-plus me-1"></i> Add Your First Device
          </button>
        </div>
      `;
    }

    const deviceItems = devices.map(device => `
      <div class="device-card" data-device-id="${device.device_id}">
        <div class="device-card-header">
          <div class="device-info">
            <h5 class="device-name">${device.device_name}</h5>
            <span class="device-type">${this.getDeviceTypeName(device.device_type)}</span>
          </div>
          <div class="device-status">
            ${this.getDeviceStatusBadge(device)}
          </div>
        </div>
        
        <div class="device-card-body">
          <div class="device-details">
            <div class="detail-item">
              <span class="detail-label">Device ID:</span>
              <code class="detail-value">${device.device_id}</code>
            </div>
            <div class="detail-item">
              <span class="detail-label">Added:</span>
              <span class="detail-value">${this.formatDate(device.created_at)}</span>
            </div>
            ${device.last_connected ? `
              <div class="detail-item">
                <span class="detail-label">Last Connected:</span>
                <span class="detail-value">${this.formatDate(device.last_connected)}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="device-card-footer">
          <button class="btn btn-outline-info btn-sm view-data-btn" data-device-id="${device.device_id}">
            <i class="fas fa-eye me-1"></i> View Data
          </button>
          <button class="btn btn-outline-danger btn-sm remove-device-btn" data-device-id="${device.device_id}">
            <i class="fas fa-trash-alt me-1"></i> Remove
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="devices-header">
        <h4>Your ESP32 Devices</h4>
        <button id="refresh-devices" class="btn btn-outline-secondary btn-sm">
          <i class="fas fa-sync-alt me-1"></i> Refresh
        </button>
      </div>
      <div class="device-list">
        ${deviceItems}
      </div>
    `;
  }

  /**
   * Render add device form
   */
  renderAddDeviceForm() {
    return `
      <div class="add-device-form">
        <h4>Register New ESP32 Device</h4>
        <p class="text-muted mb-4">Add a new ESP32 CYD or generic ESP32 device to your dashboard.</p>
        
        <form id="register-device-form">
          <div class="form-group mb-3">
            <label class="form-label">Device Name</label>
            <input type="text" class="form-control" name="deviceName" required 
                   placeholder="e.g., Living Room Display, Kitchen Dashboard">
            <div class="form-text">Give your device a descriptive name</div>
          </div>
          
          <div class="form-group mb-3">
            <label class="form-label">Device Type</label>
            <select class="form-control" name="deviceType" required>
              <option value="">Select device type...</option>
              <option value="esp32_cyd">ESP32 CYD (Cheap Yellow Display)</option>
              <option value="esp32_generic">ESP32 Generic</option>
              <option value="esp32_custom">ESP32 Custom Build</option>
            </select>
            <div class="form-text">Choose the type of ESP32 device you're registering</div>
          </div>
          
          <div id="registration-result" class="d-none">
            <div class="alert alert-success">
              <h5 class="alert-heading">
                <i class="fas fa-check-circle me-2"></i>
                Device Registered Successfully!
              </h5>
              <p>Please configure your ESP32 device with these credentials:</p>
              <div class="device-credentials">
                <div class="credential-item">
                  <label>Device ID:</label>
                  <div class="credential-value">
                    <code id="result-device-id"></code>
                    <button type="button" class="btn btn-link btn-sm copy-btn" data-copy="device-id">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
                <div class="credential-item">
                  <label>Device Token:</label>
                  <div class="credential-value">
                    <code id="result-device-token"></code>
                    <button type="button" class="btn btn-link btn-sm copy-btn" data-copy="device-token">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div class="alert alert-warning mt-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Important:</strong> Save these credentials now! The device token will not be shown again.
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="register-btn">
              <i class="fas fa-plus me-1"></i> Register Device
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Render help content
   */
  renderHelpContent() {
    return `
      <div class="help-content">
        <h4>ESP32 Dashboard Setup Guide</h4>
        <p class="text-muted mb-4">Follow these steps to set up your ESP32 device with the dashboard.</p>
        
        <div class="accordion" id="deviceHelpAccordion">
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#step1">
                <i class="fas fa-1 me-2"></i> Register Your Device
              </button>
            </h2>
            <div id="step1" class="accordion-collapse collapse show" data-bs-parent="#deviceHelpAccordion">
              <div class="accordion-body">
                <p>Start by registering your ESP32 device:</p>
                <ol>
                  <li>Go to the <strong>Add Device</strong> tab</li>
                  <li>Enter a descriptive name for your device</li>
                  <li>Select your ESP32 device type</li>
                  <li>Click "Register Device"</li>
                  <li>Save the Device ID and Token (you'll need these for setup)</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step2">
                <i class="fas fa-2 me-2"></i> Download Firmware
              </button>
            </h2>
            <div id="step2" class="accordion-collapse collapse" data-bs-parent="#deviceHelpAccordion">
              <div class="accordion-body">
                <p>Download the appropriate firmware for your device:</p>
                <div class="firmware-download">
                  <a href="/firmware/ESP32_CYD_Dashboard.zip" class="btn btn-primary mb-2" download>
                    <i class="fas fa-download me-1"></i> Download ESP32 CYD Firmware
                  </a>
                  <p class="text-muted">Compatible with ESP32-2432S028 (Cheap Yellow Display)</p>
                </div>
                <div class="alert alert-info">
                  <i class="fas fa-info-circle me-2"></i>
                  Make sure you have the Arduino IDE or PlatformIO installed for flashing firmware.
                </div>
              </div>
            </div>
          </div>
          
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step3">
                <i class="fas fa-3 me-2"></i> Flash Your ESP32
              </button>
            </h2>
            <div id="step3" class="accordion-collapse collapse" data-bs-parent="#deviceHelpAccordion">
              <div class="accordion-body">
                <p>Flash the dashboard firmware to your ESP32:</p>
                <ol>
                  <li>Connect your ESP32 to your computer via USB</li>
                  <li>Open Arduino IDE or your preferred flashing tool</li>
                  <li>Select the correct board and port</li>
                  <li>Upload the firmware</li>
                  <li>Wait for the upload to complete</li>
                </ol>
                <div class="alert alert-warning">
                  <i class="fas fa-exclamation-triangle me-2"></i>
                  Ensure you have the correct drivers installed for your ESP32 device.
                </div>
              </div>
            </div>
          </div>
          
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step4">
                <i class="fas fa-4 me-2"></i> Configure Device
              </button>
            </h2>
            <div id="step4" class="accordion-collapse collapse" data-bs-parent="#deviceHelpAccordion">
              <div class="accordion-body">
                <p>Configure your ESP32 device:</p>
                <ol>
                  <li>After flashing, your ESP32 will start in setup mode</li>
                  <li>Connect to the WiFi network: <code>Dashboard-ESP32-Setup</code></li>
                  <li>Open a browser and go to: <code>http://192.168.4.1</code></li>
                  <li>Enter your WiFi credentials</li>
                  <li>Enter the Device ID and Token from step 1</li>
                  <li>Enter server address: <code>${window.location.origin}</code></li>
                  <li>Click "Save & Connect"</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#step5">
                <i class="fas fa-5 me-2"></i> Enjoy Your Dashboard
              </button>
            </h2>
            <div id="step5" class="accordion-collapse collapse" data-bs-parent="#deviceHelpAccordion">
              <div class="accordion-body">
                <p>Your ESP32 display is now ready!</p>
                <ul>
                  <li>The display will show your dashboard widgets</li>
                  <li>Data updates automatically every few minutes</li>
                  <li>The first 4 widgets from your dashboard will appear on the ESP32</li>
                  <li>Customize your dashboard here to change what appears on your device</li>
                </ul>
                <div class="alert alert-success">
                  <i class="fas fa-check-circle me-2"></i>
                  <strong>Pro Tip:</strong> Arrange your most important widgets at the top of your dashboard - they'll appear on your ESP32 display!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup modal tab functionality
   */
  setupModalTabs(modal) {
    const tabButtons = modal.querySelectorAll('.nav-link');
    const tabPanes = modal.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update pane states
        tabPanes.forEach(pane => pane.classList.remove('active'));
        modal.querySelector(`#${targetTab}-content`).classList.add('active');
      });
    });
  }

  /**
   * Setup device management event handlers
   */
  setupDeviceManagementHandlers(modal) {
    // Register device form
    const registerForm = modal.querySelector('#register-device-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleDeviceRegistration(e, modal));
    }

    // Refresh devices button
    const refreshBtn = modal.querySelector('#refresh-devices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDeviceList(modal));
    }

    // Switch to add device tab
    const switchToAddBtns = modal.querySelectorAll('.switch-to-add');
    switchToAddBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelector('#add-device-tab').click();
      });
    });

    // Remove device buttons
    const removeBtns = modal.querySelectorAll('.remove-device-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDeviceRemoval(e, modal));
    });

    // View data buttons
    const viewDataBtns = modal.querySelectorAll('.view-data-btn');
    viewDataBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleViewDeviceData(e));
    });

    // Copy buttons
    const copyBtns = modal.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleCopyCredential(e));
    });

    // Accordion functionality for help section
    this.setupAccordion(modal);
  }

  /**
   * Handle device registration
   */
  async handleDeviceRegistration(event, modal) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('#register-btn');
    const spinner = submitBtn.querySelector('.spinner-border');
    const resultDiv = modal.querySelector('#registration-result');
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registering...';
    
    try {
      const formData = new FormData(form);
      const deviceName = formData.get('deviceName');
      const deviceType = formData.get('deviceType');
      
      const result = await this.registerDevice(deviceName, deviceType);
      
      // Show success result
      modal.querySelector('#result-device-id').textContent = result.deviceId;
      modal.querySelector('#result-device-token').textContent = result.deviceToken;
      resultDiv.classList.remove('d-none');
      
      // Hide form
      form.style.display = 'none';
      
      // Refresh device list
      this.refreshDeviceList(modal);
      
      this.showToast('Device registered successfully!', 'success');
      
    } catch (error) {
      console.error('Device registration error:', error);
      this.showToast('Failed to register device: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-plus me-1"></i> Register Device';
    }
  }

  /**
   * Handle device removal
   */
  async handleDeviceRemoval(event, modal) {
    const deviceId = event.target.closest('.remove-device-btn').dataset.deviceId;
    
    if (!confirm('Are you sure you want to remove this device? This action cannot be undone.')) {
      return;
    }
    
    try {
      await this.removeDevice(deviceId);
      this.showToast('Device removed successfully', 'success');
      this.refreshDeviceList(modal);
    } catch (error) {
      console.error('Device removal error:', error);
      this.showToast('Failed to remove device: ' + error.message, 'error');
    }
  }

  /**
   * Handle view device data
   */
  async handleViewDeviceData(event) {
    const deviceId = event.target.closest('.view-data-btn').dataset.deviceId;
    
    try {
      // This would show device-specific data
      this.showToast('Device data viewing coming soon', 'info');
    } catch (error) {
      console.error('View device data error:', error);
      this.showToast('Failed to load device data', 'error');
    }
  }

  /**
   * Handle copy credential
   */
  handleCopyCredential(event) {
    const copyType = event.target.closest('.copy-btn').dataset.copy;
    const targetId = copyType === 'device-id' ? 'result-device-id' : 'result-device-token';
    const text = document.getElementById(targetId).textContent;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Copied to clipboard!', 'success');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  /**
   * Fallback copy method
   */
  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast('Copied to clipboard!', 'success');
    } catch (err) {
      this.showToast('Failed to copy. Please copy manually.', 'error');
    }
    document.body.removeChild(textArea);
  }

  /**
   * Setup accordion functionality
   */
  setupAccordion(modal) {
    const accordionButtons = modal.querySelectorAll('.accordion-button');
    accordionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = button.dataset.bsTarget || button.getAttribute('data-bs-target');
        if (!target) return;
        
        const targetElement = modal.querySelector(target);
        if (!targetElement) return;
        
        const isExpanded = targetElement.classList.contains('show');
        
        // Close all other accordion items
        modal.querySelectorAll('.accordion-collapse').forEach(collapse => {
          collapse.classList.remove('show');
        });
        modal.querySelectorAll('.accordion-button').forEach(btn => {
          btn.classList.add('collapsed');
        });
        
        // Toggle current item
        if (!isExpanded) {
          targetElement.classList.add('show');
          button.classList.remove('collapsed');
        }
      });
    });
  }

  /**
   * Refresh device list
   */
  async refreshDeviceList(modal) {
    try {
      const devices = await this.fetchUserDevices();
      const container = modal.querySelector('.device-list-container');
      if (container) {
        container.innerHTML = this.renderDeviceList(devices);
        
        // Re-setup event handlers for new elements
        this.setupDeviceListHandlers(modal);
      }
    } catch (error) {
      console.error('Refresh device list error:', error);
      this.showToast('Failed to refresh device list', 'error');
    }
  }

  /**
   * Setup device list event handlers
   */
  setupDeviceListHandlers(modal) {
    // Remove device buttons
    const removeBtns = modal.querySelectorAll('.remove-device-btn');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDeviceRemoval(e, modal));
    });

    // View data buttons
    const viewDataBtns = modal.querySelectorAll('.view-data-btn');
    viewDataBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleViewDeviceData(e));
    });

    // Switch to add device buttons
    const switchToAddBtns = modal.querySelectorAll('.switch-to-add');
    switchToAddBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelector('#add-device-tab').click();
      });
    });

    // Refresh button
    const refreshBtn = modal.querySelector('#refresh-devices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshDeviceList(modal));
    }
  }

  /**
   * API Methods
   */

  /**
   * Fetch user's devices
   */
  async fetchUserDevices() {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/api/devices', {
      headers: {
        'x-auth-token': token
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch devices');
    }

    const data = await response.json();
    return data.devices || [];
  }

  /**
   * Register a new device
   */
  async registerDevice(deviceName, deviceType) {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch('/api/devices/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ deviceName, deviceType })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register device');
    }

    return await response.json();
  }

  /**
   * Remove a device
   */
  async removeDevice(deviceId) {
    const token = localStorage.getItem('auth-token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove device');
    }

    return await response.json();
  }

  /**
   * Utility Methods
   */

  /**
   * Get device type friendly name
   */
  getDeviceTypeName(deviceType) {
    const typeMap = {
      'esp32_cyd': 'ESP32 CYD',
      'esp32_generic': 'ESP32 Generic',
      'esp32_custom': 'ESP32 Custom'
    };
    return typeMap[deviceType] || deviceType;
  }

  /**
   * Get device status badge
   */
  getDeviceStatusBadge(device) {
    if (device.last_connected) {
      const lastConnected = new Date(device.last_connected);
      const now = new Date();
      const timeDiff = now - lastConnected;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 1) {
        return '<span class="badge bg-success">Online</span>';
      } else if (hoursDiff < 24) {
        return '<span class="badge bg-warning">Recently Active</span>';
      } else {
        return '<span class="badge bg-secondary">Offline</span>';
      }
    }
    return '<span class="badge bg-secondary">Never Connected</span>';
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Create modal
   */
  createModal(title, content, size = 'normal') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup close handlers
    modal.querySelector('.modal-close').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    return modal;
  }

  /**
   * Close modal
   */
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

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Use the global toast system if available
    if (window.dashboardApp && window.dashboardApp.showToast) {
      window.dashboardApp.showToast(message, type);
    } else if (window.showToast) {
      window.showToast(message, type);
    } else {
      // Fallback
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.devices = [];
    // Remove any open modals or event listeners if needed
  }
}

// Initialize device manager
const deviceManager = new DeviceManager();

// Export for global access
window.deviceManager = deviceManager;
