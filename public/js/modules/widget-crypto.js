/**
 * server/modules/widget-crypto.js - Updated crypto widget with standardized configuration
 */

const fetch = require('node-fetch');
const { configManager } = require('./config-manager');

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
        // Get and validate configuration using config manager
        const rawConfig = {
          coin: req.query.coin,
          currency: req.query.currency,
          detailLevel: req.query.detailLevel,
          showChart: req.query.showChart,
          chartPeriod: req.query.chartPeriod
        };

        // Sanitize and validate configuration
        const config = configManager.sanitizeConfig('crypto', rawConfig);
        const validation = configManager.validateConfig('crypto', config);

        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Invalid configuration',
            details: validation.errors
          });
        }

        // Use validated config values
        const { 
          coin = 'bitcoin', 
          currency = 'usd', 
          detailLevel = 'compact',
          showChart = false,
          chartPeriod = '7d'
        } = config;

        // Sanitize coin input for security
        const sanitizedCoin = coin.toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Check cache first
        const cacheKey = getCacheKey('crypto', { 
          coin: sanitizedCoin, 
          currency, 
          detailLevel,
          showChart,
          chartPeriod
        });
        
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return res.json({ data: cachedData });
        }

        // Fetch crypto data from CoinGecko API (free, no API key required)
        const cryptoData = await fetchCryptoData(sanitizedCoin, currency, detailLevel, showChart, chartPeriod);

        // Cache the result (2 minutes for crypto data due to volatility)
        setCachedData(cacheKey, cryptoData, 120);

        res.json({ data: cryptoData });

      } catch (error) {
        console.error('Crypto widget error:', error);
        res.status(500).json({ error: 'Failed to fetch cryptocurrency data' });
      }
    });

    // Configuration endpoint
    app.get('/api/widget/crypto/config', (req, res) => {
      try {
        const schema = configManager.getModuleSchema('crypto');
        const defaultConfig = configManager.getDefaultConfig('crypto');
        
        res.json({
          schema: schema.schema,
          presets: schema.presets,
          categories: schema.categories,
          tags: schema.tags,
          defaultConfig,
          capabilities: {
            realTimeData: true,
            historicalData: true,
            charts: true,
            multiCurrency: true,
            freeAPI: true
          }
        });
      } catch (error) {
        console.error('Crypto config error:', error);
        res.status(500).json({ error: 'Failed to get crypto configuration' });
      }
    });

    // Cryptocurrency search endpoint for configuration
    app.get('/api/widget/crypto/search', async (req, res) => {
      try {
        const { q: query } = req.query;
        
        if (!query || query.length < 2) {
          return res.json({ coins: [] });
        }

        // Search CoinGecko for cryptocurrencies
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
        
        const response = await fetch(searchUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Dashboard-App/2.0',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Search API error: ${response.status}`);
        }

        const searchData = await response.json();
        
        // Format search results
        const coins = searchData.coins?.slice(0, 10).map(coin => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol?.toUpperCase(),
          thumb: coin.thumb,
          market_cap_rank: coin.market_cap_rank,
          displayName: `${coin.name} (${coin.symbol?.toUpperCase()})`
        })) || [];

        res.json({ coins });

      } catch (error) {
        console.error('Crypto search error:', error);
        
        // Fallback to popular cryptocurrencies
        const popularCoins = [
          { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', market_cap_rank: 1 },
          { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', market_cap_rank: 2 },
          { id: 'binancecoin', name: 'BNB', symbol: 'BNB', market_cap_rank: 3 },
          { id: 'solana', name: 'Solana', symbol: 'SOL', market_cap_rank: 4 },
          { id: 'ripple', name: 'XRP', symbol: 'XRP', market_cap_rank: 5 },
          { id: 'cardano', name: 'Cardano', symbol: 'ADA', market_cap_rank: 6 },
          { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', market_cap_rank: 7 },
          { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', market_cap_rank: 8 },
          { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', market_cap_rank: 9 },
          { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', market_cap_rank: 10 }
        ];

        const queryLower = query.toLowerCase();
        const filteredCoins = popularCoins
          .filter(coin => 
            coin.name.toLowerCase().includes(queryLower) ||
            coin.symbol.toLowerCase().includes(queryLower) ||
            coin.id.includes(queryLower)
          )
          .map(coin => ({
            ...coin,
            displayName: `${coin.name} (${coin.symbol})`
          }));

        res.json({ coins: filteredCoins, fallback: true });
      }
    });

    return { message: 'Crypto widget initialized successfully with standardized configuration' };
  }
};

/**
 * Fetch cryptocurrency data from CoinGecko API
 */
async function fetchCryptoData(coin, currency, detailLevel, showChart, chartPeriod) {
  try {
    // Fetch basic coin data
    const includeParams = detailLevel === 'expanded' 
      ? 'market_data,developer_data,community_data' 
      : 'market_data';
      
    const coinUrl = `https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&community_data=${detailLevel === 'expanded'}&developer_data=${detailLevel === 'expanded'}&sparkline=false`;
    
    const response = await fetch(coinUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Dashboard-App/2.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Cryptocurrency not found');
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const coinData = await response.json();
    const marketData = coinData.market_data;

    // Process basic cryptocurrency data
    const processedData = {
      coin: coin,
      id: coinData.id,
      name: coinData.name,
      symbol: coinData.symbol?.toUpperCase(),
      rank: coinData.market_cap_rank,
      price: marketData?.current_price?.[currency],
      change24h: parseFloat(marketData?.price_change_percentage_24h?.toFixed(2)),
      change7d: parseFloat(marketData?.price_change_percentage_7d?.toFixed(2)),
      change30d: parseFloat(marketData?.price_change_percentage_30d?.toFixed(2)),
      change1y: parseFloat(marketData?.price_change_percentage_1y?.toFixed(2)),
      marketCap: marketData?.market_cap?.[currency],
      volume24h: marketData?.total_volume?.[currency],
      circulatingSupply: marketData?.circulating_supply,
      totalSupply: marketData?.total_supply,
      maxSupply: marketData?.max_supply,
      currency: currency,
      lastUpdated: marketData?.last_updated || new Date().toISOString(),
      source: 'coingecko'
    };

    // Add additional data for normal and expanded detail levels
    if (detailLevel === 'normal' || detailLevel === 'expanded') {
      processedData.ath = marketData?.ath?.[currency];
      processedData.athDate = marketData?.ath_date?.[currency];
      processedData.athChangePercentage = parseFloat(marketData?.ath_change_percentage?.[currency]?.toFixed(2));
      processedData.atl = marketData?.atl?.[currency];
      processedData.atlDate = marketData?.atl_date?.[currency];
      processedData.atlChangePercentage = parseFloat(marketData?.atl_change_percentage?.[currency]?.toFixed(2));
    }

    // Add expanded data for expanded detail level
    if (detailLevel === 'expanded') {
      processedData.marketCapRank = coinData.market_cap_rank;
      processedData.fullyDilutedValuation = marketData?.fully_diluted_valuation?.[currency];
      processedData.priceChange24h = marketData?.price_change_24h_in_currency?.[currency];
      processedData.marketCapChange24h = marketData?.market_cap_change_24h_in_currency?.[currency];
      processedData.marketCapChangePercentage24h = parseFloat(marketData?.market_cap_change_percentage_24h?.toFixed(2));
      
      // Add community and developer data if available
      if (coinData.community_data) {
        processedData.communityData = {
          facebookLikes: coinData.community_data.facebook_likes,
          twitterFollowers: coinData.community_data.twitter_followers,
          redditSubscribers: coinData.community_data.reddit_subscribers,
          telegramChannelUserCount: coinData.community_data.telegram_channel_user_count
        };
      }

      if (coinData.developer_data) {
        processedData.developerData = {
          forks: coinData.developer_data.forks,
          stars: coinData.developer_data.stars,
          subscribers: coinData.developer_data.subscribers,
          totalIssues: coinData.developer_data.total_issues,
          closedIssues: coinData.developer_data.closed_issues,
          pullRequestsMerged: coinData.developer_data.pull_requests_merged,
          pullRequestContributors: coinData.developer_data.pull_request_contributors
        };
      }
    }

    // Add chart data if requested
    if (showChart && (detailLevel === 'normal' || detailLevel === 'expanded')) {
      try {
        const chartData = await fetchChartData(coin, currency, chartPeriod);
        processedData.chartData = chartData;
      } catch (chartError) {
        console.warn('Failed to fetch chart data:', chartError);
        // Continue without chart data
      }
    }

    return processedData;

  } catch (error) {
    console.error('Crypto data fetch error:', error);
    throw error;
  }
}

/**
 * Fetch chart data for cryptocurrency
 */
async function fetchChartData(coin, currency, period) {
  const daysMap = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
    '1y': 365
  };

  const days = daysMap[period] || 7;
  const chartUrl = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${currency}&days=${days}&interval=${days > 30 ? 'daily' : 'hourly'}`;

  const response = await fetch(chartUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Dashboard-App/2.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Chart API error: ${response.status}`);
  }

  const chartData = await response.json();

  // Process chart data
  const processedChart = {
    period: period,
    currency: currency,
    prices: chartData.prices?.map(([timestamp, price]) => ({
      timestamp: new Date(timestamp).toISOString(),
      price: parseFloat(price.toFixed(8))
    })) || [],
    volumes: chartData.total_volumes?.map(([timestamp, volume]) => ({
      timestamp: new Date(timestamp).toISOString(),
      volume: parseFloat(volume.toFixed(2))
    })) || [],
    marketCaps: chartData.market_caps?.map(([timestamp, marketCap]) => ({
      timestamp: new Date(timestamp).toISOString(),
      marketCap: parseFloat(marketCap.toFixed(2))
    })) || []
  };

  // Calculate additional metrics
  if (processedChart.prices.length > 0) {
    const prices = processedChart.prices.map(p => p.price);
    processedChart.high = Math.max(...prices);
    processedChart.low = Math.min(...prices);
    processedChart.priceChange = prices[prices.length - 1] - prices[0];
    processedChart.priceChangePercentage = ((processedChart.priceChange / prices[0]) * 100).toFixed(2);
  }

  return processedChart;
}

module.exports = cryptoModule;
