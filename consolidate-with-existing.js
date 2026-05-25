#!/usr/bin/env node
/**
 * Smart consolidation that merges new sources with existing data
 * Preserves all existing entities and enriches with new data
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

const EXTERNAL_SOURCES = [
  {
    name: 'Documents Complete',
    path: '/Users/owner/Documents copy/all-businesses-COMPLETE.json',
    priority: 10
  },
  {
    name: 'Supabase All Businesses',
    path: '/Users/owner/GCR-Project-Files-Complete/supabase-all-businesses.json',
    priority: 9
  },
  {
    name: 'Organized Progress',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/organized-progress-ALL.json',
    priority: 8
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
    console.log(`   ⚠️  Could not load: ${e.message}`);
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
    state: business.state || 'AL',
    zip: business.zip || business.zipcode || '',
    rating: business.rating || business.avg_rating || 0,
    reviews: business.reviews || business.review_count || 0,
    description: business.description || business.about || '',
    image: business.image || business.image_url || business.photo || '',
    google_places_id: business.google_places_id || business.placeId || '',
    hours: business.hours || business.opening_hours || {},
    menus: business.menus || [],
    events: business.events || [],
    amenities: business.amenities || [],
    tags: business.tags || business.categories || []
  };
}

function enrichEntity(existing, newData) {
  // Add missing fields from new data
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
  }
  if (newData.hours && Object.keys(newData.hours).length > Object.keys(existing.hours || {}).length) {
    existing.hours = newData.hours;
  }

  // Merge arrays without duplicates
  if (newData.menus && Array.isArray(newData.menus)) {
    existing.menus = existing.menus || [];
    newData.menus.forEach(m => {
      if (m && !existing.menus.some(em => JSON.stringify(em) === JSON.stringify(m))) {
        existing.menus.push(m);
      }
    });
  }

  if (newData.events && Array.isArray(newData.events)) {
    existing.events = existing.events || [];
    newData.events.forEach(e => {
      if (e && !existing.events.some(ee => JSON.stringify(ee) === JSON.stringify(e))) {
        existing.events.push(e);
      }
    });
  }

  if (newData.tags && Array.isArray(newData.tags)) {
    existing.tags = existing.tags || [];
    newData.tags.forEach(tag => {
      if (tag && !existing.tags.includes(tag)) {
        existing.tags.push(tag);
      }
    });
  }

  return existing;
}

async function consolidate() {
  console.log('\n🔗 Smart consolidation with existing data...\n');

  // First, rebuild index from ALL existing entity files
  console.log('📚 Scanning existing entity files...');
  const entityFiles = fs.readdirSync(ENTITIES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`   ✓ Found ${entityFiles.length} entity files\n`);

  // Load all existing entities
  const existingMap = new Map();
  let loaded = 0;

  entityFiles.forEach((file, idx) => {
    if (idx % 1000 === 0 && idx > 0) {
      console.log(`   Loaded ${idx}/${entityFiles.length}...`);
    }

    const slug = file.replace('.json', '');
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      existingMap.set(slug, entity);
      loaded++;
    } catch (e) {
      // Skip invalid files
    }
  });

  console.log(`\n✅ Loaded ${loaded} existing entities\n`);

  // Load and parse external sources
  console.log('📥 Loading external data sources...\n');
  const externalBusinesses = [];

  for (const source of EXTERNAL_SOURCES) {
    console.log(`   📦 ${source.name}...`);
    const data = loadJSON(source.path);
    if (!data) continue;

    let businesses = [];
    if (Array.isArray(data)) businesses = data;
    else if (data.businesses) businesses = data.businesses;
    else if (data.data) businesses = data.data;
    else if (data.organized) businesses = Object.values(data.organized).flat();

    console.log(`      ✓ Loaded ${businesses.length} records`);

    businesses.forEach(b => {
      if (b && b.name) {
        externalBusinesses.push({
          ...extractBusinessData(b),
          slug: slugify(b.name || b.business_name || b.title || '')
        });
      }
    });
  }

  console.log(`\n✅ Total external records: ${externalBusinesses.length}\n`);

  // Merge external data into existing
  console.log('🔄 Enriching entities with external data...\n');

  let enriched = 0;
  let newAdded = 0;

  externalBusinesses.forEach((extBiz, idx) => {
    if (idx % 500 === 0 && idx > 0) {
      console.log(`   Processed ${idx}/${externalBusinesses.length} - ${enriched} enriched, ${newAdded} new`);
    }

    if (!extBiz.slug) return;

    // Try exact slug match
    if (existingMap.has(extBiz.slug)) {
      enrichEntity(existingMap.get(extBiz.slug), extBiz);
      enriched++;
      return;
    }

    // Try to find by normalized name
    const normName = normalizeBusinessName(extBiz.name);
    let found = false;

    for (const [slug, entity] of existingMap) {
      const existingNorm = normalizeBusinessName(entity.name || '');
      if (existingNorm && existingNorm === normName) {
        enrichEntity(entity, extBiz);
        enriched++;
        found = true;
        break;
      }
    }

    // If not found, add as new entity
    if (!found) {
      existingMap.set(extBiz.slug, {
        name: extBiz.name,
        slug: extBiz.slug,
        entity_type: 'Other',
        ...extBiz
      });
      newAdded++;
    }
  });

  console.log(`\n✅ Merge complete:`);
  console.log(`   - ${enriched} entities enriched`);
  console.log(`   - ${newAdded} new entities added`);
  console.log(`   - ${existingMap.size} total entities\n`);

  // Save all back to disk
  console.log('💾 Saving updated entities...\n');

  let saved = 0;
  let imageCount = 0;

  for (const [slug, entity] of existingMap) {
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;

      if (entity.hero_image_url || entity.image) imageCount++;
    } catch (e) {
      console.error(`Error saving ${slug}:`, e.message);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved} entities...`);
    }
  }

  // Rebuild index from all entities
  console.log(`\n📝 Rebuilding index...\n`);

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

  console.log(`📊 Final results:`);
  console.log(`   - ${saved} entities saved`);
  console.log(`   - ${imageCount} with images (${Math.round(imageCount/saved*100)}% coverage)`);
  console.log(`   - ${newIndex.length} in index\n`);

  console.log(`✅ Consolidation complete!\n`);
}

consolidate().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
