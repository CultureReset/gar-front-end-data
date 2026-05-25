#!/usr/bin/env node
/**
 * Sync ALL data from gcr-api-gules (extended database with images)
 * Stores complete entities + image URLs in gar-front-end-data
 * Images stay in Supabase, we just store the URLs
 */

const fs = require('fs');
const path = require('path');

const API = 'https://gcr-api-gules.vercel.app';
const DATA_DIR = path.join(__dirname, 'data');

async function fetchData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`   ❌ Fetch failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function syncFromGCRApiGules() {
  console.log('🔄 Syncing from gcr-api-gules (full database with Supabase images)...\n');

  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];
  const categoryStats = {};
  let processed = 0;
  let withImages = 0;
  let failed = 0;

  // Fetch all entities with pagination
  console.log('📥 Fetching all entities from gcr-api-gules...');
  let allEntities = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchData = await fetchData(`${API}/api/gcr/entities?limit=1000&offset=${offset}`);
    if (!batchData || !batchData.entities) {
      hasMore = false;
      break;
    }

    const batch = batchData.entities || batchData.businesses || [];
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    allEntities.push(...batch);
    offset += batch.length;
    console.log(`   Fetched ${allEntities.length} total...`);
  }

  if (allEntities.length === 0) {
    console.error('❌ No entities fetched from gcr-api-gules');
    process.exit(1);
  }

  console.log(`   ✓ Got ${allEntities.length} entities\n`);

  // Process each entity
  console.log('💾 Saving entities...');
  allEntities.forEach((entity, i) => {
    if (i % 2000 === 0 && i > 0) console.log(`   Processed ${i}/${allEntities.length}...`);

    try {
      const slug = entity.slug || entity.id;

      // Normalize entity, keep all data including image URLs
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
        website_url: entity.website_url || entity.website || null,
        address_line_1: entity.address_line_1 || entity.address || '',
        city: entity.city || '',
        state: entity.state || '',
        zip: entity.zip || null,
        rating: entity.rating || null,
        review_count: entity.review_count || null,
        // IMPORTANT: Store image URL from Supabase
        hero_image_url: entity.hero_image_url || null,
        // Also store full photos array if available
        photos: entity.photos || [],
        hours: entity.hours || [],
        menu_sections: entity.menu_sections || [],
        drink_sections: entity.drink_sections || [],
        happy_hour: entity.happy_hour || { schedule: '', sections: [] },
        events: entity.events || [],
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
      console.error(`   ❌ Failed to process entity:`, e.message);
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

  // Category breakdown
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

  console.log(`\n✨ Architecture:`);
  console.log(`   📁 gar-front-end-data: Complete data + image URLs`);
  console.log(`   ☁️  Supabase: Actual image storage`);
  console.log(`   🎯 launching-GCR: Displays data from gar-front-end-data`);
  console.log(`\n🚀 Ready to display on launching-GCR!`);
}

syncFromGCRApiGules().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
