#!/usr/bin/env node
/**
 * COMPREHENSIVE DATA CONSOLIDATION
 * Loads ALL available sources and only adds what's NEW
 * Enriches existing entities without duplication
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

// All sources to consolidate
const ALL_SOURCES = [
  // PRIMARY CONSOLIDATED FILES
  {
    name: '📄 Documents Complete JSON',
    path: '/Users/owner/Documents copy/all-businesses-COMPLETE.json',
    type: 'json',
    priority: 10,
    maxRecords: 999999
  },
  {
    name: '📄 Supabase All Businesses',
    path: '/Users/owner/GCR-Project-Files-Complete/supabase-all-businesses.json',
    type: 'json',
    priority: 9,
    maxRecords: 999999
  },
  {
    name: '📄 Organized Progress ALL',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/organized-progress-ALL.json',
    type: 'json',
    priority: 8,
    maxRecords: 999999
  },
  {
    name: '📊 GCR Businesses (extracted)',
    path: '/Users/owner/CYBERCHECK-MODULAR-PLATFORM/build-directory/extracted-all-data/gcr_businesses.json',
    type: 'json',
    priority: 7,
    maxRecords: 999999
  },
  // CATEGORY FILES
  {
    name: '🏠 Category - Attractions',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/CATEGORY-Attractions.json',
    type: 'json',
    priority: 6,
    maxRecords: 999999
  },
  {
    name: '🍽️  Category - Restaurants Fine Dining',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/CATEGORY-Restaurants---Fine-Dining.json',
    type: 'json',
    priority: 6,
    maxRecords: 999999
  },
  {
    name: '🏨 Category - Hotels',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/CATEGORY-Hotels---Lodging.json',
    type: 'json',
    priority: 6,
    maxRecords: 999999
  },
  {
    name: '🛍️  Category - Shopping',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/CATEGORY-Shopping---Retail.json',
    type: 'json',
    priority: 6,
    maxRecords: 999999
  },
  {
    name: '🎣 Category - Fishing Charters',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/CATEGORY-Fishing-Charters.json',
    type: 'json',
    priority: 6,
    maxRecords: 999999
  },
  // CSV SOURCES
  {
    name: '📥 Google Place IDs CSV',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/gcr-all-businesses.csv',
    type: 'csv',
    priority: 5,
    maxRecords: 999999
  },
  // OTHER JSON
  {
    name: '📄 Entities Transformed',
    path: '/Users/owner/gcr-entities-transformed.json',
    type: 'json',
    priority: 4,
    maxRecords: 999999
  },
  {
    name: '📄 Independent Businesses',
    path: '/Users/owner/independent-businesses-411.json',
    type: 'json',
    priority: 4,
    maxRecords: 999999
  }
];

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
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function extractBusinessData(business) {
  return {
    name: business.name || business.business_name || business.title || '',
    phone: business.phone || business.phone_number || '',
    address: business.address || business.street_address || '',
    website: business.website || business.url || '',
    email: business.email || '',
    city: business.city || '',
    rating: business.rating || business.avg_rating || 0,
    reviews: business.reviews || business.review_count || 0,
    description: business.description || business.about || '',
    image: business.image || business.image_url || business.photo || '',
    google_places_id: business.google_places_id || business.placeId || business.place_id || '',
    hours: business.hours || business.opening_hours || {},
    menus: business.menus || [],
    events: business.events || [],
    amenities: business.amenities || [],
    tags: business.tags || business.categories || []
  };
}

function loadCSV(filePath) {
  const records = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

    for (let i = 1; i < lines.length && i < 10000; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Simple CSV parsing (handles quoted fields)
      const fields = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim().replace(/"/g, ''));

      if (fields.length > 1) {
        const record = {};
        headers.forEach((header, idx) => {
          record[header] = fields[idx] || '';
        });
        records.push(record);
      }
    }
  } catch (e) {
    // Silent fail
  }
  return records;
}

async function consolidateEverything() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🚀 MEGA CONSOLIDATION - Loading ALL Data Sources');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load existing entities from disk
  console.log('📚 Loading existing gar-front-end-data...');
  const existingMap = new Map();
  const existingNames = new Set();
  const existingPlaceIds = new Set();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   Loaded ${idx}/${entityFiles.length}...`);

    const slug = file.replace('.json', '');
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      existingMap.set(slug, entity);
      if (entity.name) existingNames.add(normalizeBusinessName(entity.name));
      if (entity.google_places_id) existingPlaceIds.add(entity.google_places_id);
    } catch (e) {
      // Skip
    }
  });

  console.log(`✅ Existing entities: ${existingMap.size}`);
  console.log(`   - With place IDs: ${existingPlaceIds.size}`);
  console.log(`\n📊 Loading all external sources...\n`);

  const sourceStats = [];
  const allNewBusinesses = [];
  const allEnrichments = {};

  // Load each source
  for (const source of ALL_SOURCES) {
    let records = [];
    let loaded = 0;

    if (source.type === 'json') {
      const data = loadJSON(source.path);
      if (!data) {
        sourceStats.push({ ...source, loaded: 0, new: 0, enriched: 0, skipped: 0 });
        continue;
      }

      // Extract array from various formats
      if (Array.isArray(data)) records = data;
      else if (data.businesses) records = data.businesses;
      else if (data.data) records = data.data;
      else if (data.organized) records = Object.values(data.organized).flat();
      else if (data.entities) records = data.entities;
      else records = [data];

      loaded = records.length;
    } else if (source.type === 'csv') {
      records = loadCSV(source.path);
      loaded = records.length;
    }

    let newCount = 0;
    let enrichedCount = 0;
    let skippedCount = 0;

    // Process records
    records.slice(0, source.maxRecords).forEach(record => {
      if (!record || !record.name) return;

      const bizData = extractBusinessData(record);
      if (!bizData.name) return;

      const slug = slugify(bizData.name);
      const normName = normalizeBusinessName(bizData.name);
      const placeId = bizData.google_places_id;

      // Check if already exists
      if (existingMap.has(slug) || existingNames.has(normName) || (placeId && existingPlaceIds.has(placeId))) {
        // Mark for enrichment
        let targetSlug = slug;
        if (!existingMap.has(slug) && existingNames.has(normName)) {
          // Find by name
          for (const [s, e] of existingMap) {
            if (normalizeBusinessName(e.name) === normName) {
              targetSlug = s;
              break;
            }
          }
        }

        if (!allEnrichments[targetSlug]) {
          allEnrichments[targetSlug] = [];
        }
        allEnrichments[targetSlug].push(bizData);
        enrichedCount++;
      } else {
        // NEW business
        allNewBusinesses.push(bizData);
        newCount++;
        existingNames.add(normName);
        if (placeId) existingPlaceIds.add(placeId);
      }
    });

    skippedCount = loaded - newCount - enrichedCount;

    sourceStats.push({
      name: source.name,
      loaded,
      new: newCount,
      enriched: enrichedCount,
      skipped: skippedCount
    });

    console.log(`${source.name}`);
    console.log(`   📥 Loaded: ${loaded}`);
    console.log(`   ✨ New: ${newCount}`);
    console.log(`   📝 Enrich: ${enrichedCount}`);
    if (skippedCount > 0) console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log('');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 CONSOLIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalLoaded = sourceStats.reduce((sum, s) => sum + s.loaded, 0);
  const totalNew = sourceStats.reduce((sum, s) => sum + s.new, 0);
  const totalEnriched = Object.keys(allEnrichments).length;

  console.log(`Total records loaded:  ${totalLoaded}`);
  console.log(`Existing in DB:        ${existingMap.size}`);
  console.log(`NEW to add:            ${allNewBusinesses.length}`);
  console.log(`To enrich:             ${totalEnriched}`);
  console.log('\n📈 FINAL STATS:');
  console.log(`   Current: ${existingMap.size} entities`);
  console.log(`   Adding:  ${allNewBusinesses.length} new`);
  console.log(`   Result:  ${existingMap.size + allNewBusinesses.length} total entities`);
  console.log(`   Coverage increase: +${Math.round(allNewBusinesses.length/existingMap.size*100)}%\n`);

  // Show top sources
  console.log('Top sources by new records:');
  sourceStats
    .filter(s => s.new > 0)
    .sort((a, b) => b.new - a.new)
    .slice(0, 5)
    .forEach(s => {
      console.log(`   ${s.name}: +${s.new}`);
    });

  console.log('\n✅ Analysis complete!');
  console.log(`Ready to add ${allNewBusinesses.length} new businesses and enrich ${totalEnriched} existing ones.\n`);
}

consolidateEverything().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
