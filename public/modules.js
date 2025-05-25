// All widget modules in one file for simplicity
const WidgetModules = {
  weather: {
    name: 'Weather',
    icon: 'fas fa-cloud-sun',
    defaultSize: { w: 4, h: 3 },
    
    async fetchData(config = {}) {
      const { location = 'New York', units = 'imperial' } = config;
      const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}&units=${units}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.data;
    },
    
    render(container, data) {
      const tempUnit = data.units === 'metric' ? '°C' : '°F';
      
      container.innerHTML = `
        <div class="widget-data">
          <div class="widget-main">${data.temp}${tempUnit}</div>
          <div class="widget-sub">${data.condition}</div>
          <div class="widget-location">${data.location}</div>
          ${data.demo ? '<div class="text-muted">Demo Data</div>' : ''}
          <div class="widget-details">
            <div class="detail-item">
              <span class="detail-label">Humidity</span>
              <span class="detail-value">${data.humidity}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Wind</span>
              <span class="detail-value">${data.wind} mph</span>
            </div>
          </div>
        </div>
      `;
    },
    
    configure() {
      const location = prompt('Enter city name:', 'New York');
      if (!location) return null;
      
      const units = confirm('Use Celsius? (Cancel for Fahrenheit)') ? 'metric' : 'imperial';
      return { location, units };
    }
  },

  crypto: {
    name: 'Crypto',
    icon: 'fab fa-bitcoin',
    defaultSize: { w: 4, h: 3 },
    
    async fetchData(config = {}) {
      const { coin = 'bitcoin', currency = 'usd' } = config;
      const response = await fetch(`/api/crypto?coin=${coin}&currency=${currency}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.data;
    },
    
    render(container, data) {
      const changeClass = parseFloat(data.change24h) >= 0 ? 'positive' : 'negative';
      const changeIcon = parseFloat(data.change24h) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
      const symbol = data.currency === 'usd' ? '$' : data.currency.toUpperCase();
      
      container.innerHTML = `
        <div class="widget-data">
          <div class="widget-main">${symbol}${parseFloat(data.price).toLocaleString()}</div>
          <div class="widget-sub">
            <i class="fas ${changeIcon}"></i>
            <span class="${changeClass}">${data.change24h}%</span>
          </div>
          <div class="widget-location">${data.coin.charAt(0).toUpperCase() + data.coin.slice(1)}</div>
          <div class="widget-details">
            <div class="detail-item">
              <span class="detail-label">Market Cap</span>
              <span class="detail-value">${this.formatNumber(data.marketCap)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Volume</span>
              <span class="detail-value">${this.formatNumber(data.volume24h)}</span>
            </div>
          </div>
        </div>
      `;
    },
    
    configure() {
      const coin = prompt('Enter cryptocurrency (e.g., bitcoin, ethereum):', 'bitcoin');
      if (!coin) return null;
      
      const currency = prompt('Enter currency (usd, eur, btc):', 'usd');
      return { coin: coin.toLowerCase(), currency: currency.toLowerCase() };
    },
    
    formatNumber(num) {
      if (!num) return 'N/A';
      if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
      if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
      return num.toFixed(0);
    }
  },

  stocks: {
    name: 'Stocks',
    icon: 'fas fa-chart-line',
    defaultSize: { w: 4, h: 3 },
    
    async fetchData(config = {}) {
      const { symbol = 'AAPL' } = config;
      const response = await fetch(`/api/stocks?symbol=${symbol.toUpperCase()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.data;
    },
    
    render(container, data) {
      const changeClass = parseFloat(data.change) >= 0 ? 'positive' : 'negative';
      const changeIcon = parseFloat(data.change) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
      
      container.innerHTML = `
        <div class="widget-data">
          <div class="widget-main">$${parseFloat(data.price).toFixed(2)}</div>
          <div class="widget-sub">
            <i class="fas ${changeIcon}"></i>
            <span class="${changeClass}">${data.change} (${data.changePercent})</span>
          </div>
          <div class="widget-location">${data.symbol}</div>
          ${data.demo ? '<div class="text-muted">Demo Data</div>' : ''}
          <div class="widget-details">
            <div class="detail-item">
              <span class="detail-label">Volume</span>
              <span class="detail-value">${this.formatVolume(data.volume)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Prev Close</span>
              <span class="detail-value">$${parseFloat(data.previousClose).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    },
    
    configure() {
      const symbol = prompt('Enter stock symbol (e.g., AAPL, GOOGL):', 'AAPL');
      return symbol ? { symbol: symbol.toUpperCase() } : null;
    },
    
    formatVolume(volume) {
      if (!volume) return 'N/A';
      if (volume >= 1e6) return (volume / 1e6).toFixed(1) + 'M';
      if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
      return volume.toString();
    }
  },

  countdown: {
    name: 'Countdown',
    icon: 'fas fa-hourglass-half',
    defaultSize: { w: 6, h: 3 },
    
    async fetchData(config = {}) {
      const { title = 'New Year', targetDate = '2025-12-31T23:59:59' } = config;
      const response = await fetch(`/api/countdown?title=${encodeURIComponent(title)}&targetDate=${encodeURIComponent(targetDate)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.data;
    },
    
    render(container, data) {
      if (data.completed) {
        container.innerHTML = `
          <div class="widget-data">
            <div class="widget-main">🎉</div>
            <div class="widget-sub">${data.title}</div>
            <div class="widget-location">Completed!</div>
          </div>
        `;
        return;
      }
      
      const diff = new Date(data.targetDate) - new Date();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      container.innerHTML = `
        <div class="widget-data">
          <div class="widget-sub">${data.title}</div>
          <div class="countdown-timer">
            <div class="countdown-unit">
              <span class="countdown-value">${days}</span>
              <span class="countdown-label">Days</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${hours.toString().padStart(2, '0')}</span>
              <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${minutes.toString().padStart(2, '0')}</span>
              <span class="countdown-label">Min</span>
            </div>
            <div class="countdown-unit">
              <span class="countdown-value">${seconds.toString().padStart(2, '0')}</span>
              <span class="countdown-label">Sec</span>
            </div>
          </div>
        </div>
      `;
      
      // Update every second
      setTimeout(() => {
        if (container.closest('.widget')) {
          this.render(container, data);
        }
      }, 1000);
    },
    
    configure() {
      const title = prompt('Enter event title:', 'New Year');
      if (!title) return null;
      
      const dateStr = prompt('Enter target date (YYYY-MM-DD):', '2025-12-31');
      if (!dateStr) return null;
      
      try {
        const targetDate = new Date(dateStr + 'T23:59:59').toISOString();
        return { title, targetDate };
      } catch (error) {
        alert('Invalid date format. Please use YYYY-MM-DD format.');
        return null;
      }
    }
  },

  notes: {
    name: 'Notes',
    icon: 'fas fa-sticky-note',
    defaultSize: { w: 4, h: 4 },
    
    async fetchData(config = {}) {
      const { title = 'Notes', content = '' } = config;
      try {
        const response = await fetch(`/api/notes?title=${encodeURIComponent(title)}&content=${encodeURIComponent(content)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return { ...result.data, ...config };
      } catch (error) {
        // Fallback for local operation
        return { title, content, showWordCount: true, autoSave: true };
      }
    },
    
    render(container, data) {
      const noteId = 'note-' + Math.random().toString(36).substr(2, 9);
      
      container.innerHTML = `
        <div class="notes-widget-content">
          <textarea 
            class="notes-textarea" 
            placeholder="Enter your notes here..."
            data-note-id="${noteId}"
          >${data.content || ''}</textarea>
          <div class="notes-stats">
            <span id="word-count-${noteId}">0 words</span>
          </div>
        </div>
      `;
      
      const textarea = container.querySelector('.notes-textarea');
      const wordCount = container.querySelector(`#word-count-${noteId}`);
      
      const updateStats = () => {
        const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
        wordCount.textContent = `${words} words`;
        
        // Auto-save to localStorage
        try {
          localStorage.setItem(`notes-${noteId}`, textarea.value);
        } catch (e) {
          console.warn('Could not save to localStorage:', e);
        }
      };
      
      textarea.addEventListener('input', updateStats);
      updateStats();
      
      // Load saved content
      try {
        const saved = localStorage.getItem(`notes-${noteId}`);
        if (saved) {
          textarea.value = saved;
          updateStats();
        }
      } catch (e) {
        console.warn('Could not load from localStorage:', e);
      }
    },
    
    configure() {
      const title = prompt('Enter note title:', 'Notes');
      return title ? { title } : null;
    }
  },

  todo: {
    name: 'Todo',
    icon: 'fas fa-tasks',
    defaultSize: { w: 4, h: 4 },
    
    async fetchData(config = {}) {
      const { title = 'Todo List' } = config;
      try {
        const response = await fetch(`/api/todo?title=${encodeURIComponent(title)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return { ...result.data, ...config };
      } catch (error) {
        // Fallback for local operation
        return { title, items: [], showCompleted: true, maxItems: 10 };
      }
    },
    
    render(container, data) {
      const todoId = 'todo-' + Math.random().toString(36).substr(2, 9);
      
      // Load saved todos
      let todos = [];
      try {
        todos = JSON.parse(localStorage.getItem(`todos-${todoId}`) || '[]');
      } catch (e) {
        console.warn('Could not load todos from localStorage:', e);
        todos = [];
      }
      
      const renderTodos = () => {
        const todoList = todos.map((todo, index) => `
          <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <input 
              type="checkbox" 
              class="todo-checkbox" 
              ${todo.completed ? 'checked' : ''}
              data-index="${index}"
            >
            <span class="todo-text">${todo.text}</span>
            <button class="widget-action delete-todo" data-index="${index}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `).join('');
        
        return `
          <div class="todo-widget-content">
            <div class="todo-input-container">
              <input 
                type="text" 
                class="todo-input" 
                placeholder="Add new task..."
                data-todo-id="${todoId}"
              >
            </div>
            <div class="todo-list">
              ${todoList}
            </div>
            <div class="todo-stats">
              ${todos.filter(t => !t.completed).length} active, 
              ${todos.filter(t => t.completed).length} completed
            </div>
          </div>
        `;
      };
      
      container.innerHTML = renderTodos();
      
      // Add event listeners
      const input = container.querySelector('.todo-input');
      const checkboxes = container.querySelectorAll('.todo-checkbox');
      const deleteButtons = container.querySelectorAll('.delete-todo');
      
      // Add new todo
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          todos.push({ text: input.value.trim(), completed: false });
          input.value = '';
          try {
            localStorage.setItem(`todos-${todoId}`, JSON.stringify(todos));
          } catch (err) {
            console.warn('Could not save todos to localStorage:', err);
          }
          container.innerHTML = renderTodos();
          this.render(container, data); // Re-render to reattach events
        }
      });
      
      // Toggle completion
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.index);
          todos[index].completed = e.target.checked;
          try {
            localStorage.setItem(`todos-${todoId}`, JSON.stringify(todos));
          } catch (err) {
            console.warn('Could not save todos to localStorage:', err);
          }
          container.innerHTML = renderTodos();
          this.render(container, data); // Re-render to reattach events
        });
      });
      
      // Delete todo
      deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('.delete-todo').dataset.index);
          todos.splice(index, 1);
          try {
            localStorage.setItem(`todos-${todoId}`, JSON.stringify(todos));
          } catch (err) {
            console.warn('Could not save todos to localStorage:', err);
          }
          container.innerHTML = renderTodos();
          this.render(container, data); // Re-render to reattach events
        });
      });
    },
    
    configure() {
      const title = prompt('Enter todo list title:', 'Todo List');
      return title ? { title } : null;
    }
  }
};

// Export for use in app.js
window.WidgetModules = WidgetModules;
