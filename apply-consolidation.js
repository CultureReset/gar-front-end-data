#!/usr/bin/env node
/**
 * Apply consolidation: Add 59 new + enrich 2,256 existing
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

const SOURCES = [
  {
    name: 'Documents Complete',
    path: '/Users/owner/Documents copy/all-businesses-COMPLETE.json',
    type: 'json'
  },
  {
    name: 'Supabase',
    path: '/Users/owner/GCR-Project-Files-Complete/supabase-all-businesses.json',
    type: 'json'
  },
  {
    name: 'Organized Progress',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/organized-progress-ALL.json',
    type: 'json'
  },
  {
    name: 'Entities Transformed',
    path: '/Users/owner/gcr-entities-transformed.json',
    type: 'json'
  },
  {
    name: 'Google Place IDs',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/gcr-all-businesses.csv',
    type: 'csv'
  },
  {
    name: 'Independent Businesses',
    path: '/Users/owner/independent-businesses-411.json',
    type: 'json'
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
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadCSV(filePath) {
  const records = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
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
  } catch (e) {}
  return records;
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

function enrichEntity(existing, newData) {
  if (!newData) return existing;

  if (newData.phone && !existing.phone) existing.phone = newData.phone;
  if (newData.email && !existing.email) existing.email = newData.email;
  if (newData.website && !existing.website) existing.website = newData.website;
  if (newData.address && !existing.address) existing.address = newData.address;
  if (newData.description && !existing.description) existing.description = newData.description;
  if (newData.image && !existing.hero_image_url && !existing.image) {
    existing.hero_image_url = newData.image;
  }
  if (newData.google_places_id && !existing.google_places_id) {
    existing.google_places_id = newData.google_places_id;
  }
  if (newData.rating && newData.rating > (existing.rating || 0)) {
    existing.rating = newData.rating;
    existing.reviews = newData.reviews;
  }
  if (newData.hours && Object.keys(newData.hours).length > Object.keys(existing.hours || {}).length) {
    existing.hours = newData.hours;
  }

  // Merge arrays
  if (Array.isArray(newData.menus)) {
    existing.menus = existing.menus || [];
    newData.menus.forEach(m => {
      if (m && !existing.menus.some(em => JSON.stringify(em) === JSON.stringify(m))) {
        existing.menus.push(m);
      }
    });
  }
  if (Array.isArray(newData.tags)) {
    existing.tags = existing.tags || [];
    newData.tags.forEach(tag => {
      if (tag && !existing.tags.includes(tag)) {
        existing.tags.push(tag);
      }
    });
  }

  return existing;
}

async function apply() {
  console.log('\n🔄 Applying consolidation...\n');

  // Load existing
  console.log('📚 Loading existing entities...');
  const existingMap = new Map();
  const nameMap = new Map();
  const placeIdMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   ${idx}/${entityFiles.length}...`);

    const slug = file.replace('.json', '');
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      existingMap.set(slug, entity);
      nameMap.set(normalizeBusinessName(entity.name), slug);
      if (entity.google_places_id) {
        placeIdMap.set(entity.google_places_id, slug);
      }
    } catch (e) {}
  });

  console.log(`✅ Loaded ${existingMap.size} existing\n`);

  // Load all external data
  console.log('📥 Loading external sources...');
  const allNewBusinesses = [];
  const enrichmentMap = {};

  for (const source of SOURCES) {
    let records = [];

    if (source.type === 'json') {
      const data = loadJSON(source.path);
      if (!data) continue;

      if (Array.isArray(data)) records = data;
      else if (data.businesses) records = data.businesses;
      else if (data.data) records = data.data;
      else if (data.organized) records = Object.values(data.organized).flat();
      else if (data.entities) records = data.entities;
      else records = [data];
    } else if (source.type === 'csv') {
      records = loadCSV(source.path);
    }

    console.log(`   📦 ${source.name}: ${records.length} records`);

    records.forEach(record => {
      if (!record || !record.name) return;

      const bizData = extractBusinessData(record);
      if (!bizData.name) return;

      const slug = slugify(bizData.name);
      const normName = normalizeBusinessName(bizData.name);
      const placeId = bizData.google_places_id;

      // Find existing
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
        // Enrich existing
        if (!enrichmentMap[existingSlug]) {
          enrichmentMap[existingSlug] = [];
        }
        enrichmentMap[existingSlug].push(bizData);
      } else {
        // New business
        allNewBusinesses.push({
          ...bizData,
          slug: slug,
          entity_type: 'Other',
          entity_subtype: ''
        });
      }
    });
  }

  console.log(`\n📊 Ready to apply:`);
  console.log(`   ✨ ADD: ${allNewBusinesses.length} new`);
  console.log(`   📝 ENRICH: ${Object.keys(enrichmentMap).length} existing\n`);

  // Apply enrichments
  console.log('🔄 Enriching existing entities...\n');
  let enrichedCount = 0;

  Object.entries(enrichmentMap).forEach(([slug, enrichments], idx) => {
    if (idx % 500 === 0 && idx > 0) console.log(`   Enriched ${idx}/${Object.keys(enrichmentMap).length}...`);

    const entity = existingMap.get(slug);
    if (!entity) return;

    enrichments.forEach(data => {
      enrichEntity(entity, data);
    });

    existingMap.set(slug, entity);
    enrichedCount++;
  });

  console.log(`✅ Enriched ${enrichedCount} entities\n`);

  // Save enriched
  console.log('💾 Saving enriched entities...\n');
  let saved = 0;

  for (const [slug, entity] of existingMap) {
    try {
      fs.writeFileSync(
        path.join(ENTITIES_DIR, `${slug}.json`),
        JSON.stringify(entity, null, 2)
      );
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}`);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved}/${existingMap.size}...`);
    }
  }

  console.log(`✅ Saved ${saved} existing entities\n`);

  // Add new businesses
  console.log('✨ Adding new businesses...\n');
  let added = 0;

  allNewBusinesses.forEach((business, idx) => {
    if (idx % 100 === 0 && idx > 0) console.log(`   Added ${idx}/${allNewBusinesses.length}...`);

    try {
      const filePath = path.join(ENTITIES_DIR, `${business.slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(business, null, 2));
      existingMap.set(business.slug, business);
      added++;
    } catch (e) {
      console.error(`Error adding ${business.slug}`);
    }
  });

  console.log(`✅ Added ${added} new entities\n`);

  // Update index
  console.log('📝 Updating index...\n');
  const newIndex = Array.from(existingMap.values()).map(entity => ({
    slug: entity.slug,
    name: entity.name,
    entity_type: entity.entity_type || 'Other',
    entity_subtype: entity.entity_subtype || '',
    city: entity.city || '',
    hero_image_url: entity.hero_image_url || entity.image || '',
    rating: entity.rating || 0,
    tags: entity.tags || [],
    featured: entity.featured || false
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'entities-index.json'), JSON.stringify(newIndex, null, 2));

  const imageCount = newIndex.filter(e => e.hero_image_url).length;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ CONSOLIDATION COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 Final Results:`);
  console.log(`   Total entities: ${existingMap.size}`);
  console.log(`   Enriched: ${enrichedCount}`);
  console.log(`   Added: ${added}`);
  console.log(`   With images: ${imageCount} (${Math.round(imageCount/existingMap.size*100)}%)\n`);
  console.log(`🚀 gar-front-end-data is now fully consolidated!\n`);
}

apply().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
