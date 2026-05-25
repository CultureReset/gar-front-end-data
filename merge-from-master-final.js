#!/usr/bin/env node
/**
 * Merge from master-final/_MASTER.json (2,537 AI-organized complete records)
 * Pull EVERYTHING - no selective field extraction
 * This is the authoritative source with all data intact
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const MASTER_FILE = '/Users/owner/master-final/_MASTER.json';

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

function normalizeBusinessName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ Error loading ${filePath}:`, e.message);
    return null;
  }
}

function deepMerge(existing, masterRecord) {
  // Start with existing data (preserve what we have)
  const merged = { ...existing };

  // Merge every field from master
  Object.keys(masterRecord).forEach(key => {
    // Skip internal/meta fields
    if (key.startsWith('_') && !key.startsWith('_enriched')) return;

    const masterValue = masterRecord[key];

    if (masterValue === null || masterValue === undefined || masterValue === '') {
      // Master has empty value, keep existing
      return;
    }

    // Arrays - merge intelligently
    if (Array.isArray(masterValue)) {
      if (!merged[key]) {
        merged[key] = masterValue;
      } else if (Array.isArray(merged[key])) {
        // Merge arrays without duplicates
        const existing_ = merged[key];
        masterValue.forEach(item => {
          if (!existing_.some(e => JSON.stringify(e) === JSON.stringify(item))) {
            existing_.push(item);
          }
        });
      }
      return;
    }

    // Objects - merge recursively
    if (typeof masterValue === 'object') {
      if (!merged[key] || typeof merged[key] !== 'object') {
        merged[key] = masterValue;
      } else {
        // Recursive merge
        merged[key] = deepMerge(merged[key], masterValue);
      }
      return;
    }

    // Primitives - master wins if existing is empty/null
    if (!merged[key] || merged[key] === '' || merged[key] === null) {
      merged[key] = masterValue;
    }
  });

  return merged;
}

async function mergeFromMaster() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔗 MERGING FROM MASTER-FINAL (2,537 AI-organized records)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load master
  console.log('📚 Loading master-final/_MASTER.json...');
  const master = loadJSON(MASTER_FILE);
  if (!master) {
    console.error('❌ Failed to load master file');
    process.exit(1);
  }

  const masterRecords = Object.values(master);
  console.log(`✅ Loaded ${masterRecords.length} master records\n`);

  // Load existing entities
  console.log('📦 Loading existing gar-front-end-data...');
  const existingMap = new Map();
  const nameMap = new Map();
  const placeIdMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   Loaded ${idx}/${entityFiles.length}...`);

    const slug = file.replace('.json', '');
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      existingMap.set(slug, entity);
      if (entity.name) nameMap.set(normalizeBusinessName(entity.name), slug);
      if (entity.google_places_id) placeIdMap.set(entity.google_places_id, slug);
    } catch (e) {}
  });

  console.log(`✅ Loaded ${existingMap.size} existing entities\n`);

  // Merge from master
  console.log('🔄 Merging master data...\n');
  let merged = 0;
  let added = 0;
  let skipped = 0;

  masterRecords.forEach((masterRecord, idx) => {
    if (idx % 500 === 0 && idx > 0) {
      console.log(`   Processed ${idx}/${masterRecords.length} - Merged: ${merged}, Added: ${added}`);
    }

    if (!masterRecord.name) {
      skipped++;
      return;
    }

    const slug = masterRecord.slug || slugify(masterRecord.name);
    const normName = normalizeBusinessName(masterRecord.name);
    const placeId = masterRecord.place_id;

    // Find existing by various methods
    let found = existingMap.has(slug);
    let existingSlug = slug;

    if (!found && nameMap.has(normName)) {
      existingSlug = nameMap.get(normName);
      found = true;
    }

    if (!found && placeId && placeIdMap.has(placeId)) {
      existingSlug = placeIdMap.get(placeId);
      found = true;
    }

    if (found) {
      // Merge with existing
      const existing = existingMap.get(existingSlug);
      const merged_ = deepMerge(existing, masterRecord);
      existingMap.set(existingSlug, merged_);
      merged++;
    } else {
      // Add as new
      const newEntity = {
        ...masterRecord,
        slug: slug
      };
      existingMap.set(slug, newEntity);
      nameMap.set(normName, slug);
      if (placeId) placeIdMap.set(placeId, slug);
      added++;
    }
  });

  console.log(`\n✅ Merge complete:`);
  console.log(`   Merged into existing: ${merged}`);
  console.log(`   Added as new: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total entities: ${existingMap.size}\n`);

  // Save all entities
  console.log('💾 Saving merged entities...\n');
  let saved = 0;

  for (const [slug, entity] of existingMap) {
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}:`, e.message);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved}/${existingMap.size}...`);
    }
  }

  console.log(`✅ Saved ${saved} entities\n`);

  // Update index
  console.log('📝 Updating index...\n');
  const newIndex = Array.from(existingMap.values()).map(entity => ({
    slug: entity.slug,
    name: entity.name,
    entity_type: entity.entity_type || entity.google_type || 'Other',
    entity_subtype: entity.entity_subtype || '',
    city: entity.city || '',
    hero_image_url: entity.hero_image_url || '',
    rating: entity.rating || 0,
    tags: entity.tags || [],
    featured: entity.featured || false
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'entities-index.json'), JSON.stringify(newIndex, null, 2));

  // Analyze what we have
  let withPhone = 0, withWebsite = 0, withHours = 0, withMenus = 0;
  let withEvents = 0, withDescription = 0, withImages = 0, withCoords = 0;
  const types = {};

  for (const entity of existingMap.values()) {
    if (entity.phone) withPhone++;
    if (entity.website) withWebsite++;
    if (entity.hours) withHours++;
    if (entity.menus && entity.menus.length > 0) withMenus++;
    if (entity.events && entity.events.length > 0) withEvents++;
    if (entity.description) withDescription++;
    if (entity.hero_image_url) withImages++;
    if (entity.lat && entity.lng) withCoords++;

    const type = entity.entity_type || 'Other';
    types[type] = (types[type] || 0) + 1;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ MASTER MERGE COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 DATA COVERAGE:\n`);
  console.log(`   Total entities:      ${existingMap.size}`);
  console.log(`   With phone:          ${withPhone} (${Math.round(withPhone/existingMap.size*100)}%)`);
  console.log(`   With website:        ${withWebsite} (${Math.round(withWebsite/existingMap.size*100)}%)`);
  console.log(`   With hours:          ${withHours} (${Math.round(withHours/existingMap.size*100)}%)`);
  console.log(`   With coordinates:    ${withCoords} (${Math.round(withCoords/existingMap.size*100)}%)`);
  console.log(`   With description:    ${withDescription} (${Math.round(withDescription/existingMap.size*100)}%)`);
  console.log(`   With menus:          ${withMenus} (${Math.round(withMenus/existingMap.size*100)}%)`);
  console.log(`   With events:         ${withEvents} (${Math.round(withEvents/existingMap.size*100)}%)`);
  console.log(`   With images:         ${withImages} (${Math.round(withImages/existingMap.size*100)}%)\n`);

  console.log(`📂 ENTITY TYPES:\n`);
  Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([type, count]) => {
      console.log(`   ${type.padEnd(25)} ${count}`);
    });

  console.log(`\n🚀 gar-front-end-data now has COMPLETE master data merged!\n`);
}

mergeFromMaster().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
