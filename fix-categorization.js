#!/usr/bin/env node
/**
 * Fix misclassified entities using smarter categorization logic
 * Re-evaluates category based on multiple signals
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const INDEX_FILE = path.join(DATA_DIR, 'entities-index.json');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Keywords to identify business type from name, description, tags
const CATEGORY_KEYWORDS = {
  'restaurant': ['restaurant', 'cafe', 'coffee', 'bakery', 'diner', 'pizzeria', 'brewery', 'winery', 'lounge', 'bistro'],
  'bar': ['bar', 'tavern', 'nightclub', 'club', 'pub', 'lounge', 'speakeasy'],
  'hotel': ['hotel', 'motel', 'resort', 'lodge', 'inn', 'bed', 'lodging', 'vacation rental', 'airbnb', 'villa', 'condo'],
  'shopping': ['shop', 'store', 'retail', 'mall', 'outlet', 'market', 'boutique', 'gallery', 'antique'],
  'activity': ['fishing charter', 'tour', 'activity', 'adventure', 'boat rental', 'jet ski', 'zip line', 'parasail', 'water sports', 'rental'],
  'service': ['salon', 'spa', 'gym', 'fitness', 'doctor', 'dentist', 'barber', 'hair', 'nail', 'massage', 'repair', 'laundry'],
  'park': ['park', 'beach', 'nature', 'trail', 'wildlife', 'preserve', 'monument'],
  'artist': ['artist', 'musician', 'gallery', 'studio', 'art', 'theater', 'performance']
};

function categorizeByName(name = '', description = '', tags = []) {
  if (!name) return null;

  const text = `${name} ${description}`.toLowerCase();
  const tagsText = (Array.isArray(tags) ? tags.map(t => typeof t === 'string' ? t : t.tag || '').join(' ') : '').toLowerCase();
  const fullText = `${text} ${tagsText}`;

  // Score each category
  const scores = {};
  Object.entries(CATEGORY_KEYWORDS).forEach(([cat, keywords]) => {
    scores[cat] = keywords.reduce((sum, kw) => {
      const count = (fullText.match(new RegExp(kw, 'g')) || []).length;
      return sum + (count * (fullText.includes(kw) ? 2 : 1));
    }, 0);
  });

  // Find best match
  const best = Object.entries(scores).sort(([,a], [,b]) => b - a)[0];
  return best && best[1] > 0 ? best[0] : null;
}

async function fixCategorization() {
  console.log('🔧 Fixing entity categorization...\n');

  const index = loadJSON(INDEX_FILE);
  if (!index) {
    console.error('❌ No entities-index.json found');
    process.exit(1);
  }

  console.log(`📝 Checking ${index.length} entities...\n`);

  let fixed = 0;
  let errors = 0;
  const changedTypes = {};

  index.forEach((indexEntry, i) => {
    if (i % 1000 === 0 && i > 0) console.log(`   Processed ${i}/${index.length}...`);

    try {
      const entityPath = path.join(ENTITIES_DIR, `${indexEntry.slug}.json`);
      const entity = loadJSON(entityPath);

      if (!entity) {
        errors++;
        return;
      }

      const oldType = entity.entity_type;
      const oldSubtype = entity.entity_subtype;

      // Try to find better category
      const betterType = categorizeByName(
        entity.name,
        entity.description,
        entity.tags
      );

      // Update if found and different
      if (betterType && betterType !== oldType) {
        entity.entity_type = betterType;
        entity.entity_subtype = betterType;

        // Update index
        indexEntry.entity_type = betterType;
        indexEntry.entity_subtype = betterType;

        // Save entity
        saveJSON(entityPath, entity);

        // Track change
        const key = `${oldType} → ${betterType}`;
        changedTypes[key] = (changedTypes[key] || 0) + 1;

        fixed++;
      }
    } catch (e) {
      errors++;
    }
  });

  // Save updated index
  saveJSON(INDEX_FILE, index);

  console.log(`\n✅ Categorization fixed!`);
  console.log(`\n📊 Results:`);
  console.log(`   - ${fixed} entities recategorized`);
  console.log(`   - ${errors} errors`);

  if (Object.keys(changedTypes).length > 0) {
    console.log(`\n📋 Changes made:`);
    Object.entries(changedTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([change, count]) => {
        console.log(`   - ${change}: ${count}`);
      });
  }

  console.log(`\n🚀 Ready to test!`);
}

fixCategorization().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
