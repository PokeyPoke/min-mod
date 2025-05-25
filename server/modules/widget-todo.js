/**
 * server/modules/widget-todo.js - Secure todo widget module
 */

const todoModule = {
  name: 'Todo Widget',
  version: '2.0.0',
  category: 'tools',
  priority: 60,
  dependencies: [],
  enabled: true,

  async initialize(context) {
    const { app } = context;

    app.get('/api/widget/todo', async (req, res) => {
      try {
        const { 
          title = 'To-Do List',
          items = '[]',
          showCompleted = 'true',
          maxItems = '10',
          sortBy = 'newest',
          enablePriorities = 'false'
        } = req.query;
        
        // Input validation
        if (typeof title !== 'string' || title.length > 100) {
          return res.status(400).json({ error: 'Invalid title parameter' });
        }

        // Parse and validate items
        let todoItems = [];
        try {
          const parsedItems = JSON.parse(items);
          if (Array.isArray(parsedItems)) {
            todoItems = parsedItems.slice(0, 50).map((item, index) => ({
              id: item.id || `item-${index}`,
              text: typeof item.text === 'string' ? item.text.substring(0, 200) : '',
              completed: Boolean(item.completed),
              createdAt: item.createdAt || new Date().toISOString(),
              priority: ['normal', 'high', 'urgent'].includes(item.priority) ? item.priority : 'normal'
            }));
          }
        } catch (parseError) {
          // Use empty array if parsing fails
        }

        const processedData = {
          title: title.trim(),
          items: todoItems,
          showCompleted: showCompleted === 'true',
          maxItems: Math.max(1, Math.min(50, parseInt(maxItems) || 10)),
          sortBy: ['newest', 'oldest', 'alphabetical', 'priority'].includes(sortBy) ? sortBy : 'newest',
          enablePriorities: enablePriorities === 'true',
          lastUpdated: new Date().toISOString()
        };

        res.json({ data: processedData });
      } catch (error) {
        console.error('Todo widget error:', error);
        res.status(500).json({ error: 'Failed to process todo data' });
      }
    });

    return { message: 'Todo widget initialized successfully' };
  }
};
