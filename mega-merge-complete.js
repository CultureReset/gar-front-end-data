#!/usr/bin/env node
/**
 * MEGA MERGE - Pull EVERYTHING into gar-front-end-data
 * Sources: 82K+ records, 21K+ images, ALL data
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const MASTER_PATH = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function deepMergeAll(target, source) {
  if (!source) return target;

  for (const key in source) {
    if (!source[key] || source[key] === '') continue;
    if (!target[key]) {
      target[key] = source[key];
      continue;
    }

    // Arrays - merge without duplicates
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      source[key].forEach(item => {
        if (!target[key].some(t => JSON.stringify(t) === JSON.stringify(item))) {
          target[key].push(item);
        }
      });
      continue;
    }

    // Objects - recursively merge
    if (typeof source[key] === 'object' && typeof target[key] === 'object') {
      deepMergeAll(target[key], source[key]);
      continue;
    }

    // Primitives - target wins if it has value
    if (!target[key] || target[key] === '' || target[key] === null) {
      target[key] = source[key];
    }
  }

  return target;
}

async function megaMerge() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔗 MEGA MERGE - Pull ALL data into gar-front-end-data');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Load existing
  console.log('📦 Loading existing gar-front-end-data entities...');
  const existingMap = new Map();
  const nameMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   ${idx}/${entityFiles.length}...`);
    const slug = file.replace('.json', '');
    try {
      const entity = loadJSON(path.join(ENTITIES_DIR, file));
      existingMap.set(slug, entity);
      if (entity.name) nameMap.set(entity.name.toLowerCase(), slug);
    } catch (e) {}
  });

  console.log(`✅ Loaded ${existingMap.size} existing entities\n`);

  // PHASE 1: Merge from MASTER-ALL-BUSINESSES-COMPLETE
  console.log('🔄 PHASE 1: Merging MASTER data (5,663 folders)\n');

  const businesses = fs.readdirSync(MASTER_PATH).filter(f => {
    return fs.statSync(path.join(MASTER_PATH, f)).isDirectory();
  });

  let masterMerged = 0;
  let masterAdded = 0;
  let masterImages = 0;

  for (let i = 0; i < businesses.length; i++) {
    const bizName = businesses[i];
    const bizPath = path.join(MASTER_PATH, bizName);

    if (i % 500 === 0 && i > 0) {
      console.log(`   Processed ${i}/${businesses.length} - Merged: ${masterMerged}, Added: ${masterAdded}, Images: ${masterImages}`);
    }

    // Load _CONSOLIDATED.json first
    const consolidatedPath = path.join(bizPath, '_CONSOLIDATED.json');
    if (!fs.existsSync(consolidatedPath)) continue;

    const consolidated = loadJSON(consolidatedPath);
    if (!consolidated || !consolidated.name) continue;

    const slug = slugify(consolidated.name);
    const normName = consolidated.name.toLowerCase();

    // Find or create entity
    let entity;
    let existingSlug = slug;

    if (existingMap.has(slug)) {
      entity = existingMap.get(slug);
      masterMerged++;
    } else if (nameMap.has(normName)) {
      existingSlug = nameMap.get(normName);
      entity = existingMap.get(existingSlug);
      masterMerged++;
    } else {
      entity = { name: consolidated.name, slug: slug };
      masterAdded++;
    }

    // Merge basic info
    deepMergeAll(entity, consolidated);

    // Merge all JSON files in /json/ directory
    const jsonDir = path.join(bizPath, 'json');
    if (fs.existsSync(jsonDir)) {
      const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
      jsonFiles.forEach(file => {
        const data = loadJSON(path.join(jsonDir, file));
        if (data) deepMergeAll(entity, data);
      });
    }

    // Merge _AI-CURATED.json if exists
    const curatedPath = path.join(bizPath, '_AI-CURATED.json');
    if (fs.existsSync(curatedPath)) {
      const curated = loadJSON(curatedPath);
      if (curated) deepMergeAll(entity, curated);
    }

    // Collect images
    const photoDir = path.join(bizPath, 'photos-images-unsorted');
    if (fs.existsSync(photoDir)) {
      const images = fs.readdirSync(photoDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });

      if (images.length > 0) {
        entity.images = entity.images || [];
        images.forEach(img => {
          const imgPath = path.join(photoDir, img);
          entity.images.push({
            path: imgPath,
            filename: img,
            type: 'master-organized'
          });
          masterImages++;
        });
      }
    }

    existingMap.set(existingSlug, entity);
    nameMap.set(normName, existingSlug);
  }

  console.log(`✅ MASTER merge complete: ${masterMerged} merged, ${masterAdded} added, ${masterImages} images\n`);

  // PHASE 2: Save all entities
  console.log('💾 PHASE 2: Saving all entities\n');

  let saved = 0;
  for (const [slug, entity] of existingMap) {
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}`);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved}/${existingMap.size}...`);
    }
  }

  console.log(`✅ Saved ${saved} entities\n`);

  // PHASE 3: Update index
  console.log('📝 PHASE 3: Updating index\n');

  const newIndex = Array.from(existingMap.values()).map(entity => ({
    slug: entity.slug,
    name: entity.name,
    entity_type: entity.entity_type || entity.type || 'Other',
    entity_subtype: entity.entity_subtype || '',
    city: entity.city || '',
    hero_image_url: entity.hero_image_url || '',
    rating: entity.rating || 0,
    tags: entity.tags || [],
    featured: entity.featured || false,
    images: (entity.images || []).length
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'entities-index.json'), JSON.stringify(newIndex, null, 2));

  // Final stats
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ MEGA MERGE COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`📊 Final Results:`);
  console.log(`   Total entities: ${existingMap.size}`);
  console.log(`   From MASTER: ${masterMerged + masterAdded}`);
  console.log(`   - Merged: ${masterMerged}`);
  console.log(`   - New: ${masterAdded}`);
  console.log(`   - Total images: ${masterImages}\n`);

  const withImages = newIndex.filter(e => e.images > 0).length;
  console.log(`   Entities with images: ${withImages} (${Math.round(withImages/existingMap.size*100)}%)\n`);

  console.log(`🚀 gar-front-end-data now has EVERYTHING merged!\n`);
}

megaMerge().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
