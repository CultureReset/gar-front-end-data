#!/usr/bin/env node
/**
 * Apply category organization
 * Uses CATEGORY-*.json files to properly categorize all entities
 * Improves entity_type and entity_subtype organization
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const CATEGORY_DIR = '/Users/owner/CYBERCHECK-APP-STORE/systems-os';

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

function normalizeBusinessName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function getCategoryFromFilename(filename) {
  // Extract category from filename like "CATEGORY-Fishing-Charters.json"
  return filename
    .replace('CATEGORY-', '')
    .replace('.json', '')
    .replace(/---/g, ' - ')
    .replace(/-/g, ' ');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function applyCategoryOrganization() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🏷️  Applying Category Organization');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load all existing entities
  console.log('📚 Loading entities...');
  const existingMap = new Map();
  const nameMap = new Map();

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  entityFiles.forEach((file, idx) => {
    if (idx % 2000 === 0 && idx > 0) console.log(`   ${idx}/${entityFiles.length}...`);

    const slug = file.replace('.json', '');
    try {
      const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8'));
      existingMap.set(slug, entity);
      nameMap.set(normalizeBusinessName(entity.name), slug);
    } catch (e) {}
  });

  console.log(`✅ Loaded ${existingMap.size} entities\n`);

  // Load all category files
  console.log('📁 Loading categories...\n');
  const categoryFiles = fs.readdirSync(CATEGORY_DIR)
    .filter(f => f.startsWith('CATEGORY-') && f.endsWith('.json'))
    .sort();

  console.log(`Found ${categoryFiles.length} category files:\n`);

  const categorizations = [];
  let totalInCategories = 0;

  categoryFiles.forEach((filename, idx) => {
    const categoryName = getCategoryFromFilename(filename);
    const data = loadJSON(path.join(CATEGORY_DIR, filename));

    if (!data) {
      console.log(`   ${idx + 1}. ${categoryName}: ⚠️  Could not load`);
      return;
    }

    let records = [];
    if (Array.isArray(data)) records = data;
    else if (data.businesses) records = data.businesses;
    else if (data.data) records = data.data;
    else if (data.organized) records = Object.values(data.organized).flat();

    totalInCategories += records.length;
    console.log(`   ${idx + 1}. ${categoryName}: ${records.length} businesses`);

    categorizations.push({
      filename,
      categoryName,
      records,
      count: records.length
    });
  });

  console.log(`\n📊 Total in all categories: ${totalInCategories}\n`);

  // Map businesses to categories
  console.log('🔄 Mapping entities to categories...\n');
  let categorized = 0;
  const categoryMap = {};

  categorizations.forEach(cat => {
    cat.records.forEach(record => {
      if (!record || !record.name) return;

      const normName = normalizeBusinessName(record.name);
      const slug = slugify(record.name);

      // Try exact slug match
      let found = existingMap.has(slug);
      let existingSlug = slug;

      // Try name match
      if (!found && nameMap.has(normName)) {
        existingSlug = nameMap.get(normName);
        found = true;
      }

      if (found) {
        const entity = existingMap.get(existingSlug);

        // Update categorization
        if (!entity.entity_type || entity.entity_type === 'Other') {
          entity.entity_type = cat.categoryName;
        }

        // Extract subtype if available
        if (record.subtype || record.type) {
          entity.entity_subtype = record.subtype || record.type;
        }

        categorized++;

        if (!categoryMap[cat.categoryName]) {
          categoryMap[cat.categoryName] = 0;
        }
        categoryMap[cat.categoryName]++;
      }
    });
  });

  console.log(`✅ Categorized ${categorized} entities\n`);

  // Show breakdown
  console.log('📊 Categories assigned:\n');
  Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

  // Save updated entities
  console.log(`\n💾 Saving ${existingMap.size} entities with category organization...\n`);
  let saved = 0;

  for (const [slug, entity] of existingMap) {
    try {
      fs.writeFileSync(
        path.join(ENTITIES_DIR, `${slug}.json`),
        JSON.stringify(entity, null, 2)
      );
      saved++;
    } catch (e) {
      console.error(`Error saving ${slug}`);
    }

    if (saved % 1000 === 0 && saved > 0) {
      console.log(`   Saved ${saved}/${existingMap.size}...`);
    }
  }

  console.log(`✅ Saved ${saved} entities\n`);

  // Update index with category data
  console.log('📝 Updating index with categories...\n');
  const newIndex = Array.from(existingMap.values()).map(entity => ({
    slug: entity.slug,
    name: entity.name,
    entity_type: entity.entity_type || 'Other',
    entity_subtype: entity.entity_subtype || '',
    city: entity.city || '',
    hero_image_url: entity.hero_image_url || entity.image || '',
    rating: entity.rating || 0,
    tags: entity.tags || [],
    featured: entity.featured || false
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'entities-index.json'), JSON.stringify(newIndex, null, 2));

  // Analyze categories in index
  const typeCount = {};
  newIndex.forEach(e => {
    if (!typeCount[e.entity_type]) typeCount[e.entity_type] = 0;
    typeCount[e.entity_type]++;
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ CATEGORY ORGANIZATION COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 Final entity type distribution:\n`);
  Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log(`\n🎯 Total entities: ${existingMap.size}`);
  console.log(`📂 Categories: ${Object.keys(typeCount).length}\n`);
  console.log(`✨ Data is now properly organized by category!\n`);
}

applyCategoryOrganization().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
