#!/usr/bin/env node
/**
 * Sync ALL data from old APIs to gar-front-end-data
 * Pulls from gcr-api-gules and cybercheck-api-database
 */

const fs = require('fs');
const path = require('path');

const OLD_API = 'https://gcr-api-gules.vercel.app';
const CYBER_API = 'https://cybercheck-api-database.vercel.app';
const DATA_DIR = path.join(__dirname, 'data');

async function fetchData(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
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

async function syncAllData() {
  console.log('🔄 Starting sync from old APIs...\n');

  // 1. Get all entities
  console.log('📥 Fetching entities...');
  const entitiesData = await fetchData(`${OLD_API}/api/gcr/entities?limit=10000`);
  const entities = entitiesData?.entities || entitiesData?.businesses || [];
  console.log(`   ✓ Got ${entities.length} entities`);

  const index = [];
  const entitiesDir = path.join(DATA_DIR, 'entities');

  // 2. For each entity, get detailed data
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const slug = entity.slug || entity.id;

    if (i % 100 === 0) console.log(`   Processing ${i}/${entities.length}...`);

    // Get full entity data
    const fullEntity = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}`);
    const entityData = fullEntity?.entity || fullEntity?.business || entity;

    // Get menus
    const menuData = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}/menu`);
    if (menuData) {
      entityData.menu_sections = menuData.menu_sections || menuData.sections || [];
      entityData.drink_sections = menuData.drink_sections || menuData.drinks || [];
    }

    // Get hours
    const hoursData = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}/hours`);
    if (hoursData) {
      entityData.hours = hoursData.hours || hoursData;
    }

    // Get photos
    const photosData = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}/photos`);
    if (photosData) {
      entityData.photos = photosData.photos || photosData;
    }

    // Get offers/specials
    const offersData = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}/offers`);
    if (offersData) {
      entityData.specials = offersData.offers || offersData;
    }

    // Get amenities
    const amenitiesData = await fetchData(`${OLD_API}/api/gcr/entity/${encodeURIComponent(slug)}/amenities`);
    if (amenitiesData) {
      entityData.amenities = amenitiesData.amenities || amenitiesData;
    }

    // Save entity
    const entityFile = path.join(entitiesDir, `${slug}.json`);
    saveJSON(entityFile, entityData);

    // Add to index
    index.push({
      slug,
      name: entityData.name || entity.name,
      entity_type: entityData.entity_type || entity.entity_type,
      entity_subtype: entityData.entity_subtype || entity.entity_subtype,
      city: entityData.city || entity.city,
      hero_image_url: entityData.hero_image_url,
      rating: entityData.rating,
      price_range: entityData.price_range,
      tags: entityData.tags || [],
      featured: entityData.featured
    });
  }

  // 3. Save index
  console.log('\n💾 Saving entities index...');
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);
  console.log(`   ✓ Saved index with ${index.length} entities`);

  // 4. Get global events
  console.log('\n📥 Fetching events...');
  const eventsData = await fetchData(`${OLD_API}/api/gcr/events?limit=10000`);
  const events = Array.isArray(eventsData) ? eventsData : eventsData?.events || [];
  saveJSON(path.join(DATA_DIR, 'events.json'), events);
  console.log(`   ✓ Saved ${events.length} events`);

  // 5. Get global specials
  console.log('\n📥 Fetching specials...');
  const specialsData = await fetchData(`${OLD_API}/api/gcr/specials?limit=10000`);
  const specials = Array.isArray(specialsData) ? specialsData : specialsData?.specials || [];
  saveJSON(path.join(DATA_DIR, 'specials.json'), specials);
  console.log(`   ✓ Saved ${specials.length} specials`);

  // 6. Get global happy hours
  console.log('\n📥 Fetching happy hours...');
  const hhData = await fetchData(`${OLD_API}/api/gcr/happy-hours?limit=10000`);
  const happyHours = Array.isArray(hhData) ? hhData : hhData?.['happy-hours'] || hhData?.happy_hours || [];
  saveJSON(path.join(DATA_DIR, 'happy-hours.json'), happyHours);
  console.log(`   ✓ Saved ${happyHours.length} happy hour records`);

  console.log('\n✅ Sync complete!');
  console.log(`   - ${index.length} entities with full data`);
  console.log(`   - ${events.length} events`);
  console.log(`   - ${specials.length} specials`);
  console.log(`   - ${happyHours.length} happy hour records`);
}

syncAllData().catch(e => {
  console.error('❌ Sync failed:', e);
  process.exit(1);
});
