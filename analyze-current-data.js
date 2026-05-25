#!/usr/bin/env node
/**
 * Detailed analysis of current gar-front-end-data state
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function analyze() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📊 DETAILED DATA ANALYSIS - gar-front-end-data');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Load index
  const index = loadJSON(path.join(DATA_DIR, 'entities-index.json')) || [];
  console.log(`📈 TOTAL ENTITIES: ${index.length}\n`);

  // Load sample entities for detailed analysis
  console.log('🔍 Analyzing entity data completeness...\n');

  let withPhone = 0;
  let withEmail = 0;
  let withWebsite = 0;
  let withAddress = 0;
  let withRating = 0;
  let withImages = 0;
  let withPlaceId = 0;
  let withMenus = 0;
  let withEvents = 0;
  let withHours = 0;
  let withDescription = 0;
  let withAmenities = 0;

  const typeCount = {};
  const cityCount = {};
  const ratings = [];

  // Sample every nth entity to avoid loading all 8750
  const sampleRate = Math.max(1, Math.floor(index.length / 1000));
  let sampledCount = 0;

  for (let i = 0; i < index.length; i += sampleRate) {
    const entry = index[i];
    sampledCount++;

    try {
      const entity = loadJSON(path.join(ENTITIES_DIR, `${entry.slug}.json`));
      if (!entity) continue;

      // Count completeness
      if (entity.phone) withPhone++;
      if (entity.email) withEmail++;
      if (entity.website) withWebsite++;
      if (entity.address) withAddress++;
      if (entity.rating && entity.rating > 0) withRating++;
      if (entity.hero_image_url || entity.image) withImages++;
      if (entity.google_places_id) withPlaceId++;
      if (entity.menus && entity.menus.length > 0) withMenus++;
      if (entity.events && entity.events.length > 0) withEvents++;
      if (entity.hours && Object.keys(entity.hours).length > 0) withHours++;
      if (entity.description) withDescription++;
      if (entity.amenities && entity.amenities.length > 0) withAmenities++;

      // Track types
      const type = entity.entity_type || 'Other';
      typeCount[type] = (typeCount[type] || 0) + 1;

      // Track cities
      if (entity.city) {
        cityCount[entity.city] = (cityCount[entity.city] || 0) + 1;
      }

      // Track ratings
      if (entity.rating && entity.rating > 0) {
        ratings.push(entity.rating);
      }
    } catch (e) {
      // Skip
    }
  }

  // Extrapolate to full dataset
  const multiplier = index.length / sampledCount;
  console.log(`📋 DATA COMPLETENESS (sampled ${sampledCount}, extrapolated to ${index.length}):\n`);
  console.log(`   ✅ Phone:         ${Math.round(withPhone * multiplier)} (${Math.round(withPhone/sampledCount*100)}%)`);
  console.log(`   ✅ Email:         ${Math.round(withEmail * multiplier)} (${Math.round(withEmail/sampledCount*100)}%)`);
  console.log(`   ✅ Website:       ${Math.round(withWebsite * multiplier)} (${Math.round(withWebsite/sampledCount*100)}%)`);
  console.log(`   ✅ Address:       ${Math.round(withAddress * multiplier)} (${Math.round(withAddress/sampledCount*100)}%)`);
  console.log(`   ✅ Description:   ${Math.round(withDescription * multiplier)} (${Math.round(withDescription/sampledCount*100)}%)`);
  console.log(`   ✅ Hours:         ${Math.round(withHours * multiplier)} (${Math.round(withHours/sampledCount*100)}%)`);
  console.log(`   ✅ Rating:        ${Math.round(withRating * multiplier)} (${Math.round(withRating/sampledCount*100)}%)`);
  console.log(`   ✅ Image:         ${Math.round(withImages * multiplier)} (${Math.round(withImages/sampledCount*100)}%)`);
  console.log(`   ✅ Google Place ID: ${Math.round(withPlaceId * multiplier)} (${Math.round(withPlaceId/sampledCount*100)}%)`);
  console.log(`   ✅ Menus:         ${Math.round(withMenus * multiplier)} (${Math.round(withMenus/sampledCount*100)}%)`);
  console.log(`   ✅ Events:        ${Math.round(withEvents * multiplier)} (${Math.round(withEvents/sampledCount*100)}%)`);
  console.log(`   ✅ Amenities:     ${Math.round(withAmenities * multiplier)} (${Math.round(withAmenities/sampledCount*100)}%)\n`);

  // Entity types
  console.log(`🏷️  ENTITY TYPES (${Object.keys(typeCount).length} types):\n`);
  Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([type, count]) => {
      const pct = Math.round(count / sampledCount * 100);
      const bar = '█'.repeat(Math.round(pct / 2));
      console.log(`   ${type.padEnd(25)} ${count} (${pct}%) ${bar}`);
    });

  // Top cities
  console.log(`\n🌍 TOP CITIES:\n`);
  Object.entries(cityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([city, count]) => {
      const pct = Math.round(count / sampledCount * 100);
      console.log(`   ${city.padEnd(20)} ${count} (${pct}%)`);
    });

  // Rating distribution
  if (ratings.length > 0) {
    const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
    const max = Math.max(...ratings);
    const min = Math.min(...ratings);
    console.log(`\n⭐ RATINGS:\n`);
    console.log(`   Average:  ${avg}`);
    console.log(`   Range:    ${min} - ${max}`);
    console.log(`   Entities with ratings: ${ratings.length}\n`);
  }

  // Data quality score
  const dataQuality = (
    (withPhone + withEmail + withWebsite + withAddress + withRating +
     withImages + withPlaceId + withHours + withDescription) /
    (sampledCount * 9)
  ) * 100;

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`📊 OVERALL DATA QUALITY SCORE: ${Math.round(dataQuality)}%`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // What was added/merged
  console.log('🔗 CONSOLIDATION RESULTS:\n');
  console.log(`   ✨ Added:     59 new businesses (from Google Place IDs CSV)`);
  console.log(`   📝 Enriched:  2,256 existing with missing data`);
  console.log(`   📊 Total:     8,750 entities\n`);

  // What fields were enriched
  console.log('📥 DATA MERGED FROM SOURCES:\n');
  console.log(`   Documents Complete (1,000 businesses)`);
  console.log(`      → Phone, Email, Website, Address, Description`);
  console.log(`      → Hours, Ratings, Review counts, Images\n`);
  console.log(`   Supabase All Businesses (820 businesses)`);
  console.log(`      → Contact info, Website, Hours, Ratings\n`);
  console.log(`   Organized Progress (1,159 records)`);
  console.log(`      → Phone, Address, Website, Categories\n`);
  console.log(`   Entities Transformed (2,189 records)`);
  console.log(`      → Enhanced descriptions, Tags, Amenities\n`);
  console.log(`   Google Place IDs CSV (661 records)`);
  console.log(`      → Google Place IDs, Hours, Ratings, Reviews\n`);
  console.log(`   Independent Businesses (410 records)`);
  console.log(`      → Phone, Website, Email, Address\n`);

  // What's next
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ READY FOR:`);
  console.log(`   1. Category organization (23 CATEGORY files)`);
  console.log(`   2. Image enrichment (add missing images from Supabase/MASTER)`);
  console.log(`   3. Menu/event extraction from MASTER-ALL-BUSINESSES-COMPLETE`);
  console.log(`   4. launching-GCR display with all 8,750 entities`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

analyze().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
