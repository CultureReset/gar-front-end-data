#!/usr/bin/env node
/**
 * Sync COMPLETE organized data from /json/ directories
 * Uses the most complete version of each business
 */

const fs = require('fs');
const path = require('path');

const ORGANIZED_DIR = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function syncCompleteData() {
  console.log('🔄 Syncing COMPLETE organized data...\n');

  const businessDirs = fs.readdirSync(ORGANIZED_DIR).filter(f => {
    const stat = fs.statSync(path.join(ORGANIZED_DIR, f));
    return stat.isDirectory() && !f.startsWith('_');
  });

  console.log(`📂 Found ${businessDirs.length} business directories\n`);

  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];
  let processed = 0;
  let withMenus = 0;
  let withImages = 0;
  let withEvents = 0;

  businessDirs.forEach((dirName, i) => {
    if (i % 500 === 0 && i > 0) console.log(`   Processed ${i}/${businessDirs.length}...`);

    const businessPath = path.join(ORGANIZED_DIR, dirName);
    const jsonDir = path.join(businessPath, 'json');

    let bestData = null;
    let bestScore = 0;

    // Find the BEST version in /json/ directory
    if (fs.existsSync(jsonDir)) {
      const jsonFiles = fs.readdirSync(jsonDir)
        .filter(f => f.endsWith('.json'))
        .sort();

      for (const jsonFile of jsonFiles) {
        const data = loadJSON(path.join(jsonDir, jsonFile));
        if (data && data.completenessScore > bestScore) {
          bestScore = data.completenessScore;
          bestData = data;
        }
      }
    }

    // Fallback to _CONSOLIDATED.json if nothing in /json/
    if (!bestData) {
      bestData = loadJSON(path.join(businessPath, '_CONSOLIDATED.json'));
    }

    if (!bestData) return;

    // Transform to standard format
    const slug = dirName;
    const entity = {
      slug,
      name: bestData.name || dirName.replace(/-/g, ' '),
      entity_type: bestData.profileType || bestData.category || 'business',
      entity_subtype: bestData.category,
      icon: bestData.emoji || '🏪',
      description: bestData.description || '',
      phone: bestData.phone,
      email: bestData.email,
      address_line_1: bestData.address,
      city: bestData.region || '',
      website_url: bestData.website,
      rating: bestData.rating,
      review_count: bestData.reviewCount,
      hours: bestData.hours || [],
      menu_sections: bestData.menu || [],
      drink_sections: [],
      happy_hour: { schedule: '', sections: [] },
      events: bestData.events || [],
      photos: bestData.images || [],
      hero_image_url: bestData.images && bestData.images[0] ? bestData.images[0] : null,
      amenities: bestData.amenities || [],
      tags: bestData.types || [],
      featured: false,
      is_active: bestData.isActive !== false,
      completeness_score: bestData.completenessScore,
      sources: bestData.sources || {}
    };

    // Count features
    if (entity.menu_sections && entity.menu_sections.length > 0) withMenus++;
    if (entity.photos && entity.photos.length > 0) withImages++;
    if (entity.events && entity.events.length > 0) withEvents++;

    // Save entity
    const entityPath = path.join(entitiesDir, `${slug}.json`);
    saveJSON(entityPath, entity);

    // Add to index
    index.push({
      slug,
      name: entity.name,
      entity_type: entity.entity_type,
      entity_subtype: entity.entity_subtype,
      city: entity.city,
      hero_image_url: entity.hero_image_url,
      rating: entity.rating,
      tags: entity.tags,
      featured: entity.featured,
      completeness_score: entity.completeness_score
    });

    processed++;
  });

  // Save index
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);

  console.log(`\n✅ Sync complete!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - ${processed} businesses synced`);
  console.log(`   - ${withMenus} with menus (${Math.round(withMenus/processed*100)}%)`);
  console.log(`   - ${withImages} with images (${Math.round(withImages/processed*100)}%)`);
  console.log(`   - ${withEvents} with events (${Math.round(withEvents/processed*100)}%)`);
  console.log(`\n🚀 gar-front-end-data ready with COMPLETE organized data!`);
}

syncCompleteData().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
