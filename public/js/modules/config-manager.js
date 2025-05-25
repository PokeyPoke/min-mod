/**
 * server/modules/config-manager.js - Standardized Module Configuration System
 * Centralized configuration management with validation, sanitization, and user-friendly interfaces
 */

const { InputSanitizer } = require('../middleware/security');

class ConfigManager {
  constructor() {
    this.schemas = new Map();
    this.validators = new Map();
    this.transformers = new Map();
    this.presets = new Map();
    
    // Initialize built-in configurations
    this.initializeBuiltInConfigs();
  }

  /**
   * Initialize built-in module configurations
   */
  initializeBuiltInConfigs() {
    // Weather module configuration
    this.registerModuleConfig('weather', {
      schema: {
        location: {
          type: 'text',
          label: 'Location',
          description: 'City name or coordinates (lat,lon)',
          required: true,
          default: 'New York',
          validation: {
            minLength: 2,
            maxLength: 100,
            pattern: null
          },
          placeholder: 'Enter city name or coordinates',
          helpText: 'Examples: "London", "Tokyo", "40.7128,-74.0060"'
        },
        units: {
          type: 'select',
          label: 'Temperature Units',
          description: 'Choose temperature display units',
          required: false,
          default: 'imperial',
          options: [
            { value: 'imperial', label: 'Fahrenheit (°F)', description: 'US standard temperature scale' },
            { value: 'metric', label: 'Celsius (°C)', description: 'International standard temperature scale' },
            { value: 'kelvin', label: 'Kelvin (K)', description: 'Scientific temperature scale' }
          ],
          helpText: 'Temperature will be displayed in the selected units'
        },
        detailLevel: {
          type: 'select',
          label: 'Detail Level',
          description: 'Amount of weather information to display',
          required: false,
          default: 'compact',
          options: [
            { value: 'compact', label: 'Compact', description: 'Basic temperature and condition' },
            { value: 'normal', label: 'Normal', description: 'Temperature, condition, and key details' },
            { value: 'expanded', label: 'Expanded', description: 'Full weather information and forecast' }
          ],
          helpText: 'More detailed views show additional weather data'
        },
        showForecast: {
          type: 'boolean',
          label: 'Show 5-Day Forecast',
          description: 'Display extended weather forecast',
          required: false,
          default: true,
          helpText: 'Only visible in expanded detail level'
        },
        showAirQuality: {
          type: 'boolean',
          label: 'Show Air Quality',
          description: 'Display air quality index when available',
          required: false,
          default: false,
          helpText: 'Requires location with air quality monitoring'
        },
        refreshInterval: {
          type: 'number',
          label: 'Auto Refresh (minutes)',
          description: 'How often to refresh weather data',
          required: false,
          default: 10,
          min: 5,
          max: 60,
          step: 5,
          helpText: 'Weather data updates automatically at this interval'
        }
      },
      presets: {
        minimal: {
          name: 'Minimal Weather',
          config: {
            detailLevel: 'compact',
            showForecast: false,
            showAirQuality: false,
            refreshInterval: 15
          }
        },
        standard: {
          name: 'Standard Weather',
          config: {
            detailLevel: 'normal',
            showForecast: true,
            showAirQuality: false,
            refreshInterval: 10
          }
        },
        comprehensive: {
          name: 'Comprehensive Weather',
          config: {
            detailLevel: 'expanded',
            showForecast: true,
            showAirQuality: true,
            refreshInterval: 5
          }
        }
      },
      categories: ['Essential', 'Location-based'],
      tags: ['weather', 'forecast', 'temperature', 'outdoor']
    });

    // Crypto module configuration
    this.registerModuleConfig('crypto', {
      schema: {
        coin: {
          type: 'text',
          label: 'Cryptocurrency',
          description: 'Cryptocurrency symbol or name',
          required: true,
          default: 'bitcoin',
          validation: {
            minLength: 2,
            maxLength: 50,
            pattern: '^[a-z0-9-]+$'
          },
          placeholder: 'e.g., bitcoin, ethereum, cardano',
          helpText: 'Use CoinGecko coin IDs (lowercase, hyphen-separated)',
          searchable: true,
          searchEndpoint: '/api/crypto/search'
        },
        currency: {
          type: 'select',
          label: 'Display Currency',
          description: 'Currency for price display',
          required: false,
          default: 'usd',
          options: [
            { value: 'usd', label: 'US Dollar ($)', icon: '💵' },
            { value: 'eur', label: 'Euro (€)', icon: '💶' },
            { value: 'btc', label: 'Bitcoin (₿)', icon: '₿' },
            { value: 'eth', label: 'Ethereum (Ξ)', icon: 'Ξ' }
          ],
          helpText: 'Cryptocurrency prices in the selected currency'
        },
        detailLevel: {
          type: 'select',
          label: 'Detail Level',
          description: 'Amount of market information to display',
          required: false,
          default: 'compact',
          options: [
            { value: 'compact', label: 'Compact', description: 'Price and 24h change only' },
            { value: 'normal', label: 'Normal', description: 'Price, change, and market stats' },
            { value: 'expanded', label: 'Expanded', description: 'Full market data and charts' }
          ]
        },
        showChart: {
          type: 'boolean',
          label: 'Show Price Chart',
          description: 'Display price trend chart',
          required: false,
          default: false,
          helpText: 'Only available in expanded detail level'
        },
        chartPeriod: {
          type: 'select',
          label: 'Chart Period',
          description: 'Time range for price chart',
          required: false,
          default: '7d',
          options: [
            { value: '1d', label: '24 Hours' },
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: '1y', label: '1 Year' }
          ],
          dependsOn: 'showChart',
          helpText: 'Chart will show price history for this period'
        }
      },
      presets: {
        bitcoin_usd: {
          name: 'Bitcoin (USD)',
          config: {
            coin: 'bitcoin',
            currency: 'usd',
            detailLevel: 'normal',
            showChart: false
          }
        },
        ethereum_usd: {
          name: 'Ethereum (USD)',
          config: {
            coin: 'ethereum',
            currency: 'usd',
            detailLevel: 'normal',
            showChart: false
          }
        },
        portfolio_tracker: {
          name: 'Portfolio Tracker',
          config: {
            coin: 'bitcoin',
            currency: 'usd',
            detailLevel: 'expanded',
            showChart: true,
            chartPeriod: '7d'
          }
        }
      },
      categories: ['Financial', 'Investment'],
      tags: ['cryptocurrency', 'bitcoin', 'market', 'price', 'trading']
    });

    // Stocks module configuration
    this.registerModuleConfig('stocks', {
      schema: {
        symbol: {
          type: 'text',
          label: 'Stock Symbol',
          description: 'Stock ticker symbol',
          required: true,
          default: 'AAPL',
          validation: {
            minLength: 1,
            maxLength: 10,
            pattern: '^[A-Z0-9.]+$'
          },
          placeholder: 'e.g., AAPL, GOOGL, MSFT',
          helpText: 'Enter valid stock ticker symbols',
          searchable: true,
          searchEndpoint: '/api/stocks/search',
          transform: 'uppercase'
        },
        exchange: {
          type: 'select',
          label: 'Stock Exchange',
          description: 'Primary stock exchange',
          required: false,
          default: 'auto',
          options: [
            { value: 'auto', label: 'Auto-detect', description: 'Automatically determine exchange' },
            { value: 'NYSE', label: 'New York Stock Exchange (NYSE)' },
            { value: 'NASDAQ', label: 'NASDAQ' },
            { value: 'LSE', label: 'London Stock Exchange' },
            { value: 'TSE', label: 'Tokyo Stock Exchange' }
          ],
          helpText: 'Leave on auto-detect for most stocks'
        },
        detailLevel: {
          type: 'select',
          label: 'Detail Level',
          description: 'Amount of stock information to display',
          required: false,
          default: 'compact',
          options: [
            { value: 'compact', label: 'Compact', description: 'Price and change only' },
            { value: 'normal', label: 'Normal', description: 'Price, change, and key metrics' },
            { value: 'expanded', label: 'Expanded', description: 'Full stock data and analysis' }
          ]
        },
        showChart: {
          type: 'boolean',
          label: 'Show Stock Chart',
          description: 'Display stock price chart',
          required: false,
          default: false,
          helpText: 'Historical price chart with technical indicators'
        },
        afterHours: {
          type: 'boolean',
          label: 'Show After Hours',
          description: 'Include after-hours trading data',
          required: false,
          default: true,
          helpText: 'Shows extended trading hours when available'
        }
      },
      presets: {
        tech_stocks: {
          name: 'Tech Giants',
          config: {
            symbol: 'AAPL',
            detailLevel: 'normal',
            showChart: false,
            afterHours: true
          }
        },
        day_trader: {
          name: 'Day Trading',
          config: {
            symbol: 'AAPL',
            detailLevel: 'expanded',
            showChart: true,
            afterHours: true
          }
        }
      },
      categories: ['Financial', 'Investment'],
      tags: ['stocks', 'equity', 'market', 'trading', 'investment']
    });

    // Countdown module configuration
    this.registerModuleConfig('countdown', {
      schema: {
        title: {
          type: 'text',
          label: 'Countdown Title',
          description: 'Name for your countdown event',
          required: true,
          default: 'New Year',
          validation: {
            minLength: 1,
            maxLength: 100
          },
          placeholder: 'e.g., Project Deadline, Vacation, Anniversary',
          helpText: 'Give your countdown a meaningful name'
        },
        targetDate: {
          type: 'datetime-local',
          label: 'Target Date & Time',
          description: 'When your countdown should end',
          required: true,
          default: '2026-01-01T00:00:00',
          min: new Date().toISOString().slice(0, 16),
          helpText: 'Select the exact moment your countdown reaches zero'
        },
        timezone: {
          type: 'select',
          label: 'Timezone',
          description: 'Timezone for the countdown',
          required: false,
          default: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
          helpText: 'Choose the timezone for your event'
        },
        format: {
          type: 'select',
          label: 'Display Format',
          description: 'How to display the countdown',
          required: false,
          default: 'detailed',
          options: [
            { value: 'detailed', label: 'Detailed (Days, Hours, Minutes, Seconds)' },
            { value: 'compact', label: 'Compact (Days, Hours)' },
            { value: 'minimal', label: 'Minimal (Days only)' },
            { value: 'precise', label: 'Precise (Including milliseconds)' }
          ]
        },
        showProgress: {
          type: 'boolean',
          label: 'Show Progress Bar',
          description: 'Display visual progress towards the target',
          required: false,
          default: true,
          helpText: 'Requires a start date to calculate progress'
        },
        startDate: {
          type: 'datetime-local',
          label: 'Start Date (Optional)',
          description: 'When the countdown period began',
          required: false,
          dependsOn: 'showProgress',
          helpText: 'Used to calculate progress percentage'
        },
        alertDays: {
          type: 'number',
          label: 'Alert When Close (Days)',
          description: 'Show alert when countdown is within this many days',
          required: false,
          default: 7,
          min: 0,
          max: 365,
          helpText: 'Visual indicator when the event is approaching'
        }
      },
      presets: {
        new_year: {
          name: 'New Year Countdown',
          config: {
            title: 'New Year 2026',
            targetDate: '2026-01-01T00:00:00',
            format: 'detailed',
            showProgress: false,
            alertDays: 30
          }
        },
        project_deadline: {
          name: 'Project Deadline',
          config: {
            title: 'Project Due',
            format: 'detailed',
            showProgress: true,
            alertDays: 3
          }
        },
        vacation: {
          name: 'Vacation Countdown',
          config: {
            title: 'Vacation Time!',
            format: 'detailed',
            showProgress: true,
            alertDays: 14
          }
        }
      },
      categories: ['Productivity', 'Personal'],
      tags: ['countdown', 'deadline', 'event', 'reminder', 'time']
    });

    // Notes module configuration
    this.registerModuleConfig('notes', {
      schema: {
        title: {
          type: 'text',
          label: 'Notes Title',
          description: 'Title for your notes',
          required: false,
          default: 'Notes',
          validation: {
            maxLength: 100
          },
          placeholder: 'My Notes, Ideas, Reminders...',
          helpText: 'Optional title for organization'
        },
        content: {
          type: 'textarea',
          label: 'Note Content',
          description: 'Your note content',
          required: false,
          default: '',
          validation: {
            maxLength: 10000
          },
          rows: 10,
          placeholder: 'Start typing your notes here...',
          helpText: 'Supports plain text with automatic saving'
        },
        fontSize: {
          type: 'select',
          label: 'Font Size',
          description: 'Text size for readability',
          required: false,
          default: 'normal',
          options: [
            { value: 'small', label: 'Small (12px)', description: 'Compact text for more content' },
            { value: 'normal', label: 'Normal (14px)', description: 'Standard readable size' },
            { value: 'large', label: 'Large (16px)', description: 'Larger text for better readability' },
            { value: 'extra-large', label: 'Extra Large (18px)', description: 'Maximum readability' }
          ]
        },
        lineHeight: {
          type: 'select',
          label: 'Line Spacing',
          description: 'Space between lines of text',
          required: false,
          default: 'normal',
          options: [
            { value: 'compact', label: 'Compact (1.2)', description: 'Tight line spacing' },
            { value: 'normal', label: 'Normal (1.5)', description: 'Standard line spacing' },
            { value: 'relaxed', label: 'Relaxed (1.8)', description: 'Comfortable line spacing' }
          ]
        },
        showWordCount: {
          type: 'boolean',
          label: 'Show Word Count',
          description: 'Display character and word count',
          required: false,
          default: true,
          helpText: 'Shows live word and character statistics'
        },
        autoSave: {
          type: 'boolean',
          label: 'Auto Save',
          description: 'Automatically save changes',
          required: false,
          default: true,
          helpText: 'Notes are saved as you type'
        },
        spellCheck: {
          type: 'boolean',
          label: 'Spell Check',
          description: 'Enable browser spell checking',
          required: false,
          default: true,
          helpText: 'Underlines misspelled words in supported browsers'
        }
      },
      presets: {
        simple: {
          name: 'Simple Notes',
          config: {
            title: 'Notes',
            fontSize: 'normal',
            lineHeight: 'normal',
            showWordCount: false,
            autoSave: true,
            spellCheck: true
          }
        },
        writing: {
          name: 'Writing Focused',
          config: {
            title: 'Writing',
            fontSize: 'large',
            lineHeight: 'relaxed',
            showWordCount: true,
            autoSave: true,
            spellCheck: true
          }
        },
        compact: {
          name: 'Compact Notes',
          config: {
            title: 'Quick Notes',
            fontSize: 'small',
            lineHeight: 'compact',
            showWordCount: false,
            autoSave: true,
            spellCheck: false
          }
        }
      },
      categories: ['Productivity', 'Text'],
      tags: ['notes', 'text', 'writing', 'memo', 'reminder']
    });

    // Todo module configuration
    this.registerModuleConfig('todo', {
      schema: {
        title: {
          type: 'text',
          label: 'Todo List Title',
          description: 'Name for your todo list',
          required: false,
          default: 'To-Do List',
          validation: {
            maxLength: 100
          },
          placeholder: 'Work Tasks, Shopping List, Goals...',
          helpText: 'Give your todo list a descriptive name'
        },
        maxItems: {
          type: 'number',
          label: 'Maximum Items',
          description: 'Maximum number of todo items to display',
          required: false,
          default: 10,
          min: 1,
          max: 50,
          helpText: 'Limits the number of visible items for performance'
        },
        showCompleted: {
          type: 'boolean',
          label: 'Show Completed Tasks',
          description: 'Display completed items in the list',
          required: false,
          default: true,
          helpText: 'Completed tasks are shown with strikethrough'
        },
        sortBy: {
          type: 'select',
          label: 'Sort Order',
          description: 'How to order the todo items',
          required: false,
          default: 'newest',
          options: [
            { value: 'newest', label: 'Newest First', description: 'Most recently added items at top' },
            { value: 'oldest', label: 'Oldest First', description: 'Oldest items at top' },
            { value: 'alphabetical', label: 'Alphabetical', description: 'Sort by task name A-Z' },
            { value: 'priority', label: 'Priority', description: 'High priority items first' },
            { value: 'status', label: 'By Status', description: 'Incomplete tasks first' }
          ]
        },
        enablePriorities: {
          type: 'boolean',
          label: 'Enable Priorities',
          description: 'Allow setting priority levels for tasks',
          required: false,
          default: false,
          helpText: 'Adds priority indicators (Low, Normal, High, Urgent)'
        },
        enableDueDates: {
          type: 'boolean',
          label: 'Enable Due Dates',
          description: 'Allow setting due dates for tasks',
          required: false,
          default: false,
          helpText: 'Adds due date functionality with reminders'
        },
        enableCategories: {
          type: 'boolean',
          label: 'Enable Categories',
          description: 'Allow organizing tasks into categories',
          required: false,
          default: false,
          helpText: 'Group tasks by custom categories or tags'
        },
        autoRemoveCompleted: {
          type: 'select',
          label: 'Auto-Remove Completed',
          description: 'Automatically remove completed tasks',
          required: false,
          default: 'never',
          options: [
            { value: 'never', label: 'Never', description: 'Keep completed tasks' },
            { value: 'immediately', label: 'Immediately', description: 'Remove as soon as completed' },
            { value: 'daily', label: 'Daily', description: 'Remove at end of day' },
            { value: 'weekly', label: 'Weekly', description: 'Remove after one week' }
          ],
          helpText: 'Keeps your list clean and focused'
        },
        completionSound: {
          type: 'boolean',
          label: 'Completion Sound',
          description: 'Play sound when tasks are completed',
          required: false,
          default: false,
          helpText: 'Provides audio feedback for task completion'
        }
      },
      presets: {
        simple: {
          name: 'Simple Todo',
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
        productivity: {
          name: 'Productivity Focused',
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
        personal: {
          name: 'Personal Tasks',
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
        project: {
          name: 'Project Management',
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
      categories: ['Productivity', 'Organization'],
      tags: ['todo', 'tasks', 'checklist', 'productivity', 'gtd']
    });
  }

  /**
   * Register a module configuration
   */
  registerModuleConfig(moduleType, config) {
    if (!moduleType || !config || !config.schema) {
      throw new Error('Module type and schema are required');
    }

    // Validate schema structure
    this.validateSchema(config.schema);

    // Store configuration
    this.schemas.set(moduleType, config);

    // Create validators for this module
    this.createValidators(moduleType, config.schema);

    console.log(`✅ Registered configuration for module: ${moduleType}`);
  }

  /**
   * Validate schema structure
   */
  validateSchema(schema) {
    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      if (!fieldConfig.type) {
        throw new Error(`Field ${fieldName} missing required 'type' property`);
      }

      if (!fieldConfig.label) {
        throw new Error(`Field ${fieldName} missing required 'label' property`);
      }

      // Validate field type
      const validTypes = [
        'text', 'textarea', 'number', 'boolean', 'select', 'multiselect',
        'color', 'date', 'datetime-local', 'time', 'range', 'file', 'email', 'url'
      ];

      if (!validTypes.includes(fieldConfig.type)) {
        throw new Error(`Invalid field type '${fieldConfig.type}' for field ${fieldName}`);
      }

      // Validate select options
      if ((fieldConfig.type === 'select' || fieldConfig.type === 'multiselect') && !fieldConfig.options) {
        throw new Error(`Select field ${fieldName} must have options array`);
      }

      // Validate number constraints
      if (fieldConfig.type === 'number') {
        if (fieldConfig.min !== undefined && fieldConfig.max !== undefined && fieldConfig.min > fieldConfig.max) {
          throw new Error(`Field ${fieldName} min value cannot be greater than max value`);
        }
      }
    }
  }

  /**
   * Create validators for a module
   */
  createValidators(moduleType, schema) {
    const validators = {};

    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      validators[fieldName] = this.createFieldValidator(fieldName, fieldConfig);
    }

    this.validators.set(moduleType, validators);
  }

  /**
   * Create validator for a specific field
   */
  createFieldValidator(fieldName, fieldConfig) {
    return (value) => {
      const errors = [];

      // Required field validation
      if (fieldConfig.required && (value === null || value === undefined || value === '')) {
        errors.push(`${fieldConfig.label} is required`);
        return errors;
      }

      // Skip other validations if field is not required and empty
      if (!fieldConfig.required && (value === null || value === undefined || value === '')) {
        return errors;
      }

      // Type-specific validation
      switch (fieldConfig.type) {
        case 'text':
        case 'textarea':
        case 'email':
        case 'url':
          if (typeof value !== 'string') {
            errors.push(`${fieldConfig.label} must be text`);
            break;
          }

          // Length validation
          if (fieldConfig.validation) {
            if (fieldConfig.validation.minLength && value.length < fieldConfig.validation.minLength) {
              errors.push(`${fieldConfig.label} must be at least ${fieldConfig.validation.minLength} characters`);
            }
            if (fieldConfig.validation.maxLength && value.length > fieldConfig.validation.maxLength) {
              errors.push(`${fieldConfig.label} cannot exceed ${fieldConfig.validation.maxLength} characters`);
            }

            // Pattern validation
            if (fieldConfig.validation.pattern) {
              const pattern = new RegExp(fieldConfig.validation.pattern);
              if (!pattern.test(value)) {
                errors.push(`${fieldConfig.label} format is invalid`);
              }
            }
          }

          // Email validation
          if (fieldConfig.type === 'email') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
              errors.push(`${fieldConfig.label} must be a valid email address`);
            }
          }

          // URL validation
          if (fieldConfig.type === 'url') {
            try {
              new URL(value);
            } catch {
              errors.push(`${fieldConfig.label} must be a valid URL`);
            }
          }
          break;

        case 'number':
        case 'range':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`${fieldConfig.label} must be a number`);
            break;
          }

          if (fieldConfig.min !== undefined && numValue < fieldConfig.min) {
            errors.push(`${fieldConfig.label} must be at least ${fieldConfig.min}`);
          }
          if (fieldConfig.max !== undefined && numValue > fieldConfig.max) {
            errors.push(`${fieldConfig.label} cannot exceed ${fieldConfig.max}`);
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${fieldConfig.label} must be true or false`);
          }
          break;

        case 'select':
          if (fieldConfig.options) {
            const validValues = fieldConfig.options.map(opt => opt.value);
            if (!validValues.includes(value)) {
              errors.push(`${fieldConfig.label} must be one of: ${validValues.join(', ')}`);
            }
          }
          break;

        case 'multiselect':
          if (!Array.isArray(value)) {
            errors.push(`${fieldConfig.label} must be an array`);
            break;
          }

          if (fieldConfig.options) {
            const validValues = fieldConfig.options.map(opt => opt.value);
            const invalidValues = value.filter(v => !validValues.includes(v));
            if (invalidValues.length > 0) {
              errors.push(`${fieldConfig.label} contains invalid values: ${invalidValues.join(', ')}`);
            }
          }
          break;

        case 'date':
        case 'datetime-local':
        case 'time':
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            errors.push(`${fieldConfig.label} must be a valid date`);
            break;
          }

          if (fieldConfig.min) {
            const minDate = new Date(fieldConfig.min);
            if (dateValue < minDate) {
              errors.push(`${fieldConfig.label} cannot be before ${minDate.toLocaleDateString()}`);
            }
          }
          if (fieldConfig.max) {
            const maxDate = new Date(fieldConfig.max);
            if (dateValue > maxDate) {
              errors.push(`${fieldConfig.label} cannot be after ${maxDate.toLocaleDateString()}`);
            }
          }
          break;

        case 'color':
          const colorPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          if (!colorPattern.test(value)) {
            errors.push(`${fieldConfig.label} must be a valid hex color`);
          }
          break;
      }

      return errors;
    };
  }

  /**
   * Get module configuration schema
   */
  getModuleSchema(moduleType) {
    const config = this.schemas.get(moduleType);
    if (!config) {
      throw new Error(`No configuration found for module: ${moduleType}`);
    }
    return config;
  }

  /**
   * Get configuration field
   */
  getConfigField(moduleType, fieldName) {
    const schema = this.getModuleSchema(moduleType);
    const field = schema.schema[fieldName];
    
    if (!field) {
      throw new Error(`Field ${fieldName} not found in ${moduleType} configuration`);
    }
    
    return field;
  }

  /**
   * Validate module configuration
   */
  validateConfig(moduleType, config) {
    const validators = this.validators.get(moduleType);
    if (!validators) {
      throw new Error(`No validators found for module: ${moduleType}`);
    }

    const errors = {};
    let hasErrors = false;

    // Validate each field
    for (const [fieldName, validator] of Object.entries(validators)) {
      const fieldErrors = validator(config[fieldName]);
      if (fieldErrors.length > 0) {
        errors[fieldName] = fieldErrors;
        hasErrors = true;
      }
    }

    return {
      valid: !hasErrors,
      errors: hasErrors ? errors : null
    };
  }

  /**
   * Sanitize module configuration
   */
  sanitizeConfig(moduleType, config) {
    const schema = this.getModuleSchema(moduleType);
    const sanitized = {};

    for (const [fieldName, fieldConfig] of Object.entries(schema.schema)) {
      let value = config[fieldName];

      // Use default if value is missing
      if (value === undefined || value === null) {
        value = fieldConfig.default;
      }

      // Type-specific sanitization
      switch (fieldConfig.type) {
        case 'text':
        case 'textarea':
        case 'email':
        case 'url':
          if (typeof value === 'string') {
            value = InputSanitizer.sanitizeString(value, fieldConfig.validation?.maxLength);
            
            // Apply transformations
            if (fieldConfig.transform === 'uppercase') {
              value = value.toUpperCase();
            } else if (fieldConfig.transform === 'lowercase') {
              value = value.toLowerCase();
            } else if (fieldConfig.transform === 'trim') {
              value = value.trim();
            }
          }
          break;

        case 'number':
        case 'range':
          value = InputSanitizer.sanitizeNumeric(
            value, 
            fieldConfig.min || 0, 
            fieldConfig.max || Number.MAX_SAFE_INTEGER
          );
          break;

        case 'boolean':
          value = InputSanitizer.sanitizeBoolean(value);
          break;

        case 'select':
          if (fieldConfig.options) {
            const validValues = fieldConfig.options.map(opt => opt.value);
            value = InputSanitizer.sanitizeEnum(value, validValues, fieldConfig.default);
          }
          break;

        case 'multiselect':
          if (Array.isArray(value) && fieldConfig.options) {
            const validValues = fieldConfig.options.map(opt => opt.value);
            value = value.filter(v => validValues.includes(v));
          } else {
            value = [];
          }
          break;

        case 'color':
          // Ensure color starts with # and is valid hex
          if (typeof value === 'string') {
            value = value.startsWith('#') ? value : `#${value}`;
            if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
              value = fieldConfig.default || '#000000';
            }
          }
          break;
      }

      sanitized[fieldName] = value;
    }

    return sanitized;
  }

  /**
   * Get module presets
   */
  getModulePresets(moduleType) {
    const config = this.schemas.get(moduleType);
    return config?.presets || {};
  }

  /**
   * Apply preset to configuration
   */
  applyPreset(moduleType, presetName, baseConfig = {}) {
    const presets = this.getModulePresets(moduleType);
    const preset = presets[presetName];
    
    if (!preset) {
      throw new Error(`Preset ${presetName} not found for module ${moduleType}`);
    }

    // Merge base config with preset config
    const mergedConfig = { ...baseConfig, ...preset.config };
    
    // Sanitize the merged config
    return this.sanitizeConfig(moduleType, mergedConfig);
  }

  /**
   * Get default configuration for a module
   */
  getDefaultConfig(moduleType) {
    const schema = this.getModuleSchema(moduleType);
    const defaultConfig = {};

    for (const [fieldName, fieldConfig] of Object.entries(schema.schema)) {
      defaultConfig[fieldName] = fieldConfig.default;
    }

    return defaultConfig;
  }

  /**
   * Generate configuration form HTML
   */
  generateConfigForm(moduleType, currentConfig = {}, options = {}) {
    const schema = this.getModuleSchema(moduleType);
    const { includePresets = true, groupByCategory = false, showAdvanced = true } = options;

    let html = `<div class="module-config-form" data-module="${moduleType}">`;

    // Add presets section
    if (includePresets && Object.keys(schema.presets || {}).length > 0) {
      html += this.generatePresetsSection(moduleType, schema.presets);
    }

    // Add form fields
    html += '<div class="config-fields">';
    
    if (groupByCategory) {
      html += this.generateCategorizedFields(moduleType, schema.schema, currentConfig, showAdvanced);
    } else {
      html += this.generateLinearFields(moduleType, schema.schema, currentConfig, showAdvanced);
    }
    
    html += '</div>';

    // Add form actions
    html += this.generateFormActions();

    html += '</div>';

    return html;
  }

  /**
   * Generate presets section
   */
  generatePresetsSection(moduleType, presets) {
    let html = `
      <div class="config-presets mb-4">
        <h5 class="config-section-title">
          <i class="fas fa-magic me-2"></i>Quick Setup
        </h5>
        <div class="preset-buttons">
    `;

    for (const [presetKey, preset] of Object.entries(presets)) {
      html += `
        <button type="button" class="btn btn-outline-primary btn-sm preset-btn" 
                data-preset="${presetKey}" data-module="${moduleType}">
          <i class="fas fa-wand-magic-sparkles me-1"></i>
          ${preset.name}
        </button>
      `;
    }

    html += `
        </div>
        <small class="text-muted">Click a preset to quickly configure your widget</small>
      </div>
    `;

    return html;
  }

  /**
   * Generate linear fields layout
   */
  generateLinearFields(moduleType, schema, currentConfig, showAdvanced) {
    let html = '';

    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      // Skip advanced fields if not showing advanced
      if (!showAdvanced && fieldConfig.advanced) continue;

      html += this.generateFieldHTML(moduleType, fieldName, fieldConfig, currentConfig[fieldName]);
    }

    return html;
  }

  /**
   * Generate categorized fields layout
   */
  generateCategorizedFields(moduleType, schema, currentConfig, showAdvanced) {
    // Group fields by category
    const categories = {};
    const uncategorized = [];

    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      if (!showAdvanced && fieldConfig.advanced) continue;

      if (fieldConfig.category) {
        if (!categories[fieldConfig.category]) {
          categories[fieldConfig.category] = [];
        }
        categories[fieldConfig.category].push([fieldName, fieldConfig]);
      } else {
        uncategorized.push([fieldName, fieldConfig]);
      }
    }

    let html = '';

    // Render categorized fields
    for (const [categoryName, fields] of Object.entries(categories)) {
      html += `
        <div class="config-category mb-4">
          <h6 class="config-category-title">${categoryName}</h6>
          <div class="config-category-fields">
      `;

      for (const [fieldName, fieldConfig] of fields) {
        html += this.generateFieldHTML(moduleType, fieldName, fieldConfig, currentConfig[fieldName]);
      }

      html += `
          </div>
        </div>
      `;
    }

    // Render uncategorized fields
    if (uncategorized.length > 0) {
      html += '<div class="config-category mb-4">';
      if (Object.keys(categories).length > 0) {
        html += '<h6 class="config-category-title">Other Settings</h6>';
      }
      html += '<div class="config-category-fields">';

      for (const [fieldName, fieldConfig] of uncategorized) {
        html += this.generateFieldHTML(moduleType, fieldName, fieldConfig, currentConfig[fieldName]);
      }

      html += '</div></div>';
    }

    return html;
  }

  /**
   * Generate HTML for a specific field
   */
  generateFieldHTML(moduleType, fieldName, fieldConfig, currentValue) {
    const fieldId = `${moduleType}-${fieldName}`;
    const value = currentValue !== undefined ? currentValue : fieldConfig.default;
    const required = fieldConfig.required ? 'required' : '';
    const disabled = fieldConfig.disabled ? 'disabled' : '';

    let html = `
      <div class="form-group mb-3 ${fieldConfig.advanced ? 'advanced-field' : ''}" 
           ${fieldConfig.dependsOn ? `data-depends-on="${fieldConfig.dependsOn}"` : ''}>
        <label for="${fieldId}" class="form-label">
          ${fieldConfig.label}
          ${fieldConfig.required ? '<span class="text-danger">*</span>' : ''}
        </label>
    `;

    // Generate field input based on type
    switch (fieldConfig.type) {
      case 'text':
      case 'email':
      case 'url':
        html += `
          <input type="${fieldConfig.type}" class="form-control" id="${fieldId}" 
                 name="${fieldName}" value="${this.escapeHtml(value || '')}" 
                 ${required} ${disabled}
                 ${fieldConfig.placeholder ? `placeholder="${this.escapeHtml(fieldConfig.placeholder)}"` : ''}
                 ${fieldConfig.validation?.minLength ? `minlength="${fieldConfig.validation.minLength}"` : ''}
                 ${fieldConfig.validation?.maxLength ? `maxlength="${fieldConfig.validation.maxLength}"` : ''}
                 ${fieldConfig.validation?.pattern ? `pattern="${fieldConfig.validation.pattern}"` : ''}>
        `;
        break;

      case 'textarea':
        html += `
          <textarea class="form-control" id="${fieldId}" name="${fieldName}" 
                    ${required} ${disabled}
                    ${fieldConfig.rows ? `rows="${fieldConfig.rows}"` : 'rows="4"'}
                    ${fieldConfig.placeholder ? `placeholder="${this.escapeHtml(fieldConfig.placeholder)}"` : ''}
                    ${fieldConfig.validation?.maxLength ? `maxlength="${fieldConfig.validation.maxLength}"` : ''}>${this.escapeHtml(value || '')}</textarea>
        `;
        break;

      case 'number':
      case 'range':
        html += `
          <input type="${fieldConfig.type}" class="form-control" id="${fieldId}" 
                 name="${fieldName}" value="${value || ''}" 
                 ${required} ${disabled}
                 ${fieldConfig.min !== undefined ? `min="${fieldConfig.min}"` : ''}
                 ${fieldConfig.max !== undefined ? `max="${fieldConfig.max}"` : ''}
                 ${fieldConfig.step !== undefined ? `step="${fieldConfig.step}"` : ''}>
        `;
        break;

      case 'boolean':
        html += `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="${fieldId}" 
                   name="${fieldName}" ${value ? 'checked' : ''} ${disabled}>
            <label class="form-check-label" for="${fieldId}">
              ${fieldConfig.checkboxLabel || 'Enable this option'}
            </label>
          </div>
        `;
        break;

      case 'select':
        html += `<select class="form-control" id="${fieldId}" name="${fieldName}" ${required} ${disabled}>`;
        
        if (!fieldConfig.required) {
          html += '<option value="">-- Select an option --</option>';
        }
        
        for (const option of fieldConfig.options || []) {
          const selected = value === option.value ? 'selected' : '';
          html += `
            <option value="${this.escapeHtml(option.value)}" ${selected} 
                    ${option.description ? `title="${this.escapeHtml(option.description)}"` : ''}>
              ${option.icon ? option.icon + ' ' : ''}${this.escapeHtml(option.label)}
            </option>
          `;
        }
        
        html += '</select>';
        break;

      case 'multiselect':
        html += `<select class="form-control" id="${fieldId}" name="${fieldName}" multiple ${required} ${disabled}>`;
        
        const selectedValues = Array.isArray(value) ? value : [];
        for (const option of fieldConfig.options || []) {
          const selected = selectedValues.includes(option.value) ? 'selected' : '';
          html += `
            <option value="${this.escapeHtml(option.value)}" ${selected}>
              ${this.escapeHtml(option.label)}
            </option>
          `;
        }
        
        html += '</select>';
        break;

      case 'color':
        html += `
          <input type="color" class="form-control form-control-color" id="${fieldId}" 
                 name="${fieldName}" value="${value || '#000000'}" ${required} ${disabled}>
        `;
        break;

      case 'date':
      case 'datetime-local':
      case 'time':
        html += `
          <input type="${fieldConfig.type}" class="form-control" id="${fieldId}" 
                 name="${fieldName}" value="${value || ''}" 
                 ${required} ${disabled}
                 ${fieldConfig.min ? `min="${fieldConfig.min}"` : ''}
                 ${fieldConfig.max ? `max="${fieldConfig.max}"` : ''}>
        `;
        break;

      case 'file':
        html += `
          <input type="file" class="form-control" id="${fieldId}" 
                 name="${fieldName}" ${required} ${disabled}
                 ${fieldConfig.accept ? `accept="${fieldConfig.accept}"` : ''}
                 ${fieldConfig.multiple ? 'multiple' : ''}>
        `;
        break;
    }

    // Add search functionality for searchable fields
    if (fieldConfig.searchable) {
      html += `
        <div class="field-search mt-2">
          <button type="button" class="btn btn-outline-secondary btn-sm search-btn" 
                  data-field="${fieldName}" data-endpoint="${fieldConfig.searchEndpoint}">
            <i class="fas fa-search me-1"></i>Search
          </button>
        </div>
      `;
    }

    // Add help text
    if (fieldConfig.helpText) {
      html += `<div class="form-text">${this.escapeHtml(fieldConfig.helpText)}</div>`;
    }

    // Add description
    if (fieldConfig.description && fieldConfig.description !== fieldConfig.helpText) {
      html += `<small class="text-muted">${this.escapeHtml(fieldConfig.description)}</small>`;
    }

    html += '</div>';

    return html;
  }

  /**
   * Generate form actions
   */
  generateFormActions() {
    return `
      <div class="config-actions mt-4">
        <div class="d-flex justify-content-between">
          <div>
            <button type="button" class="btn btn-outline-secondary btn-sm reset-btn">
              <i class="fas fa-undo me-1"></i>Reset to Defaults
            </button>
          </div>
          <div>
            <button type="button" class="btn btn-outline-secondary me-2 cancel-btn">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary save-btn">
              <i class="fas fa-save me-1"></i>Save Configuration
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get available modules with their configuration info
   */
  getAvailableModules() {
    const modules = [];

    for (const [moduleType, config] of this.schemas.entries()) {
      modules.push({
        type: moduleType,
        name: config.name || moduleType,
        description: config.description || `${moduleType} module`,
        categories: config.categories || [],
        tags: config.tags || [],
        hasPresets: Object.keys(config.presets || {}).length > 0,
        fieldCount: Object.keys(config.schema).length,
        configurable: true
      });
    }

    return modules.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search modules by criteria
   */
  searchModules(query, filters = {}) {
    const modules = this.getAvailableModules();
    let filtered = modules;

    // Text search
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(module => 
        module.name.toLowerCase().includes(searchTerm) ||
        module.description.toLowerCase().includes(searchTerm) ||
        module.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(module => 
        module.categories.includes(filters.category)
      );
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(module => 
        filters.tags.some(tag => module.tags.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * Export module configuration
   */
  exportConfig(moduleType, config) {
    const schema = this.getModuleSchema(moduleType);
    
    return {
      moduleType,
      moduleName: schema.name || moduleType,
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      config: this.sanitizeConfig(moduleType, config),
      schema: {
        fields: Object.keys(schema.schema),
        required: Object.entries(schema.schema)
          .filter(([_, field]) => field.required)
          .map(([name, _]) => name)
      }
    };
  }

  /**
   * Import module configuration
   */
  importConfig(importData) {
    if (!importData.moduleType || !importData.config) {
      throw new Error('Invalid import data: missing moduleType or config');
    }

    const moduleType = importData.moduleType;
    
    // Validate that we have a schema for this module
    if (!this.schemas.has(moduleType)) {
      throw new Error(`No schema found for module type: ${moduleType}`);
    }

    // Validate and sanitize the imported config
    const validation = this.validateConfig(moduleType, importData.config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${JSON.stringify(validation.errors)}`);
    }

    return this.sanitizeConfig(moduleType, importData.config);
  }

  /**
   * Utility method to escape HTML
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const div = document?.createElement('div');
    if (div) {
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Fallback for server-side
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Get configuration statistics
   */
  getConfigStats() {
    const stats = {
      totalModules: this.schemas.size,
      moduleTypes: Array.from(this.schemas.keys()),
      totalFields: 0,
      fieldsByType: {},
      modulesWithPresets: 0,
      totalPresets: 0
    };

    for (const [moduleType, config] of this.schemas.entries()) {
      // Count fields
      const fieldCount = Object.keys(config.schema).length;
      stats.totalFields += fieldCount;

      // Count field types
      for (const field of Object.values(config.schema)) {
        stats.fieldsByType[field.type] = (stats.fieldsByType[field.type] || 0) + 1;
      }

      // Count presets
      const presetCount = Object.keys(config.presets || {}).length;
      if (presetCount > 0) {
        stats.modulesWithPresets++;
        stats.totalPresets += presetCount;
      }
    }

    return stats;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

module.exports = {
  ConfigManager,
  configManager
};
