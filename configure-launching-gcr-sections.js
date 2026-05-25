#!/usr/bin/env node
/**
 * Configure launching-GCR to display all business sections
 * Creates a sections manifest that tells launching-GCR what to display
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'sections.json');

function readJSON(filePath) {
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

async function configureGCRSections() {
  console.log('⚙️  Configuring launching-GCR sections...\n');

  // Read sections config
  const sections = readJSON(CONFIG_FILE);
  if (!sections || !sections.sections) {
    console.error('❌ No sections.json found. Run generate-sections-config.js first.');
    process.exit(1);
  }

  // Create launching-GCR configuration
  const gcrConfig = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    total_sections: sections.sections.length,
    total_entities: sections.total_entities,
    api_endpoint: 'gar-front-end-data',
    display_sections: []
  };

  // Map sections to launching-GCR format
  sections.sections.forEach(section => {
    gcrConfig.display_sections.push({
      id: section.type.toLowerCase(),
      name: section.name,
      icon: section.icon,
      count: section.count,
      type: section.type,
      route: getRouteForType(section.type),
      subtypes: section.subtypes.map(sub => ({
        id: sub.type,
        name: sub.name,
        count: sub.count,
        filter: `entity_subtype=${sub.type}`
      }))
    });
  });

  // Save to sections manifest
  const manifestPath = path.join(DATA_DIR, 'launching-gcr-sections.json');
  saveJSON(manifestPath, gcrConfig);

  console.log('✅ Configuration created!\n');
  console.log('📊 Sections for launching-GCR:');

  gcrConfig.display_sections.forEach(section => {
    console.log(`\n   ${section.icon} ${section.name} (${section.id})`);
    console.log(`      Count: ${section.count}`);
    console.log(`      Route: ${section.route}`);
    if (section.subtypes.length > 0) {
      console.log(`      Subtypes:`);
      section.subtypes.slice(0, 5).forEach(sub => {
        console.log(`         • ${sub.name} (${sub.count})`);
      });
      if (section.subtypes.length > 5) {
        console.log(`         ... and ${section.subtypes.length - 5} more`);
      }
    }
  });

  console.log(`\n📝 Configuration saved to: data/launching-gcr-sections.json`);
  console.log(`\n✨ Ready to launch! launching-GCR can now display all ${sections.total_entities} entities across all sections.\n`);

  return gcrConfig;
}

function getRouteForType(type) {
  const routes = {
    'restaurant': 'restaurants',
    'hotel': 'staying',
    'activity': 'things-to-do',
    'park': 'public-spots',
    'shopping': 'shopping',
    'nightlife': 'nightlife',
    'service': 'services',
    'artist': 'artists',
    'business': 'directory'
  };
  return routes[type.toLowerCase()] || type.toLowerCase();
}

configureGCRSections().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
