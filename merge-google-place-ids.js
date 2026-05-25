#!/usr/bin/env node
/**
 * Merge Google Place IDs from CYBERCHECK-APP-STORE CSV into gar-front-end-data
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PLACE_IDS_FILE = '/Users/owner/CYBERCHECK-APP-STORE/systems-os/gcr-all-businesses.csv';
const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const INDEX_FILE = path.join(DATA_DIR, 'entities-index.json');

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

async function mergeGooglePlaceIds() {
  console.log('🔗 Merging Google Place IDs from CYBERCHECK-APP-STORE...\n');

  // Load index
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  console.log(`📊 Loaded ${index.length} entities from index\n`);

  // Read CSV
  const placeIds = {};
  let csvLines = 0;

  const fileStream = fs.createReadStream(PLACE_IDS_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    csvLines++;
    const parts = line.split(',');
    const placeId = parts[0];
    const name = parts[1];

    if (placeId && name && placeId.startsWith('ChIJ')) {
      const slug = slugify(name);
      placeIds[slug] = placeId;
      placeIds[name.toLowerCase()] = placeId; // Also store by full name
    }
  }

  console.log(`📥 Loaded ${csvLines} CSV lines`);
  console.log(`🔍 Found ${Object.keys(placeIds).length} unique Place IDs\n`);

  // Merge into entities
  console.log('🔗 Merging into entities...\n');

  let matched = 0;
  let updated = 0;

  index.forEach((entry, i) => {
    if (i % 1000 === 0 && i > 0) console.log(`   Processed ${i}/${index.length}...`);

    try {
      const entityPath = path.join(ENTITIES_DIR, `${entry.slug}.json`);
      const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));

      // Try to find Place ID by various methods
      let placeId = placeIds[entry.slug]; // Exact slug match
      if (!placeId) placeId = placeIds[slugify(entity.name)]; // Name match
      if (!placeId) placeId = placeIds[entity.name?.toLowerCase()]; // Exact name match

      if (placeId) {
        entity.google_places_id = placeId;
        fs.writeFileSync(entityPath, JSON.stringify(entity, null, 2));
        entry.google_places_id = placeId;
        matched++;
        updated++;
      }
    } catch (e) {
      // Silent fail
    }
  });

  // Save updated index
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  console.log(`\n✅ Merge complete!`);
  console.log(`\n📊 Results:`);
  console.log(`   - ${matched} entities matched with Place IDs`);
  console.log(`   - ${index.length - matched} without Place IDs`);
  console.log(`   - ${Math.round(matched/index.length*100)}% coverage`);

  console.log(`\n🚀 Google Place IDs added to gar-front-end-data!`);
}

mergeGooglePlaceIds().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
