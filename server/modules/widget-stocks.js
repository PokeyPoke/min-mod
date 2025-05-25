/**
 * server/modules/widget-stocks.js - Secure stocks widget module
 */

const stocksModule = {
  name: 'Stocks Widget',
  version: '2.0.0',
  category: 'data',
  priority: 30,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app, getCachedData, setCachedData, getCacheKey } = context;

    app.get('/api/widget/stocks', async (req, res) => {
      try {
        const { symbol = 'AAPL', detailLevel = 'compact' } = req.query;
        
        // Input validation
        if (!symbol || typeof symbol !== 'string' || symbol.length > 10) {
          return res.status(400).json({ error: 'Invalid symbol parameter' });
        }

        // Sanitize symbol input
        const sanitizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');

        // Check cache first
        const cacheKey = getCacheKey('stocks', { symbol: sanitizedSymbol });
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return res.json({ data: cachedData });
        }

        let stockData = null;

        // Try AlphaVantage if API key is available
        if (process.env.ALPHAVANTAGE_API_KEY) {
          try {
            const alphaUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sanitizedSymbol}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`;
            
            const response = await fetch(alphaUrl, {
              timeout: 10000,
              headers: { 'User-Agent': 'Dashboard-App/2.0' }
            });

            if (response.ok) {
              const data = await response.json();
              const quote = data['Global Quote'];
              
              if (quote && quote['01. symbol']) {
                stockData = {
                  symbol: quote['01. symbol'],
                  price: parseFloat(quote['05. price']),
                  change: parseFloat(quote['09. change']),
                  changePercent: quote['10. change percent'].replace('%', ''),
                  volume: parseInt(quote['06. volume']),
                  previousClose: parseFloat(quote['08. previous close']),
                  open: parseFloat(quote['02. open']),
                  high: parseFloat(quote['03. high']),
                  low: parseFloat(quote['04. low']),
                  lastUpdated: quote['07. latest trading day']
                };
              }
            }
          } catch (alphaError) {
            console.error('AlphaVantage API error:', alphaError);
          }
        }

        // Fallback to Finnhub if available
        if (!stockData && process.env.FINNHUB_API_KEY) {
          try {
            const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${sanitizedSymbol}&token=${process.env.FINNHUB_API_KEY}`;
            
            const response = await fetch(finnhubUrl, {
              timeout: 10000,
              headers: { 'User-Agent': 'Dashboard-App/2.0' }
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.c && data.c > 0) {
                stockData = {
                  symbol: sanitizedSymbol,
                  price: data.c,
                  change: data.d,
                  changePercent: data.dp?.toFixed(2),
                  previousClose: data.pc,
                  open: data.o,
                  high: data.h,
                  low: data.l,
                  lastUpdated: new Date().toISOString()
                };
              }
            }
          } catch (finnhubError) {
            console.error('Finnhub API error:', finnhubError);
          }
        }

        // Final fallback with mock data structure (for demo purposes)
        if (!stockData) {
          console.warn(`No stock API configured or data unavailable for ${sanitizedSymbol}`);
          return res.status(400).json({ 
            error: 'Stock data service not configured. Please configure ALPHAVANTAGE_API_KEY or FINNHUB_API_KEY in environment variables.' 
          });
        }

        // Cache the result
        setCachedData(cacheKey, stockData);

        res.json({ data: stockData });
      } catch (error) {
        console.error('Stocks widget error:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
      }
    });

    return { message: 'Stocks widget initialized successfully' };
  }
};
