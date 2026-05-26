#!/usr/bin/env node
/**
 * PULL ALL DATA DIRECTLY FROM SUPABASE
 * Businesses + menus + photos + events + everything
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ENTITIES_DIR = path.join(__dirname, 'data/entities');

// Use GCR Supabase
const SUPABASE_URL = 'https://xbptmkpbiqzvxptjkfoi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicHRta3BiaXF6dnhwdGprZm9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE3NTk1NiwiZXhwIjoyMDkzNzUxOTU2fQ.Z_xD_yMq8a-H0QkLR2tpvZ0Yq1K2eF4vZ5aB9cD_eGk';

function query(table, select = '*', filters = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    if (filters) url.searchParams.set('apikey', SUPABASE_KEY);

    const options = {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };

    https.get(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

async function pullFromSupabase() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('💾 PULLING ALL DATA DIRECTLY FROM SUPABASE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Pull all businesses
  console.log('📂 Fetching businesses...');
  const businesses = await query('entity', '*');
  console.log(`✅ Got ${businesses.length} businesses\n`);

  if (!businesses.length) {
    console.log('❌ No businesses found\n');
    return;
  }

  let saved = 0;

  // For each business, fetch related data
  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    const slug = biz.slug || slugify(biz.name);

    // Fetch menus for this business
    const menus = await query('menu_items', '*', `entity_id=eq.${biz.id}`);

    // Fetch photos for this business
    const photos = await query('media', '*', `entity_id=eq.${biz.id}`);

    // Fetch events for this business
    const events = await query('events', '*', `entity_id=eq.${biz.id}`);

    // Fetch hours
    const hours = await query('hours_exceptions', '*', `entity_id=eq.${biz.id}`);

    // Fetch specials
    const specials = await query('specials', '*', `entity_id=eq.${biz.id}`);

    // Combine all data
    const entity = {
      ...biz,
      slug: slug,
      menu_items: menus || [],
      photos: photos || [],
      events: events || [],
      hours: hours || [],
      specials: specials || []
    };

    // Save to file
    try {
      const filePath = path.join(ENTITIES_DIR, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}: ${e.message}`);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${businesses.length} - Saved: ${saved}`);
    }
  }

  console.log(`\n✅ SAVED ${saved} complete business entities\n`);

  // Update index
  console.log('📝 Updating index...\n');
  const files = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  const index = [];

  for (const file of files) {
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      if (!entity.name) continue;

      index.push({
        slug: entity.slug || file.replace('.json', ''),
        name: entity.name,
        entity_type: entity.entity_type || 'Other',
        entity_subtype: entity.entity_subtype || '',
        city: entity.city || '',
        hero_image_url: entity.hero_image_url || '',
        rating: entity.rating || 0,
        tags: entity.tags || [],
        featured: entity.featured || false
      });
    } catch (e) {}
  }

  fs.writeFileSync(
    path.join(__dirname, 'data/entities-index.json'),
    JSON.stringify(index, null, 2)
  );

  console.log(`✅ Index has ${index.length} entities\n`);
}

pullFromSupabase().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
