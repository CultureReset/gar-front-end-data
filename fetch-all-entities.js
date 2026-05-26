#!/usr/bin/env node
/**
 * FETCH ALL ENTITIES FROM CYBERCHECK-API
 * Get every single entity's FULL data
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
    }).on('error', () => resolve(null));
  });
}

async function fetchAllEntities() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📡 FETCHING ALL ENTITY DATA FROM CYBERCHECK-API');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let limit = 500;
  let offset = 0;
  let totalFetched = 0;
  let saved = 0;
  let slugs = [];

  // Step 1: Get all entity slugs
  console.log('Step 1: Getting all entity slugs...\n');

  while (true) {
    const url = `${API_BASE}/entities?limit=${limit}&offset=${offset}`;
    const response = await fetchAPI(url);

    if (!response || !response.entities || response.entities.length === 0) {
      break;
    }

    response.entities.forEach(e => {
      if (e.slug) slugs.push(e.slug);
    });

    totalFetched += response.entities.length;
    console.log(`  Fetched ${totalFetched} slugs...`);

    if (response.entities.length < limit) break;
    offset += limit;
  }

  console.log(`✅ Got ${slugs.length} slugs\n`);

  // Step 2: Fetch full data for each slug
  console.log('Step 2: Fetching full data for each entity...\n');

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const url = `${API_BASE}/entity/${encodeURIComponent(slug)}`;
    const fullData = await fetchAPI(url);

    if (fullData) {
      try {
        const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
        fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2));
        saved++;
      } catch (e) {}
    }

    if ((i + 1) % 100 === 0) {
      console.log(`   ${i + 1}/${slugs.length} - Saved: ${saved}`);
    }
  }

  console.log(`\n✅ FETCHED & SAVED ${saved} complete entities\n`);

  // Step 3: Update index
  console.log('Step 3: Updating index...\n');

  const files = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  const index = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      const entity = data.entity || data;

      if (!entity.name) continue;

      index.push({
        slug: entity.slug || file.replace('.json', ''),
        name: entity.name,
        entity_type: entity.entity_type || 'Other',
        entity_subtype: entity.entity_subtype || '',
        city: entity.city || '',
        hero_image_url: entity.hero_image_url || '',
        rating: entity.rating || 0,
        tags: entity.tags || [],
        featured: entity.featured || false
      });
    } catch (e) {}
  }

  fs.writeFileSync(
    path.join(__dirname, 'data/entities-index.json'),
    JSON.stringify(index, null, 2)
  );

  console.log(`═══════════════════════════════════════════════════════════════════════`);
  console.log(`✅ COMPLETE - Index has ${index.length} entities`);
  console.log(`═══════════════════════════════════════════════════════════════════════\n`);
}

fetchAllEntities().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
