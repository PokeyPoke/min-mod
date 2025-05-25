/**
* stocks.js - Stocks module with standardized configuration
*/

import { ModuleRegistry, showToast } from '../module-core.js';

const StocksModule = {
 name: 'Stocks',
 description: 'Real-time stock market data with detailed financial metrics',
 category: 'data',
 version: '2.0.0',
 author: 'Dashboard Team',
 icon: 'fas fa-chart-line',
 cssClass: 'stocks-module',
 
 // Module configuration schema
 configOptions: [
   {
     name: 'symbol',
     label: 'Stock Symbol',
     type: 'text',
     default: 'AAPL',
     description: 'Stock ticker symbol',
     required: true,
     validation: {
       minLength: 1,
       maxLength: 10,
       pattern: '^[A-Z0-9.]+$'
     },
     placeholder: 'e.g., AAPL, GOOGL, MSFT',
     helpText: 'Enter valid stock ticker symbols',
     searchable: true,
     transform: 'uppercase'
   },
   {
     name: 'exchange',
     label: 'Stock Exchange',
     type: 'select',
     options: [
       { value: 'auto', label: 'Auto-detect', description: 'Automatically determine exchange' },
       { value: 'NYSE', label: 'New York Stock Exchange (NYSE)' },
       { value: 'NASDAQ', label: 'NASDAQ' },
       { value: 'LSE', label: 'London Stock Exchange' },
       { value: 'TSE', label: 'Tokyo Stock Exchange' }
     ],
     default: 'auto',
     description: 'Primary stock exchange',
     required: false,
     helpText: 'Leave on auto-detect for most stocks'
   },
   {
     name: 'detailLevel',
     label: 'Detail Level',
     type: 'select',
     options: [
       { value: 'compact', label: 'Compact', description: 'Price and change only' },
       { value: 'normal', label: 'Normal', description: 'Price, change, and key metrics' },
       { value: 'expanded', label: 'Expanded', description: 'Full stock data and analysis' }
     ],
     default: 'compact',
     description: 'Amount of stock information to display',
     required: false
   },
   {
     name: 'showChart',
     label: 'Show Stock Chart',
     type: 'checkbox',
     default: false,
     description: 'Display stock price chart',
     required: false,
     helpText: 'Historical price chart with technical indicators'
   },
   {
     name: 'afterHours',
     label: 'Show After Hours',
     type: 'checkbox',
     default: true,
     description: 'Include after-hours trading data',
     required: false,
     helpText: 'Shows extended trading hours when available'
   }
 ],
 
 // Configuration presets
 configPresets: {
   'tech_stocks': {
     name: 'Tech Giants',
     description: 'Popular technology stocks',
     config: {
       symbol: 'AAPL',
       detailLevel: 'normal',
       showChart: false,
       afterHours: true
     }
   },
   'day_trader': {
     name: 'Day Trading',
     description: 'Optimized for active trading',
     config: {
       symbol: 'AAPL',
       detailLevel: 'expanded',
       showChart: true,
       afterHours: true
     }
   },
   'portfolio': {
     name: 'Portfolio Tracker',
     description: 'Long-term investment tracking',
     config: {
       symbol: 'AAPL',
       detailLevel: 'normal',
       showChart: false,
       afterHours: false
     }
   }
 },

 /**
  * Initialize the stocks module
  */
 async initialize() {
   console.log('Stocks module initialized');
 },

 /**
  * Fetch stocks data
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

     const response = await fetch(`/api/widget/stocks?${params.toString()}`);
     
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}`);
     }
     
     const result = await response.json();
     
     if (result.error) {
       throw new Error(result.error);
     }
     
     return result.data;
   } catch (error) {
     console.error('Stocks data fetch error:', error);
     throw error;
   }
 },
 
 /**
  * Render the stocks module
  */
 async render(container, data, detailLevel = 'compact') {
   if (!data) {
     container.innerHTML = `
       <div class="module-message">
         <div class="alert alert-warning">
           <i class="fas fa-exclamation-triangle me-2"></i>
           No stock data available
         </div>
       </div>
     `;
     return;
   }

   // Handle API configuration errors
   if (data.error || data.isDemo) {
     container.innerHTML = `
       <div class="module-message">
         <div class="alert alert-info">
           <i class="fas fa-info-circle me-2"></i>
           ${data.error || 'Stock API not configured - showing demo data'}
         </div>
       </div>
     `;
     return;
   }

   let html = `
     <div class="stock-data" data-symbol="${data.symbol}">
       <div class="stock-header">
         <div class="stock-symbol">${data.symbol}</div>
         ${data.name ? `<div class="stock-name">${this.escapeHtml(data.name)}</div>` : ''}
       </div>
       
       <div class="stock-main">
         <div class="stock-price">$${this.formatPrice(data.price)}</div>
         <div class="stock-change ${this.getChangeClass(data.change)}">
           <i class="fas ${this.getChangeIcon(data.change)} me-1"></i>
           ${this.formatChange(data.change)} (${data.changePercent || 'N/A'})
         </div>
       </div>
   `;

   // Add details based on detail level
   if (detailLevel === 'normal' || detailLevel === 'expanded') {
     html += `
       <div class="stock-details">
         <div class="stock-detail-item">
           <span class="stock-detail-label">Volume</span>
           <span class="stock-detail-value">${this.formatLargeNumber(data.volume)}</span>
         </div>
         <div class="stock-detail-item">
           <span class="stock-detail-label">Prev Close</span>
           <span class="stock-detail-value">$${this.formatPrice(data.previousClose)}</span>
         </div>
     `;

     if (detailLevel === 'expanded') {
       html += `
         <div class="stock-detail-item">
           <span class="stock-detail-label">Open</span>
           <span class="stock-detail-value">$${this.formatPrice(data.open)}</span>
         </div>
         <div class="stock-detail-item">
           <span class="stock-detail-label">High</span>
           <span class="stock-detail-value">$${this.formatPrice(data.high)}</span>
         </div>
         <div class="stock-detail-item">
           <span class="stock-detail-label">Low</span>
           <span class="stock-detail-value">$${this.formatPrice(data.low)}</span>
         </div>
         <div class="stock-detail-item">
           <span class="stock-detail-label">Market Cap</span>
           <span class="stock-detail-value">${this.formatLargeNumber(data.marketCap || 0)}</span>
         </div>
       `;
     }

     html += '</div>';
   }

   // Add chart placeholder for expanded view
   if (detailLevel === 'expanded' && data.showChart) {
     html += `
       <div class="stock-chart">
         <div class="chart-placeholder">
           <i class="fas fa-chart-line fa-2x text-muted"></i>
           <p class="text-muted">Chart data coming soon</p>
         </div>
       </div>
     `;
   }

   // Add footer with update time
   if (data.lastUpdated) {
     html += `
       <div class="stock-updated">
         <small class="text-muted">
           <i class="fas fa-clock me-1"></i>
           Updated: ${this.formatUpdateTime(data.lastUpdated)}
         </small>
       </div>
     `;
   }

   html += '</div>';
   container.innerHTML = html;

   // Setup interactive functionality
   this.setupStockInteractivity(container, data);
 },

 /**
  * Setup stock interactivity
  */
 setupStockInteractivity(container, data) {
   // Add click handlers for additional stock info
   const stockHeader = container.querySelector('.stock-header');
   if (stockHeader) {
     stockHeader.addEventListener('click', () => {
       this.showStockDetails(data);
     });
   }

   // Add hover effects for better UX
   const priceElement = container.querySelector('.stock-price');
   if (priceElement) {
     priceElement.title = `${data.symbol} - $${this.formatPrice(data.price)}`;
   }
 },

 /**
  * Show detailed stock information
  */
 showStockDetails(data) {
   const modal = document.createElement('div');
   modal.className = 'modal-overlay';
   modal.innerHTML = `
     <div class="modal">
       <div class="modal-header">
         <h3>${data.symbol} - Stock Details</h3>
         <button class="modal-close">&times;</button>
       </div>
       <div class="modal-body">
         <div class="stock-detail-grid">
           <div class="detail-row">
             <span class="detail-label">Current Price:</span>
             <span class="detail-value">$${this.formatPrice(data.price)}</span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Change:</span>
             <span class="detail-value ${this.getChangeClass(data.change)}">
               ${this.formatChange(data.change)} (${data.changePercent || 'N/A'})
             </span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Previous Close:</span>
             <span class="detail-value">$${this.formatPrice(data.previousClose)}</span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Volume:</span>
             <span class="detail-value">${this.formatLargeNumber(data.volume)}</span>
           </div>
           ${data.open ? `
             <div class="detail-row">
               <span class="detail-label">Open:</span>
               <span class="detail-value">$${this.formatPrice(data.open)}</span>
             </div>
           ` : ''}
           ${data.high ? `
             <div class="detail-row">
               <span class="detail-label">Day High:</span>
               <span class="detail-value">$${this.formatPrice(data.high)}</span>
             </div>
           ` : ''}
           ${data.low ? `
             <div class="detail-row">
               <span class="detail-label">Day Low:</span>
               <span class="detail-value">$${this.formatPrice(data.low)}</span>
             </div>
           ` : ''}
         </div>
       </div>
       <div class="modal-footer">
         <button class="btn btn-primary close-modal">Close</button>
       </div>
     </div>
   `;

   document.body.appendChild(modal);

   // Event handlers
   modal.querySelector('.modal-close').addEventListener('click', () => {
     document.body.removeChild(modal);
   });

   modal.querySelector('.close-modal').addEventListener('click', () => {
     document.body.removeChild(modal);
   });

   modal.addEventListener('click', (e) => {
     if (e.target === modal) {
       document.body.removeChild(modal);
     }
   });
 },

 /**
  * Configure the stocks module
  */
 configure(id, currentConfig = {}, callback) {
   const modal = document.createElement('div');
   modal.className = 'modal-overlay';
   modal.innerHTML = `
     <div class="modal large">
       <div class="modal-header">
         <h3>Configure Stocks Module</h3>
         <button class="modal-close">&times;</button>
       </div>
       <div class="modal-body">
         <form id="stocks-config-form-${id}">
           <!-- Stock Selection -->
           <div class="config-section">
             <h4>Stock Selection</h4>
             
             <div class="form-group mb-3">
               <label for="symbol-${id}" class="form-label">Stock Symbol</label>
               <div class="input-group">
                 <input type="text" class="form-control" id="symbol-${id}" name="symbol" 
                        value="${currentConfig.symbol || 'AAPL'}" 
                        placeholder="e.g., AAPL, GOOGL, MSFT" 
                        pattern="[A-Z0-9.]+" 
                        maxlength="10" 
                        required>
                 <button type="button" class="btn btn-outline-secondary search-stocks-btn">
                   <i class="fas fa-search"></i>
                 </button>
               </div>
               <div class="form-text">Enter a valid stock ticker symbol</div>
             </div>
             
             <div class="form-group mb-3">
               <label for="exchange-${id}" class="form-label">Exchange</label>
               <select class="form-control" id="exchange-${id}" name="exchange">
                 <option value="auto" ${(currentConfig.exchange === 'auto' || !currentConfig.exchange) ? 'selected' : ''}>Auto-detect</option>
                 <option value="NYSE" ${currentConfig.exchange === 'NYSE' ? 'selected' : ''}>NYSE</option>
                 <option value="NASDAQ" ${currentConfig.exchange === 'NASDAQ' ? 'selected' : ''}>NASDAQ</option>
                 <option value="LSE" ${currentConfig.exchange === 'LSE' ? 'selected' : ''}>London Stock Exchange</option>
                 <option value="TSE" ${currentConfig.exchange === 'TSE' ? 'selected' : ''}>Tokyo Stock Exchange</option>
               </select>
               <div class="form-text">Leave on auto-detect for most stocks</div>
             </div>
           </div>
           
           <!-- Display Options -->
           <div class="config-section">
             <h4>Display Options</h4>
             
             <div class="form-group mb-3">
               <label for="detailLevel-${id}" class="form-label">Detail Level</label>
               <select class="form-control" id="detailLevel-${id}" name="detailLevel">
                 <option value="compact" ${(currentConfig.detailLevel === 'compact' || !currentConfig.detailLevel) ? 'selected' : ''}>Compact</option>
                 <option value="normal" ${currentConfig.detailLevel === 'normal' ? 'selected' : ''}>Normal</option>
                 <option value="expanded" ${currentConfig.detailLevel === 'expanded' ? 'selected' : ''}>Expanded</option>
               </select>
               <div class="form-text">Choose how much information to display</div>
             </div>
             
             <div class="row">
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <div class="form-check">
                     <input class="form-check-input" type="checkbox" id="showChart-${id}" name="showChart" ${currentConfig.showChart ? 'checked' : ''}>
                     <label class="form-check-label" for="showChart-${id}">
                       Show Price Chart
                     </label>
                   </div>
                   <div class="form-text">Display historical price chart</div>
                 </div>
               </div>
               
               <div class="col-md-6">
                 <div class="form-group mb-3">
                   <div class="form-check">
                     <input class="form-check-input" type="checkbox" id="afterHours-${id}" name="afterHours" ${currentConfig.afterHours !== false ? 'checked' : ''}>
                     <label class="form-check-label" for="afterHours-${id}">
                       Show After Hours
                     </label>
                   </div>
                   <div class="form-text">Include extended trading hours</div>
                 </div>
               </div>
             </div>
           </div>
           
           <!-- Popular Stocks Quick Selection -->
           <div class="config-section">
             <h4>Popular Stocks</h4>
             <div class="popular-stocks">
               ${this.getPopularStocks().map(stock => `
                 <button type="button" class="btn btn-outline-secondary btn-sm popular-stock-btn me-2 mb-2" data-symbol="${stock.symbol}">
                   ${stock.symbol}
                   <small class="d-block">${stock.name}</small>
                 </button>
               `).join('')}
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
   
   // Popular stock buttons
   modal.querySelectorAll('.popular-stock-btn').forEach(btn => {
     btn.addEventListener('click', function() {
       const symbol = this.dataset.symbol;
       modal.querySelector(`#symbol-${id}`).value = symbol;
       
       // Visual feedback
       modal.querySelectorAll('.popular-stock-btn').forEach(b => b.classList.remove('active'));
       this.classList.add('active');
     });
   });
   
   // Preset buttons
   modal.querySelectorAll('.preset-btn').forEach(btn => {
     btn.addEventListener('click', function() {
       const presetKey = this.dataset.preset;
       const preset = StocksModule.configPresets[presetKey];
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
   
   // Stock search functionality
   modal.querySelector('.search-stocks-btn').addEventListener('click', () => {
     this.showStockSearchModal(modal, id);
   });
   
   // Form submission
   const form = modal.querySelector(`#stocks-config-form-${id}`);
   form.addEventListener('submit', (e) => {
     e.preventDefault();
     
     const formData = new FormData(form);
     const newConfig = {};
     
     // Process form data
     for (const [key, value] of formData.entries()) {
       if (key === 'showChart' || key === 'afterHours') {
         newConfig[key] = true;
       } else {
         newConfig[key] = value;
       }
     }
     
     // Handle unchecked checkboxes
     if (!formData.has('showChart')) {
       newConfig.showChart = false;
     }
     if (!formData.has('afterHours')) {
       newConfig.afterHours = false;
     }
     
     // Transform symbol to uppercase
     if (newConfig.symbol) {
       newConfig.symbol = newConfig.symbol.toUpperCase();
     }
     
     document.body.removeChild(modal);
     
     if (typeof callback === 'function') {
       callback(newConfig);
     }
     
     showToast('Stocks configuration updated', 'success');
   });
 },

 /**
  * Show stock search modal
  */
 showStockSearchModal(parentModal, id) {
   const searchModal = document.createElement('div');
   searchModal.className = 'modal-overlay';
   searchModal.innerHTML = `
     <div class="modal">
       <div class="modal-header">
         <h3>Search Stocks</h3>
         <button class="modal-close">&times;</button>
       </div>
       <div class="modal-body">
         <div class="search-container">
           <input type="text" class="form-control mb-3" id="stock-search-input" 
                  placeholder="Search by symbol or company name...">
           <div id="search-results" class="search-results">
             <div class="text-muted text-center">Start typing to search for stocks...</div>
           </div>
         </div>
       </div>
     </div>
   `;
   
   document.body.appendChild(searchModal);
   
   // Search functionality
   const searchInput = searchModal.querySelector('#stock-search-input');
   const resultsContainer = searchModal.querySelector('#search-results');
   let searchTimeout;
   
   searchInput.addEventListener('input', (e) => {
     clearTimeout(searchTimeout);
     const query = e.target.value.trim();
     
     if (query.length < 1) {
       resultsContainer.innerHTML = '<div class="text-muted text-center">Start typing to search for stocks...</div>';
       return;
     }
     
     searchTimeout = setTimeout(() => {
       this.performStockSearch(query, resultsContainer, parentModal, id, searchModal);
     }, 300);
   });
   
   // Close handlers
   searchModal.querySelector('.modal-close').addEventListener('click', () => {
     document.body.removeChild(searchModal);
   });
   
   searchModal.addEventListener('click', (e) => {
     if (e.target === searchModal) {
       document.body.removeChild(searchModal);
     }
   });
   
   // Focus search input
   searchInput.focus();
 },

 /**
  * Perform stock search
  */
 async performStockSearch(query, resultsContainer, parentModal, id, searchModal) {
   resultsContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
   
   try {
     // For now, use a static list of popular stocks
     const stocks = this.searchPopularStocks(query);
     
     if (stocks.length === 0) {
       resultsContainer.innerHTML = '<div class="text-muted text-center">No stocks found</div>';
       return;
     }
     
     resultsContainer.innerHTML = stocks.map(stock => `
       <div class="search-result-item" data-symbol="${stock.symbol}">
         <div class="stock-result">
           <div class="stock-symbol">${stock.symbol}</div>
           <div class="stock-name">${stock.name}</div>
           <div class="stock-exchange">${stock.exchange}</div>
         </div>
       </div>
     `).join('');
     
     // Add click handlers
     resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
       item.addEventListener('click', () => {
         const symbol = item.dataset.symbol;
         parentModal.querySelector(`#symbol-${id}`).value = symbol;
         document.body.removeChild(searchModal);
       });
     });
     
   } catch (error) {
     console.error('Stock search error:', error);
     resultsContainer.innerHTML = '<div class="text-danger text-center">Search failed. Please try again.</div>';
   }
 },

 /**
  * Search popular stocks (fallback method)
  */
 searchPopularStocks(query) {
   const popularStocks = this.getPopularStocks();
   const queryLower = query.toLowerCase();
   
   return popularStocks.filter(stock => 
     stock.symbol.toLowerCase().includes(queryLower) ||
     stock.name.toLowerCase().includes(queryLower)
   ).slice(0, 10);
 },

 /**
  * Get popular stocks list
  */
 getPopularStocks() {
   return [
     { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
     { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
     { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ' },
     { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
     { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
     { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
     { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ' },
     { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
     { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
     { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
     { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
     { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE' },
     { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE' },
     { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
     { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE' },
     { symbol: 'DIS', name: 'Walt Disney Co.', exchange: 'NYSE' },
     { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
     { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE' },
     { symbol: 'XOM', name: 'Exxon Mobil Corp.', exchange: 'NYSE' },
     { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' }
   ];
 },

 /**
  * Utility functions
  */
 formatPrice(price) {
   if (!price || isNaN(price)) return '0.00';
   return parseFloat(price).toFixed(2);
 },

 formatChange(change) {
   if (!change || isNaN(change)) return '0.00';
   const sign = parseFloat(change) >= 0 ? '+' : '';
   return sign + parseFloat(change).toFixed(2);
 },

 getChangeClass(change) {
   if (!change || isNaN(change)) return '';
   return parseFloat(change) >= 0 ? 'positive' : 'negative';
 },

 getChangeIcon(change) {
   if (!change || isNaN(change)) return 'fa-minus';
   return parseFloat(change) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
 },

 formatLargeNumber(num) {
   if (!num || isNaN(num)) return 'N/A';
   
   const number = parseInt(num);
   if (number >= 1e12) {
     return (number / 1e12).toFixed(1) + 'T';
   } else if (number >= 1e9) {
     return (number / 1e9).toFixed(1) + 'B';
   } else if (number >= 1e6) {
     return (number / 1e6).toFixed(1) + 'M';
   } else if (number >= 1e3) {
     return (number / 1e3).toFixed(1) + 'K';
   } else {
     return number.toLocaleString();
   }
 },

 formatUpdateTime(timestamp) {
   try {
     const date = new Date(timestamp);
     return date.toLocaleTimeString([], { 
       hour: '2-digit', 
       minute: '2-digit',
       hour12: true 
     });
   } catch (error) {
     return 'Unknown';
   }
 },

 escapeHtml(text) {
   const div = document.createElement('div');
   div.textContent = text;
   return div.innerHTML;
 }
};

// Register the module
ModuleRegistry.register('stocks', StocksModule);

export default StocksModule;
