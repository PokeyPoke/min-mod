/**
* notes.js - Notes module with standardized configuration
* Provides a simple note-taking widget with formatting options
*/

import { ModuleRegistry, showToast } from '../module-core.js';

const NotesModule = {
 name: 'Notes',
 description: 'Simple note-taking widget with rich formatting options',
 category: 'tools',
 version: '2.0.0',
 author: 'Dashboard Team',
 icon: 'fas fa-sticky-note',
 cssClass: 'notes-module',
 
 // Module configuration schema
 configOptions: [
   {
     name: 'title',
     label: 'Note Title',
     type: 'text',
     default: 'Notes',
     description: 'Title for the note widget',
     required: false,
     validation: {
       maxLength: 100
     }
   },
   {
     name: 'content',
     label: 'Note Content',
     type: 'textarea',
     default: '',
     description: 'Content of the note',
     required: false,
     validation: {
       maxLength: 10000
     }
   },
   {
     name: 'fontSize',
     label: 'Font Size',
     type: 'select',
     options: [
       { value: 'small', label: 'Small' },
       { value: 'normal', label: 'Normal' },
       { value: 'large', label: 'Large' }
     ],
     default: 'normal',
     description: 'Text size for the notes',
     required: false
   },
   {
     name: 'lineHeight',
     label: 'Line Height',
     type: 'select',
     options: [
       { value: 'compact', label: 'Compact' },
       { value: 'normal', label: 'Normal' },
       { value: 'relaxed', label: 'Relaxed' }
     ],
     default: 'normal',
     description: 'Line spacing for text',
     required: false
   },
   {
     name: 'showWordCount',
     label: 'Show Word Count',
     type: 'checkbox',
     default: true,
     description: 'Display word and character count',
     required: false
   },
   {
     name: 'autoSave',
     label: 'Auto Save',
     type: 'checkbox',
     default: true,
     description: 'Automatically save changes',
     required: false
   },
   {
     name: 'spellCheck',
     label: 'Spell Check',
     type: 'checkbox',
     default: true,
     description: 'Enable spell checking',
     required: false
   },
   {
     name: 'detailLevel',
     label: 'Detail Level',
     type: 'select',
     options: [
       { value: 'compact', label: 'Compact - Basic note editor' },
       { value: 'normal', label: 'Normal - Standard features' },
       { value: 'expanded', label: 'Expanded - Full features' }
     ],
     default: 'compact',
     description: 'Amount of features to show',
     required: false
   }
 ],
 
 // Configuration presets
 configPresets: {
   'minimal': {
     name: 'Minimal',
     description: 'Basic note-taking',
     config: {
       showWordCount: false,
       fontSize: 'normal',
       lineHeight: 'normal',
       spellCheck: false
     }
   },
   'writer': {
     name: 'Writer Mode',
     description: 'For extended writing',
     config: {
       fontSize: 'large',
       lineHeight: 'relaxed',
       showWordCount: true,
       spellCheck: true,
       autoSave: true
     }
   },
   'compact': {
     name: 'Compact',
     description: 'Space-efficient notes',
     config: {
       fontSize: 'small',
       lineHeight: 'compact',
       showWordCount: false
     }
   }
 },

 /**
  * Initialize the notes module
  */
 async initialize() {
   console.log('Notes module initialized');
 },

 /**
  * Fetch notes data
  */
 async fetchData(config = {}) {
   try {
     // Build query parameters
     const params = new URLSearchParams();
     for (const [key, value] of Object.entries(config)) {
       if (value !== undefined && value !== null) {
         params.append(key, value);
       }
     }

     const response = await fetch(`/api/widget/notes?${params.toString()}`);
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }
     
     const result = await response.json();
     
     if (result.error) {
       throw new Error(result.error);
     }
     
     return result.data;
   } catch (error) {
     console.error('Notes data fetch error:', error);
     throw error;
   }
 },
 
 /**
  * Render the notes module
  */
 async render(container, data, detailLevel = 'compact') {
   if (!data) {
     container.innerHTML = `
       <div class="module-message">
         <div class="alert alert-warning">
           <i class="fas fa-exclamation-triangle me-2"></i>
           No notes data available
         </div>
       </div>
     `;
     return;
   }

   const noteId = `notes-${Date.now()}`;
   
   let html = `
     <div class="notes-data" data-font-size="${data.fontSize}" data-line-height="${data.lineHeight}">
       <div class="notes-header">
         <input type="text" class="notes-title-input" 
                value="${this.escapeHtml(data.title || 'Notes')}" 
                placeholder="Note title..."
                maxlength="100"
                data-auto-save="${data.autoSave}">
         <div class="notes-actions">
           ${detailLevel === 'expanded' ? this.renderToolbar() : ''}
           <button class="notes-action-btn save-btn" title="Save" data-auto-save="${data.autoSave}">
             <i class="fas fa-save"></i>
           </button>
         </div>
       </div>
       
       <div class="notes-editor">
         <textarea class="notes-content" 
                   placeholder="Start writing your notes here..."
                   spellcheck="${data.spellCheck}"
                   maxlength="10000"
                   data-auto-save="${data.autoSave}"
                   data-note-id="${noteId}">${this.escapeHtml(data.content || '')}</textarea>
       </div>
   `;

   // Add footer with statistics and options
   if (data.showWordCount || detailLevel !== 'compact') {
     html += `
       <div class="notes-footer">
         ${data.showWordCount ? `
           <div class="notes-stats">
             <span class="word-count">0 words</span>
             <span class="character-count">0 characters</span>
           </div>
         ` : ''}
         
         ${detailLevel === 'expanded' ? `
           <div class="notes-options">
             <button class="notes-action-btn export-btn" title="Export">
               <i class="fas fa-download"></i>
             </button>
             <button class="notes-action-btn clear-btn" title="Clear">
               <i class="fas fa-trash"></i>
             </button>
           </div>
         ` : ''}
         
         <div class="notes-save-status">
           ${data.autoSave ? '<span class="auto-save-indicator">Auto-save: On</span>' : ''}
         </div>
       </div>
     `;
   }

   html += '</div>';
   container.innerHTML = html;

   // Setup interactive functionality
   this.setupNotesInteractivity(container, data);
   
   // Update initial statistics
   this.updateNotesStatistics(container);
 },

 /**
  * Render formatting toolbar for expanded view
  */
 renderToolbar() {
   return `
     <div class="notes-toolbar">
       <button class="notes-action-btn format-btn" data-format="bold" title="Bold">
         <i class="fas fa-bold"></i>
       </button>
       <button class="notes-action-btn format-btn" data-format="italic" title="Italic">
         <i class="fas fa-italic"></i>
       </button>
       <div class="notes-action-separator"></div>
       <button class="notes-action-btn format-btn" data-format="list" title="Bullet List">
         <i class="fas fa-list-ul"></i>
       </button>
       <button class="notes-action-btn format-btn" data-format="numbered" title="Numbered List">
         <i class="fas fa-list-ol"></i>
       </button>
       <div class="notes-action-separator"></div>
       <button class="notes-action-btn undo-btn" title="Undo">
         <i class="fas fa-undo"></i>
       </button>
       <button class="notes-action-btn redo-btn" title="Redo">
         <i class="fas fa-redo"></i>
       </button>
     </div>
   `;
 },

 /**
  * Setup notes interactivity
  */
 setupNotesInteractivity(container, data) {
   const titleInput = container.querySelector('.notes-title-input');
   const contentTextarea = container.querySelector('.notes-content');
   const saveBtn = container.querySelector('.save-btn');
   
   if (!titleInput || !contentTextarea) return;

   let saveTimeout;
   let hasUnsavedChanges = false;

   // Auto-save functionality
   const autoSave = () => {
     if (data.autoSave && hasUnsavedChanges) {
       this.saveNotes(container);
       hasUnsavedChanges = false;
     }
   };

   // Title input handler
   titleInput.addEventListener('input', () => {
     hasUnsavedChanges = true;
     if (data.autoSave) {
       clearTimeout(saveTimeout);
       saveTimeout = setTimeout(autoSave, 1000);
     }
   });

   // Content textarea handler
   contentTextarea.addEventListener('input', () => {
     hasUnsavedChanges = true;
     this.updateNotesStatistics(container);
     
     if (data.autoSave) {
       clearTimeout(saveTimeout);
       saveTimeout = setTimeout(autoSave, 1000);
     }
   });

   // Manual save button
   if (saveBtn) {
     saveBtn.addEventListener('click', () => {
       this.saveNotes(container);
       hasUnsavedChanges = false;
     });
   }

   // Keyboard shortcuts
   contentTextarea.addEventListener('keydown', (e) => {
     // Ctrl+S for save
     if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
       e.preventDefault();
       this.saveNotes(container);
       hasUnsavedChanges = false;
     }
     
     // Tab for indentation
     if (e.key === 'Tab') {
       e.preventDefault();
       const start = contentTextarea.selectionStart;
       const end = contentTextarea.selectionEnd;
       
       contentTextarea.value = contentTextarea.value.substring(0, start) + 
                              '  ' + 
                              contentTextarea.value.substring(end);
       contentTextarea.selectionStart = contentTextarea.selectionEnd = start + 2;
       
       hasUnsavedChanges = true;
       this.updateNotesStatistics(container);
     }
   });

   // Setup toolbar if present
   this.setupToolbar(container);

   // Setup expanded features
   this.setupExpandedFeatures(container);

   // Prevent data loss on page unload
   window.addEventListener('beforeunload', (e) => {
     if (hasUnsavedChanges && !data.autoSave) {
       e.preventDefault();
       e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
     }
   });
 },

 /**
  * Setup formatting toolbar
  */
 setupToolbar(container) {
   const toolbar = container.querySelector('.notes-toolbar');
   if (!toolbar) return;

   const contentTextarea = container.querySelector('.notes-content');
   
   toolbar.addEventListener('click', (e) => {
     const button = e.target.closest('.format-btn, .undo-btn, .redo-btn');
     if (!button) return;

     if (button.classList.contains('format-btn')) {
       const format = button.dataset.format;
       this.applyFormatting(contentTextarea, format);
     } else if (button.classList.contains('undo-btn')) {
       document.execCommand('undo');
     } else if (button.classList.contains('redo-btn')) {
       document.execCommand('redo');
     }
   });
 },

 /**
  * Setup expanded features
  */
 setupExpandedFeatures(container) {
   const exportBtn = container.querySelector('.export-btn');
   const clearBtn = container.querySelector('.clear-btn');

   if (exportBtn) {
     exportBtn.addEventListener('click', () => {
       this.exportNotes(container);
     });
   }

   if (clearBtn) {
     clearBtn.addEventListener('click', () => {
       if (confirm('Clear all notes? This action cannot be undone.')) {
         this.clearNotes(container);
       }
     });
   }
 },

 /**
  * Apply text formatting
  */
 applyFormatting(textarea, format) {
   const start = textarea.selectionStart;
   const end = textarea.selectionEnd;
   const selectedText = textarea.value.substring(start, end);
   let replacement = selectedText;

   switch (format) {
     case 'bold':
       replacement = `**${selectedText}**`;
       break;
     case 'italic':
       replacement = `*${selectedText}*`;
       break;
     case 'list':
       replacement = selectedText.split('\n').map(line => 
         line.trim() ? `• ${line.trim()}` : line
       ).join('\n');
       break;
     case 'numbered':
       replacement = selectedText.split('\n').map((line, index) => 
         line.trim() ? `${index + 1}. ${line.trim()}` : line
       ).join('\n');
       break;
   }

   textarea.value = textarea.value.substring(0, start) + 
                   replacement + 
                   textarea.value.substring(end);
   
   textarea.selectionStart = start;
   textarea.selectionEnd = start + replacement.length;
   textarea.focus();

   // Trigger input event for auto-save
   textarea.dispatchEvent(new Event('input'));
 },

 /**
  * Update notes statistics
  */
 updateNotesStatistics(container) {
   const contentTextarea = container.querySelector('.notes-content');
   const wordCountEl = container.querySelector('.word-count');
   const charCountEl = container.querySelector('.character-count');

   if (!contentTextarea) return;

   const content = contentTextarea.value;
   const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
   const charCount = content.length;

   if (wordCountEl) {
     wordCountEl.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
   }

   if (charCountEl) {
     charCountEl.textContent = `${charCount} character${charCount !== 1 ? 's' : ''}`;
   }
 },

 /**
  * Save notes
  */
 async saveNotes(container) {
   const titleInput = container.querySelector('.notes-title-input');
   const contentTextarea = container.querySelector('.notes-content');
   const saveBtn = container.querySelector('.save-btn');

   if (!titleInput || !contentTextarea) return;

   const title = titleInput.value;
   const content = contentTextarea.value;
   const noteId = contentTextarea.dataset.noteId;

   // Show saving state
   if (saveBtn) {
     saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
     saveBtn.disabled = true;
   }

   try {
     // Save to localStorage
     const noteData = {
       title,
       content,
       lastModified: new Date().toISOString()
     };
     
     localStorage.setItem(`notes-${noteId}`, JSON.stringify(noteData));

     // Try to save to server if authenticated
     const authToken = localStorage.getItem('auth-token');
     if (authToken) {
       try {
         await fetch('/api/widget/notes/save', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'x-auth-token': authToken
           },
           body: JSON.stringify({
             title,
             content,
             widgetId: noteId
           })
         });
       } catch (serverError) {
         console.warn('Server save failed, using local storage only:', serverError);
       }
     }

     // Show success feedback
     this.showSaveSuccess(container);

   } catch (error) {
     console.error('Failed to save notes:', error);
     showToast('Failed to save notes', 'error');
   } finally {
     // Restore save button
     if (saveBtn) {
       saveBtn.innerHTML = '<i class="fas fa-save"></i>';
       saveBtn.disabled = false;
     }
   }
 },

 /**
  * Show save success feedback
  */
 showSaveSuccess(container) {
   const saveStatus = container.querySelector('.notes-save-status');
   if (!saveStatus) return;

   const indicator = document.createElement('span');
   indicator.className = 'save-indicator';
   indicator.innerHTML = '<i class="fas fa-check"></i> Saved';
   
   saveStatus.appendChild(indicator);
   
   setTimeout(() => {
     indicator.classList.add('fade-out');
     setTimeout(() => {
       if (indicator.parentNode) {
         indicator.parentNode.removeChild(indicator);
       }
     }, 300);
   }, 2000);
 },

 /**
  * Export notes
  */
 exportNotes(container) {
   const titleInput = container.querySelector('.notes-title-input');
   const contentTextarea = container.querySelector('.notes-content');

   if (!titleInput || !contentTextarea) return;

   const title = titleInput.value || 'Notes';
   const content = contentTextarea.value;
   
   const exportData = `${title}\n${'='.repeat(title.length)}\n\n${content}`;
   
   const blob = new Blob([exportData], { type: 'text/plain' });
   const url = URL.createObjectURL(blob);
   
   const a = document.createElement('a');
   a.href = url;
   a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   
   URL.revokeObjectURL(url);
   
   showToast('Notes exported successfully', 'success');
 },

 /**
  * Clear notes
  */
 clearNotes(container) {
   const titleInput = container.querySelector('.notes-title-input');
   const contentTextarea = container.querySelector('.notes-content');

   if (titleInput) {
     titleInput.value = 'Notes';
   }

   if (contentTextarea) {
     contentTextarea.value = '';
     contentTextarea.dispatchEvent(new Event('input'));
   }

   this.updateNotesStatistics(container);
   showToast('Notes cleared', 'info');
 },

 /**
  * Configure the notes module
  */
 configure(id, currentConfig = {}, callback) {
   const modal = document.createElement('div');
   modal.className = 'modal-overlay';
   modal.innerHTML = `
     <div class="modal large">
       <div class="modal-header">
         <h3>Configure Notes Module</h3>
         <button class="modal-close">&times;</button>
       </div>
       <div class="modal-body">
         <form id="notes-config-form-${id}">
           <!-- Content Configuration -->
           <div class="config-section">
             <h4>Content Settings</h4>
             
             <div class="form-group mb-3">
               <label for="title-${id}" class="form-label">Note Title</label>
               <input type="text" class="form-control" id="title-${id}" name="title" 
                      value="${currentConfig.title || 'Notes'}" maxlength="100">
               <div class="form-text">Title for the note widget</div>
             </div>
             
             <div class="form-group mb-3">
               <label for="content-${id}" class="form-label">Initial Content</label>
               <textarea class="form-control" id="content-${id}" name="content" 
                         rows="4" maxlength="10000">${currentConfig.content || ''}</textarea>
               <div class="form-text">Initial content for the note</div>
             </div>
           </div>
           
           <!-- Appearance Configuration -->
           <div class="config-section">
             <h4>Appearance</h4>
             
             <div class="row">
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <label for="fontSize-${id}" class="form-label">Font Size</label>
                   <select class="form-control" id="fontSize-${id}" name="fontSize">
                     <option value="small" ${currentConfig.fontSize === 'small' ? 'selected' : ''}>Small</option>
                     <option value="normal" ${(currentConfig.fontSize === 'normal' || !currentConfig.fontSize) ? 'selected' : ''}>Normal</option>
                     <option value="large" ${currentConfig.fontSize === 'large' ? 'selected' : ''}>Large</option>
                   </select>
                 </div>
               </div>
               
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <label for="lineHeight-${id}" class="form-label">Line Height</label>
                   <select class="form-control" id="lineHeight-${id}" name="lineHeight">
                     <option value="compact" ${currentConfig.lineHeight === 'compact' ? 'selected' : ''}>Compact</option>
                     <option value="normal" ${(currentConfig.lineHeight === 'normal' || !currentConfig.lineHeight) ? 'selected' : ''}>Normal</option>
                     <option value="relaxed" ${currentConfig.lineHeight === 'relaxed' ? 'selected' : ''}>Relaxed</option>
                   </select>
                 </div>
               </div>
             </div>
             
             <div class="form-group mb-3">
               <label for="detailLevel-${id}" class="form-label">Detail Level</label>
               <select class="form-control" id="detailLevel-${id}" name="detailLevel">
                 <option value="compact" ${(currentConfig.detailLevel === 'compact' || !currentConfig.detailLevel) ? 'selected' : ''}>Compact</option>
                 <option value="normal" ${currentConfig.detailLevel === 'normal' ? 'selected' : ''}>Normal</option>
                 <option value="expanded" ${currentConfig.detailLevel === 'expanded' ? 'selected' : ''}>Expanded</option>
               </select>
               <div class="form-text">Choose how many features to display</div>
             </div>
           </div>
           
           <!-- Behavior Configuration -->
           <div class="config-section">
             <h4>Behavior</h4>
             
             <div class="row">
               <div class="col-md-4">
                 <div class="form-group mb-3">
                   <div class="form-check">
                     <input class="form-check-input" type="checkbox" id="showWordCount-${id}" name="showWordCount" ${currentConfig.showWordCount !== false ? 'checked' : ''}>
                     <label class="form-check-label" for="showWordCount-${id}">
                       Show Word Count
                     </label>
                   </div>
                 </div>
               </div>
               
               <div class="col-md-4">
                 <div class="form-group mb-3">
                   <div class="form-check">
                     <input class="form-check-input" type="checkbox" id="autoSave-${id}" name="autoSave" ${currentConfig.autoSave !== false ? 'checked' : ''}>
                     <label class="form-check-label" for="autoSave-${id}">
                       Auto Save
                     </label>
                   </div>
                 </div>
               </div>
               
               <div class="col-md-4">
                 <div class="form-group mb-3">
                   <div class="form-check">
                     <input class="form-check-input" type="checkbox" id="spellCheck-${id}" name="spellCheck" ${currentConfig.spellCheck !== false ? 'checked' : ''}>
                     <label class="form-check-label" for="spellCheck-${id}">
                       Spell Check
                     </label>
                   </div>
                 </div>
               </div>
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
   
   // Preset buttons
   modal.querySelectorAll('.preset-btn').forEach(btn => {
     btn.addEventListener('click', function() {
       const presetKey = this.dataset.preset;
       const preset = NotesModule.configPresets[presetKey];
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
   
   // Form submission
   const form = modal.querySelector(`#notes-config-form-${id}`);
   form.addEventListener('submit', (e) => {
     e.preventDefault();
     
     const formData = new FormData(form);
     const newConfig = {};
     
     // Process form data
     for (const [key, value] of formData.entries()) {
       if (key === 'showWordCount' || key === 'autoSave' || key === 'spellCheck') {
         newConfig[key] = true;
       } else {
         newConfig[key] = value;
       }
     }
     
     // Handle unchecked checkboxes
     if (!formData.has('showWordCount')) {
       newConfig.showWordCount = false;
     }
     if (!formData.has('autoSave')) {
       newConfig.autoSave = false;
     }
     if (!formData.has('spellCheck')) {
       newConfig.spellCheck = false;
     }
     
     document.body.removeChild(modal);
     
     if (typeof callback === 'function') {
       callback(newConfig);
     }
     
     showToast('Notes configuration updated', 'success');
   });
 },

 /**
  * Utility functions
  */
 escapeHtml(text) {
   const div = document.createElement('div');
   div.textContent = text;
   return div.innerHTML;
 }
};

// Register the module
ModuleRegistry.register('notes', NotesModule);

export default NotesModule;
