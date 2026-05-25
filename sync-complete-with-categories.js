#!/usr/bin/env node
/**
 * Sync COMPLETE organized data with proper categorization
 * Extracts categories from multiple sources and applies intelligent mapping
 */

const fs = require('fs');
const path = require('path');

const ORGANIZED_DIR = '/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE';
const DATA_DIR = path.join(__dirname, 'data');

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

// Map Google Places types to business categories
const TYPE_MAPPING = {
  // Restaurants & Food
  'restaurant': { type: 'restaurant', subtype: 'restaurants' },
  'cafe': { type: 'restaurant', subtype: 'cafes' },
  'bar': { type: 'nightlife', subtype: 'bars' },
  'night_club': { type: 'nightlife', subtype: 'nightclubs' },
  'bakery': { type: 'restaurant', subtype: 'bakeries' },
  'food': { type: 'restaurant', subtype: 'food' },
  'food_delivery': { type: 'restaurant', subtype: 'food' },

  // Hotels & Lodging
  'lodging': { type: 'hotel', subtype: 'hotels' },
  'hotel': { type: 'hotel', subtype: 'hotels' },
  'motel': { type: 'hotel', subtype: 'motels' },
  'rv_park': { type: 'hotel', subtype: 'rv_parks' },
  'campground': { type: 'hotel', subtype: 'campgrounds' },

  // Shopping
  'shopping_mall': { type: 'shopping', subtype: 'shopping' },
  'store': { type: 'shopping', subtype: 'stores' },
  'clothing_store': { type: 'shopping', subtype: 'clothing' },
  'jewelry_store': { type: 'shopping', subtype: 'jewelry' },
  'hardware_store': { type: 'shopping', subtype: 'hardware' },
  'sporting_goods_store': { type: 'shopping', subtype: 'sporting_goods' },
  'book_store': { type: 'shopping', subtype: 'books' },
  'florist': { type: 'shopping', subtype: 'flowers' },

  // Services
  'spa': { type: 'service', subtype: 'spas' },
  'beauty_salon': { type: 'service', subtype: 'salons' },
  'hair_care': { type: 'service', subtype: 'hair' },
  'barbershop': { type: 'service', subtype: 'barbershops' },
  'gym': { type: 'service', subtype: 'fitness' },
  'health': { type: 'service', subtype: 'health' },
  'dentist': { type: 'service', subtype: 'dentist' },
  'doctor': { type: 'service', subtype: 'medical' },
  'veterinary_care': { type: 'service', subtype: 'veterinary' },
  'car_rental': { type: 'service', subtype: 'car_rental' },
  'car_repair': { type: 'service', subtype: 'car_repair' },
  'laundry': { type: 'service', subtype: 'laundry' },

  // Entertainment & Activities
  'amusement_park': { type: 'activity', subtype: 'amusement' },
  'aquarium': { type: 'activity', subtype: 'aquarium' },
  'art_gallery': { type: 'activity', subtype: 'gallery' },
  'museum': { type: 'activity', subtype: 'museum' },
  'movie_theater': { type: 'activity', subtype: 'theater' },
  'bowling_alley': { type: 'activity', subtype: 'bowling' },
  'golf_course': { type: 'activity', subtype: 'golf' },
  'gym': { type: 'activity', subtype: 'fitness' },
  'park': { type: 'park', subtype: 'parks' },
  'natural_feature': { type: 'park', subtype: 'nature' },
  'tourist_attraction': { type: 'activity', subtype: 'attraction' },
  'zoo': { type: 'activity', subtype: 'zoo' },
  'aquarium': { type: 'activity', subtype: 'aquarium' },

  // Arts & Culture
  'art': { type: 'artist', subtype: 'art' },
  'artist': { type: 'artist', subtype: 'artist' },
  'cultural_organization': { type: 'artist', subtype: 'culture' }
};

function categorizeFromTypes(types) {
  if (!types || !Array.isArray(types)) return null;

  for (const type of types) {
    const normalized = type.toLowerCase().replace(/_/g, '_');
    if (TYPE_MAPPING[normalized]) {
      return TYPE_MAPPING[normalized];
    }
  }
  return null;
}

function extractCategory(data, dirName) {
  // Try direct fields first
  if (data.profileType && data.category) {
    return { type: data.profileType, subtype: data.category };
  }
  if (data.profileType) {
    return { type: data.profileType, subtype: data.profileType };
  }
  if (data.category) {
    return { type: data.category, subtype: data.category };
  }

  // Try Google Places types
  if (data.types) {
    const mapped = categorizeFromTypes(data.types);
    if (mapped) return mapped;
  }

  // Try to extract from directory name
  const dirLower = dirName.toLowerCase();
  if (dirLower.includes('restaurant')) return { type: 'restaurant', subtype: 'restaurants' };
  if (dirLower.includes('hotel')) return { type: 'hotel', subtype: 'hotels' };
  if (dirLower.includes('bar') || dirLower.includes('tavern')) return { type: 'nightlife', subtype: 'bars' };
  if (dirLower.includes('shop') || dirLower.includes('store')) return { type: 'shopping', subtype: 'stores' };
  if (dirLower.includes('activity') || dirLower.includes('activity')) return { type: 'activity', subtype: 'activities' };
  if (dirLower.includes('park')) return { type: 'park', subtype: 'parks' };
  if (dirLower.includes('art') || dirLower.includes('gallery')) return { type: 'artist', subtype: 'art' };

  return null;
}

async function syncWithCategories() {
  console.log('🔄 Syncing COMPLETE organized data with categories...\n');

  const businessDirs = fs.readdirSync(ORGANIZED_DIR).filter(f => {
    const stat = fs.statSync(path.join(ORGANIZED_DIR, f));
    return stat.isDirectory() && !f.startsWith('_');
  });

  console.log(`📂 Found ${businessDirs.length} business directories\n`);

  const entitiesDir = path.join(DATA_DIR, 'entities');
  const index = [];
  const categoryStats = {};
  let processed = 0;

  businessDirs.forEach((dirName, i) => {
    if (i % 500 === 0 && i > 0) console.log(`   Processed ${i}/${businessDirs.length}...`);

    const businessPath = path.join(ORGANIZED_DIR, dirName);
    const jsonDir = path.join(businessPath, 'json');

    let bestData = null;
    let bestScore = 0;

    // Find the BEST version in /json/ directory
    if (fs.existsSync(jsonDir)) {
      const jsonFiles = fs.readdirSync(jsonDir)
        .filter(f => f.endsWith('.json'))
        .sort();

      for (const jsonFile of jsonFiles) {
        const data = loadJSON(path.join(jsonDir, jsonFile));
        if (data && (!bestData || (data.completenessScore > bestScore))) {
          bestScore = data.completenessScore || 0;
          bestData = data;
        }
      }
    }

    // Fallback to _CONSOLIDATED.json if nothing in /json/
    if (!bestData) {
      bestData = loadJSON(path.join(businessPath, '_CONSOLIDATED.json'));
    }

    if (!bestData) return;

    // Extract category
    const category = extractCategory(bestData, dirName);

    // Transform to standard format
    const slug = dirName;
    const entity = {
      slug,
      name: bestData.name || dirName.replace(/-/g, ' '),
      entity_type: category?.type || 'business',
      entity_subtype: category?.subtype || 'general',
      icon: bestData.emoji || '🏪',
      description: bestData.description || '',
      phone: bestData.phone,
      email: bestData.email,
      address_line_1: bestData.address,
      city: bestData.region || '',
      website_url: bestData.website,
      rating: bestData.rating,
      review_count: bestData.reviewCount,
      hours: bestData.hours || [],
      menu_sections: bestData.menu || [],
      drink_sections: [],
      happy_hour: { schedule: '', sections: [] },
      events: bestData.events || [],
      photos: bestData.images || [],
      hero_image_url: bestData.images && bestData.images[0] ? bestData.images[0] : null,
      amenities: bestData.amenities || [],
      tags: bestData.types || [],
      featured: false,
      is_active: bestData.isActive !== false,
      completeness_score: bestData.completenessScore,
      sources: bestData.sources || {}
    };

    // Track categories
    const catKey = `${entity.entity_type}:${entity.entity_subtype}`;
    categoryStats[catKey] = (categoryStats[catKey] || 0) + 1;

    // Save entity
    const entityPath = path.join(entitiesDir, `${slug}.json`);
    saveJSON(entityPath, entity);

    // Add to index
    index.push({
      slug,
      name: entity.name,
      entity_type: entity.entity_type,
      entity_subtype: entity.entity_subtype,
      city: entity.city,
      hero_image_url: entity.hero_image_url,
      rating: entity.rating,
      tags: entity.tags,
      featured: entity.featured,
      completeness_score: entity.completeness_score
    });

    processed++;
  });

  // Save index
  saveJSON(path.join(DATA_DIR, 'entities-index.json'), index);

  console.log(`\n✅ Sync complete!`);
  console.log(`\n📊 Summary:`);
  console.log(`   - ${processed} businesses synced`);

  // Count by type
  const typeStats = {};
  Object.entries(categoryStats).forEach(([key, count]) => {
    const [type] = key.split(':');
    typeStats[type] = (typeStats[type] || 0) + count;
  });

  console.log(`\n📁 By Type:`);
  Object.entries(typeStats).sort(([,a], [,b]) => b - a).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
  });

  console.log(`\n🚀 gar-front-end-data ready with categorized data!`);
}

syncWithCategories().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
