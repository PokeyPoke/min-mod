/**
 * server/modules/widget-crypto.js - Secure cryptocurrency widget module
 */

const cryptoModule = {
  name: 'Crypto Widget',
  version: '2.0.0',
  category: 'data',
  priority: 20,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app, getCachedData, setCachedData, getCacheKey } = context;

    app.get('/api/widget/crypto', async (req, res) => {
      try {
        const { coin = 'bitcoin', currency = 'usd', detailLevel = 'compact' } = req.query;
        
        // Input validation
        if (!coin || typeof coin !== 'string' || coin.length > 50) {
          return res.status(400).json({ error: 'Invalid coin parameter' });
        }

        if (!['usd', 'eur', 'btc', 'eth'].includes(currency)) {
          return res.status(400).json({ error: 'Invalid currency parameter' });
        }

        // Sanitize coin input
        const sanitizedCoin = coin.toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Check cache first
        const cacheKey = getCacheKey('crypto', { coin: sanitizedCoin, currency });
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return res.json({ data: cachedData });
        }

        // Use CoinGecko API (free, no API key required)
        const includeParams = detailLevel === 'expanded' 
          ? 'market_data,developer_data,community_data' 
          : 'market_data';
          
        const cryptoUrl = `https://api.coingecko.com/api/v3/coins/${sanitizedCoin}?localization=false&tickers=false&community_data=${detailLevel === 'expanded'}&developer_data=${detailLevel === 'expanded'}&sparkline=false`;
        
        const response = await fetch(cryptoUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Dashboard-App/2.0',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(400).json({ error: 'Cryptocurrency not found' });
          }
          throw new Error(`Crypto API error: ${response.status}`);
        }

        const cryptoData = await response.json();
        const marketData = cryptoData.market_data;

        // Process and sanitize crypto data
        const processedData = {
          coin: sanitizedCoin,
          name: cryptoData.name,
          symbol: cryptoData.symbol?.toUpperCase(),
          rank: cryptoData.market_cap_rank,
          price: marketData?.current_price?.[currency],
          change24h: marketData?.price_change_percentage_24h?.toFixed(2),
          change7d: marketData?.price_change_percentage_7d?.toFixed(2),
          change30d: marketData?.price_change_percentage_30d?.toFixed(2),
          change1y: marketData?.price_change_percentage_1y?.toFixed(2),
          marketCap: marketData?.market_cap?.[currency],
          volume24h: marketData?.total_volume?.[currency],
          circulatingSupply: marketData?.circulating_supply,
          totalSupply: marketData?.total_supply,
          maxSupply: marketData?.max_supply,
          ath: marketData?.ath?.[currency],
          athDate: marketData?.ath_date?.[currency],
          athChangePercentage: marketData?.ath_change_percentage?.[currency]?.toFixed(2),
          currency: currency,
          lastUpdated: marketData?.last_updated || new Date().toISOString()
        };

        // Add performance data for expanded view
        if (detailLevel === 'expanded') {
          processedData.priceChange7d = processedData.change7d;
          processedData.priceChange30d = processedData.change30d;
          processedData.priceChange1y = processedData.change1y;
        }

        // Cache the result
        setCachedData(cacheKey, processedData);

        res.json({ data: processedData });
      } catch (error) {
        console.error('Crypto widget error:', error);
        res.status(500).json({ error: 'Failed to fetch cryptocurrency data' });
      }
    });

    return { message: 'Crypto widget initialized successfully' };
  }
};
