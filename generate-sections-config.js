#!/usr/bin/env node
/**
 * Generate sections configuration from synced entity data
 * Creates a sections.json file listing all available business categories
 * Enables launching-GCR to display all business sections
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');
const CONFIG_FILE = path.join(DATA_DIR, 'sections.json');
const INDEX_FILE = path.join(DATA_DIR, 'entities-index.json');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function generateSectionsConfig() {
  console.log('🔄 Generating business sections configuration...\n');

  // Load the index
  const index = loadJSON(INDEX_FILE);
  if (!index || index.length === 0) {
    console.error('❌ No entities-index.json found. Run a sync script first.');
    process.exit(1);
  }

  console.log(`📊 Analyzing ${index.length} entities...\n`);

  // Group by entity_type and entity_subtype
  const sections = {};
  const stats = {
    byType: {},
    bySubtype: {},
    total: 0
  };

  index.forEach(entity => {
    const type = entity.entity_type || 'other';
    const subtype = entity.entity_subtype || 'general';

    // Initialize type if needed
    if (!sections[type]) {
      sections[type] = {
        name: formatName(type),
        icon: getIcon(type),
        subtypes: {},
        count: 0,
        entities: []
      };
    }

    // Initialize subtype if needed
    if (!sections[type].subtypes[subtype]) {
      sections[type].subtypes[subtype] = {
        name: formatName(subtype),
        count: 0,
        entities: []
      };
    }

    // Count and track
    sections[type].count++;
    sections[type].subtypes[subtype].count++;
    sections[type].entities.push(entity.slug);
    sections[type].subtypes[subtype].entities.push(entity.slug);

    // Stats
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    stats.bySubtype[subtype] = (stats.bySubtype[subtype] || 0) + 1;
    stats.total++;
  });

  // Convert to arrays for easier consumption
  const sectionsArray = Object.keys(sections).map(type => ({
    type,
    name: sections[type].name,
    icon: sections[type].icon,
    count: sections[type].count,
    subtypes: Object.keys(sections[type].subtypes).map(subtype => ({
      name: sections[type].subtypes[subtype].name,
      type: subtype,
      count: sections[type].subtypes[subtype].count,
      slug: subtype.toLowerCase().replace(/\s+/g, '-')
    })).sort((a, b) => b.count - a.count)
  })).sort((a, b) => b.count - a.count);

  // Create final config
  const config = {
    generated_at: new Date().toISOString(),
    total_entities: stats.total,
    total_types: Object.keys(stats.byType).length,
    total_subtypes: Object.keys(stats.bySubtype).length,
    sections: sectionsArray,
    stats: {
      by_type: Object.entries(stats.byType)
        .sort(([,a], [,b]) => b - a)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
      by_subtype: Object.entries(stats.bySubtype)
        .sort(([,a], [,b]) => b - a)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
    }
  };

  // Save config
  saveJSON(CONFIG_FILE, config);
  console.log(`✅ Generated sections configuration\n`);

  // Print summary
  console.log('📊 Business Sections Summary:');
  console.log(`   Total: ${stats.total} entities\n`);

  sectionsArray.forEach(section => {
    console.log(`   🏢 ${section.name} (${section.type})`);
    console.log(`      └─ Count: ${section.count}`);
    if (section.subtypes.length > 0) {
      section.subtypes.slice(0, 5).forEach(sub => {
        console.log(`         • ${sub.name}: ${sub.count}`);
      });
      if (section.subtypes.length > 5) {
        console.log(`         ... and ${section.subtypes.length - 5} more`);
      }
    }
  });

  console.log(`\n✨ Configuration saved to: data/sections.json`);
  console.log(`🚀 Ready for launching-GCR to display all sections!\n`);

  return config;
}

function formatName(text) {
  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getIcon(type) {
  const icons = {
    'restaurant': '🍽️',
    'food': '🍽️',
    'cafe': '☕',
    'coffee': '☕',
    'shopping': '🛍️',
    'retail': '🛍️',
    'hotel': '🏨',
    'lodging': '🏨',
    'activity': '🎯',
    'activities': '🎯',
    'entertainment': '🎭',
    'service': '🔧',
    'services': '🔧',
    'nightlife': '🍷',
    'bar': '🍷',
    'parks': '🌳',
    'nature': '🌳',
    'art': '🎨',
    'arts': '🎨',
    'artist': '🎨',
    'business': '🏢',
    'other': '📍'
  };
  return icons[type?.toLowerCase()] || icons[Object.keys(icons)[0]];
}

generateSectionsConfig().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
