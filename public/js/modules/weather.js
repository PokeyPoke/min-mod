/**
 * server/modules/widget-weather.js - Updated weather widget with standardized configuration
 */

const fetch = require('node-fetch');
const { configManager } = require('./config-manager');

module.exports = {
  name: 'Weather Widget',
  version: '2.0.0',
  category: 'data',
  priority: 10,
  dependencies: ['OPENWEATHER_API_KEY'],
  enabled: true,

  async initialize(context) {
    const { app, getCachedData, setCachedData, getCacheKey } = context;

    // Validate API key on startup
    if (!process.env.OPENWEATHER_API_KEY) {
      console.warn('OPENWEATHER_API_KEY not configured - weather widget will use demo data');
    }

    app.get('/api/widget/weather', async (req, res) => {
      try {
        // Get and validate configuration using config manager
        const rawConfig = {
          location: req.query.location,
          units: req.query.units,
          detailLevel: req.query.detailLevel,
          showForecast: req.query.showForecast,
          showAirQuality: req.query.showAirQuality,
          refreshInterval: req.query.refreshInterval
        };

        // Sanitize and validate configuration
        const config = configManager.sanitizeConfig('weather', rawConfig);
        const validation = configManager.validateConfig('weather', config);

        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Invalid configuration',
            details: validation.errors
          });
        }

        // Use validated config values
        const { 
          location = 'New York', 
          units = 'imperial', 
          detailLevel = 'compact',
          showForecast = false,
          showAirQuality = false
        } = config;

        // Check cache first
        const cacheKey = getCacheKey('weather', { 
          location: location.toLowerCase(), 
          units, 
          detailLevel,
          showForecast,
          showAirQuality
        });
        
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return res.json({ data: cachedData });
        }

        // Fetch weather data
        let weatherData;
        
        if (process.env.OPENWEATHER_API_KEY) {
          weatherData = await fetchRealWeatherData(location, units, detailLevel, showForecast, showAirQuality);
        } else {
          weatherData = generateDemoWeatherData(location, units, detailLevel, showForecast, showAirQuality);
        }

        // Cache the result (5 minutes for real data, 1 minute for demo data)
        const cacheTTL = process.env.OPENWEATHER_API_KEY ? 300 : 60;
        setCachedData(cacheKey, weatherData, cacheTTL);

        res.json({ data: weatherData });

      } catch (error) {
        console.error('Weather widget error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
      }
    });

    // Configuration endpoint
    app.get('/api/widget/weather/config', (req, res) => {
      try {
        const schema = configManager.getModuleSchema('weather');
        const defaultConfig = configManager.getDefaultConfig('weather');
        
        res.json({
          schema: schema.schema,
          presets: schema.presets,
          categories: schema.categories,
          tags: schema.tags,
          defaultConfig,
          capabilities: {
            realData: !!process.env.OPENWEATHER_API_KEY,
            forecast: true,
            airQuality: !!process.env.OPENWEATHER_API_KEY,
            geolocation: true
          }
        });
      } catch (error) {
        console.error('Weather config error:', error);
        res.status(500).json({ error: 'Failed to get weather configuration' });
      }
    });

    // City search endpoint for configuration
    app.get('/api/widget/weather/search', async (req, res) => {
      try {
        const { q: query } = req.query;
        
        if (!query || query.length < 2) {
          return res.json({ cities: [] });
        }

        let cities = [];

        if (process.env.OPENWEATHER_API_KEY) {
          // Use OpenWeatherMap Geocoding API
          const apiKey = process.env.OPENWEATHER_API_KEY;
          const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=10&appid=${apiKey}`;
          
          const response = await fetch(geocodeUrl, { timeout: 5000 });
          
          if (response.ok) {
            const geocodeData = await response.json();
            cities = geocodeData.map(city => ({
              name: city.name,
              country: city.country,
              state: city.state,
              lat: city.lat,
              lon: city.lon,
              displayName: `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`
            }));
          }
        } else {
          // Fallback to static popular cities
          const popularCities = [
            { name: 'New York', country: 'US', state: 'NY', lat: 40.7128, lon: -74.0060 },
            { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
            { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
            { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
            { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 },
            { name: 'Los Angeles', country: 'US', state: 'CA', lat: 34.0522, lon: -118.2437 },
            { name: 'Chicago', country: 'US', state: 'IL', lat: 41.8781, lon: -87.6298 },
            { name: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050 },
            { name: 'Mumbai', country: 'IN', lat: 19.0760, lon: 72.8777 },
            { name: 'Beijing', country: 'CN', lat: 39.9042, lon: 116.4074 }
          ];

          const queryLower = query.toLowerCase();
          cities = popularCities
            .filter(city => 
              city.name.toLowerCase().includes(queryLower) ||
              city.country.toLowerCase().includes(queryLower)
            )
            .map(city => ({
              ...city,
              displayName: `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`
            }));
        }

        res.json({ cities });

      } catch (error) {
        console.error('Weather search error:', error);
        res.json({ cities: [], error: 'Search failed' });
      }
    });

    return { message: 'Weather widget initialized successfully with standardized configuration' };
  }
};

/**
 * Fetch real weather data from OpenWeatherMap API
 */
async function fetchRealWeatherData(location, units, detailLevel, showForecast, showAirQuality) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  try {
    // Fetch current weather
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;
    const weatherResponse = await fetch(weatherUrl, { timeout: 10000 });

    if (!weatherResponse.ok) {
      if (weatherResponse.status === 404) {
        throw new Error('Location not found');
      }
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    
    // Process basic weather data
    const processedData = {
      location: weatherData.name,
      country: weatherData.sys?.country,
      temp: Math.round(weatherData.main?.temp),
      feelsLike: Math.round(weatherData.main?.feels_like),
      condition: weatherData.weather?.[0]?.main,
      description: weatherData.weather?.[0]?.description,
      icon: weatherData.weather?.[0]?.icon,
      humidity: weatherData.main?.humidity,
      pressure: weatherData.main?.pressure,
      wind: weatherData.wind?.speed,
      windDirection: weatherData.wind?.deg,
      visibility: weatherData.visibility ? Math.round(weatherData.visibility / 1000) : undefined,
      cloudiness: weatherData.clouds?.all,
      sunrise: weatherData.sys?.sunrise ? new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString() : undefined,
      sunset: weatherData.sys?.sunset ? new Date(weatherData.sys.sunset * 1000).toLocaleTimeString() : undefined,
      units: units,
      lastUpdated: new Date().toISOString(),
      source: 'openweathermap'
    };

    // Add forecast data if requested and detail level supports it
    if (showForecast && (detailLevel === 'normal' || detailLevel === 'expanded')) {
      try {
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;
        const forecastResponse = await fetch(forecastUrl, { timeout: 10000 });
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          processedData.forecast = processForecastData(forecastData, units);
        }
      } catch (forecastError) {
        console.warn('Failed to fetch forecast data:', forecastError);
        // Continue without forecast data
      }
    }

    // Add air quality data if requested and detail level supports it
    if (showAirQuality && detailLevel === 'expanded') {
      try {
        const { lat, lon } = weatherData.coord;
        const aqUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        const aqResponse = await fetch(aqUrl, { timeout: 10000 });
        
        if (aqResponse.ok) {
          const aqData = await aqResponse.json();
          processedData.airQuality = processAirQualityData(aqData);
        }
      } catch (aqError) {
        console.warn('Failed to fetch air quality data:', aqError);
        // Continue without air quality data
      }
    }

    return processedData;

  } catch (error) {
    console.error('Real weather data fetch error:', error);
    // Fallback to demo data on API error
    return generateDemoWeatherData(location, units, detailLevel, showForecast, showAirQuality);
  }
}

/**
 * Process forecast data from API
 */
function processForecastData(forecastData, units) {
  const dailyForecasts = [];
  const processedDays = new Set();
  
  for (const item of forecastData.list.slice(0, 40)) {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toDateString();
    
    if (!processedDays.has(dayKey) && dailyForecasts.length < 5) {
      processedDays.add(dayKey);
      dailyForecasts.push({
        date: date.toISOString(),
        dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
        temp: Math.round(item.main.temp),
        min: Math.round(item.main.temp_min),
        max: Math.round(item.main.temp_max),
        condition: item.weather[0].main,
        icon: item.weather[0].icon,
        description: item.weather[0].description,
        pop: Math.round((item.pop || 0) * 100), // Probability of precipitation as percentage
        humidity: item.main.humidity,
        wind: item.wind?.speed
      });
    }
  }
  
  return dailyForecasts;
}

/**
 * Process air quality data from API
 */
function processAirQualityData(aqData) {
  if (!aqData.list || !aqData.list[0]) return null;
  
  const aqi = aqData.list[0];
  return {
    aqi: aqi.main.aqi,
    level: getAQILevel(aqi.main.aqi),
    components: {
      co: aqi.components.co,
      no: aqi.components.no,
      no2: aqi.components.no2,
      o3: aqi.components.o3,
      so2: aqi.components.so2,
      pm2_5: aqi.components.pm2_5,
      pm10: aqi.components.pm10,
      nh3: aqi.components.nh3
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get AQI level description
 */
function getAQILevel(aqi) {
  if (aqi === 1) return { name: 'Good', color: '#00e400' };
  if (aqi === 2) return { name: 'Fair', color: '#ffff00' };
  if (aqi === 3) return { name: 'Moderate', color: '#ff7e00' };
  if (aqi === 4) return { name: 'Poor', color: '#ff0000' };
  if (aqi === 5) return { name: 'Very Poor', color: '#8f3f97' };
  return { name: 'Unknown', color: '#999999' };
}

/**
 * Generate demo weather data when API is not available
 */
function generateDemoWeatherData(location, units, detailLevel, showForecast, showAirQuality) {
  // Generate realistic but fake weather data
  const baseTemp = units === 'metric' ? 
    Math.floor(Math.random() * 30) + 5 : // 5-35°C
    Math.floor(Math.random() * 60) + 40; // 40-100°F

  const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Mist'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  const icons = {
    'Clear': '01d',
    'Clouds': '03d',
    'Rain': '10d',
    'Snow': '13d',
    'Mist': '50d'
  };

  const processedData = {
    location: location || 'Demo City',
    country: 'XX',
    temp: baseTemp,
    feelsLike: baseTemp + Math.floor(Math.random() * 6) - 3,
    condition: condition,
    description: condition.toLowerCase(),
    icon: icons[condition],
    humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
    pressure: Math.floor(Math.random() * 50) + 1000, // 1000-1050 hPa
    wind: Math.floor(Math.random() * 20) + 2, // 2-22 speed units
    windDirection: Math.floor(Math.random() * 360),
    visibility: Math.floor(Math.random() * 15) + 5, // 5-20 km
    cloudiness: Math.floor(Math.random() * 100),
    sunrise: '06:30 AM',
    sunset: '07:45 PM',
    units: units,
    lastUpdated: new Date().toISOString(),
    source: 'demo',
    isDemoData: true
  };

  // Add demo forecast if requested
  if (showForecast && (detailLevel === 'normal' || detailLevel === 'expanded')) {
    processedData.forecast = generateDemoForecast(units);
  }

  // Add demo air quality if requested
  if (showAirQuality && detailLevel === 'expanded') {
    processedData.airQuality = generateDemoAirQuality();
  }

  return processedData;
}

/**
 * Generate demo forecast data
 */
function generateDemoForecast(units) {
  const forecast = [];
  const baseTemp = units === 'metric' ? 20 : 68;
  const conditions = ['Clear', 'Clouds', 'Rain', 'Snow'];
  const icons = ['01d', '03d', '10d', '13d'];
  
  for (let i = 1; i <= 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const conditionIndex = Math.floor(Math.random() * conditions.length);
    const temp = baseTemp + Math.floor(Math.random() * 20) - 10;
    
    forecast.push({
      date: date.toISOString(),
      dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
      temp: temp,
      min: temp - Math.floor(Math.random() * 8) - 2,
      max: temp + Math.floor(Math.random() * 8) + 2,
      condition: conditions[conditionIndex],
      icon: icons[conditionIndex],
      description: conditions[conditionIndex].toLowerCase(),
      pop: Math.floor(Math.random() * 80),
      humidity: Math.floor(Math.random() * 40) + 40,
      wind: Math.floor(Math.random() * 15) + 3
    });
  }
  
  return forecast;
}

/**
 * Generate demo air quality data
 */
function generateDemoAirQuality() {
  const aqi = Math.floor(Math.random() * 4) + 1; // 1-5 scale
  
  return {
    aqi: aqi,
    level: getAQILevel(aqi),
    components: {
      co: Math.floor(Math.random() * 1000) + 200,
      no: Math.floor(Math.random() * 50),
      no2: Math.floor(Math.random() * 100) + 10,
      o3: Math.floor(Math.random() * 200) + 50,
      so2: Math.floor(Math.random() * 50),
      pm2_5: Math.floor(Math.random() * 50) + 5,
      pm10: Math.floor(Math.random() * 100) + 10,
      nh3: Math.floor(Math.random() * 20)
    },
    lastUpdated: new Date().toISOString(),
    isDemoData: true
  };
}
