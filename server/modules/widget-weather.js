/**
 * server/modules/widget-weather.js - Secure weather widget module
 */

const fetch = require('node-fetch');

module.exports = {
  name: 'Weather Widget',
  version: '2.0.0',
  category: 'data',
  priority: 10,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app, getCachedData, setCachedData, getCacheKey } = context;

    // Validate API key on startup
    if (!process.env.OPENWEATHER_API_KEY) {
      throw new Error('OPENWEATHER_API_KEY environment variable is required for weather widget');
    }

    app.get('/api/widget/weather', async (req, res) => {
      try {
        const { location = 'New York', units = 'imperial', detailLevel = 'compact' } = req.query;
        
        // Input validation
        if (!location || typeof location !== 'string' || location.length > 100) {
          return res.status(400).json({ error: 'Invalid location parameter' });
        }

        if (!['metric', 'imperial'].includes(units)) {
          return res.status(400).json({ error: 'Invalid units parameter' });
        }

        // Check cache first
        const cacheKey = getCacheKey('weather', { location: location.toLowerCase(), units });
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return res.json({ data: cachedData });
        }

        // Fetch weather data
        const apiKey = process.env.OPENWEATHER_API_KEY;
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;
        
        const response = await fetch(weatherUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Dashboard-App/2.0'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(400).json({ error: 'Location not found' });
          }
          if (response.status === 401) {
            console.error('Invalid OpenWeather API key');
            return res.status(500).json({ error: 'Weather service configuration error' });
          }
          throw new Error(`Weather API error: ${response.status}`);
        }

        const weatherData = await response.json();

        // Process and sanitize weather data
        const processedData = {
          location: weatherData.name,
          country: weatherData.sys?.country,
          temp: weatherData.main?.temp,
          feelsLike: weatherData.main?.feels_like,
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
          lastUpdated: new Date().toISOString()
        };

        // Fetch forecast data for expanded view
        if (detailLevel === 'expanded') {
          try {
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;
            const forecastResponse = await fetch(forecastUrl, { timeout: 10000 });
            
            if (forecastResponse.ok) {
              const forecastData = await forecastResponse.json();
              const dailyForecasts = [];
              const processedDays = new Set();
              
              for (const item of forecastData.list.slice(0, 40)) {
                const date = new Date(item.dt * 1000);
                const dayKey = date.toDateString();
                
                if (!processedDays.has(dayKey) && dailyForecasts.length < 5) {
                  processedDays.add(dayKey);
                  dailyForecasts.push({
                    date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                    temp: item.main.temp,
                    min: item.main.temp_min,
                    max: item.main.temp_max,
                    condition: item.weather[0].main,
                    icon: item.weather[0].icon,
                    description: item.weather[0].description
                  });
                }
              }
              
              processedData.forecast = dailyForecasts;
            }
          } catch (forecastError) {
            console.error('Forecast fetch error:', forecastError);
            // Continue without forecast data
          }
        }

        // Cache the result
        setCachedData(cacheKey, processedData);

        res.json({ data: processedData });
      } catch (error) {
        console.error('Weather widget error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
      }
    });

    return { message: 'Weather widget initialized successfully' };
  }
};
