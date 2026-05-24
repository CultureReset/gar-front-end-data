const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA = path.join(__dirname, '../data');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function slugFile(dir, slug) {
  return path.join(DATA, dir, `${slug}.json`);
}

// Auth
function auth(req, res, next) {
  const KEY = process.env.GCR_WRITE_KEY;
  if (!KEY) return next();
  const k = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (k !== KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── GET /api/admin/businesses ─────────────────────────────────────
// List all businesses (admin view)
router.get('/businesses', auth, (req, res) => {
  const index = readJSON(path.join(DATA, 'entities-index.json')) || [];
  res.json({ businesses: index, total: index.length });
});

// ── GET /api/businesses/:id ───────────────────────────────────────
router.get('/businesses/:id', (req, res) => {
  const entity = readJSON(slugFile('entities', req.params.id));
  if (!entity) return res.status(404).json({ error: 'Not found' });
  res.json({ business: entity, entity });
});

// ── POST /api/businesses ──────────────────────────────────────────
router.post('/businesses', auth, (req, res) => {
  const slug = req.body.slug || req.body.subdomain || req.body.id;
  if (!slug) return res.status(400).json({ error: 'slug required' });
  writeJSON(slugFile('entities', slug), { ...req.body, slug });
  res.json({ ok: true, slug });
});

// ── PUT/PATCH /api/businesses/:id ─────────────────────────────────
router.put('/businesses/:id', auth, (req, res) => updateBusiness(req, res));
router.patch('/businesses/:id', auth, (req, res) => updateBusiness(req, res));

function updateBusiness(req, res) {
  const slug = req.params.id;
  const existing = readJSON(slugFile('entities', slug)) || {};
  const updated = { ...existing, ...req.body, slug };
  writeJSON(slugFile('entities', slug), updated);

  // Also update index entry
  const indexPath = path.join(DATA, 'entities-index.json');
  const index = readJSON(indexPath) || [];
  const i = index.findIndex(e => e.slug === slug);
  if (i >= 0) {
    index[i] = { ...index[i], ...req.body, slug };
    writeJSON(indexPath, index);
  }

  res.json({ ok: true, business: updated });
}

// ── PATCH /api/businesses/:id/status ─────────────────────────────
router.patch('/businesses/:id/status', auth, (req, res) => {
  const slug = req.params.id;
  const existing = readJSON(slugFile('entities', slug)) || {};
  const updated = { ...existing, ...req.body, slug };
  writeJSON(slugFile('entities', slug), updated);
  res.json({ ok: true });
});

// ── Menu editor endpoints ─────────────────────────────────────────
router.get('/menu-editor-data', (req, res) => {
  const slug = req.query.slug || req.query.site_id;
  if (!slug) return res.status(400).json({ error: 'slug required' });
  const entity = readJSON(slugFile('entities', slug)) || {};
  const menu   = readJSON(slugFile('menus', slug)) || {};
  const hours  = readJSON(slugFile('hours', slug)) || {};
  res.json({ entity, ...menu, ...hours });
});

router.post('/menu-editor-save', auth, (req, res) => {
  const slug = req.body.slug || req.body.site_id;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  if (req.body.menu_sections || req.body.drink_sections || req.body.happy_hour_sections) {
    const existing = readJSON(slugFile('menus', slug)) || {};
    writeJSON(slugFile('menus', slug), {
      ...existing,
      slug,
      menu_sections:       req.body.menu_sections       || existing.menu_sections || [],
      drink_sections:      req.body.drink_sections      || existing.drink_sections || [],
      happy_hour_sections: req.body.happy_hour_sections || existing.happy_hour_sections || [],
    });
  }

  if (req.body.hours) {
    const existing = readJSON(slugFile('hours', slug)) || {};
    writeJSON(slugFile('hours', slug), { ...existing, slug, hours: req.body.hours });
  }

  res.json({ ok: true, slug });
});

// ── AI admin scrape/settings ──────────────────────────────────────
router.get('/ai-settings', auth, (req, res) => {
  res.json({ model: 'claude-opus-4-7', enabled: true });
});

module.exports = router;
