#!/usr/bin/env node
/**
 * CONSOLIDATE LOCAL BUSINESSES ONLY
 * - Orange Beach & Gulf Shores ONLY
 * - Filter out franchises (CVS, Walmart, Publix, etc)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

const CHAINS = new Set([
  'cvs', 'walgreens', 'walmart', 'target', 'publix', 'winn-dixie',
  'bestbuy', 'lowes', 'home depot', 'tjmaxx', 'ross', 'marshalls',
  'olive garden', 'red lobster', 'applebees', 'chilis', 'dennys',
  'mcdonalds', 'burger king', 'wendys', 'taco bell', 'kfc', 'popeyes',
  'subway', 'pandaexpress', 'chipotle', 'qdoba', 'five guys',
  'pizza hut', 'dominos', 'littlecaesars', 'papa johns',
  'dunkindonuts', 'starbucks', 'sonic', 'whataburger', 'in-n-out',
  'cracker barrel', 'welcome to moose', 'perkins', 'ihop', 'waffle house',
  'texas roadhouse', 'longhorns steakhouse', 'ruth chris', 'shoney\'s',
  'bonefish grill', 'outback steakhouse', 'sizzler', 'black angus'
]);

function isChain(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  for (const chain of CHAINS) {
    if (lower.includes(chain)) return true;
  }
  return false;
}

function isLocalArea(entity) {
  const name = (entity.name || '').toLowerCase();
  const address = (entity.address || entity.address_line_1 || '').toLowerCase();
  const city = (entity.city || '').toLowerCase();
  const fullText = name + ' ' + address + ' ' + city;

  // Include if Orange Beach or Gulf Shores in any field
  if (fullText.includes('orange beach') || fullText.includes('gulf shores')) {
    return true;
  }

  // Also include if AL address but no city info (likely local)
  if (address.includes(', al ') && (address.includes('orange') || address.includes('gulf'))) {
    return true;
  }

  return false;
}

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

async function consolidateLocal() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🏖️  CONSOLIDATE LOCAL BUSINESSES ONLY');
  console.log('   Orange Beach & Gulf Shores ONLY');
  console.log('   Excluding chains (CVS, Walmart, Publix, etc)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const entityMap = new Map();

  // Load MASTER - filter local + non-chains
  console.log('📂 MASTER-ALL-BUSINESSES-COMPLETE...');
  const masterPath = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
  let masterLocal = 0;
  let masterChains = 0;

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
          if (isChain(data.name)) {
            masterChains++;
            continue;
          }
          if (isLocalArea(data)) {
            const slug = slugify(data.name);
            if (entityMap.has(slug)) {
              deepMerge(entityMap.get(slug), data);
            } else {
              data.slug = slug;
              entityMap.set(slug, data);
            }
            masterLocal++;
          }
        }
      }

      if ((i + 1) % 500 === 0) {
        console.log(`   Processing ${i + 1}/5663...`);
      }
    }
  }
  console.log(`✅ Found ${masterLocal} local businesses (skipped ${masterChains} chains)\n`);

  // Load consolidated-may-2026 - filter local + non-chains
  console.log('📂 consolidated-may-2026...');
  const consPath = '/Users/owner/consolidated-may-2026';
  let consLocal = 0;
  let consChains = 0;

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
          if (isChain(data.name)) {
            consChains++;
            continue;
          }
          if (isLocalArea(data)) {
            const slug = slugify(data.name);
            if (entityMap.has(slug)) {
              deepMerge(entityMap.get(slug), data);
            } else {
              data.slug = slug;
              entityMap.set(slug, data);
            }
            consLocal++;
          }
        }
      }
    }
  }
  console.log(`✅ Found ${consLocal} local businesses (skipped ${consChains} chains)\n`);

  // Condos (always local)
  console.log('📂 condos_data...');
  const condosPath = '/Users/owner/condos_data';
  let condosLocal = 0;
  if (fs.existsSync(condosPath)) {
    const files = fs.readdirSync(condosPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(condosPath, file));
      if (data && data.name && isLocalArea(data)) {
        const slug = slugify(data.name);
        if (entityMap.has(slug)) {
          deepMerge(entityMap.get(slug), data);
        } else {
          data.slug = slug;
          entityMap.set(slug, data);
        }
        condosLocal++;
      }
    }
  }
  console.log(`✅ Found ${condosLocal} local condos\n`);

  // Vacation homes (always local)
  console.log('📂 vacationhomes_data...');
  const vacPath = '/Users/owner/vacationhomes_data';
  let vacLocal = 0;
  if (fs.existsSync(vacPath)) {
    const files = fs.readdirSync(vacPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(vacPath, file));
      if (data && data.name && isLocalArea(data)) {
        const slug = slugify(data.name);
        if (entityMap.has(slug)) {
          deepMerge(entityMap.get(slug), data);
        } else {
          data.slug = slug;
          entityMap.set(slug, data);
        }
        vacLocal++;
      }
    }
  }
  console.log(`✅ Found ${vacLocal} local vacation homes\n`);

  // Save
  console.log('💾 SAVING LOCAL ENTITIES...\n');
  let saved = 0;
  for (const [slug, entity] of entityMap) {
    try {
      fs.writeFileSync(
        path.join(ENTITIES_DIR, `${slug}.json`),
        JSON.stringify(entity, null, 2)
      );
      saved++;
      if (saved % 100 === 0) console.log(`   Saved ${saved}/${entityMap.size}...`);
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
  console.log('✅ LOCAL CONSOLIDATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`📊 Summary:`);
  console.log(`   MASTER: ${masterLocal} local (${masterChains} chains excluded)`);
  console.log(`   consolidated-may-2026: ${consLocal} local (${consChains} chains excluded)`);
  console.log(`   Condos: ${condosLocal}`);
  console.log(`   Vacation homes: ${vacLocal}`);
  console.log(`   TOTAL: ${entityMap.size} local businesses\n`);
}

consolidateLocal().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
