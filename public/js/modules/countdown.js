/**
* countdown.js - Countdown module with standardized configuration
* Provides a countdown timer widget with flexible formatting and timezone support
*/

import { ModuleRegistry, showToast } from '../module-core.js';

const CountdownModule = {
 name: 'Countdown',
 description: 'Countdown timer to important events and deadlines',
 category: 'tools',
 version: '2.0.0',
 author: 'Dashboard Team',
 icon: 'fas fa-hourglass-half',
 cssClass: 'countdown-module',
 
 // Module configuration schema
 configOptions: [
   {
     name: 'title',
     label: 'Countdown Title',
     type: 'text',
     default: 'New Year',
     description: 'Name for your countdown event',
     required: true,
     validation: {
       minLength: 1,
       maxLength: 100
     }
   },
   {
     name: 'targetDate',
     label: 'Target Date & Time',
     type: 'datetime-local',
     default: '2026-01-01T00:00:00',
     description: 'When your countdown should end',
     required: true,
     min: new Date().toISOString().slice(0, 16)
   },
   {
     name: 'timezone',
     label: 'Timezone',
     type: 'select',
     options: [
       { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
       { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
       { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
       { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
       { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
       { value: 'Europe/London', label: 'London (GMT/BST)' },
       { value: 'Europe/Paris', label: 'Central European Time' },
       { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
       { value: 'Asia/Shanghai', label: 'China Standard Time' },
       { value: 'Australia/Sydney', label: 'Australian Eastern Time' }
     ],
     default: Intl.DateTimeFormat().resolvedOptions().timeZone,
     description: 'Timezone for the countdown',
     required: false
   },
   {
     name: 'format',
     label: 'Display Format',
     type: 'select',
     options: [
       { value: 'detailed', label: 'Detailed (Days, Hours, Minutes, Seconds)' },
       { value: 'compact', label: 'Compact (Days, Hours)' },
       { value: 'minimal', label: 'Minimal (Days only)' },
       { value: 'precise', label: 'Precise (Including milliseconds)' }
     ],
     default: 'detailed',
     description: 'How to display the countdown',
     required: false
   },
   {
     name: 'showProgress',
     label: 'Show Progress Bar',
     type: 'checkbox',
     default: true,
     description: 'Display visual progress towards the target',
     required: false
   },
   {
     name: 'startDate',
     label: 'Start Date (Optional)',
     type: 'datetime-local',
     default: '',
     description: 'When the countdown period began',
     required: false
   },
   {
     name: 'alertDays',
     label: 'Alert When Close (Days)',
     type: 'number',
     default: 7,
     min: 0,
     max: 365,
     description: 'Show alert when countdown is within this many days',
     required: false
   },
   {
     name: 'detailLevel',
     label: 'Detail Level',
     type: 'select',
     options: [
       { value: 'compact', label: 'Compact - Basic countdown display' },
       { value: 'normal', label: 'Normal - Standard features' },
       { value: 'expanded', label: 'Expanded - Full features with progress' }
     ],
     default: 'compact',
     description: 'Amount of features to show',
     required: false
   }
 ],
 
 // Configuration presets
 configPresets: {
   'new_year': {
     name: 'New Year Countdown',
     description: 'Count down to the new year',
     config: {
       title: 'New Year 2026',
       targetDate: '2026-01-01T00:00:00',
       format: 'detailed',
       showProgress: false,
       alertDays: 30
     }
   },
   'project_deadline': {
     name: 'Project Deadline',
     description: 'Track project due dates',
     config: {
       title: 'Project Due',
       format: 'detailed',
       showProgress: true,
       alertDays: 3
     }
   },
   'vacation': {
     name: 'Vacation Countdown',
     description: 'Count down to vacation time',
     config: {
       title: 'Vacation Time!',
       format: 'detailed',
       showProgress: true,
       alertDays: 14
     }
   }
 },

 /**
  * Initialize the countdown module
  */
 async initialize() {
   console.log('Countdown module initialized');
 },

 /**
  * Fetch countdown data
  */
 async fetchData(config = {}) {
   try {
     // Build query parameters
     const params = new URLSearchParams();
     for (const [key, value] of Object.entries(config)) {
       if (value !== undefined && value !== null && value !== '') {
         params.append(key, value);
       }
     }

     const response = await fetch(`/api/widget/countdown?${params.toString()}`);
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }
     
     const result = await response.json();
     
     if (result.error) {
       throw new Error(result.error);
     }
     
     return result.data;
   } catch (error) {
     console.error('Countdown data fetch error:', error);
     throw error;
   }
 },
 
 /**
  * Render the countdown module
  */
 async render(container, data, detailLevel = 'compact') {
   if (!data) {
     container.innerHTML = `
       <div class="module-message">
         <div class="alert alert-warning">
           <i class="fas fa-exclamation-triangle me-2"></i>
           No countdown data available
         </div>
       </div>
     `;
     return;
   }

   const countdownId = `countdown-${Date.now()}`;
   
   // Check if countdown is completed
   if (data.completed) {
     container.innerHTML = `
       <div class="countdown-data completed">
         <div class="countdown-title">${this.escapeHtml(data.title)}</div>
         <div class="countdown-completed">
           <div class="countdown-completed-icon">
             <i class="fas fa-check-circle"></i>
           </div>
           <div class="countdown-completed-text">Event Complete!</div>
           <div class="countdown-completed-date">
             ${new Date(data.targetDate).toLocaleDateString()}
           </div>
         </div>
       </div>
     `;
     return;
   }

   // Calculate time remaining
   const now = new Date();
   const target = new Date(data.targetDate);
   const diff = target - now;
   
   if (diff <= 0) {
     this.renderCompletedCountdown(container, data);
     return;
   }

   const timeUnits = this.calculateTimeUnits(diff);
   const format = data.format || 'detailed';
   const isAlertTime = data.alertDays && (diff / (1000 * 60 * 60 * 24)) <= data.alertDays;

   let html = `
     <div class="countdown-data ${isAlertTime ? 'alert-time' : ''}" data-countdown-id="${countdownId}">
       <div class="countdown-title">${this.escapeHtml(data.title)}</div>
       
       <div class="countdown-timer ${format}" id="countdown-timer-${countdownId}">
         ${this.renderTimeUnits(timeUnits, format)}
       </div>
   `;

   // Add date information for normal and expanded views
   if (detailLevel !== 'compact') {
     html += `
       <div class="countdown-date">
         ${this.formatTargetDate(data.targetDate, data.timezone)}
       </div>
     `;
   }

   // Add progress bar if enabled and expanded view
   if (data.showProgress && detailLevel === 'expanded' && data.startDate) {
     const progressPercent = this.calculateProgress(data.startDate, data.targetDate);
     html += `
       <div class="countdown-progress">
         <div class="progress-label">Progress: ${progressPercent}%</div>
         <div class="countdown-bar">
           <div class="countdown-bar-fill" style="width: ${progressPercent}%"></div>
         </div>
       </div>
     `;
   }

   // Add alert indicator if close to target
   if (isAlertTime && detailLevel !== 'compact') {
     const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
     html += `
       <div class="countdown-alert">
         <i class="fas fa-exclamation-triangle me-1"></i>
         ${daysLeft === 1 ? 'Tomorrow!' : `${daysLeft} days left!`}
       </div>
     `;
   }

   html += '</div>';
   container.innerHTML = html;

   // Start live countdown updates
   this.startCountdownTimer(countdownId, data);
 },

 /**
  * Render completed countdown
  */
 renderCompletedCountdown(container, data) {
   container.innerHTML = `
     <div class="countdown-data completed">
       <div class="countdown-title">${this.escapeHtml(data.title)}</div>
       <div class="countdown-completed">
         <div class="countdown-completed-icon">
           <i class="fas fa-party-horn"></i>
         </div>
         <div class="countdown-completed-text">Time's Up!</div>
         <div class="countdown-completed-date">
           ${this.formatTargetDate(data.targetDate, data.timezone)}
         </div>
       </div>
     </div>
   `;
 },

 /**
  * Calculate time units from milliseconds
  */
 calculateTimeUnits(milliseconds) {
   const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
   const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
   const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
   const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
   const ms = milliseconds % 1000;

   return { days, hours, minutes, seconds, ms };
 },

 /**
  * Render time units based on format
  */
 renderTimeUnits(timeUnits, format) {
   const { days, hours, minutes, seconds, ms } = timeUnits;

   switch (format) {
     case 'minimal':
       return `
         <div class="countdown-unit">
           <span class="countdown-value">${days}</span>
           <div class="countdown-label">Days</div>
         </div>
       `;

     case 'compact':
       return `
         <div class="countdown-unit">
           <span class="countdown-value">${days}</span>
           <div class="countdown-label">Days</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${hours.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Hours</div>
         </div>
       `;

     case 'precise':
       return `
         <div class="countdown-unit">
           <span class="countdown-value">${days}</span>
           <div class="countdown-label">Days</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${hours.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Hours</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${minutes.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Min</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${seconds.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Sec</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value countdown-ms">${ms.toString().padStart(3, '0')}</span>
           <div class="countdown-label">MS</div>
         </div>
       `;

     case 'detailed':
     default:
       return `
         <div class="countdown-unit">
           <span class="countdown-value">${days}</span>
           <div class="countdown-label">Days</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${hours.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Hours</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${minutes.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Minutes</div>
         </div>
         <div class="countdown-unit">
           <span class="countdown-value">${seconds.toString().padStart(2, '0')}</span>
           <div class="countdown-label">Seconds</div>
         </div>
       `;
   }
 },

 /**
  * Format target date for display
  */
 formatTargetDate(targetDate, timezone) {
   try {
     const date = new Date(targetDate);
     const options = {
       weekday: 'long',
       year: 'numeric',
       month: 'long',
       day: 'numeric',
       hour: '2-digit',
       minute: '2-digit',
       timeZoneName: 'short'
     };

     if (timezone && timezone !== 'UTC') {
       options.timeZone = timezone;
     }

     return date.toLocaleDateString(undefined, options);
   } catch (error) {
     return targetDate;
   }
 },

 /**
  * Calculate progress percentage
  */
 calculateProgress(startDate, targetDate) {
   const start = new Date(startDate);
   const target = new Date(targetDate);
   const now = new Date();

   if (now <= start) return 0;
   if (now >= target) return 100;

   const total = target - start;
   const elapsed = now - start;
   const percent = Math.round((elapsed / total) * 100);

   return Math.max(0, Math.min(100, percent));
 },

 /**
  * Start live countdown timer
  */
 startCountdownTimer(countdownId, data) {
   const updateInterval = data.format === 'precise' ? 10 : 1000; // 10ms for precise, 1s for others
   
   const timer = setInterval(() => {
     this.updateCountdownDisplay(countdownId, data, timer);
   }, updateInterval);

   // Store timer reference for cleanup
   if (!window.countdownTimers) {
     window.countdownTimers = new Map();
   }
   window.countdownTimers.set(countdownId, timer);
 },

 /**
  * Update countdown display
  */
 updateCountdownDisplay(countdownId, data, timer) {
   const timerElement = document.getElementById(`countdown-timer-${countdownId}`);
   if (!timerElement) {
     // Element no longer exists, clear timer
     clearInterval(timer);
     if (window.countdownTimers) {
       window.countdownTimers.delete(countdownId);
     }
     return;
   }

   const now = new Date();
   const target = new Date(data.targetDate);
   const diff = target - now;

   if (diff <= 0) {
     // Countdown finished
     clearInterval(timer);
     if (window.countdownTimers) {
       window.countdownTimers.delete(countdownId);
     }
     
     // Trigger completion animation
     this.triggerCompletionEffect(countdownId, data);
     return;
   }

   const timeUnits = this.calculateTimeUnits(diff);
   const format = data.format || 'detailed';
   
   // Update time units
   const unitElements = timerElement.querySelectorAll('.countdown-value');
   
   switch (format) {
     case 'minimal':
       if (unitElements[0]) unitElements[0].textContent = timeUnits.days;
       break;
       
     case 'compact':
       if (unitElements[0]) unitElements[0].textContent = timeUnits.days;
       if (unitElements[1]) unitElements[1].textContent = timeUnits.hours.toString().padStart(2, '0');
       break;
       
     case 'precise':
       if (unitElements[0]) unitElements[0].textContent = timeUnits.days;
       if (unitElements[1]) unitElements[1].textContent = timeUnits.hours.toString().padStart(2, '0');
       if (unitElements[2]) unitElements[2].textContent = timeUnits.minutes.toString().padStart(2, '0');
       if (unitElements[3]) unitElements[3].textContent = timeUnits.seconds.toString().padStart(2, '0');
       if (unitElements[4]) unitElements[4].textContent = timeUnits.ms.toString().padStart(3, '0');
       break;
       
     case 'detailed':
     default:
       if (unitElements[0]) unitElements[0].textContent = timeUnits.days;
       if (unitElements[1]) unitElements[1].textContent = timeUnits.hours.toString().padStart(2, '0');
       if (unitElements[2]) unitElements[2].textContent = timeUnits.minutes.toString().padStart(2, '0');
       if (unitElements[3]) unitElements[3].textContent = timeUnits.seconds.toString().padStart(2, '0');
       break;
   }

   // Update progress bar if present
   if (data.showProgress && data.startDate) {
     const progressBar = document.querySelector(`[data-countdown-id="${countdownId}"] .countdown-bar-fill`);
     if (progressBar) {
       const progressPercent = this.calculateProgress(data.startDate, data.targetDate);
       progressBar.style.width = `${progressPercent}%`;
     }
   }

   // Check for alert state
   const isAlertTime = data.alertDays && (diff / (1000 * 60 * 60 * 24)) <= data.alertDays;
   const countdownContainer = document.querySelector(`[data-countdown-id="${countdownId}"]`);
   if (countdownContainer) {
     countdownContainer.classList.toggle('alert-time', isAlertTime);
   }
 },

 /**
  * Trigger completion effect
  */
 triggerCompletionEffect(countdownId, data) {
   const container = document.querySelector(`[data-countdown-id="${countdownId}"]`).parentElement;
   
   // Show completion animation
   container.innerHTML = `
     <div class="countdown-data completed celebration">
       <div class="countdown-title">${this.escapeHtml(data.title)}</div>
       <div class="countdown-completed">
         <div class="countdown-completed-icon animate">
           <i class="fas fa-trophy"></i>
         </div>
         <div class="countdown-completed-text animate">Complete!</div>
         <div class="countdown-completed-message">
           🎉 Your countdown has finished! 🎉
         </div>
       </div>
     </div>
   `;

   // Show toast notification
   showToast(`🎉 ${data.title} countdown complete!`, 'success', 5000);

   // Play completion sound if available
   if (typeof Audio !== 'undefined') {
     try {
       // Create a simple completion beep using Web Audio API
       const audioContext = new (window.AudioContext || window.webkitAudioContext)();
       const oscillator = audioContext.createOscillator();
       const gainNode = audioContext.createGain();
       
       oscillator.connect(gainNode);
       gainNode.connect(audioContext.destination);
       
       oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
       oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
       
       gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
       gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
       
       oscillator.start(audioContext.currentTime);
       oscillator.stop(audioContext.currentTime + 0.3);
     } catch (error) {
       // Ignore audio errors
     }
   }
 },

 /**
  * Configure the countdown module
  */
 configure(id, currentConfig = {}, callback) {
   const modal = document.createElement('div');
   modal.className = 'modal-overlay';
   modal.innerHTML = `
     <div class="modal large">
       <div class="modal-header">
         <h3>Configure Countdown Widget</h3>
         <button class="modal-close">&times;</button>
       </div>
       <div class="modal-body">
         <form id="countdown-config-form-${id}">
           <!-- Basic Configuration -->
           <div class="config-section">
             <h4>Event Details</h4>
             
             <div class="form-group mb-3">
               <label for="title-${id}" class="form-label">Event Title</label>
               <input type="text" class="form-control" id="title-${id}" name="title" 
                      value="${currentConfig.title || 'New Year'}" maxlength="100" required>
               <div class="form-text">Give your countdown a meaningful name</div>
             </div>
             
             <div class="form-group mb-3">
               <label for="targetDate-${id}" class="form-label">Target Date & Time</label>
               <input type="datetime-local" class="form-control" id="targetDate-${id}" name="targetDate" 
                      value="${currentConfig.targetDate || '2026-01-01T00:00:00'}" required>
               <div class="form-text">When your countdown should reach zero</div>
             </div>
             
             <div class="form-group mb-3">
               <label for="timezone-${id}" class="form-label">Timezone</label>
               <select class="form-control" id="timezone-${id}" name="timezone">
                 <option value="UTC" ${currentConfig.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
                 <option value="America/New_York" ${currentConfig.timezone === 'America/New_York' ? 'selected' : ''}>Eastern Time</option>
                 <option value="America/Chicago" ${currentConfig.timezone === 'America/Chicago' ? 'selected' : ''}>Central Time</option>
                 <option value="America/Denver" ${currentConfig.timezone === 'America/Denver' ? 'selected' : ''}>Mountain Time</option>
                 <option value="America/Los_Angeles" ${currentConfig.timezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific Time</option>
                 <option value="Europe/London" ${currentConfig.timezone === 'Europe/London' ? 'selected' : ''}>London</option>
                 <option value="Europe/Paris" ${currentConfig.timezone === 'Europe/Paris' ? 'selected' : ''}>Central European</option>
                 <option value="Asia/Tokyo" ${currentConfig.timezone === 'Asia/Tokyo' ? 'selected' : ''}>Tokyo</option>
               </select>
             </div>
           </div>
           
           <!-- Display Configuration -->
           <div class="config-section">
             <h4>Display Options</h4>
             
             <div class="row">
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <label for="format-${id}" class="form-label">Display Format</label>
                   <select class="form-control" id="format-${id}" name="format">
                     <option value="detailed" ${(currentConfig.format === 'detailed' || !currentConfig.format) ? 'selected' : ''}>Detailed (D:H:M:S)</option>
                     <option value="compact" ${currentConfig.format === 'compact' ? 'selected' : ''}>Compact (D:H)</option>
                     <option value="minimal" ${currentConfig.format === 'minimal' ? 'selected' : ''}>Minimal (Days)</option>
                     <option value="precise" ${currentConfig.format === 'precise' ? 'selected' : ''}>Precise (+ MS)</option>
                   </select>
                 </div>
               </div>
               
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <label for="detailLevel-${id}" class="form-label">Detail Level</label>
                   <select class="form-control" id="detailLevel-${id}" name="detailLevel">
                     <option value="compact" ${(currentConfig.detailLevel === 'compact' || !currentConfig.detailLevel) ? 'selected' : ''}>Compact</option>
                     <option value="normal" ${currentConfig.detailLevel === 'normal' ? 'selected' : ''}>Normal</option>
                     <option value="expanded" ${currentConfig.detailLevel === 'expanded' ? 'selected' : ''}>Expanded</option>
                   </select>
                 </div>
               </div>
             </div>
             
             <div class="form-group mb-3">
               <label for="alertDays-${id}" class="form-label">Alert When Close (Days)</label>
               <input type="number" class="form-control" id="alertDays-${id}" name="alertDays" 
                      value="${currentConfig.alertDays || 7}" min="0" max="365">
               <div class="form-text">Show alert styling when countdown is within this many days</div>
             </div>
           </div>
           
           <!-- Progress Configuration -->
           <div class="config-section">
             <h4>Progress Tracking</h4>
             
             <div class="form-group mb-3">
               <div class="form-check">
                 <input class="form-check-input" type="checkbox" id="showProgress-${id}" name="showProgress" ${currentConfig.showProgress !== false ? 'checked' : ''}>
                 <label class="form-check-label" for="showProgress-${id}">
                   Show Progress Bar
                 </label>
               </div>
               <div class="form-text">Requires start date to calculate progress</div>
             </div>
             
             <div class="form-group mb-3" id="startDate-group-${id}">
               <label for="startDate-${id}" class="form-label">Start Date (Optional)</label>
               <input type="datetime-local" class="form-control" id="startDate-${id}" name="startDate" 
                      value="${currentConfig.startDate || ''}">
               <div class="form-text">When the countdown period began (for progress calculation)</div>
             </div>
           </div>
           
           <!-- Configuration Presets -->
           <div class="config-section">
             <h4>Quick Presets</h4>
             <div class="preset-buttons">
               ${Object.entries(this.configPresets).map(([key, preset]) => `
                 <button type="button" class="btn btn-outline-secondary preset-btn me-2 mb-2" data-preset="${key}">
                   ${preset.name}
                   <small class="d-block">${preset.description}</small>
                 </button>
               `).join('')}
             </div>
           </div>
           
           <div class="modal-footer">
             <button type="button" class="btn btn-outline-secondary" id="cancel-${id}">Cancel</button>
             <button type="submit" class="btn btn-primary">Save Configuration</button>
           </div>
         </form>
       </div>
     </div>
   `;
   
   document.body.appendChild(modal);
   this.setupConfigurationHandlers(modal, id, currentConfig, callback);
 },

 /**
  * Setup configuration modal handlers
  */
 setupConfigurationHandlers(modal, id, currentConfig, callback) {
   // Close handlers
   modal.querySelector('.modal-close').addEventListener('click', () => {
     document.body.removeChild(modal);
   });
   
   modal.querySelector(`#cancel-${id}`).addEventListener('click', () => {
     document.body.removeChild(modal);
   });
   
   // Progress checkbox handler
   const showProgressCheckbox = modal.querySelector(`#showProgress-${id}`);
   const startDateGroup = modal.querySelector(`#startDate-group-${id}`);
   
   showProgressCheckbox.addEventListener('change', function() {
     startDateGroup.style.display = this.checked ? 'block' : 'none';
   });
   
   // Initial state
   startDateGroup.style.display = showProgressCheckbox.checked ? 'block' : 'none';
   
   // Preset buttons
   modal.querySelectorAll('.preset-btn').forEach(btn => {
     btn.addEventListener('click', function() {
       const presetKey = this.dataset.preset;
       const preset = CountdownModule.configPresets[presetKey];
       if (preset) {
         // Apply preset values to form
         Object.entries(preset.config).forEach(([key, value]) => {
           const input = modal.querySelector(`[name="${key}"]`);
           if (input) {
             if (input.type === 'checkbox') {
               input.checked = value;
             } else {
               input.value = value;
             }
           }
         });
         
         // Update start date visibility
         const showProgress = modal.querySelector(`#showProgress-${id}`);
         startDateGroup.style.display = showProgress.checked ? 'block' : 'none';
         
         // Visual feedback
         modal.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
         this.classList.add('active');
       }
     });
   });
   
   // Form submission
   const form = modal.querySelector(`#countdown-config-form-${id}`);
   form.addEventListener('submit', (e) => {
     e.preventDefault();
     
     const formData = new FormData(form);
     const newConfig = {};
     
     // Process form data
     for (const [key, value] of formData.entries()) {
       if (key === 'showProgress') {
         newConfig[key] = true;
       } else if (key === 'alertDays') {
         newConfig[key] = parseInt(value) || 7;
       } else {
         newConfig[key] = value;
       }
     }
     
// Handle unchecked checkboxes
     if (!formData.has('showProgress')) {
       newConfig.showProgress = false;
     }
     if (!formData.has('enableAlerts')) {
       newConfig.enableAlerts = false;
     }
     
     document.body.removeChild(modal);
     
     if (typeof callback === 'function') {
       callback(newConfig);
     }
     
     showToast('Countdown configuration updated', 'success');
   });
 },

 /**
  * Setup configuration modal handlers
  */
 setupConfigurationHandlers(modal, id, currentConfig, callback) {
   // Close handlers
   modal.querySelector('.modal-close').addEventListener('click', () => {
     document.body.removeChild(modal);
   });
   
   modal.querySelector(`#cancel-${id}`).addEventListener('click', () => {
     document.body.removeChild(modal);
   });
   
   // Preset buttons
   modal.querySelectorAll('.preset-btn').forEach(btn => {
     btn.addEventListener('click', function() {
       const presetKey = this.dataset.preset;
       const preset = CountdownModule.configPresets[presetKey];
       if (preset) {
         // Apply preset values to form
         Object.entries(preset.config).forEach(([key, value]) => {
           const input = modal.querySelector(`[name="${key}"]`);
           if (input) {
             if (input.type === 'checkbox') {
               input.checked = value;
             } else {
               input.value = value;
             }
           }
         });
         
         // Visual feedback
         modal.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
         this.classList.add('active');
       }
     });
   });
 },

 /**
  * Utility functions
  */
 escapeHtml(text) {
   const div = document.createElement('div');
   div.textContent = text;
   return div.innerHTML;
 },

 formatDate(date) {
   return new Date(date).toLocaleDateString(undefined, {
     year: 'numeric',
     month: 'long',
     day: 'numeric',
     hour: '2-digit',
     minute: '2-digit'
   });
 }
};

// Register the module
ModuleRegistry.register('countdown', CountdownModule);

export default CountdownModule;
