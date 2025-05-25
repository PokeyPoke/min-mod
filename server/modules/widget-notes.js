/**
 * server/modules/widget-notes.js - Secure notes widget module
 */

const notesModule = {
  name: 'Notes Widget',
  version: '2.0.0',
  category: 'tools',
  priority: 50,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app } = context;

    app.get('/api/widget/notes', async (req, res) => {
      try {
        const { 
          content = '', 
          title = 'Notes',
          fontSize = 'normal',
          lineHeight = 'normal',
          showWordCount = 'true',
          autoSave = 'true'
        } = req.query;
        
        // Input validation and sanitization
        if (typeof title !== 'string' || title.length > 100) {
          return res.status(400).json({ error: 'Invalid title parameter' });
        }

        if (typeof content !== 'string' || content.length > 10000) {
          return res.status(400).json({ error: 'Content too long (max 10000 characters)' });
        }

        const processedData = {
          title: title.trim(),
          content: content.trim(),
          fontSize: ['small', 'normal', 'large'].includes(fontSize) ? fontSize : 'normal',
          lineHeight: ['compact', 'normal', 'relaxed'].includes(lineHeight) ? lineHeight : 'normal',
          showWordCount: showWordCount === 'true',
          autoSave: autoSave === 'true',
          lastUpdated: new Date().toISOString()
        };

        res.json({ data: processedData });
      } catch (error) {
        console.error('Notes widget error:', error);
        res.status(500).json({ error: 'Failed to process notes data' });
      }
    });

    return { message: 'Notes widget initialized successfully' };
  }
};
