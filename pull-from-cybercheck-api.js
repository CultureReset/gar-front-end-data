#!/usr/bin/env node
/**
 * PULL ALL AVAILABLE DATA FROM CYBERCHECK-API
 * Load everything into gcr-front-end-data
 * No filtering, no theory - just get the data
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ENTITIES_DIR = path.join(__dirname, 'data/entities');
const API_BASE = 'https://cybercheck-api-database.vercel.app/api/gcr';

function fetchAPI(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

async function pullFromCybercheck() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📡 PULLING ALL DATA FROM CYBERCHECK-API');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let limit = 500;
  let offset = 0;
  let total = 0;
  let saved = 0;
  let fetched = 0;

  // Fetch all entities in batches
  while (true) {
    console.log(`Fetching batch: offset ${offset}, limit ${limit}...`);

    const url = `${API_BASE}/entities?limit=${limit}&offset=${offset}`;
    const response = await fetchAPI(url);

    if (!response || !response.entities || response.entities.length === 0) {
      console.log(`No more entities at offset ${offset}\n`);
      break;
    }

    const entities = response.entities;
    total = response.total || entities.length;
    fetched += entities.length;

    // For each entity, fetch full data and save
    for (const entity of entities) {
      const slug = entity.slug || slugify(entity.name);

      // Get full entity data
      const fullUrl = `${API_BASE}/entity/${encodeURIComponent(slug)}`;
      const fullData = await fetchAPI(fullUrl);

      if (fullData && fullData.entity) {
        try {
          const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
          fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2));
          saved++;
        } catch (e) {
          console.error(`Error saving ${slug}: ${e.message}`);
        }
      }

      if (saved % 50 === 0 && saved > 0) {
        console.log(`  Saved ${saved} entities...`);
      }
    }

    offset += limit;

    // Stop if we've fetched enough or reached total
    if (fetched >= (total || 500)) break;
  }

  console.log(`\n✅ PULL COMPLETE`);
  console.log(`   Total entities fetched: ${fetched}`);
  console.log(`   Saved: ${saved}\n`);

  // Update index
  console.log('📝 Updating index...\n');

  const files = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  const index = [];

  for (const file of files) {
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      const e = entity.entity || entity;

      if (!e.name) continue;

      index.push({
        slug: e.slug || file.replace('.json', ''),
        name: e.name,
        entity_type: e.entity_type || 'Other',
        entity_subtype: e.entity_subtype || '',
        city: e.city || '',
        hero_image_url: e.hero_image_url || '',
        rating: e.rating || 0,
        tags: e.tags || [],
        featured: e.featured || false
      });
    } catch (e) {}
  }

  fs.writeFileSync(
    path.join(__dirname, 'data/entities-index.json'),
    JSON.stringify(index, null, 2)
  );

  console.log(`✅ Index updated with ${index.length} entities\n`);
}

pullFromCybercheck().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
