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

// ── POST /api/admin/parse-data ────────────────────────────────────
// Parse raw unstructured data and return structured business fields
router.post('/parse-data', async (req, res) => {
  try {
    const { rawData, currentBusiness } = req.body;
    if (!rawData) return res.status(400).json({ error: 'rawData required' });

    // Try to use Claude API if key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.json({ parsed: null, message: 'Claude API key not configured' });
    }

    const prompt = `You are a business data extraction expert. Parse this raw business data and extract structured information.

Raw data:
${rawData}

Current business (if any):
${JSON.stringify(currentBusiness, null, 2)}

Extract and return ONLY a valid JSON object with these fields (use null for missing data):
{
  "name": "business name",
  "phone": "phone number",
  "email": "email address",
  "website_url": "website URL",
  "address_line_1": "street address",
  "city": "city name",
  "state": "state",
  "zip": "zip code",
  "entity_type": "restaurant/bar/shopping/etc",
  "rating": 0-5,
  "description": "business description",
  "hours": [{"day":"Mon","open":"10am","close":"10pm"}],
  "amenities": ["amenity1", "amenity2"]
}

Return ONLY the JSON, no markdown or explanation.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return res.json({ parsed: null, error: 'Claude API failed' });
    }

    const result = await response.json();
    const content = result.content[0]?.text || '';

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ parsed: null, message: 'Could not parse Claude response' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Clean up the parsed data
    const cleaned = {};
    Object.keys(parsed).forEach(key => {
      const val = parsed[key];
      if (val !== null && val !== undefined && val !== '') {
        cleaned[key] = val;
      }
    });

    res.json({ parsed: cleaned });
  } catch (e) {
    console.error('Parse error:', e.message);
    res.json({ parsed: null, error: e.message });
  }
});

module.exports = router;
