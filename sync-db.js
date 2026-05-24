#!/usr/bin/env node
// Pulls ALL data directly from Supabase — bypasses API limits
// Run: SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=your_service_role_key node sync-db.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://adpnhipmdefutkzzltbs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_KEY. Run:\nSUPABASE_KEY=your_service_role_key node sync-db.js');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DATA = path.join(__dirname, 'data');

// Ensure all folders exist
['entities','menus','hours','photos','offers','info','about','amenities'].forEach(d =>
  fs.mkdirSync(path.join(DATA, d), { recursive: true })
);

function write(dir, slug, data) {
  fs.writeFileSync(path.join(DATA, dir, `${slug}.json`), JSON.stringify(data, null, 2));
}

async function all(table, select = '*', filters = {}) {
  let q = db.from(table).select(select);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) { console.warn(`  ⚠ ${table}:`, error.message); return []; }
  return data || [];
}

async function syncAll() {
  console.log('Connecting to Supabase...\n');

  // 1. Load ALL entities
  const { data: entities, error: entErr } = await db
    .from('entity')
    .select('*')
    .order('name');

  if (entErr) { console.error('Failed to load entities:', entErr.message); process.exit(1); }
  console.log(`✓ Loaded ${entities.length} entities\n`);

  // 2. Load ALL related data in bulk (one query each — much faster than per-entity)
  console.log('Loading all related tables...');
  const [
    allSections, allSectionItems,
    allHours,
    allPhotos,
    allEvents, allSpecials,
    allHHSections, allHHItems,
    allActivities, allPricing, allFleet, allAddons,
    allIncluded, allSlots,
    allRequirements, allPolicies, allMeetingPoints, allQna,
    allBullets, allFeatures, allPerfectFor,
    allTags, allProductSections,
  ] = await Promise.all([
    all('entity_sections', 'id, entity_id, section_key, section_label, section_type, sort_order'),
    all('section_items', 'id, section_id, item_name, item_description, price_label, price_text, price_numeric, price_min, price_max, unit_label, item_type, image_url, sort_order'),
    all('entity_hours'),
    all('entity_photos'),
    all('entity_events'),
    all('entity_specials'),
    all('happy_hour_sections'),
    all('happy_hour_items'),
    all('activities'),
    all('pricing_items'),
    all('fleet_items'),
    all('addons'),
    all('whats_included'),
    all('booking_slots'),
    all('requirements'),
    all('policies'),
    all('meeting_points'),
    all('entity_qna'),
    all('entity_about_bullets'),
    all('entity_features'),
    all('entity_perfect_for'),
    all('entity_tags'),
    all('product_sections'),
  ]);
  console.log('✓ All tables loaded\n');

  // 3. Index everything by entity_id for fast lookup
  const byEntity = (arr, key = 'entity_id') => {
    const map = {};
    arr.forEach(r => {
      const id = r[key];
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(r);
    });
    return map;
  };

  const sectionsByEntity   = byEntity(allSections);
  const itemsBySection     = byEntity(allSectionItems, 'section_id');
  const hoursByEntity      = byEntity(allHours);
  const photosByEntity     = byEntity(allPhotos);
  const eventsByEntity     = byEntity(allEvents);
  const specialsByEntity   = byEntity(allSpecials);
  const hhSectionsByEntity = byEntity(allHHSections);
  const hhItemsBySection   = byEntity(allHHItems, 'section_id');
  const activitiesByEntity = byEntity(allActivities);
  const pricingByEntity    = byEntity(allPricing);
  const fleetByEntity      = byEntity(allFleet);
  const addonsByEntity     = byEntity(allAddons);
  const includedByEntity   = byEntity(allIncluded);
  const slotsByEntity      = byEntity(allSlots);
  const reqByEntity        = byEntity(allRequirements);
  const polByEntity        = byEntity(allPolicies);
  const meetByEntity       = byEntity(allMeetingPoints);
  const qnaByEntity        = byEntity(allQna);
  const bulletsByEntity    = byEntity(allBullets);
  const featuresByEntity   = byEntity(allFeatures);
  const perfectForByEntity = byEntity(allPerfectFor);
  const tagsByEntity       = byEntity(allTags);
  const productsByEntity   = byEntity(allProductSections);

  // 4. Build index + per-entity files
  const index = [];

  for (const e of entities) {
    const eid  = e.id;
    const slug = e.slug || e.id;

    // Build section structure — section_items grouped under their section
    const sections = (sectionsByEntity[eid] || []).map(s => ({
      ...s,
      items: (itemsBySection[s.id] || []).sort((a,b) => a.sort_order - b.sort_order),
    }));

    // Split sections by type for clean display
    const menuSections = sections.filter(s =>
      ['menu','food','breakfast','lunch','dinner','appetizers','entrees','sides','desserts','specials_menu'].includes((s.section_type||s.section_key||'').toLowerCase())
    );
    const drinkSections = sections.filter(s =>
      ['drinks','bar','beer','wine','cocktails','spirits','non_alcoholic'].includes((s.section_type||s.section_key||'').toLowerCase())
    );
    const hhSections = (hhSectionsByEntity[eid] || []).map(s => ({
      ...s,
      items: (hhItemsBySection[s.id] || []),
    }));
    // Everything else (activities, shopping, services, etc.)
    const otherSections = sections.filter(s => !menuSections.includes(s) && !drinkSections.includes(s));

    // Slim index entry
    index.push({
      slug,
      name:           e.name,
      entity_type:    e.entity_type || '',
      entity_subtype: e.entity_subtype || '',
      city:           e.city || '',
      hero_image_url: e.hero_image_url || '',
      rating:         e.rating || null,
      price_range:    e.price_range || '',
      tags:           (tagsByEntity[eid] || []).map(t => t.tag),
      featured:       e.featured || false,
      icon:           e.icon || '',
      phone:          e.phone || '',
    });

    // ── Core entity ───────────────────────────────────────────────
    write('entities', slug, {
      id: eid, slug,
      name:             e.name,
      entity_type:      e.entity_type || '',
      entity_subtype:   e.entity_subtype || '',
      secondary_types:  e.secondary_types || [],
      icon:             e.icon || '',
      subtitle:         e.subtitle || '',
      description:      e.description || '',
      short_description:e.short_description || '',
      tagline:          e.tagline || '',
      featured:         e.featured || false,
      gcr_verified:     e.gcr_verified || false,
      address_line_1:   e.address_line_1 || '',
      address_line_2:   e.address_line_2 || '',
      city:             e.city || '',
      state:            e.state || '',
      zip:              e.zip || '',
      latitude:         e.latitude || null,
      longitude:        e.longitude || null,
      phone:            e.phone || '',
      email:            e.email || '',
      website_url:      e.website_url || '',
      booking_url:      e.booking_url || '',
      reservation_url:  e.reservation_url || '',
      order_url:        e.order_url || '',
      menu_url:         e.menu_url || '',
      directions_url:   e.directions_url || '',
      call_url:         e.call_url || '',
      social_facebook:  e.social_facebook || '',
      social_instagram: e.social_instagram || '',
      social_tiktok:    e.social_tiktok || '',
      social_twitter:   e.social_twitter || '',
      social_youtube:   e.social_youtube || '',
      hero_image_url:   e.hero_image_url || '',
      logo_url:         e.logo_url || '',
      rating:           e.rating || null,
      review_count:     e.review_count || 0,
      price_range:      e.price_range || '',
      price_from:       e.price_from || null,
      price_to:         e.price_to || null,
      price_unit:       e.price_unit || '',
      dine_in:          e.dine_in || false,
      takeout:          e.takeout || false,
      delivery:         e.delivery || false,
      outdoor_seating:  e.outdoor_seating || false,
      live_music:       e.live_music || false,
      parking:          e.parking || false,
      wifi:             e.wifi || false,
      reservable:       e.reservable || false,
      waterfront:       e.waterfront || false,
      pet_friendly:     e.pet_friendly || false,
      kids_friendly:    e.kids_friendly || false,
    });

    // ── Menu ─────────────────────────────────────────────────────
    write('menus', slug, {
      slug,
      menu_sections:        menuSections,
      drink_sections:       drinkSections,
      happy_hour_sections:  hhSections,
      other_sections:       otherSections,
    });

    // ── Hours ────────────────────────────────────────────────────
    write('hours', slug, {
      slug,
      hours:          hoursByEntity[eid] || [],
      hours_text:     e.hours_text || '',
      open_time:      e.open_time || '',
      close_time:     e.close_time || '',
      hh_days:        e.hh_days || '',
      hh_start:       e.hh_start || '',
      hh_end:         e.hh_end || '',
      hh_description: e.hh_description || '',
    });

    // ── Photos ───────────────────────────────────────────────────
    write('photos', slug, {
      slug,
      photos: photosByEntity[eid] || [],
    });

    // ── Offers ───────────────────────────────────────────────────
    write('offers', slug, {
      slug,
      pricing:          pricingByEntity[eid] || [],
      activities:       activitiesByEntity[eid] || [],
      fleet:            fleetByEntity[eid] || [],
      addons:           addonsByEntity[eid] || [],
      whats_included:   includedByEntity[eid] || [],
      booking_slots:    slotsByEntity[eid] || [],
      product_sections: productsByEntity[eid] || [],
    });

    // ── Info ─────────────────────────────────────────────────────
    write('info', slug, {
      slug,
      requirements:   reqByEntity[eid] || [],
      policies:       polByEntity[eid] || [],
      meeting_points: meetByEntity[eid] || [],
      qna:            qnaByEntity[eid] || [],
    });

    // ── About ────────────────────────────────────────────────────
    write('about', slug, {
      slug,
      about_bullets: bulletsByEntity[eid] || [],
      features:      featuresByEntity[eid] || [],
      perfect_for:   perfectForByEntity[eid] || [],
    });

    // ── Amenities & Tags ─────────────────────────────────────────
    write('amenities', slug, {
      slug,
      tags: (tagsByEntity[eid] || []).map(t => t.tag),
      amenities: {
        dine_in:               e.dine_in || false,
        takeout:               e.takeout || false,
        delivery:              e.delivery || false,
        outdoor_seating:       e.outdoor_seating || false,
        live_music:            e.live_music || false,
        parking:               e.parking || false,
        wifi:                  e.wifi || false,
        reservable:            e.reservable || false,
        waterfront:            e.waterfront || false,
        pet_friendly:          e.pet_friendly || false,
        kids_friendly:         e.kids_friendly || false,
        wheelchair_accessible: e.wheelchair_accessible || false,
        serves_beer:           e.serves_beer || false,
        serves_wine:           e.serves_wine || false,
        serves_cocktails:      e.serves_cocktails || false,
        good_for_groups:       e.good_for_groups || false,
        pool:                  e.pool || false,
        beachfront:            e.beachfront || false,
        gulf_views:            e.gulf_views || false,
      },
      condo_amenities:  e.condo_amenities || [],
      check_in_time:    e.check_in_time || '',
      check_out_time:   e.check_out_time || '',
      min_stay_nights:  e.min_stay_nights || null,
      num_bedrooms:     e.num_bedrooms || null,
      num_bathrooms:    e.num_bathrooms || null,
      max_occupancy:    e.max_occupancy || null,
    });
  }

  // 5. Write top-level index + event/specials/HH files
  fs.writeFileSync(path.join(DATA, 'entities-index.json'), JSON.stringify(index, null, 2));
  console.log(`✓ entities-index.json (${index.length} entries)`);

  fs.writeFileSync(path.join(DATA, 'events.json'), JSON.stringify(allEvents, null, 2));
  fs.writeFileSync(path.join(DATA, 'specials.json'), JSON.stringify(allSpecials, null, 2));
  fs.writeFileSync(path.join(DATA, 'happy-hours.json'), JSON.stringify(allHHSections, null, 2));
  console.log('✓ events.json, specials.json, happy-hours.json\n');

  console.log(`✓ ${entities.length} entities synced across all section folders`);
  console.log('\nSync complete.');
}

syncAll().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
