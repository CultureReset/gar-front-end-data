const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA = path.join(__dirname, '../data');
const ENTITIES_DIR  = path.join(DATA, 'entities');
const MENUS_DIR     = path.join(DATA, 'menus');
const HOURS_DIR     = path.join(DATA, 'hours');
const PHOTOS_DIR    = path.join(DATA, 'photos');
const OFFERS_DIR    = path.join(DATA, 'offers');
const INFO_DIR      = path.join(DATA, 'info');
const ABOUT_DIR     = path.join(DATA, 'about');
const AMENITIES_DIR = path.join(DATA, 'amenities');

// Cache headers — Vercel CDN caches for 5 min, serves stale up to 1hr
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  }
  next();
});

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readDataFile(name) {
  return readJSON(path.join(DATA, name)) || [];
}

function readEntity(slug) {
  return readJSON(path.join(ENTITIES_DIR, `${slug}.json`));
}

function getAllEntities() {
  return readDataFile('entities-index.json');
}

// ── GET /api/gcr/entities ──────────────────────────────────────────
router.get('/entities', (req, res) => {
  let entities = getAllEntities();

  // Filters
  if (req.query.type || req.query.category) {
    const cat = (req.query.type || req.query.category).toLowerCase();
    entities = entities.filter(e =>
      (e.entity_type || '').toLowerCase() === cat ||
      (e.entity_subtype || '').toLowerCase() === cat
    );
  }
  if (req.query.search) {
    const q = req.query.search.toLowerCase();
    entities = entities.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.entity_type || '').toLowerCase().includes(q) ||
      (e.city || '').toLowerCase().includes(q)
    );
  }
  if (req.query.featured === 'true') {
    entities = entities.filter(e => e.featured);
  }

  const limit = Math.min(parseInt(req.query.limit) || 1000, 1000);
  const offset = parseInt(req.query.offset) || 0;
  const paged = entities.slice(offset, offset + limit);

  res.json({ entities: paged, businesses: paged, total: entities.length });
});

// ── GET /api/gcr/entity/:slug ──────────────────────────────────────
router.get('/entity/:slug', (req, res) => {
  const entity = readEntity(req.params.slug);
  if (!entity) return res.status(404).json({ error: 'Entity not found' });
  res.json({ entity, business: entity });
});

// ── GET /api/gcr/entities/:slug (alternate route) ──────────────────
router.get('/entities/:slug', (req, res) => {
  const entity = readEntity(req.params.slug);
  if (!entity) return res.status(404).json({ error: 'Entity not found' });
  res.json({ entity, business: entity });
});

// ── GET /api/gcr/events ────────────────────────────────────────────
router.get('/events', (req, res) => {
  let events = readDataFile('events.json');
  if (req.query.slug) {
    events = events.filter(e =>
      e.entity_slug === req.query.slug || (e.entity && e.entity.slug === req.query.slug)
    );
  }
  if (req.query.upcoming === 'true') {
    const now = new Date().toISOString();
    events = events.filter(e => e.event_date >= now);
  }
  res.json(events);
});

// ── GET /api/gcr/specials ──────────────────────────────────────────
router.get('/specials', (req, res) => {
  let specials = readDataFile('specials.json');
  if (req.query.slug) {
    specials = specials.filter(s => s.entity_slug === req.query.slug || s.slug === req.query.slug);
  }
  res.json(specials);
});

// ── GET /api/gcr/happy-hours ───────────────────────────────────────
router.get('/happy-hours', (req, res) => {
  let hh = readDataFile('happy-hours.json');
  if (req.query.slug) {
    hh = hh.filter(h => h.entity_slug === req.query.slug || h.slug === req.query.slug);
  }
  res.json(hh);
});

// ── POST /api/gcr/search ───────────────────────────────────────────
router.post('/search', (req, res) => {
  const { query, category, limit: lim = 50 } = req.body;
  let entities = getAllEntities();

  if (query) {
    const q = query.toLowerCase();
    entities = entities.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.entity_type || '').toLowerCase().includes(q) ||
      (e.city || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (category) {
    entities = entities.filter(e =>
      (e.entity_type || '').toLowerCase() === category.toLowerCase() ||
      (e.entity_subtype || '').toLowerCase() === category.toLowerCase()
    );
  }

  const results = entities.slice(0, lim);
  res.json({ results, businesses: results, total: results.length });
});

// ── GET /api/gcr/settings/:key ─────────────────────────────────────
router.get('/settings/:key', (req, res) => {
  const settings = readDataFile('settings.json');
  const value = settings[req.params.key] || null;
  res.json({ key: req.params.key, value });
});

// ── GET /api/gcr/entity/:slug/menu ────────────────────────────────
router.get('/entity/:slug/menu', (req, res) => {
  const data = readJSON(path.join(MENUS_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/hours ───────────────────────────────
router.get('/entity/:slug/hours', (req, res) => {
  const data = readJSON(path.join(HOURS_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/photos ──────────────────────────────
router.get('/entity/:slug/photos', (req, res) => {
  const data = readJSON(path.join(PHOTOS_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/offers ──────────────────────────────
router.get('/entity/:slug/offers', (req, res) => {
  const data = readJSON(path.join(OFFERS_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/info ────────────────────────────────
router.get('/entity/:slug/info', (req, res) => {
  const data = readJSON(path.join(INFO_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/about ───────────────────────────────
router.get('/entity/:slug/about', (req, res) => {
  const data = readJSON(path.join(ABOUT_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── GET /api/gcr/entity/:slug/amenities ───────────────────────────
router.get('/entity/:slug/amenities', (req, res) => {
  const data = readJSON(path.join(AMENITIES_DIR, `${req.params.slug}.json`));
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// ── POST /api/gcr/track ────────────────────────────────────────────
router.post('/track', (req, res) => {
  // Tracking — accept and ignore (analytics handled separately)
  res.json({ ok: true });
});

module.exports = router;
