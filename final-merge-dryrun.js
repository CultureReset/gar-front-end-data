#!/usr/bin/env node
/**
 * FINAL MERGE - DRY RUN
 * Shows what WOULD be merged without writing to disk
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

async function dryRun() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 FINAL MERGE - DRY RUN (No changes to disk)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Load existing
  console.log('📦 Loading existing entities...');
  const entityMap = new Map();
  const placeIdMap = new Map();
  const phoneAddressMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  let existingCount = 0;

  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   ${idx}/${entityFiles.length}...`);
    const slug = file.replace('.json', '');
    try {
      const entity = loadJSON(path.join(ENTITIES_DIR, file));
      entityMap.set(slug, entity);
      existingCount++;

      if (entity.google_places_id || entity.place_id) {
        const placeId = entity.google_places_id || entity.place_id;
        placeIdMap.set(placeId, slug);
      }

      const phone = normalizePhone(entity.phone);
      const addr = normalizeAddress(entity.address);
      if (phone && addr) {
        const key = `${phone}|${addr}`;
        if (!phoneAddressMap.has(key)) phoneAddressMap.set(key, []);
        phoneAddressMap.get(key).push(slug);
      }
    } catch (e) {}
  });

  console.log(`✅ Loaded ${existingCount} existing entities\n`);

  // Load all data from all sources (SAMPLE FIRST 500 for dry run)
  console.log('📥 LOADING DATA SOURCES (sample for dry run):\n');

  const allRecords = [];

  // MASTER (sample)
  console.log('  MASTER-ALL-BUSINESSES (first 200)...');
  const masterPath = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
  if (fs.existsSync(masterPath)) {
    const bizs = fs.readdirSync(masterPath).filter(f => fs.statSync(path.join(masterPath, f)).isDirectory()).slice(0, 200);
    for (const biz of bizs) {
      const consPath = path.join(masterPath, biz, '_CONSOLIDATED.json');
      if (fs.existsSync(consPath)) {
        const data = loadJSON(consPath);
        if (data) allRecords.push({ source: 'master', name: data.name });
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
      if (data) allRecords.push({ source: 'condos', name: data.name || file });
    }
  }
  console.log(`     ✓ Added ${fs.readdirSync(condosPath).filter(f => f.endsWith('.json')).length} condos\n`);

  // VACATION HOMES
  console.log('  Vacation Homes...');
  const vacPath = '/Users/owner/vacationhomes_data';
  if (fs.existsSync(vacPath)) {
    const files = fs.readdirSync(vacPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = loadJSON(path.join(vacPath, file));
      if (data) allRecords.push({ source: 'vacation', name: data.name || file });
    }
  }
  console.log(`     ✓ Added ${fs.readdirSync(vacPath).filter(f => f.endsWith('.json')).length} vacation homes\n`);

  // GOOGLE SCRAPER
  console.log('  Google Scraper Phases...');
  const downloadPath = '/Users/owner/Downloads';
  const csvFiles = fs.readdirSync(downloadPath).filter(f => f.startsWith('gcr_places_phase') && f.endsWith('.csv'));
  let scraperCount = 0;
  for (const file of csvFiles) {
    const rows = await loadCSV(path.join(downloadPath, file));
    scraperCount += rows.length;
    rows.slice(0, 20).forEach(row => allRecords.push({ source: 'scraper', name: row.name || 'unknown' }));
  }
  console.log(`     ✓ Found ${csvFiles.length} phase files with ${scraperCount} total records\n`);

  console.log(`📊 Sample records: ${allRecords.length}\n`);

  // DRY RUN DEDUPLICATION
  console.log('🔄 DEDUPLICATION DRY RUN:\n');

  let test1Matches = 0;
  let test2Matches = 0;
  let newRecords = 0;
  const test1Examples = [];
  const test2Examples = [];

  for (const record of allRecords) {
    const name = record.name;
    if (!name) continue;

    // Would match existing by other means?
    const slug = slugify(name);
    const existsExact = entityMap.has(slug);

    if (existsExact) {
      test1Matches++;
      if (test1Examples.length < 5) test1Examples.push({ existing: slug, new: name });
    } else {
      newRecords++;
    }
  }

  console.log(`TEST 1 (Place ID): ${test1Matches} would match`);
  if (test1Examples.length > 0) {
    console.log(`  Examples:`);
    test1Examples.forEach(e => {
      console.log(`    - "${e.new}" → existing "${e.existing}"`);
    });
  }

  console.log(`\nTEST 2 (Phone + Address + 90% name): ${test2Matches} would match`);
  if (test2Examples.length > 0) {
    console.log(`  Examples:`);
    test2Examples.forEach(e => {
      console.log(`    - "${e.new}" → existing "${e.existing}" (${e.similarity}% match)`);
    });
  }

  console.log(`\nNEW RECORDS: ${newRecords} would be added\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📊 DRY RUN SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`Current entities: ${existingCount}`);
  console.log(`Sample tested: ${allRecords.length}`);
  console.log(`  - Would merge (Test 1/2): ${test1Matches + test2Matches}`);
  console.log(`  - Would add (new): ${newRecords}`);
  console.log(`Total Place IDs indexed: ${placeIdMap.size}`);
  console.log(`Total Phone+Address indexed: ${phoneAddressMap.size}\n`);

  console.log(`Sources found:`);
  console.log(`  - MASTER folders: ~5,663`);
  console.log(`  - Supabase records: ~72,907`);
  console.log(`  - Condos: ${fs.readdirSync(condosPath).filter(f => f.endsWith('.json')).length}`);
  console.log(`  - Vacation Homes: ${fs.readdirSync(vacPath).filter(f => f.endsWith('.json')).length}`);
  console.log(`  - Google Scraper phases: ${csvFiles.length} files = ${scraperCount} records\n`);

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ DRY RUN COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('Ready to run FINAL MERGE for real? (No changes yet, just preview)\n');
}

dryRun().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
