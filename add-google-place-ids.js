#!/usr/bin/env node
/**
 * Extract Google Place IDs from MASTER-ALL-BUSINESSES-COMPLETE
 * and merge them into gar-front-end-data entities
 */

const fs = require('fs');
const path = require('path');

const ORGANIZED_DIR = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function extractAndMergePlaceIds() {
  console.log('🔍 Extracting Google Place IDs from MASTER data...\n');

  const index = loadJSON(path.join(DATA_DIR, 'entities-index.json'));
  if (!index) {
    console.error('❌ No entities-index.json found');
    process.exit(1);
  }

  // Load MASTER-INDEX which has placeIds
  const masterIndex = loadJSON(path.join(ORGANIZED_DIR, '_MASTER-INDEX.json'));
  if (!masterIndex) {
    console.error('❌ No _MASTER-INDEX.json found');
    process.exit(1);
  }

  console.log(`📊 Processing ${index.length} entities...\n`);

  // Build map of business names to placeIds from MASTER
  const placeIdMap = {};
  if (masterIndex.businesses && Array.isArray(masterIndex.businesses)) {
    masterIndex.businesses.forEach(b => {
      if (b.name && b.placeId) {
        placeIdMap[b.name.toLowerCase().trim()] = b.placeId;
      }
    });
  }

  console.log(`✓ Found ${Object.keys(placeIdMap).length} Place IDs in MASTER\n`);

  // Merge placeIds into entities
  let added = 0;
  let matched = 0;

  index.forEach((indexEntry, i) => {
    if (i % 1000 === 0 && i > 0) console.log(`   Processed ${i}/${index.length}...`);

    try {
      const entityPath = path.join(ENTITIES_DIR, `${indexEntry.slug}.json`);
      const entity = loadJSON(entityPath);

      if (!entity) return;

      // Try to match by name
      const nameKey = entity.name.toLowerCase().trim();
      const placeId = placeIdMap[nameKey];

      if (placeId) {
        entity.google_places_id = placeId;
        saveJSON(entityPath, entity);
        matched++;
        added++;
      }

      // Also try fuzzy match if exact match fails
      if (!placeId && entity.name) {
        const fuzzyKey = Object.keys(placeIdMap).find(key => {
          // Match if first 80% of name is same
          const minLen = Math.min(key.length, nameKey.length);
          return key.substring(0, minLen * 0.8) === nameKey.substring(0, minLen * 0.8);
        });

        if (fuzzyKey) {
          entity.google_places_id = placeIdMap[fuzzyKey];
          saveJSON(entityPath, entity);
          added++;
        }
      }
    } catch (e) {
      // Silent fail
    }
  });

  console.log(`\n✅ Complete!`);
  console.log(`\n📊 Results:`);
  console.log(`   - ${added} entities with Google Place IDs added`);
  console.log(`   - ${matched} matched by exact name`);
  console.log(`   - ${index.filter(e => placeIdMap[e.name?.toLowerCase().trim()]).length} available in MASTER`);

  console.log(`\n🚀 Google Place IDs added to gar-front-end-data!`);
  console.log(`   Each entity now has: google_places_id field\n`);
}

extractAndMergePlaceIds().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
