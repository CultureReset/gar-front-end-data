#!/usr/bin/env node
/**
 * FIX ENTITY SLUGS - Generate proper slugs from business names
 * Renames all entity files and fixes slug fields
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

function slugify(text) {
  if (!text) return 'unknown';
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    .slice(0, 100); // Max 100 chars
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function fixSlugs() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔄 FIXING ENTITY SLUGS - Regenerating from business names');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const entityFiles = fs.readdirSync(ENTITIES_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${entityFiles.length} entities to process\n`);

  let fixed = 0;
  let errors = 0;
  const slugMap = new Map(); // Track slugs to avoid duplicates

  // First pass: load all entities and generate new slugs
  const entities = [];
  for (const file of entityFiles) {
    const entity = loadJSON(path.join(ENTITIES_DIR, file));
    if (!entity) {
      errors++;
      continue;
    }
    entities.push({ file, entity });
  }

  // Second pass: generate slugs and handle duplicates
  for (let i = 0; i < entities.length; i++) {
    const { file, entity } = entities[i];
    let newSlug = slugify(entity.name);

    // Handle duplicate slugs
    let counter = 1;
    const originalSlug = newSlug;
    while (slugMap.has(newSlug)) {
      newSlug = `${originalSlug}-${counter}`;
      counter++;
    }
    slugMap.set(newSlug, true);

    entity.slug = newSlug;

    const oldPath = path.join(ENTITIES_DIR, file);
    const newPath = path.join(ENTITIES_DIR, `${newSlug}.json`);

    try {
      // Write to new file
      fs.writeFileSync(newPath, JSON.stringify(entity, null, 2));

      // Delete old file if different
      if (oldPath !== newPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      fixed++;

      if (fixed % 500 === 0) {
        console.log(`  Processed ${fixed}/${entities.length}...`);
      }
    } catch (e) {
      console.error(`Error fixing ${file}: ${e.message}`);
      errors++;
    }
  }

  console.log(`✅ Fixed ${fixed} entities, ${errors} errors\n`);

  // Update index
  console.log('📝 Updating entities-index.json...\n');

  const newIndex = entities.map(({ entity }) => ({
    slug: entity.slug,
    name: entity.name,
    entity_type: entity.entity_type || 'Other',
    entity_subtype: entity.entity_subtype || '',
    city: entity.city || '',
    hero_image_url: entity.hero_image_url || '',
    rating: entity.rating || 0,
    tags: entity.tags || [],
    featured: entity.featured || false
  }));

  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-index.json'),
    JSON.stringify(newIndex, null, 2)
  );

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('✅ SLUG FIX COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`📊 Results:`);
  console.log(`   Total entities: ${fixed}`);
  console.log(`   Index entries: ${newIndex.length}\n`);

  console.log('🚀 All entities now have proper slugs from their names!\n');
}

fixSlugs().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
