/**
 * server/modules/widget-countdown.js - Secure countdown widget module
 */

const countdownModule = {
  name: 'Countdown Widget',
  version: '2.0.0',
  category: 'tools',
  priority: 40,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app } = context;

    app.get('/api/widget/countdown', async (req, res) => {
      try {
        const { 
          title = 'Countdown', 
          targetDate = '2025-12-31T00:00:00',
          timezone = 'UTC',
          showProgress = 'true',
          alertDays = '7'
        } = req.query;
        
        // Input validation
        if (!title || typeof title !== 'string' || title.length > 100) {
          return res.status(400).json({ error: 'Invalid title parameter' });
        }

        // Validate and parse target date
        const target = new Date(targetDate);
        if (isNaN(target.getTime())) {
          return res.status(400).json({ error: 'Invalid target date' });
        }

        // Ensure target date is in the future
        if (target <= new Date()) {
          return res.json({
            data: {
              title: title.trim(),
              targetDate: target.toISOString(),
              completed: true,
              timezone: timezone
            }
          });
        }

        const processedData = {
          title: title.trim(),
          targetDate: target.toISOString(),
          timezone: timezone,
          showProgress: showProgress === 'true',
          alertDays: Math.max(0, Math.min(365, parseInt(alertDays) || 7)),
          completed: false,
          lastUpdated: new Date().toISOString()
        };

        res.json({ data: processedData });
      } catch (error) {
        console.error('Countdown widget error:', error);
        res.status(500).json({ error: 'Failed to process countdown data' });
      }
    });

    return { message: 'Countdown widget initialized successfully' };
  }
};
