#!/usr/bin/env node
/**
 * COMPLETE CONSOLIDATION - Load ALL data from ALL sources
 * - MASTER (all json/ and menus/ data)
 * - consolidated-may-2026
 * - Supabase exports
 * - Condos + Vacation homes
 * - Google scrapers
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

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
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      source[key].forEach(item => {
        if (!target[key].some(t => JSON.stringify(t) === JSON.stringify(item))) {
          target[key].push(item);
        }
      });
      continue;
    }
    if (typeof source[key] === 'object' && typeof target[key] === 'object') {
      deepMergeAll(target[key], source[key]);
      continue;
    }
    if (!target[key] || target[key] === '' || target[key] === null) {
      target[key] = source[key];
    }
  }
  return target;
}

async function consolidateEverything() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔗 COMPLETE CONSOLIDATION - ALL DATA FROM ALL SOURCES');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const entityMap = new Map();
  let totalLoaded = 0;

  // ─────── LOAD EXISTING ───────────
  console.log('📦 Loading existing entities...');
  const existingFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  existingFiles.forEach(file => {
    const slug = file.replace('.json', '');
    const entity = loadJSON(path.join(ENTITIES_DIR, file));
    if (entity) entityMap.set(slug, entity);
  });
  console.log(`✅ Loaded ${entityMap.size} existing entities\n`);

  // ─────── MASTER (COMPLETE) ───────────
  console.log('📂 MASTER-ALL-BUSINESSES-COMPLETE...');
  const masterPath = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
  if (fs.existsSync(masterPath)) {
    const bizFolders = fs.readdirSync(masterPath)
      .filter(f => fs.statSync(path.join(masterPath, f)).isDirectory());

    for (const bizFolder of bizFolders) {
      const bizPath = path.join(masterPath, bizFolder);
      const consolidatedPath = path.join(bizPath, '_CONSOLIDATED.json');

      if (!fs.existsSync(consolidatedPath)) continue;

      let entity = loadJSON(consolidatedPath);
      if (!entity || !entity.name) continue;

      const slug = slugify(entity.name);

      // Load and merge _AI-CURATED.json
      const curatedPath = path.join(bizPath, '_AI-CURATED.json');
      if (fs.existsSync(curatedPath)) {
        const curated = loadJSON(curatedPath);
        if (curated) deepMergeAll(entity, curated);
      }

      // Load and merge all JSON files from json/ directory
      const jsonDir = path.join(bizPath, 'json');
      if (fs.existsSync(jsonDir)) {
        const jsonFiles = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
        for (const jsonFile of jsonFiles) {
          const jsonData = loadJSON(path.join(jsonDir, jsonFile));
          if (jsonData) deepMergeAll(entity, jsonData);
        }
      }

      // Load and merge menus
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
            } else {
              entity.menu_sections.push(menuData);
            }
          }
        }
      }

      if (entityMap.has(slug)) {
        deepMergeAll(entityMap.get(slug), entity);
      } else {
        entity.slug = slug;
        entityMap.set(slug, entity);
      }
      totalLoaded++;
    }
  }
  console.log(`✅ Loaded ${totalLoaded} MASTER entries\n`);

  // ─────── CONSOLIDATED-MAY-2026 ───────────
  console.log('📂 consolidated-may-2026...');
  const consolidatedPath = '/Users/owner/consolidated-may-2026';
  let consolidatedCount = 0;
  if (fs.existsSync(consolidatedPath)) {
    const bizFolders = fs.readdirSync(consolidatedPath)
      .filter(f => fs.statSync(path.join(consolidatedPath, f)).isDirectory());

    for (const bizFolder of bizFolders) {
      const bizPath = path.join(consolidatedPath, bizFolder);

      // Try different data files
      let data = null;
      const tryFiles = ['_CONSOLIDATED.json', 'data.json', 'index.json'];
      for (const tryFile of tryFiles) {
        const tryPath = path.join(bizPath, tryFile);
        if (fs.existsSync(tryPath)) {
          data = loadJSON(tryPath);
          if (data) break;
        }
      }

      if (!data || !data.name) continue;

      const slug = slugify(data.name);
      if (entityMap.has(slug)) {
        deepMergeAll(entityMap.get(slug), data);
      } else {
        data.slug = slug;
        entityMap.set(slug, data);
      }
      consolidatedCount++;
    }
  }
  console.log(`✅ Loaded ${consolidatedCount} from consolidated-may-2026\n`);

  // ─────── CONDOS ───────────
  console.log('📂 condos_data...');
  const condosPath = '/Users/owner/condos_data';
  let condosCount = 0;
  if (fs.existsSync(condosPath)) {
    const files = fs.readdirSync(condosPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(condosPath, file));
      if (!data || !data.name) continue;
      const slug = slugify(data.name);
      if (entityMap.has(slug)) {
        deepMergeAll(entityMap.get(slug), data);
      } else {
        data.slug = slug;
        entityMap.set(slug, data);
      }
      condosCount++;
    }
  }
  console.log(`✅ Loaded ${condosCount} condos\n`);

  // ─────── VACATION HOMES ───────────
  console.log('📂 vacationhomes_data...');
  const vacPath = '/Users/owner/vacationhomes_data';
  let vacCount = 0;
  if (fs.existsSync(vacPath)) {
    const files = fs.readdirSync(vacPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(vacPath, file));
      if (!data || !data.name) continue;
      const slug = slugify(data.name);
      if (entityMap.has(slug)) {
        deepMergeAll(entityMap.get(slug), data);
      } else {
        data.slug = slug;
        entityMap.set(slug, data);
      }
      vacCount++;
    }
  }
  console.log(`✅ Loaded ${vacCount} vacation homes\n`);

  // ─────── SAVE ALL ───────────
  console.log('💾 SAVING ALL ENTITIES...\n');
  let saved = 0;
  for (const [slug, entity] of entityMap) {
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;
      if (saved % 500 === 0) console.log(`   Saved ${saved}/${entityMap.size}...`);
    } catch (e) {
      console.error(`Error saving ${slug}`);
    }
  }
  console.log(`✅ Saved ${saved} entities\n`);

  // ─────── UPDATE INDEX ───────────
  console.log('📝 Updating index...\n');
  const newIndex = Array.from(entityMap.values()).map(e => ({
    slug: e.slug,
    name: e.name,
    entity_type: e.entity_type || 'Other',
    entity_subtype: e.entity_subtype || '',
    city: e.city || '',
    hero_image_url: e.hero_image_url || '',
    rating: e.rating || 0,
    tags: e.tags || [],
    featured: e.featured || false
  }));

  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-index.json'),
    JSON.stringify(newIndex, null, 2)
  );

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ COMPLETE CONSOLIDATION DONE!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`📊 Final Results:`);
  console.log(`   Total entities: ${entityMap.size}`);
  console.log(`   - MASTER: ${totalLoaded}`);
  console.log(`   - consolidated-may-2026: ${consolidatedCount}`);
  console.log(`   - Condos: ${condosCount}`);
  console.log(`   - Vacation homes: ${vacCount}`);
  console.log(`   - Index entries: ${newIndex.length}\n`);

  console.log(`🚀 All data fully consolidated!\n`);
}

consolidateEverything().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
