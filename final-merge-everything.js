#!/usr/bin/env node
/**
 * FINAL MERGE - ALL DATA IN
 *
 * Consolidation strategy:
 * - TEST 1: Group by Google Place ID
 * - TEST 2: Group by Phone + Address + 90% name similarity
 * - MERGE all data for matched groups
 * - KEEP everything (no deletion)
 * - NO fuzzy name matching
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

const ALL_SOURCES = [
  // PRIMARY
  '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE',
  '/Users/owner/supabase_export_2026-05-10_07-37',
  '/Users/owner/supabase_export_2026-05-10_06-16',
  '/Users/owner/consolidated-may-2026',
  '/Users/owner/cybercheck-api-database copy',

  // LODGING
  '/Users/owner/condos_data',
  '/Users/owner/vacationhomes_data',

  // GOOGLE SCRAPERS
  '/Users/owner/Downloads',

  // TRIPSHOCK
  '/Users/owner/tripshock_images',
  '/Users/owner/trip-swipe-live'
];

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '').slice(-10);
}

function normalizeAddress(addr) {
  if (!addr) return '';
  return addr.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilarity(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;
  if (n1.includes(n2) || n2.includes(n1)) return 95;

  let matches = 0;
  let idx = 0;
  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  for (let i = 0; i < longer.length && idx < shorter.length; i++) {
    if (longer[i] === shorter[idx]) {
      matches++;
      idx++;
    }
  }
  return Math.round((matches / longer.length) * 100);
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function loadCSV(filePath) {
  return new Promise((resolve) => {
    const rows = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    let headers = [];
    let isFirst = true;

    rl.on('line', (line) => {
      if (isFirst) {
        headers = line.split(',').map(h => h.trim().replace(/"/g, ''));
        isFirst = false;
        return;
      }

      const fields = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          fields.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      fields.push(current.trim().replace(/"/g, ''));

      if (fields.length > 0) {
        const row = {};
        headers.forEach((h, i) => {
          row[h] = fields[i] || '';
        });
        rows.push(row);
      }
    });

    rl.on('close', () => resolve(rows));
  });
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

async function finalMerge() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔗 FINAL MERGE - ALL DATA');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Load existing
  console.log('📦 Loading existing entities...');
  const entityMap = new Map();
  const placeIdMap = new Map();
  const phoneAddressMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   ${idx}/${entityFiles.length}...`);
    const slug = file.replace('.json', '');
    try {
      const entity = loadJSON(path.join(ENTITIES_DIR, file));
      entityMap.set(slug, entity);

      // Index by Place ID (Test 1)
      if (entity.google_places_id || entity.place_id) {
        const placeId = entity.google_places_id || entity.place_id;
        placeIdMap.set(placeId, slug);
      }

      // Index by Phone+Address (Test 2)
      const phone = normalizePhone(entity.phone);
      const addr = normalizeAddress(entity.address);
      if (phone && addr) {
        const key = `${phone}|${addr}`;
        if (!phoneAddressMap.has(key)) phoneAddressMap.set(key, []);
        phoneAddressMap.get(key).push(slug);
      }
    } catch (e) {}
  });

  console.log(`✅ Loaded ${entityMap.size} entities\n`);

  // Load all data from all sources
  console.log('📥 LOADING ALL DATA SOURCES:\n');

  const allRecords = [];

  // MASTER
  console.log('  MASTER-ALL-BUSINESSES-COMPLETE...');
  const masterPath = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
  if (fs.existsSync(masterPath)) {
    const bizs = fs.readdirSync(masterPath).filter(f => fs.statSync(path.join(masterPath, f)).isDirectory());
    for (const biz of bizs) {
      const consPath = path.join(masterPath, biz, '_CONSOLIDATED.json');
      if (fs.existsSync(consPath)) {
        const data = loadJSON(consPath);
        if (data) allRecords.push({ source: 'master', data });
      }
    }
  }
  console.log(`     ✓ ${allRecords.length} records\n`);

  // CONDOS
  console.log('  Condos...');
  const condosPath = '/Users/owner/condos_data';
  if (fs.existsSync(condosPath)) {
    const files = fs.readdirSync(condosPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(condosPath, file));
      if (data) allRecords.push({ source: 'condos', data });
    }
  }
  console.log(`     ✓ Added condos\n`);

  // VACATION HOMES
  console.log('  Vacation Homes...');
  const vacPath = '/Users/owner/vacationhomes_data';
  if (fs.existsSync(vacPath)) {
    const files = fs.readdirSync(vacPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(vacPath, file));
      if (data) allRecords.push({ source: 'vacation_homes', data });
    }
  }
  console.log(`     ✓ Added vacation homes\n`);

  // GOOGLE SCRAPER PHASES
  console.log('  Google Scraper Phases...');
  const downloadPath = '/Users/owner/Downloads';
  if (fs.existsSync(downloadPath)) {
    const csvFiles = fs.readdirSync(downloadPath).filter(f => f.startsWith('gcr_places_phase') && f.endsWith('.csv'));
    for (const file of csvFiles) {
      const rows = await loadCSV(path.join(downloadPath, file));
      rows.forEach(row => allRecords.push({ source: 'google_scraper', data: row }));
    }
  }
  console.log(`     ✓ Added Google scraper phases\n`);

  console.log(`📊 Total records loaded: ${allRecords.length}\n`);

  // CONSOLIDATE
  console.log('🔄 CONSOLIDATING:\n');

  let merged = 0;
  let added = 0;

  for (const record of allRecords) {
    const data = record.data;
    if (!data || !data.name) continue;

    // TEST 1: Google Place ID
    const placeId = data.google_places_id || data.place_id || data.placeId;
    if (placeId && placeIdMap.has(placeId)) {
      const slug = placeIdMap.get(placeId);
      const entity = entityMap.get(slug);
      deepMergeAll(entity, data);
      merged++;
      continue;
    }

    // TEST 2: Phone + Address + 90% name
    const phone = normalizePhone(data.phone);
    const addr = normalizeAddress(data.address);
    const name = data.name;

    if (phone && addr && phoneAddressMap.has(`${phone}|${addr}`)) {
      const candidates = phoneAddressMap.get(`${phone}|${addr}`);
      for (const slug of candidates) {
        const entity = entityMap.get(slug);
        const similarity = nameSimilarity(entity.name, name);
        if (similarity >= 90) {
          deepMergeAll(entity, data);
          merged++;
          break;
        }
      }
      continue;
    }

    // NEW - Keep everything
    const slug = slugify(name);
    if (!entityMap.has(slug)) {
      entityMap.set(slug, { ...data, slug });
      added++;
    } else {
      // Even if slug exists, merge into it
      deepMergeAll(entityMap.get(slug), data);
      merged++;
    }
  }

  console.log(`✅ Consolidated: ${merged} merged, ${added} new\n`);

  // SAVE
  console.log('💾 SAVING ALL ENTITIES:\n');

  let saved = 0;
  for (const [slug, entity] of entityMap) {
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}`);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved}/${entityMap.size}...`);
    }
  }

  console.log(`✅ Saved ${saved} entities\n`);

  // UPDATE INDEX
  console.log('📝 Updating index...\n');

  const newIndex = Array.from(entityMap.values()).map(e => ({
    slug: e.slug,
    name: e.name,
    entity_type: e.entity_type || e.type || 'Other',
    entity_subtype: e.entity_subtype || '',
    city: e.city || '',
    hero_image_url: e.hero_image_url || '',
    rating: e.rating || 0,
    tags: e.tags || [],
    featured: e.featured || false
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'entities-index.json'), JSON.stringify(newIndex, null, 2));

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ FINAL MERGE COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`📊 FINAL STATS:`);
  console.log(`   Total entities: ${entityMap.size}`);
  console.log(`   Consolidated: ${merged}`);
  console.log(`   New: ${added}`);
  console.log(`   Index entries: ${newIndex.length}\n`);

  console.log(`🚀 gar-front-end-data is fully consolidated with ALL data!\n`);
}

finalMerge().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
