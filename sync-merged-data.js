#!/usr/bin/env node
/**
 * Sync BOTH consolidated data files into gar-front-end-data
 * - gcr-entities-transformed.json (2,189 records)
 * - independent-businesses-411.json (410 records)
 * Merges both, avoids duplicates
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TRANSFORMED_FILE = '/Users/owner/gcr-entities-transformed.json';
const INDEPENDENT_FILE = '/Users/owner/independent-businesses-411.json';

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Failed to load ${filePath}:`, e.message);
    return [];
  }
}

async function syncMergedData() {
  console.log('🔄 Starting merged data sync...\n');

  // Load both files
  console.log('📥 Loading gcr-entities-transformed.json...');
  const transformed = loadJSON(TRANSFORMED_FILE);
  console.log(`   ✓ Loaded ${transformed.length} records`);

  console.log('\n📥 Loading independent-businesses-411.json...');
  const independent = loadJSON(INDEPENDENT_FILE);
  console.log(`   ✓ Loaded ${independent.length} records`);

  // Merge data, avoiding duplicates by slug
  console.log('\n🔀 Merging data...');
  const slugMap = {};
  const merged = [];

  // Add transformed first
  transformed.forEach(entity => {
    const slug = entity.slug || entity.id;
    if (!slugMap[slug]) {
      slugMap[slug] = true;
      merged.push(entity);
    }
  });

  // Add independent (new ones only)
  let newCount = 0;
  independent.forEach(entity => {
    const slug = entity.slug || entity.id;
    if (!slugMap[slug]) {
      slugMap[slug] = true;
      merged.push(entity);
      newCount++;
    }
  });

  console.log(`   ✓ Merged ${merged.length} total unique records`);
  console.log(`   ✓ Added ${newCount} new from independent-businesses-411`);

  // Create entities directory
  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];

  // Save each entity
  console.log('\n💾 Saving entities...');
  merged.forEach((entity, i) => {
    if (i % 500 === 0) console.log(`   Processing ${i}/${merged.length}...`);

    const slug = entity.slug || entity.id;

    // Save individual entity file
    const entityFile = path.join(entitiesDir, `${slug}.json`);
    saveJSON(entityFile, entity);

    // Add to index
    index.push({
      slug,
      name: entity.name,
      entity_type: entity.entity_type || entity.type,
      entity_subtype: entity.entity_subtype || entity.category,
      city: entity.city,
      hero_image_url: entity.hero_image_url || entity.cover_url,
      rating: entity.rating,
      price_range: entity.price_range,
      tags: entity.tags || [],
      featured: entity.featured
    });
  });

  // Save index
  console.log('\n💾 Saving entities index...');
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);
  console.log(`   ✓ Saved index with ${index.length} entities`);

  // Extract and save global data
  console.log('\n🎯 Extracting global data...');

  // Events
  const allEvents = [];
  merged.forEach(entity => {
    if (entity.events && Array.isArray(entity.events)) {
      allEvents.push(...entity.events);
    }
  });
  saveJSON(path.join(DATA_DIR, 'events.json'), allEvents);
  console.log(`   ✓ Extracted ${allEvents.length} events`);

  // Specials
  const allSpecials = [];
  merged.forEach(entity => {
    if (entity.specials && Array.isArray(entity.specials)) {
      allSpecials.push(...entity.specials);
    }
  });
  saveJSON(path.join(DATA_DIR, 'specials.json'), allSpecials);
  console.log(`   ✓ Extracted ${allSpecials.length} specials`);

  // Happy Hours
  const allHH = [];
  merged.forEach(entity => {
    if (entity.happy_hour) {
      allHH.push({
        slug: entity.slug,
        name: entity.name,
        entity_id: entity.id,
        ...entity.happy_hour
      });
    }
  });
  saveJSON(path.join(DATA_DIR, 'happy-hours.json'), allHH);
  console.log(`   ✓ Extracted ${allHH.length} happy hour records`);

  console.log('\n✅ Sync complete!');
  console.log(`\n📊 Final Summary:`);
  console.log(`   - ${index.length} unique businesses`);
  console.log(`   - ${allEvents.length} events`);
  console.log(`   - ${allSpecials.length} specials`);
  console.log(`   - ${allHH.length} happy hour records`);
  console.log(`\n🚀 gar-front-end-data is now populated and ready!`);
}

syncMergedData().catch(e => {
  console.error('❌ Sync failed:', e);
  process.exit(1);
});
