const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value) {
  cache.set(key, {
    value,
    expires: Date.now() + CACHE_TTL
  });
}

app.use(cors());
app.use(express.json());

// Make cache available to routes
app.getCache = getCache;
app.setCache = setCache;

// Cache invalidation endpoint
app.post('/api/cache/clear', (req, res) => {
  cache.clear();
  res.json({ message: 'Cache cleared', size: cache.size });
});

app.use('/api/gcr', require('./routes/gcr'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/businesses', require('./routes/admin'));
app.use('/api/gcr/menu-editor-data', require('./routes/admin'));
app.use('/api/gcr/menu-editor-save', require('./routes/admin'));

app.get('/', (req, res) => res.json({ status: 'gcr-front-end-data running' }));

app.listen(PORT, () => console.log(`gcr-front-end-data running on port ${PORT}`));
module.exports = app;
