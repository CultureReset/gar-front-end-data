#!/usr/bin/env node
/**
 * Comprehensive consolidation script
 * Merges all available data sources into gar-front-end-data
 * Intelligently deduplicates and merges business records
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

// Data sources to consolidate
const SOURCES = [
  {
    name: 'Documents Complete',
    path: '/Users/owner/Documents copy/all-businesses-COMPLETE.json',
    priority: 10,
    parser: (data) => {
      if (Array.isArray(data)) return data;
      if (data.businesses) return data.businesses;
      if (data.data) return data.data;
      return [];
    }
  },
  {
    name: 'Supabase All Businesses',
    path: '/Users/owner/GCR-Project-Files-Complete/supabase-all-businesses.json',
    priority: 9,
    parser: (data) => {
      if (Array.isArray(data)) return data;
      if (data.businesses) return data.businesses;
      if (data.data) return data.data;
      return [];
    }
  },
  {
    name: 'Organized Progress',
    path: '/Users/owner/CYBERCHECK-APP-STORE/systems-os/organized-progress-ALL.json',
    priority: 8,
    parser: (data) => {
      if (Array.isArray(data)) return data;
      if (data.businesses) return data.businesses;
      if (data.data) return data.data;
      if (data.organized) return Object.values(data.organized).flat();
      return [];
    }
  },
  {
    name: 'GCR Businesses JSON',
    path: '/Users/owner/CYBERCHECK-MODULAR-PLATFORM/build-directory/extracted-all-data/gcr_businesses.json',
    priority: 7,
    parser: (data) => {
      if (Array.isArray(data)) return data;
      if (data.businesses) return data.businesses;
      return [];
    }
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
    console.log(`   ⚠️  Could not load ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

function normalizeEntity(entity, source) {
  // Extract core fields from various schema formats
  const normalized = {
    name: entity.name || entity.business_name || entity.title || '',
    slug: slugify(entity.name || entity.business_name || entity.title || ''),
    phone: entity.phone || entity.phone_number || entity.contact_phone || '',
    address: entity.address || entity.street_address || entity.full_address || '',
    website: entity.website || entity.url || entity.website_url || '',
    email: entity.email || entity.contact_email || '',
    city: entity.city || entity.location_city || '',
    state: entity.state || entity.location_state || 'AL',
    zip: entity.zip || entity.zipcode || entity.postal_code || '',
    rating: entity.rating || entity.avg_rating || entity.stars || 0,
    reviews: entity.reviews || entity.review_count || entity.num_reviews || 0,
    description: entity.description || entity.about || entity.bio || '',
    image: entity.image || entity.image_url || entity.photo || entity.hero_image || '',
    google_places_id: entity.google_places_id || entity.placeId || entity.place_id || '',
    hours: entity.hours || entity.opening_hours || entity.business_hours || {},
    menus: entity.menus || [],
    events: entity.events || [],
    amenities: entity.amenities || entity.features || [],
    tags: entity.tags || entity.categories || [],
    entity_type: entity.entity_type || entity.type || 'Other',
    entity_subtype: entity.entity_subtype || entity.subtype || '',
    latitude: entity.latitude || entity.lat || 0,
    longitude: entity.longitude || entity.lng || 0,
    source: source.name,
    source_priority: source.priority
  };

  return normalized;
}

function areBusinessesSame(b1, b2, threshold = 0.85) {
  // Check if two businesses are likely the same based on name and location
  if (!b1.name || !b2.name) return false;

  const norm1 = normalizeBusinessName(b1.name);
  const norm2 = normalizeBusinessName(b2.name);

  // Exact match
  if (norm1 === norm2) {
    // If same name and city, definitely same
    if (b1.city && b2.city && b1.city.toLowerCase() === b2.city.toLowerCase()) {
      return true;
    }
    // Same name, assume same if close enough
    return true;
  }

  // Similarity check (Levenshtein-like)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen === 0) return false;

  const matchLen = Array.from(norm1).filter((c, i) => norm2[i] === c).length;
  return (matchLen / minLen) >= threshold;
}

function mergeEntities(existing, newer) {
  // Merge two business records, preferring newer data where available
  const merged = { ...existing };

  // Use newer data if it's more complete or has higher priority
  if (newer.source_priority > existing.source_priority) {
    Object.keys(newer).forEach(key => {
      if (key.startsWith('_')) return;
      if (newer[key] && !merged[key]) {
        merged[key] = newer[key];
      }
    });
  }

  // Always prefer more complete data
  if (newer.description && !merged.description) merged.description = newer.description;
  if (newer.phone && !merged.phone) merged.phone = newer.phone;
  if (newer.website && !merged.website) merged.website = newer.website;
  if (newer.hours && Object.keys(newer.hours).length > Object.keys(merged.hours || {}).length) {
    merged.hours = newer.hours;
  }
  if (newer.image && !merged.image) merged.image = newer.image;
  if (newer.google_places_id && !merged.google_places_id) {
    merged.google_places_id = newer.google_places_id;
  }
  if (newer.rating > (merged.rating || 0)) {
    merged.rating = newer.rating;
    merged.reviews = newer.reviews;
  }

  // Merge arrays (menus, events, amenities, tags)
  merged.menus = Array.from(new Set([...(merged.menus || []), ...(newer.menus || [])]))
    .filter(m => m && typeof m === 'object');
  merged.events = Array.from(new Set([...(merged.events || []), ...(newer.events || [])]))
    .filter(e => e && typeof e === 'object');
  merged.amenities = Array.from(new Set([...(merged.amenities || []), ...(newer.amenities || [])]));
  merged.tags = Array.from(new Set([...(merged.tags || []), ...(newer.tags || [])]));

  return merged;
}

async function consolidateAllData() {
  console.log('\n🔗 Consolidating all business data sources...\n');

  // Load current index
  const indexPath = path.join(DATA_DIR, 'entities-index.json');
  let index = [];
  let existingEntities = {};

  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      console.log(`📊 Loaded ${index.length} existing entities from index`);

      // Load existing entities
      index.forEach(entry => {
        const entityPath = path.join(ENTITIES_DIR, `${entry.slug}.json`);
        try {
          const entity = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
          existingEntities[entry.slug] = entity;
        } catch (e) {
          // Skip if can't read
        }
      });
      console.log(`✓ Loaded ${Object.keys(existingEntities).length} entity files\n`);
    } catch (e) {
      console.log(`⚠️  Could not load existing index: ${e.message}\n`);
    }
  }

  // Consolidate all sources
  const allBusinesses = [];
  let totalLoaded = 0;

  for (const source of SOURCES) {
    console.log(`📥 Loading ${source.name}...`);
    const data = loadJSON(source.path);

    if (!data) continue;

    const businesses = source.parser(data);
    console.log(`   ✓ Loaded ${businesses.length} records`);
    totalLoaded += businesses.length;

    businesses.forEach(business => {
      if (!business || !business.name) return;
      const normalized = normalizeEntity(business, source);
      allBusinesses.push(normalized);
    });
  }

  console.log(`\n📦 Total loaded: ${totalLoaded} records\n`);

  // Deduplicate and merge
  console.log('🔄 Deduplicating and merging...\n');

  const businessMap = new Map();
  let dedupCount = 0;
  let mergedCount = 0;

  allBusinesses.forEach((business, idx) => {
    if (idx % 500 === 0 && idx > 0) {
      console.log(`   Processed ${idx}/${allBusinesses.length} - ${businessMap.size} unique so far`);
    }

    if (!business.slug || business.slug.length === 0) return;

    // Try exact slug match first
    if (businessMap.has(business.slug)) {
      const existing = businessMap.get(business.slug);
      const merged = mergeEntities(existing, business);
      businessMap.set(business.slug, merged);
      mergedCount++;
      return;
    }

    // Try to find similar business in existing map
    let foundMatch = false;
    for (const [key, existing] of businessMap) {
      if (areBusinessesSame(business, existing, 0.80)) {
        const merged = mergeEntities(existing, business);
        businessMap.set(key, merged);
        mergedCount++;
        foundMatch = true;
        dedupCount++;
        break;
      }
    }

    if (!foundMatch) {
      businessMap.set(business.slug, business);
    }
  });

  console.log(`\n✅ Consolidation complete:`);
  console.log(`   - ${businessMap.size} unique businesses`);
  console.log(`   - ${mergedCount} records merged`);
  console.log(`   - ${dedupCount} duplicates removed\n`);

  // Save consolidated entities
  console.log('💾 Saving consolidated data...\n');

  const newIndex = [];
  let saved = 0;
  let imageCount = 0;

  for (const [slug, business] of businessMap) {
    try {
      const entityPath = path.join(ENTITIES_DIR, `${slug}.json`);

      // Add to index
      newIndex.push({
        slug: business.slug,
        name: business.name,
        entity_type: business.entity_type,
        entity_subtype: business.entity_subtype,
        city: business.city,
        hero_image_url: business.image,
        rating: business.rating,
        tags: business.tags,
        featured: false
      });

      // Save entity file
      fs.writeFileSync(entityPath, JSON.stringify(business, null, 2));
      saved++;

      if (business.image) imageCount++;
    } catch (e) {
      console.error(`   Error saving ${slug}: ${e.message}`);
    }

    if (saved % 500 === 0 && saved > 0) {
      console.log(`   Saved ${saved} entities...`);
    }
  }

  // Save updated index
  fs.writeFileSync(indexPath, JSON.stringify(newIndex, null, 2));

  console.log(`\n📊 Final results:`);
  console.log(`   - ${saved} entities saved`);
  console.log(`   - ${imageCount} with images (${Math.round(imageCount/saved*100)}% coverage)`);
  console.log(`   - ${newIndex.length} in index\n`);

  console.log(`✅ Consolidation complete! gar-front-end-data now contains all consolidated data.\n`);
}

consolidateAllData().catch(e => {
  console.error('❌ Consolidation failed:', e);
  process.exit(1);
});
