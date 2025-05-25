/**
* todo.js - Todo module with standardized configuration
* Task management widget with priorities, due dates, and categories
*/

import { ModuleRegistry, showToast } from '../module-core.js';

const TodoModule = {
 name: 'Todo List',
 description: 'Task management widget with priorities, due dates, and organization features',
 category: 'tools',
 version: '2.0.0',
 author: 'Dashboard Team',
 icon: 'fas fa-tasks',
 cssClass: 'todo-module',
 
 // Module configuration schema
 configOptions: [
   {
     name: 'title',
     label: 'Todo List Title',
     type: 'text',
     default: 'To-Do List',
     description: 'Name for your todo list',
     required: false,
     validation: {
       maxLength: 100
     }
   },
   {
     name: 'maxItems',
     label: 'Maximum Items',
     type: 'number',
     default: 10,
     description: 'Maximum number of todo items to display',
     required: false,
     min: 1,
     max: 50
   },
   {
     name: 'showCompleted',
     label: 'Show Completed Tasks',
     type: 'checkbox',
     default: true,
     description: 'Display completed items in the list',
     required: false
   },
   {
     name: 'sortBy',
     label: 'Sort Order',
     type: 'select',
     options: [
       { value: 'newest', label: 'Newest First' },
       { value: 'oldest', label: 'Oldest First' },
       { value: 'alphabetical', label: 'Alphabetical' },
       { value: 'priority', label: 'Priority' },
       { value: 'status', label: 'By Status' }
     ],
     default: 'newest',
     description: 'How to order the todo items',
     required: false
   },
   {
     name: 'enablePriorities',
     label: 'Enable Priorities',
     type: 'checkbox',
     default: false,
     description: 'Allow setting priority levels for tasks',
     required: false
   },
   {
     name: 'enableDueDates',
     label: 'Enable Due Dates',
     type: 'checkbox',
     default: false,
     description: 'Allow setting due dates for tasks',
     required: false
   },
   {
     name: 'enableCategories',
     label: 'Enable Categories',
     type: 'checkbox',
     default: false,
     description: 'Allow organizing tasks into categories',
     required: false
   },
   {
     name: 'autoRemoveCompleted',
     label: 'Auto-Remove Completed',
     type: 'select',
     options: [
       { value: 'never', label: 'Never' },
       { value: 'immediately', label: 'Immediately' },
       { value: 'daily', label: 'Daily' },
       { value: 'weekly', label: 'Weekly' }
     ],
     default: 'never',
     description: 'Automatically remove completed tasks',
     required: false
   },
   {
     name: 'completionSound',
     label: 'Completion Sound',
     type: 'checkbox',
     default: false,
     description: 'Play sound when tasks are completed',
     required: false
   },
   {
     name: 'detailLevel',
     label: 'Detail Level',
     type: 'select',
     options: [
       { value: 'compact', label: 'Compact - Simple task list' },
       { value: 'normal', label: 'Normal - Standard features' },
       { value: 'expanded', label: 'Expanded - Full functionality' }
     ],
     default: 'compact',
     description: 'Amount of features to show',
     required: false
   }
 ],
 
 // Configuration presets
 configPresets: {
   'simple': {
     name: 'Simple Todo',
     description: 'Basic task management',
     config: {
       title: 'Tasks',
       maxItems: 10,
       showCompleted: true,
       sortBy: 'newest',
       enablePriorities: false,
       enableDueDates: false,
       enableCategories: false,
       autoRemoveCompleted: 'never',
       completionSound: false
     }
   },
   'productivity': {
     name: 'Productivity Focused',
     description: 'Advanced task management',
     config: {
       title: 'Work Tasks',
       maxItems: 15,
       showCompleted: false,
       sortBy: 'priority',
       enablePriorities: true,
       enableDueDates: true,
       enableCategories: true,
       autoRemoveCompleted: 'daily',
       completionSound: true
     }
   },
   'personal': {
     name: 'Personal Tasks',
     description: 'Simple personal organization',
     config: {
       title: 'Personal',
       maxItems: 8,
       showCompleted: true,
       sortBy: 'newest',
       enablePriorities: false,
       enableDueDates: false,
       enableCategories: false,
       autoRemoveCompleted: 'weekly',
       completionSound: false
     }
   },
   'project': {
     name: 'Project Management',
     description: 'Full-featured project tracking',
     config: {
       title: 'Project Tasks',
       maxItems: 20,
       showCompleted: true,
       sortBy: 'priority',
       enablePriorities: true,
       enableDueDates: true,
       enableCategories: true,
       autoRemoveCompleted: 'never',
       completionSound: true
     }
   }
 },

 /**
  * Initialize the todo module
  */
 async initialize() {
   console.log('Todo module initialized');
 },

 /**
  * Fetch todo data
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

     const response = await fetch(`/api/widget/todo?${params.toString()}`);
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }
     
     const result = await response.json();
     
     if (result.error) {
       throw new Error(result.error);
     }
     
     return result.data;
   } catch (error) {
     console.error('Todo data fetch error:', error);
     throw error;
   }
 },
 
 /**
  * Render the todo module
  */
 async render(container, data, detailLevel = 'compact') {
   if (!data) {
     container.innerHTML = `
       <div class="module-message">
         <div class="alert alert-warning">
           <i class="fas fa-exclamation-triangle me-2"></i>
           No todo data available
         </div>
       </div>
     `;
     return;
   }

   const todoId = `todo-${Date.now()}`;
   let items = data.items || [];
   
   // Sort items based on configuration
   items = this.sortTodoItems(items, data.sortBy, data.enablePriorities);
   
   // Filter items based on configuration
   if (!data.showCompleted) {
     items = items.filter(item => !item.completed);
   }
   
   // Limit items based on maxItems
   if (data.maxItems && items.length > data.maxItems) {
     items = items.slice(0, data.maxItems);
   }

   const activeItems = items.filter(item => !item.completed);
   const completedCount = items.filter(item => item.completed).length;
   
   let html = `
     <div class="todo-data" data-todo-id="${todoId}">
       <div class="todo-header">
         <h4 class="todo-title">${this.escapeHtml(data.title || 'To-Do List')}</h4>
         <div class="todo-stats">
           <span class="stat-item">
             <i class="fas fa-tasks me-1"></i>
             ${activeItems.length} active
           </span>
           ${completedCount > 0 ? `
             <span class="stat-item">
               <i class="fas fa-check me-1"></i>
               ${completedCount} done
             </span>
           ` : ''}
         </div>
       </div>
       
       <div class="todo-input-section">
         <div class="todo-input-group">
           <input type="text" class="todo-input" 
                  placeholder="Add a new task..." 
                  maxlength="200"
                  data-todo-id="${todoId}">
           
           ${data.enablePriorities && detailLevel !== 'compact' ? `
             <select class="todo-priority-select">
               <option value="normal">Normal</option>
               <option value="high">High</option>
               <option value="urgent">Urgent</option>
             </select>
           ` : ''}
           
           ${data.enableCategories && detailLevel === 'expanded' ? `
             <input type="text" class="todo-category-input" 
                    placeholder="Category..." 
                    maxlength="50">
           ` : ''}
           
           ${data.enableDueDates && detailLevel === 'expanded' ? `
             <input type="date" class="todo-date-input" 
                    min="${new Date().toISOString().split('T')[0]}">
           ` : ''}
           
           <button class="todo-add-btn" data-todo-id="${todoId}">
             <i class="fas fa-plus"></i>
           </button>
         </div>
       </div>
       
       <div class="todo-list-container">
         ${items.length === 0 ? this.renderEmptyState() : this.renderTodoList(items, data, detailLevel)}
       </div>
   `;

   // Add progress bar for expanded view
   if (detailLevel === 'expanded' && items.length > 0) {
     const totalItems = items.length;
     const completedItems = items.filter(item => item.completed).length;
     const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
     
     html += `
       <div class="todo-progress">
         <div class="progress-label">
           Progress: ${completedItems}/${totalItems} tasks completed
         </div>
         <div class="progress-bar-container">
           <div class="progress-bar" style="width: ${progressPercentage}%"></div>
         </div>
       </div>
     `;
   }

   // Add actions for expanded view
   if (detailLevel === 'expanded') {
     html += `
       <div class="todo-actions">
         <button class="todo-action-btn clear-completed-btn" 
                 ${completedCount === 0 ? 'disabled' : ''}>
           <i class="fas fa-trash me-1"></i>
           Clear Completed (${completedCount})
         </button>
         
         <button class="todo-action-btn export-btn">
           <i class="fas fa-download me-1"></i>
           Export Tasks
         </button>
         
         <button class="todo-action-btn import-btn">
           <i class="fas fa-upload me-1"></i>
           Import Tasks
         </button>
       </div>
     `;
   }

   html += '</div>';
   container.innerHTML = html;

   // Setup interactive functionality
   this.setupTodoInteractivity(container, data, detailLevel);
 },

 /**
  * Render empty state
  */
 renderEmptyState() {
   return `
     <div class="todo-empty">
       <div class="todo-empty-icon">
         <i class="fas fa-clipboard-check"></i>
       </div>
       <div class="todo-empty-text">
         <h5>No tasks yet</h5>
         <p>Add your first task above to get started!</p>
       </div>
     </div>
   `;
 },

 /**
  * Render todo list
  */
 renderTodoList(items, data, detailLevel) {
   const itemsHtml = items.map(item => this.renderTodoItem(item, data, detailLevel)).join('');
   
   return `
     <ul class="todo-list">
       ${itemsHtml}
     </ul>
   `;
 },

 /**
  * Render individual todo item
  */
 renderTodoItem(item, data, detailLevel) {
   const priorityClass = data.enablePriorities ? `priority-${item.priority || 'normal'}` : '';
   const completedClass = item.completed ? 'completed' : '';
   const overdueClass = this.isOverdue(item) ? 'overdue' : '';
   
   let html = `
     <li class="todo-item ${completedClass} ${priorityClass} ${overdueClass}" data-item-id="${item.id}">
       <div class="todo-item-main">
         <input type="checkbox" class="todo-checkbox" 
                ${item.completed ? 'checked' : ''} 
                data-item-id="${item.id}">
         
         <div class="todo-content">
           <div class="todo-text">${this.escapeHtml(item.text)}</div>
           
           ${this.shouldShowMeta(item, data, detailLevel) ? `
             <div class="todo-meta">
               ${item.createdAt ? `
                 <span class="todo-date">
                   <i class="fas fa-calendar-plus me-1"></i>
                   ${this.formatDate(item.createdAt)}
                 </span>
               ` : ''}
               
               ${data.enablePriorities && item.priority && item.priority !== 'normal' ? `
                 <span class="todo-priority-badge priority-${item.priority}">
                   ${item.priority}
                 </span>
               ` : ''}
               
               ${data.enableCategories && item.category ? `
                 <span class="todo-category-badge">
                   <i class="fas fa-tag me-1"></i>
                   ${this.escapeHtml(item.category)}
                 </span>
               ` : ''}
               
               ${data.enableDueDates && item.dueDate ? `
                 <span class="todo-due-date ${this.isOverdue(item) ? 'overdue' : ''}">
                   <i class="fas fa-clock me-1"></i>
                   Due: ${this.formatDate(item.dueDate)}
                 </span>
               ` : ''}
             </div>
           ` : ''}
         </div>
       </div>
       
       ${detailLevel !== 'compact' ? `
         <div class="todo-item-actions">
           ${data.enablePriorities ? `
             <button class="todo-priority-btn" title="Change Priority" data-item-id="${item.id}">
               <i class="fas fa-flag"></i>
             </button>
           ` : ''}
           
           <button class="todo-edit-btn" title="Edit Task" data-item-id="${item.id}">
             <i class="fas fa-edit"></i>
           </button>
           
           <button class="todo-delete-btn" title="Delete Task" data-item-id="${item.id}">
             <i class="fas fa-trash-alt"></i>
           </button>
         </div>
       ` : ''}
     </li>
   `;
   
   return html;
 },

 /**
  * Setup todo interactivity
  */
 setupTodoInteractivity(container, data, detailLevel) {
   const todoId = container.querySelector('.todo-data').dataset.todoId;
   const todoInput = container.querySelector('.todo-input');
   const addBtn = container.querySelector('.todo-add-btn');
   
   if (!todoInput || !addBtn) return;

   // Load existing items from localStorage
   let todoItems = this.loadTodoItems(todoId);
   
   // Merge with data items if provided
   if (data.items && data.items.length > 0) {
     todoItems = data.items;
     this.saveTodoItems(todoId, todoItems);
   }

   // Add new todo item
   const addTodoItem = () => {
     const text = todoInput.value.trim();
     if (!text) return;

     const prioritySelect = container.querySelector('.todo-priority-select');
     const categoryInput = container.querySelector('.todo-category-input');
     const dateInput = container.querySelector('.todo-date-input');

     const newItem = {
       id: this.generateId(),
       text: text,
       completed: false,
       createdAt: new Date().toISOString(),
       priority: prioritySelect ? prioritySelect.value : 'normal',
       category: categoryInput ? categoryInput.value.trim() : null,
       dueDate: dateInput ? dateInput.value : null
     };

     todoItems.unshift(newItem);
     this.saveTodoItems(todoId, todoItems);
     
     // Clear inputs
     todoInput.value = '';
     if (prioritySelect) prioritySelect.value = 'normal';
     if (categoryInput) categoryInput.value = '';
     if (dateInput) dateInput.value = '';

     // Re-render
     this.render(container, { ...data, items: todoItems }, detailLevel);
     
     showToast('Task added', 'success');
   };

   // Event listeners
   todoInput.addEventListener('keypress', (e) => {
     if (e.key === 'Enter') {
       e.preventDefault();
       addTodoItem();
     }
   });

   addBtn.addEventListener('click', addTodoItem);

   // Checkbox handlers
   container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
     checkbox.addEventListener('change', (e) => {
       const itemId = e.target.dataset.itemId;
       const item = todoItems.find(item => item.id === itemId);
       
       if (item) {
         item.completed = e.target.checked;
         item.completedAt = e.target.checked ? new Date().toISOString() : null;
         
         this.saveTodoItems(todoId, todoItems);
         
         // Add visual feedback
         const todoItem = e.target.closest('.todo-item');
         if (todoItem) {
           if (e.target.checked) {
             todoItem.classList.add('just-completed');
             setTimeout(() => todoItem.classList.remove('just-completed'), 500);
             
             // Play completion sound if enabled
             if (data.completionSound) {
               this.playCompletionSound();
             }
           }
         }
         
         // Auto-remove if configured
         if (e.target.checked && data.autoRemoveCompleted === 'immediately') {
           setTimeout(() => {
             this.removeTodoItem(todoId, itemId, todoItems);
             this.render(container, { ...data, items: todoItems }, detailLevel);
           }, 1000);
         } else {
           // Re-render to update display
           this.render(container, { ...data, items: todoItems }, detailLevel);
         }
       }
     });
   });

   // Delete button handlers
   container.querySelectorAll('.todo-delete-btn').forEach(btn => {
     btn.addEventListener('click', (e) => {
       const itemId = e.target.closest('.todo-delete-btn').dataset.itemId;
       
       if (confirm('Delete this task?')) {
         this.removeTodoItem(todoId, itemId, todoItems);
         this.render(container, { ...data, items: todoItems }, detailLevel);
         showToast('Task deleted', 'info');
       }
     });
   });

   // Priority button handlers
   container.querySelectorAll('.todo-priority-btn').forEach(btn => {
     btn.addEventListener('click', (e) => {
       const itemId = e.target.closest('.todo-priority-btn').dataset.itemId;
       this.togglePriority(todoId, itemId, todoItems, container, data, detailLevel);
     });
   });

   // Edit button handlers
   container.querySelectorAll('.todo-edit-btn').forEach(btn => {
     btn.addEventListener('click', (e) => {
       const itemId = e.target.closest('.todo-edit-btn').dataset.itemId;
       this.editTodoItem(todoId, itemId, todoItems, container, data, detailLevel);
     });
   });

   // Clear completed button
   const clearCompletedBtn = container.querySelector('.clear-completed-btn');
   if (clearCompletedBtn) {
     clearCompletedBtn.addEventListener('click', () => {
       if (confirm('Remove all completed tasks?')) {
         const beforeCount = todoItems.length;
         todoItems = todoItems.filter(item => !item.completed);
         const removedCount = beforeCount - todoItems.length;
         
         this.saveTodoItems(todoId, todoItems);
         this.render(container, { ...data, items: todoItems }, detailLevel);
         
         showToast(`${removedCount} completed tasks removed`, 'success');
       }
     });
   }

   // Export button
   const exportBtn = container.querySelector('.export-btn');
   if (exportBtn) {
     exportBtn.addEventListener('click', () => {
       this.exportTodoItems(todoItems, data.title);
     });
   }

   // Import button
   const importBtn = container.querySelector('.import-btn');
   if (importBtn) {
     importBtn.addEventListener('click', () => {
       this.importTodoItems(todoId, container, data, detailLevel);
     });
   }
 },

 /**
  * Sort todo items based on criteria
  */
 sortTodoItems(items, sortBy, enablePriorities) {
   const sortedItems = [...items];
   
   switch (sortBy) {
     case 'newest':
       return sortedItems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
     
     case 'oldest':
       return sortedItems.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
     
     case 'alphabetical':
       return sortedItems.sort((a, b) => a.text.localeCompare(b.text));
     
     case 'priority':
       if (!enablePriorities) return sortedItems;
       const priorityOrder = { urgent: 0, high: 1, normal: 2 };
       return sortedItems.sort((a, b) => {
         const aPriority = priorityOrder[a.priority || 'normal'];
         const bPriority = priorityOrder[b.priority || 'normal'];
         return aPriority - bPriority;
       });
     
     case 'status':
       return sortedItems.sort((a, b) => {
         if (a.completed === b.completed) return 0;
         return a.completed ? 1 : -1;
       });
     
     default:
       return sortedItems;
   }
 },

 /**
  * Check if a task is overdue
  */
 isOverdue(item) {
   if (!item.dueDate || item.completed) return false;
   return new Date(item.dueDate) < new Date();
 },

 /**
  * Check if meta information should be shown
  */
 shouldShowMeta(item, data, detailLevel) {
   if (detailLevel === 'compact') return false;
   
   return item.createdAt || 
          (data.enablePriorities && item.priority && item.priority !== 'normal') ||
          (data.enableCategories && item.category) ||
          (data.enableDueDates && item.dueDate);
 },

 /**
  * Toggle priority of a todo item
  */
 togglePriority(todoId, itemId, todoItems, container, data, detailLevel) {
   const item = todoItems.find(item => item.id === itemId);
   if (!item) return;

   const priorities = ['normal', 'high', 'urgent'];
   const currentIndex = priorities.indexOf(item.priority || 'normal');
   const nextIndex = (currentIndex + 1) % priorities.length;
   
   item.priority = priorities[nextIndex];
   this.saveTodoItems(todoId, todoItems);
   this.render(container, { ...data, items: todoItems }, detailLevel);
   
   showToast(`Priority changed to ${item.priority}`, 'success');
 },

 /**
  * Edit a todo item
  */
 editTodoItem(todoId, itemId, todoItems, container, data, detailLevel) {
   const item = todoItems.find(item => item.id === itemId);
   if (!item) return;

   const newText = prompt('Edit task:', item.text);
   if (newText !== null && newText.trim()) {
     item.text = newText.trim();
     item.updatedAt = new Date().toISOString();
     
     this.saveTodoItems(todoId, todoItems);
     this.render(container, { ...data, items: todoItems }, detailLevel);
     
     showToast('Task updated', 'success');
   }
 },

 /**
  * Remove a todo item
  */
 removeTodoItem(todoId, itemId, todoItems) {
   const index = todoItems.findIndex(item => item.id === itemId);
   if (index > -1) {
     todoItems.splice(index, 1);
     this.saveTodoItems(todoId, todoItems);
   }
 },

 /**
  * Export todo items
  */
 exportTodoItems(items, title) {
   const exportData = {
     title: title || 'Todo List',
     exported: new Date().toISOString(),
     items: items
   };
   
   const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   
   const a = document.createElement('a');
   a.href = url;
   a.download = `todo-list-${new Date().toISOString().split('T')[0]}.json`;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   
   URL.revokeObjectURL(url);
   showToast('Todo list exported', 'success');
 },

 /**
  * Import todo items
  */
 importTodoItems(todoId, container, data, detailLevel) {
   const input = document.createElement('input');
   input.type = 'file';
   input.accept = '.json';
   
   input.onchange = (e) => {
     const file = e.target.files[0];
     if (!file) return;
     
     const reader = new FileReader();
     reader.onload = (e) => {
       try {
         const importData = JSON.parse(e.target.result);
         
         if (importData.items && Array.isArray(importData.items)) {
           let todoItems = this.loadTodoItems(todoId);
           
           // Add imported items with new IDs
           const importedItems = importData.items.map(item => ({
             ...item,
             id: this.generateId(),
             importedAt: new Date().toISOString()
           }));
           
           todoItems = [...todoItems, ...importedItems];
           this.saveTodoItems(todoId, todoItems);
           this.render(container, { ...data, items: todoItems }, detailLevel);
           
           showToast(`${importedItems.length} tasks imported`, 'success');
         } else {
           showToast('Invalid file format', 'error');
         }
       } catch (error) {
         showToast('Failed to import file', 'error');
       }
     };
     
     reader.readAsText(file);
   };
   
   input.click();
 },

 /**
  * Play completion sound
  */
 playCompletionSound() {
   try {
     // Create a simple completion sound using Web Audio API
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
     // Fallback: no sound if Web Audio API is not available
     console.log('Completion sound not available');
   }
 },

 /**
  * Load todo items from localStorage
  */
 loadTodoItems(todoId) {
   try {
     const stored = localStorage.getItem(`todo-items-${todoId}`);
     return stored ? JSON.parse(stored) : [];
   } catch (error) {
     console.error('Failed to load todo items:', error);
     return [];
   }
 },

 /**
  * Save todo items to localStorage
  */
 saveTodoItems(todoId, items) {
   try {
     localStorage.setItem(`todo-items-${todoId}`, JSON.stringify(items));
   } catch (error) {
     console.error('Failed to save todo items:', error);
   }
 },

 /**
  * Generate unique ID
  */
 generateId() {
   return Date.now().toString(36) + Math.random().toString(36).substr(2);
 },

 /**
  * Format date for display
  */
 formatDate(dateString) {
   if (!dateString) return '';
   
   const date = new Date(dateString);
   const now = new Date();
   const diffTime = Math.abs(now - date);
   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

   if (diffDays === 0) {
     return 'Today';
   } else if (diffDays === 1) {
     return 'Yesterday';
   } else if (diffDays < 7) {
     return `${diffDays} days ago`;
   } else {
     return date.toLocaleDateString();
   }
 },

/**
 * Configure the todo module
 */
configure(id, currentConfig = {}, callback) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal large">
      <div class="modal-header">
        <h3>Configure Todo List</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form id="todo-config-form-${id}">
          <!-- Content Configuration -->
          <div class="config-section">
            <h4>List Settings</h4>
            
            <div class="form-group mb-3">
              <label for="title-${id}" class="form-label">Todo List Title</label>
              <input type="text" class="form-control" id="title-${id}" name="title" 
                     value="${currentConfig.title || 'To-Do List'}" maxlength="100">
              <div class="form-text">Name for your todo list</div>
            </div>
            
            <div class="form-group mb-3">
              <label for="maxItems-${id}" class="form-label">Maximum Items</label>
              <input type="number" class="form-control" id="maxItems-${id}" name="maxItems" 
                     value="${currentConfig.maxItems || 10}" min="1" max="50">
              <div class="form-text">Maximum number of todo items to display</div>
            </div>
          </div>
          
          <!-- Display Options -->
          <div class="config-section">
            <h4>Display Options</h4>
            
            <div class="row">
              <div class="col-md-6">
                <div class="form-group mb-3">
                  <label for="sortBy-${id}" class="form-label">Sort Order</label>
                  <select class="form-control" id="sortBy-${id}" name="sortBy">
                    <option value="newest" ${(currentConfig.sortBy === 'newest' || !currentConfig.sortBy) ? 'selected' : ''}>Newest First</option>
                    <option value="oldest" ${currentConfig.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                    <option value="alphabetical" ${currentConfig.sortBy === 'alphabetical' ? 'selected' : ''}>Alphabetical</option>
                    <option value="priority" ${currentConfig.sortBy === 'priority' ? 'selected' : ''}>Priority</option>
                    <option value="status" ${currentConfig.sortBy === 'status' ? 'selected' : ''}>By Status</option>
                  </select>
                  <div class="form-text">How to order the todo items</div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="form-group mb-3">
                  <label for="autoRemoveCompleted-${id}" class="form-label">Auto-Remove Completed</label>
                  <select class="form-control" id="autoRemoveCompleted-${id}" name="autoRemoveCompleted">
                    <option value="never" ${(currentConfig.autoRemoveCompleted === 'never' || !currentConfig.autoRemoveCompleted) ? 'selected' : ''}>Never</option>
                    <option value="immediately" ${currentConfig.autoRemoveCompleted === 'immediately' ? 'selected' : ''}>Immediately</option>
                    <option value="daily" ${currentConfig.autoRemoveCompleted === 'daily' ? 'selected' : ''}>Daily</option>
                    <option value="weekly" ${currentConfig.autoRemoveCompleted === 'weekly' ? 'selected' : ''}>Weekly</option>
                  </select>
                  <div class="form-text">Automatically remove completed tasks</div>
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
          
          <!-- Feature Toggles -->
          <div class="config-section">
            <h4>Features</h4>
            
            <div class="row">
              <div class="col-md-6">
                <div class="form-group mb-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="showCompleted-${id}" name="showCompleted" ${currentConfig.showCompleted !== false ? 'checked' : ''}>
                    <label class="form-check-label" for="showCompleted-${id}">
                      Show Completed Tasks
                    </label>
                  </div>
                  <div class="form-text">Display completed items in the list</div>
                </div>
                
                <div class="form-group mb-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="enablePriorities-${id}" name="enablePriorities" ${currentConfig.enablePriorities ? 'checked' : ''}>
                    <label class="form-check-label" for="enablePriorities-${id}">
                      Enable Priorities
                    </label>
                  </div>
                  <div class="form-text">Allow setting priority levels for tasks</div>
                </div>
                
                <div class="form-group mb-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="enableDueDates-${id}" name="enableDueDates" ${currentConfig.enableDueDates ? 'checked' : ''}>
                    <label class="form-check-label" for="enableDueDates-${id}">
                      Enable Due Dates
                    </label>
                  </div>
                  <div class="form-text">Allow setting due dates for tasks</div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="form-group mb-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="enableCategories-${id}" name="enableCategories" ${currentConfig.enableCategories ? 'checked' : ''}>
                    <label class="form-check-label" for="enableCategories-${id}">
                      Enable Categories
                    </label>
                  </div>
                  <div class="form-text">Allow organizing tasks into categories</div>
                </div>
                
                <div class="form-group mb-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="completionSound-${id}" name="completionSound" ${currentConfig.completionSound ? 'checked' : ''}>
                    <label class="form-check-label" for="completionSound-${id}">
                      Completion Sound
                    </label>
                  </div>
                  <div class="form-text">Play sound when tasks are completed</div>
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
      const preset = TodoModule.configPresets[presetKey];
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
  const form = modal.querySelector(`#todo-config-form-${id}`);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const newConfig = {};
    
    // Process text fields
    ['title', 'sortBy', 'autoRemoveCompleted', 'detailLevel'].forEach(field => {
      if (formData.has(field)) {
        newConfig[field] = formData.get(field);
      }
    });
    
    // Process number fields
    if (formData.has('maxItems')) {
      newConfig.maxItems = parseInt(formData.get('maxItems'), 10);
    }
    
    // Process checkboxes
    ['showCompleted', 'enablePriorities', 'enableDueDates', 'enableCategories', 'completionSound'].forEach(field => {
      newConfig[field] = formData.has(field);
    });
    
    document.body.removeChild(modal);
    
    if (typeof callback === 'function') {
      callback(newConfig);
    }
    
    showToast('Todo configuration updated', 'success');
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
  return new Date(date).toLocaleDateString();
},

generateId() {
  return Math.random().toString(36).substr(2, 9);
}
};

// Register the module
ModuleRegistry.register('todo', TodoModule);

export default TodoModule;
