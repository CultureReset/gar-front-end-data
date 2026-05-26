#!/usr/bin/env node
/**
 * LOAD MENUS & PHOTOS from MASTER directories
 * Actually load the files from json/ and menus/ subdirectories
 */

const fs = require('fs');
const path = require('path');

const ENTITIES_DIR = path.join(__dirname, 'data/entities');
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

function deepMerge(target, source) {
  if (!source) return target;
  for (const key in source) {
    if (!source[key] || source[key] === '') continue;
    if (!target[key]) {
      target[key] = source[key];
    } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      source[key].forEach(item => {
        if (!target[key].some(t => JSON.stringify(t) === JSON.stringify(item))) {
          target[key].push(item);
        }
      });
    } else if (typeof source[key] === 'object' && typeof target[key] === 'object') {
      deepMerge(target[key], source[key]);
    } else if (!target[key] || target[key] === '' || target[key] === null) {
      target[key] = source[key];
    }
  }
  return target;
}

async function loadMenusAndPhotos() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📂 LOADING MENUS & PHOTOS from MASTER directories');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Load all MASTER folders
  const folders = fs.readdirSync(MASTER_PATH)
    .filter(f => fs.statSync(path.join(MASTER_PATH, f)).isDirectory());

  console.log(`Found ${folders.length} MASTER folders\n`);

  let enriched = 0;
  let menus_loaded = 0;
  let photos_loaded = 0;

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const bizPath = path.join(MASTER_PATH, folder);

    // Get business name from _CONSOLIDATED.json
    const consPath = path.join(bizPath, '_CONSOLIDATED.json');
    if (!fs.existsSync(consPath)) continue;

    const cons = loadJSON(consPath);
    if (!cons || !cons.name) continue;

    const slug = slugify(cons.name);
    const entityPath = path.join(ENTITIES_DIR, `${slug}.json`);

    // Load the entity if it exists
    if (!fs.existsSync(entityPath)) continue;

    let entity = loadJSON(entityPath);
    if (!entity) continue;

    let updated = false;

    // Load menus from menus/ directory
    const menusDir = path.join(bizPath, 'menus');
    if (fs.existsSync(menusDir)) {
      const menuFiles = fs.readdirSync(menusDir).filter(f => f.endsWith('.json'));
      for (const menuFile of menuFiles) {
        const menuData = loadJSON(path.join(menusDir, menuFile));
        if (menuData) {
          if (!entity.menu_sections) entity.menu_sections = [];
          if (Array.isArray(menuData)) {
            entity.menu_sections.push(...menuData);
          } else if (menuData.sections) {
            entity.menu_sections.push(...menuData.sections);
          } else if (menuData.items) {
            entity.menu_sections.push({items: menuData.items});
          }
          menus_loaded++;
          updated = true;
        }
      }
    }

    // Load photos
    const photoDir = path.join(bizPath, 'photos-images-unsorted');
    if (fs.existsSync(photoDir)) {
      const images = fs.readdirSync(photoDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });
      if (images.length > 0) {
        if (!entity.photos) entity.photos = [];
        images.slice(0, 20).forEach(img => { // limit to 20 per entity
          entity.photos.push({
            filename: img,
            path: path.join(photoDir, img),
            type: 'master'
          });
        });
        photos_loaded += images.length;
        updated = true;
      }
    }

    // Load all JSON files from json/ directory
    const jsonDir = path.join(bizPath, 'json');
    if (fs.existsSync(jsonDir)) {
      const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json')).slice(0, 10);
      for (const jsonFile of jsonFiles) {
        const jsonData = loadJSON(path.join(jsonDir, jsonFile));
        if (jsonData) {
          deepMerge(entity, jsonData);
          updated = true;
        }
      }
    }

    if (updated) {
      try {
        fs.writeFileSync(entityPath, JSON.stringify(entity, null, 2));
        enriched++;
      } catch (e) {}
    }

    if ((i + 1) % 500 === 0) {
      console.log(`   ${i + 1}/${folders.length} - Enriched: ${enriched}, Menus: ${menus_loaded}, Photos: ${photos_loaded}`);
    }
  }

  console.log(`\n✅ ENRICHMENT COMPLETE`);
  console.log(`   Entities enriched: ${enriched}`);
  console.log(`   Menu sections loaded: ${menus_loaded}`);
  console.log(`   Photos loaded: ${photos_loaded}\n`);
}

loadMenusAndPhotos().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
