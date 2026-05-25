# launching-GCR Sections Integration Guide

## Overview
All 5,580+ businesses are now synced to `gar-front-end-data` and automatically organized into business sections:

- 🏢 **Business** (4,673) - General businesses
- 🍷 **Nightlife** (270) - Bars and nightclubs  
- 🎨 **Artist** (230) - Local artists and performers
- 🌳 **Park** (157) - Parks and outdoor attractions
- 🍽️ **Restaurant** (140) - Restaurants and dining
- 🛍️ **Shopping** (90) - Retail stores
- 🏨 **Hotel** (18) - Hotels and lodging
- 🎯 **Activity** (2) - Activities and entertainment

## API Endpoints

### Get All Sections Configuration
```
GET /api/gcr/sections
```
Returns: `sections.json` with all available sections, subtypes, and counts

### Get Entities by Type
```
GET /api/gcr/entities?type=restaurant
GET /api/gcr/entities?type=nightlife&subtype=bars
```

### Search Across All Types
```
GET /api/gcr/entities?search=pizza
GET /api/gcr/entities?featured=true
```

## launching-GCR Integration

### 1. Display Sections Dynamically
```html
<!-- HTML -->
<div id="sections-nav"></div>

<script>
// Load sections from gar-front-end-data
fetch('https://gar-front-end-data.vercel.app/api/gcr/sections')
  .then(r => r.json())
  .then(config => {
    const nav = document.getElementById('sections-nav');
    config.sections.forEach(section => {
      const link = document.createElement('a');
      link.href = `${section.route}.html`;
      link.className = 'section-nav-link';
      link.innerHTML = `${section.icon} ${section.name} (${section.count})`;
      nav.appendChild(link);
    });
  });
</script>
```

### 2. Load Entities for a Section
```javascript
// Load restaurants
const response = await fetch(
  'https://gar-front-end-data.vercel.app/api/gcr/entities?type=restaurant'
);
const { entities } = await response.json();

// Display entities
entities.forEach(entity => {
  console.log(`${entity.name} - ${entity.city}`);
});
```

### 3. Section-Specific Pages

Each section can fetch its own category:

**restaurants.html:**
```javascript
const TYPE = 'restaurant';
const entities = await fetch(`/api/gcr/entities?type=${TYPE}`).then(r => r.json());
```

**artists.html:**
```javascript
const TYPE = 'artist';
const entities = await fetch(`/api/gcr/entities?type=${TYPE}`).then(r => r.json());
```

**staying.html:**
```javascript
const TYPE = 'hotel';
const entities = await fetch(`/api/gcr/entities?type=${TYPE}`).then(r => r.json());
```

## Configuration Files

### `data/sections.json`
Complete sections configuration with stats:
- Total entities
- Total types
- Total subtypes
- Full section breakdown

### `data/launching-gcr-sections.json`
Pre-formatted configuration for launching-GCR:
- Display order
- Routes for each section
- Subtypes with filters

### `data/entities-index.json`
Index of all 5,580 entities with:
- slug, name, type, subtype
- city, rating, tags
- hero_image_url, featured status

### `data/entities/*.json`
Individual entity files (one per business) with complete data:
- Contact info (phone, email, website)
- Address and location
- Hours of operation
- Menus, events, specials
- Photos and amenities
- Rating and reviews

## Admin Dashboard Integration

The admin dashboard (`cybercheck-login`) can now:
1. **View all sections** - GET `/api/gcr/sections`
2. **View entities by section** - GET `/api/gcr/entities?type=SECTION`
3. **Edit menus by PIN** - POST `/api/gcr/entity/:slug/menu` with PIN
4. **Add events** - POST `/api/gcr/events`
5. **Manage amenities** - POST `/api/gcr/entity/:slug/amenities`

## Data Sync Scripts

### Sync Complete Data with Categories
```bash
node sync-complete-with-categories.js
```
- Reads from `/Users/owner/MASTER-ALL-BUSINESSES-COMPLETE`
- Extracts proper categories from JSON files
- Uses Google Places types as fallback
- Extracts from directory names as last resort
- Saves 5,580+ entities to `/data/entities/`

### Generate Sections Configuration
```bash
node generate-sections-config.js
```
- Analyzes all synced entities
- Groups by type and subtype
- Creates `sections.json`
- Generates stats and summaries

### Configure launching-GCR
```bash
node configure-launching-gcr-sections.js
```
- Creates `launching-gcr-sections.json`
- Maps types to routes
- Provides pre-formatted config for frontend

## Next Steps

1. **Test All Sections** 
   - Verify each section page loads from new API
   - Check entity counts match configuration
   - Test filters and search

2. **Image Loading**
   - Most entities still need images
   - AI can help populate missing images
   - Supabase URLs may need updating

3. **Data Quality**
   - Menus: 0% complete (can be added via admin)
   - Images: ~19 with valid URLs
   - Hours: Some populated from organized data

4. **AI Integration**
   - Use AI chat to enhance descriptions
   - Add missing images via web scraping
   - Normalize menu data
   - Generate events and specials

## File Sizes

```
data/entities/          5,580 .json files (one per business)
data/sections.json      ~20KB
data/entities-index.json ~2.5MB
data/launching-gcr-sections.json ~15KB
```

## Performance Notes

- Entities cached at Vercel CDN (5 min) with stale-while-revalidate (1 hr)
- Sections endpoint is small (~20KB) - caches well
- Index file (~2.5MB) loads on startup
- Individual entity lookups are instant (file-based)
- Search and filter happens in memory (fast for 5K entities)

## Troubleshooting

### Sections not showing
- Check `/api/gcr/sections` returns data
- Verify `data/sections.json` exists
- Re-run `generate-sections-config.js`

### Entities not appearing
- Check `/api/gcr/entities?limit=10` returns data
- Verify `data/entities-index.json` exists
- Check individual entity files in `data/entities/`

### Wrong categorization
- Re-run `sync-complete-with-categories.js`
- Check `MASTER-ALL-BUSINESSES-COMPLETE` data has proper types
- Update TYPE_MAPPING in script for custom categories

---

**Status**: ✅ All 5,580 entities synced and configured for launching-GCR display
**API**: gar-front-end-data running on port 3001 (local) / Vercel (deployed)
**Admin**: cybercheck-login dashboard wired to new API with PIN support
