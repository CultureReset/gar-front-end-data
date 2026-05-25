#!/usr/bin/env node
/**
 * Sync from MASTER-ALL-BUSINESSES-COMPLETE organized data
 * Uses Hauki-organized consolidated data from May 22
 * Most complete source with all images, menus, hours, etc.
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

async function syncOrganizedData() {
  console.log('🔄 Starting sync from organized data (May 22)...\n');

  // Load master index
  console.log('📥 Loading _MASTER-INDEX.json...');
  const masterIndex = loadJSON(path.join(ORGANIZED_DIR, '_MASTER-INDEX.json'));
  if (!masterIndex) {
    console.error('❌ Could not load _MASTER-INDEX.json');
    process.exit(1);
  }
  console.log(`   ✓ Loaded ${masterIndex.length} records from index`);

  // Load consolidated master
  console.log('\n📥 Loading _CONSOLIDATED.json...');
  const consolidated = loadJSON(path.join(ORGANIZED_DIR, '_CONSOLIDATED.json'));
  console.log(`   ✓ Loaded consolidated data`);

  // Process each business directory
  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];
  const businessDirs = fs.readdirSync(ORGANIZED_DIR).filter(f => {
    const stat = fs.statSync(path.join(ORGANIZED_DIR, f));
    return stat.isDirectory() && !f.startsWith('_');
  });

  console.log(`\n🔀 Processing ${businessDirs.length} business directories...\n`);

  let processed = 0;
  businessDirs.forEach((dirName, i) => {
    if (i % 100 === 0 && i > 0) console.log(`   Processed ${i}/${businessDirs.length}...`);

    const businessPath = path.join(ORGANIZED_DIR, dirName);
    const slug = dirName;

    // Initialize entity object
    let entity = {
      slug,
      name: dirName.replace(/-/g, ' '),
      entity_type: 'business',
      entity_subtype: '',
      icon: '🏪',
      featured: false,
      photos: [],
      menu_sections: [],
      drink_sections: [],
      happy_hour: { schedule: '', sections: [] },
      events: [],
      specials: [],
      tags: [],
      amenities: {}
    };

    // Load entity.json if exists
    const entityFile = path.join(businessPath, 'entity.json');
    if (fs.existsSync(entityFile)) {
      const loaded = loadJSON(entityFile);
      if (loaded) entity = { ...entity, ...loaded };
    }

    // Load menus.json
    const menusFile = path.join(businessPath, 'menus.json');
    if (fs.existsSync(menusFile)) {
      const menus = loadJSON(menusFile);
      if (menus) {
        entity.menu_sections = menus.menu_sections || menus.sections || [];
        entity.drink_sections = menus.drink_sections || menus.drinks || [];
      }
    }

    // Load hours.json
    const hoursFile = path.join(businessPath, 'hours.json');
    if (fs.existsSync(hoursFile)) {
      const hours = loadJSON(hoursFile);
      if (hours) entity.hours = hours.hours || hours;
    }

    // Load photos.json
    const photosFile = path.join(businessPath, 'photos.json');
    if (fs.existsSync(photosFile)) {
      const photos = loadJSON(photosFile);
      if (photos) {
        entity.photos = photos.photos || photos.images || photos;
        // Set hero image from first photo if not set
        if (!entity.hero_image_url && photos.length > 0) {
          entity.hero_image_url = photos[0].url || photos[0];
        }
      }
    }

    // Load specials.json
    const specialsFile = path.join(businessPath, 'specials.json');
    if (fs.existsSync(specialsFile)) {
      const specials = loadJSON(specialsFile);
      if (specials) entity.specials = specials;
    }

    // Load events.json
    const eventsFile = path.join(businessPath, 'events.json');
    if (fs.existsSync(eventsFile)) {
      const events = loadJSON(eventsFile);
      if (events) entity.events = events;
    }

    // Load happy-hour.json
    const hhFile = path.join(businessPath, 'happy-hour.json');
    if (fs.existsSync(hhFile)) {
      const hh = loadJSON(hhFile);
      if (hh) entity.happy_hour = hh;
    }

    // Load tags.json
    const tagsFile = path.join(businessPath, 'tags.json');
    if (fs.existsSync(tagsFile)) {
      const tags = loadJSON(tagsFile);
      if (tags) entity.tags = tags;
    }

    // Load amenities.json
    const amenitiesFile = path.join(businessPath, 'amenities.json');
    if (fs.existsSync(amenitiesFile)) {
      const amenities = loadJSON(amenitiesFile);
      if (amenities) entity.amenities = amenities;
    }

    // Save entity
    const entityPath = path.join(entitiesDir, `${slug}.json`);
    saveJSON(entityPath, entity);

    // Add to index
    index.push({
      slug,
      name: entity.name,
      entity_type: entity.entity_type,
      entity_subtype: entity.entity_subtype,
      city: entity.city || '',
      hero_image_url: entity.hero_image_url,
      rating: entity.rating,
      price_range: entity.price_range,
      tags: entity.tags || [],
      featured: entity.featured,
      photos_count: (entity.photos || []).length,
      menu_sections_count: (entity.menu_sections || []).length
    });

    processed++;
  });

  // Save index
  console.log(`\n💾 Saving entities index...`);
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);
  console.log(`   ✓ Saved index with ${index.length} entities`);

  // Summary
  const withPhotos = index.filter(e => e.photos_count > 0).length;
  const withMenus = index.filter(e => e.menu_sections_count > 0).length;

  console.log('\n✅ Sync from organized data complete!');
  console.log(`\n📊 Final Summary:`);
  console.log(`   - ${index.length} total businesses`);
  console.log(`   - ${withPhotos} with photos (${Math.round(withPhotos/index.length*100)}%)`);
  console.log(`   - ${withMenus} with menus (${Math.round(withMenus/index.length*100)}%)`);
  console.log(`\n🚀 gar-front-end-data now populated with COMPLETE organized data!`);
}

syncOrganizedData().catch(e => {
  console.error('❌ Sync failed:', e);
  process.exit(1);
});
