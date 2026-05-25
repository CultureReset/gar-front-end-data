#!/usr/bin/env node
/**
 * Sync from old cybercheck-api-database which has proper categorization and images
 * This ensures correct business types and populated images
 */

const fs = require('fs');
const path = require('path');

const OLD_API = 'https://cybercheck-api-database.vercel.app';
const DATA_DIR = path.join(__dirname, 'data');

async function fetchData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`Failed to fetch ${url}:`, e.message);
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function syncFromOldAPI() {
  console.log('🔄 Syncing from old API (proper categorization & images)...\n');

  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];
  const categoryStats = {};
  let processed = 0;
  let withImages = 0;
  let failed = 0;

  // Fetch all entities with pagination
  console.log('📥 Fetching all entities...');
  let entities = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchData = await fetchData(`${OLD_API}/api/gcr/entities?limit=1000&offset=${offset}`);
    if (!batchData || !batchData.entities) {
      hasMore = false;
      break;
    }

    const batch = batchData.entities || batchData.businesses || [];
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    entities.push(...batch);
    offset += batch.length;
    console.log(`   Fetched ${entities.length} total...`);
  }

  if (entities.length === 0) {
    console.error('❌ Failed to fetch entities from old API');
    process.exit(1);
  }

  console.log(`   ✓ Got ${entities.length} entities\n`);

  // Process each entity
  console.log('💾 Saving entities...');
  entities.forEach((entity, i) => {
    if (i % 500 === 0 && i > 0) console.log(`   Processed ${i}/${entities.length}...`);

    try {
      const slug = entity.slug || entity.id;

      // Normalize the entity data
      const normalized = {
        id: entity.id,
        slug: slug,
        name: entity.name || '',
        entity_type: entity.entity_type || 'business',
        entity_subtype: entity.entity_subtype || 'general',
        icon: entity.icon || '🏪',
        description: entity.description || '',
        phone: entity.phone || null,
        email: entity.email || null,
        address_line_1: entity.address_line_1 || entity.address || '',
        city: entity.city || '',
        state: entity.state || '',
        zip: entity.zip || null,
        website_url: entity.website_url || entity.website || null,
        rating: entity.rating || null,
        review_count: entity.review_count || null,
        hero_image_url: entity.hero_image_url || null,
        hours: entity.hours || [],
        menu_sections: entity.menu_sections || [],
        drink_sections: entity.drink_sections || [],
        happy_hour: entity.happy_hour || { schedule: '', sections: [] },
        events: entity.events || [],
        photos: entity.photos || [],
        amenities: entity.amenities || [],
        tags: entity.tags || [],
        featured: entity.featured || false,
        is_active: entity.is_active !== false
      };

      // Count features
      if (normalized.hero_image_url) withImages++;

      // Track categories
      const catKey = `${normalized.entity_type}:${normalized.entity_subtype}`;
      categoryStats[catKey] = (categoryStats[catKey] || 0) + 1;

      // Save entity file
      const entityPath = path.join(entitiesDir, `${slug}.json`);
      saveJSON(entityPath, normalized);

      // Add to index
      index.push({
        slug: slug,
        name: normalized.name,
        entity_type: normalized.entity_type,
        entity_subtype: normalized.entity_subtype,
        city: normalized.city,
        hero_image_url: normalized.hero_image_url,
        rating: normalized.rating,
        tags: normalized.tags || [],
        featured: normalized.featured
      });

      processed++;
    } catch (e) {
      failed++;
      console.error(`   ❌ Failed to process ${entity.name}:`, e.message);
    }
  });

  // Save index
  console.log('\n💾 Saving index...');
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);

  // Print stats
  console.log(`\n✅ Sync complete!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - ${processed} entities synced`);
  console.log(`   - ${withImages} with images (${Math.round(withImages/processed*100)}%)`);
  console.log(`   - ${failed} failed`);

  console.log(`\n📁 Categories:`);
  const byType = {};
  Object.entries(categoryStats).forEach(([key, count]) => {
    const [type] = key.split(':');
    byType[type] = (byType[type] || 0) + count;
  });

  Object.entries(byType)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

  console.log(`\n🚀 Ready with proper categorization and images!`);
}

syncFromOldAPI().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
