#!/usr/bin/env node
/**
 * FAST CONSOLIDATION - Load _CONSOLIDATED.json from each source
 */

const fs = require('fs');
const path = require('path');

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

async function consolidateFast() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('⚡ FAST CONSOLIDATION - Load & merge core data');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const entityMap = new Map();

  // Load existing
  console.log('📦 Loading existing entities...');
  const existingFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  existingFiles.forEach(file => {
    const slug = file.replace('.json', '');
    const entity = loadJSON(path.join(ENTITIES_DIR, file));
    if (entity && entity.name) entityMap.set(slug, entity);
  });
  console.log(`✅ Loaded ${entityMap.size} existing\n`);

  // MASTER - just load _CONSOLIDATED.json
  console.log('📂 MASTER (loading _CONSOLIDATED.json only)...');
  const masterPath = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
  let masterCount = 0;
  if (fs.existsSync(masterPath)) {
    const folders = fs.readdirSync(masterPath);
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const bizPath = path.join(masterPath, folder);

      if (!fs.statSync(bizPath).isDirectory()) continue;

      const consPath = path.join(bizPath, '_CONSOLIDATED.json');
      if (fs.existsSync(consPath)) {
        const data = loadJSON(consPath);
        if (data && data.name) {
          const slug = slugify(data.name);
          if (entityMap.has(slug)) {
            deepMerge(entityMap.get(slug), data);
          } else {
            data.slug = slug;
            entityMap.set(slug, data);
          }
          masterCount++;
        }
      }

      if ((i + 1) % 500 === 0) {
        console.log(`   ${i + 1}/5663...`);
      }
    }
  }
  console.log(`✅ Merged ${masterCount} MASTER entries\n`);

  // consolidated-may-2026
  console.log('📂 consolidated-may-2026...');
  const consPath = '/Users/owner/consolidated-may-2026';
  let consCount = 0;
  if (fs.existsSync(consPath)) {
    const folders = fs.readdirSync(consPath).filter(f => {
      try {
        return fs.statSync(path.join(consPath, f)).isDirectory();
      } catch {
        return false;
      }
    });
    for (const folder of folders) {
      const dataPath = path.join(consPath, folder, '_CONSOLIDATED.json');
      if (fs.existsSync(dataPath)) {
        const data = loadJSON(dataPath);
        if (data && data.name) {
          const slug = slugify(data.name);
          if (entityMap.has(slug)) {
            deepMerge(entityMap.get(slug), data);
          } else {
            data.slug = slug;
            entityMap.set(slug, data);
          }
          consCount++;
        }
      }
    }
  }
  console.log(`✅ Merged ${consCount} from consolidated-may-2026\n`);

  // Condos
  console.log('📂 condos_data...');
  const condosPath = '/Users/owner/condos_data';
  let condosCount = 0;
  if (fs.existsSync(condosPath)) {
    const files = fs.readdirSync(condosPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(condosPath, file));
      if (data && data.name) {
        const slug = slugify(data.name);
        if (entityMap.has(slug)) {
          deepMerge(entityMap.get(slug), data);
        } else {
          data.slug = slug;
          entityMap.set(slug, data);
        }
        condosCount++;
      }
    }
  }
  console.log(`✅ Merged ${condosCount} condos\n`);

  // Vacation homes
  console.log('📂 vacationhomes_data...');
  const vacPath = '/Users/owner/vacationhomes_data';
  let vacCount = 0;
  if (fs.existsSync(vacPath)) {
    const files = fs.readdirSync(vacPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(vacPath, file));
      if (data && data.name) {
        const slug = slugify(data.name);
        if (entityMap.has(slug)) {
          deepMerge(entityMap.get(slug), data);
        } else {
          data.slug = slug;
          entityMap.set(slug, data);
        }
        vacCount++;
      }
    }
  }
  console.log(`✅ Merged ${vacCount} vacation homes\n`);

  // Save
  console.log('💾 SAVING...\n');
  let saved = 0;
  for (const [slug, entity] of entityMap) {
    try {
      fs.writeFileSync(
        path.join(ENTITIES_DIR, `${slug}.json`),
        JSON.stringify(entity, null, 2)
      );
      saved++;
      if (saved % 1000 === 0) console.log(`   Saved ${saved}/${entityMap.size}...`);
    } catch (e) {}
  }
  console.log(`✅ Saved ${saved}\n`);

  // Index
  console.log('📝 Updating index...\n');
  const index = Array.from(entityMap.values()).map(e => ({
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
    JSON.stringify(index, null, 2)
  );

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ CONSOLIDATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`📊 Total: ${entityMap.size} entities\n`);
}

consolidateFast().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
