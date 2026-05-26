#!/usr/bin/env node
/**
 * BATCH FETCH ALL ENTITIES
 * Step 1: Gather all slugs, save to file
 * Step 2: Batch-fetch full data locally in chunks
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ENTITIES_DIR = path.join(__dirname, 'data/entities');
const SLUGS_FILE = path.join(__dirname, 'all-slugs.json');
const API_BASE = 'https://cybercheck-api-database.vercel.app/api/gcr';

function fetchAPI(url) {
  return new Promise((resolve) => {
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

async function step1_GatherSlugs() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('Step 1: GATHER ALL SLUGS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const slugs = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const url = `${API_BASE}/entities?limit=${limit}&offset=${offset}`;
    const response = await fetchAPI(url);

    if (!response || !response.entities || response.entities.length === 0) break;

    response.entities.forEach(e => {
      if (e.slug) slugs.push(e.slug);
    });

    console.log(`  Fetched ${slugs.length} slugs...`);

    if (response.entities.length < limit) break;
    offset += limit;
  }

  // Save slugs to file
  fs.writeFileSync(SLUGS_FILE, JSON.stringify(slugs, null, 2));
  console.log(`\n✅ Saved ${slugs.length} slugs to ${SLUGS_FILE}\n`);

  return slugs;
}

async function step2_BatchFetchData(slugs) {
  console.log('Step 2: BATCH FETCH FULL DATA');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const batchSize = 50; // Fetch 50 at a time
  let saved = 0;

  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);

    // Fetch all in this batch in parallel
    const promises = batch.map(slug =>
      fetchAPI(`${API_BASE}/entity/${encodeURIComponent(slug)}`)
        .then(data => ({ slug, data }))
    );

    const results = await Promise.all(promises);

    // Save all results
    for (const { slug, data } of results) {
      if (data) {
        try {
          fs.writeFileSync(
            path.join(ENTITIES_DIR, `${slug}.json`),
            JSON.stringify(data, null, 2)
          );
          saved++;
        } catch (e) {}
      }
    }

    const progress = Math.min(i + batchSize, slugs.length);
    console.log(`  ${progress}/${slugs.length} - Saved: ${saved}`);
  }

  console.log(`\n✅ Saved ${saved} complete entities\n`);
}

async function step3_UpdateIndex() {
  console.log('Step 3: UPDATE INDEX');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

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

  console.log(`✅ Index has ${index.length} entities\n`);
}

async function main() {
  // Check if slugs already saved
  let slugs;
  if (fs.existsSync(SLUGS_FILE)) {
    console.log('Loading existing slugs from file...');
    slugs = JSON.parse(fs.readFileSync(SLUGS_FILE, 'utf8'));
    console.log(`Loaded ${slugs.length} slugs\n`);
  } else {
    slugs = await step1_GatherSlugs();
  }

  await step2_BatchFetchData(slugs);
  await step3_UpdateIndex();

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ BATCH FETCH COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
