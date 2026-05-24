#!/usr/bin/env node
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GCR_API = 'https://gcr-api-gules.vercel.app/api/gcr';
const DATA = path.join(__dirname, 'data');

// Ensure all section folders exist
['entities','menus','hours','photos','offers','info','products','amenities','about'].forEach(d =>
  fs.mkdirSync(path.join(DATA, d), { recursive: true })
);

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function write(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function fetchFull(slug) {
  try {
    const d = await get(`${GCR_API}/entity/${encodeURIComponent(slug)}`);
    return d.entity || d.business || d;
  } catch {
    return null;
  }
}

function file(dir, slug) {
  return path.join(DATA, dir, `${slug}.json`);
}

async function syncAll() {
  console.log('Syncing from GCR API...\n');

  const [entitiesData, events, specials, happyHours] = await Promise.all([
    get(`${GCR_API}/entities?limit=1000`),
    get(`${GCR_API}/events`).catch(() => []),
    get(`${GCR_API}/specials`).catch(() => []),
    get(`${GCR_API}/happy-hours`).catch(() => []),
  ]);

  const slim = entitiesData.entities || entitiesData.businesses || [];
  console.log(`Fetched: ${slim.length} entities | ${events.length} events | ${specials.length} specials | ${happyHours.length} happy hours\n`);

  // Top-level list files
  write(path.join(DATA, 'events.json'), events);
  write(path.join(DATA, 'specials.json'), specials);
  write(path.join(DATA, 'happy-hours.json'), happyHours);

  // Slim search index
  const index = slim.map(e => ({
    slug:          e.slug || e.id,
    name:          e.name,
    entity_type:   e.entity_type || e.type || '',
    entity_subtype:e.entity_subtype || '',
    city:          e.city || '',
    hero_image_url:e.hero_image_url || '',
    rating:        e.rating || null,
    price_range:   e.price_range || '',
    tags:          e.tags || [],
    featured:      e.featured || false,
    icon:          e.icon || '',
    phone:         e.phone || '',
  }));
  write(path.join(DATA, 'entities-index.json'), index);
  console.log(`✓ entities-index.json (${index.length} entries)`);

  // Full per-entity sync in batches of 10
  let done = 0;
  const BATCH = 10;

  for (let i = 0; i < slim.length; i += BATCH) {
    const batch = slim.slice(i, i + BATCH);

    await Promise.all(batch.map(async (e) => {
      const slug = e.slug || e.id;
      if (!slug) return;

      const f = await fetchFull(slug);
      if (!f) return;

      // ── Core entity ───────────────────────────────────────────────
      write(file('entities', slug), {
        id:              f.id,
        slug,
        name:            f.name,
        entity_type:     f.entity_type || f.type || '',
        entity_subtype:  f.entity_subtype || '',
        secondary_types: f.secondary_types || [],
        icon:            f.icon || '',
        subtitle:        f.subtitle || '',
        description:     f.description || '',
        short_description: f.short_description || '',
        tagline:         f.tagline || '',
        featured:        f.featured || false,
        gcr_verified:    f.gcr_verified || false,
        address_line_1:  f.address_line_1 || '',
        address_line_2:  f.address_line_2 || '',
        city:            f.city || '',
        state:           f.state || '',
        zip:             f.zip || '',
        latitude:        f.latitude || null,
        longitude:       f.longitude || null,
        phone:           f.phone || '',
        email:           f.email || '',
        website_url:     f.website_url || '',
        booking_url:     f.booking_url || '',
        reservation_url: f.reservation_url || '',
        order_url:       f.order_url || '',
        menu_url:        f.menu_url || '',
        directions_url:  f.directions_url || '',
        call_url:        f.call_url || '',
        social_facebook: f.social_facebook || '',
        social_instagram:f.social_instagram || '',
        social_tiktok:   f.social_tiktok || '',
        social_twitter:  f.social_twitter || '',
        social_youtube:  f.social_youtube || '',
        hero_image_url:  f.hero_image_url || '',
        logo_url:        f.logo_url || '',
        rating:          f.rating || null,
        review_count:    f.review_count || 0,
        price_range:     f.price_range || '',
        price_from:      f.price_from || null,
        price_to:        f.price_to || null,
        price_unit:      f.price_unit || '',
        dine_in:         f.dine_in || false,
        takeout:         f.takeout || false,
        delivery:        f.delivery || false,
        outdoor_seating: f.outdoor_seating || false,
        live_music:      f.live_music || false,
        parking:         f.parking || false,
        wifi:            f.wifi || false,
        reservable:      f.reservable || false,
        tags:            f.tags || [],
      });

      // ── Menu ──────────────────────────────────────────────────────
      write(file('menus', slug), {
        slug,
        menu_sections:       f.menu_sections || [],
        drink_sections:      f.drink_sections || [],
        happy_hour_sections: f.happy_hour_sections || [],
      });

      // ── Hours ─────────────────────────────────────────────────────
      write(file('hours', slug), {
        slug,
        hours:          f.hours || [],
        hours_text:     f.hours_text || '',
        open_time:      f.open_time || '',
        close_time:     f.close_time || '',
        hh_days:        f.hh_days || '',
        hh_start:       f.hh_start || '',
        hh_end:         f.hh_end || '',
        hh_description: f.hh_description || '',
      });

      // ── Photos ────────────────────────────────────────────────────
      write(file('photos', slug), {
        slug,
        photos: f.photos || [],
      });

      // ── Offers (pricing, activities, fleet, addons, bookings) ─────
      write(file('offers', slug), {
        slug,
        pricing:       f.pricing || f.pricing_items || [],
        activities:    f.activities || [],
        fleet:         f.fleet || f.fleet_items || [],
        addons:        f.addons || [],
        whats_included:f.whats_included || [],
        booking_slots: f.booking_slots || [],
        product_sections: f.product_sections || [],
      });

      // ── Info (policies, requirements, Q&A) ───────────────────────
      write(file('info', slug), {
        slug,
        requirements:   f.requirements || [],
        policies:       f.policies || [],
        meeting_points: f.meeting_points || [],
        qna:            f.qna || f.entity_qna || [],
      });

      // ── About (story, bullets, features, perfect for) ─────────────
      write(file('about', slug), {
        slug,
        about_bullets: f.about_bullets || f.entity_about_bullets || [],
        features:      f.features || [],
        perfect_for:   f.perfect_for || [],
        sections:      f.sections || f.entity_sections || [],
      });

      // ── Amenities & Tags ──────────────────────────────────────────
      write(file('amenities', slug), {
        slug,
        tags:            f.tags || [],
        amenities: {
          dine_in:         f.dine_in || false,
          takeout:         f.takeout || false,
          delivery:        f.delivery || false,
          outdoor_seating: f.outdoor_seating || false,
          live_music:      f.live_music || false,
          parking:         f.parking || false,
          wifi:            f.wifi || false,
          reservable:      f.reservable || false,
          waterfront:      f.waterfront || false,
          pet_friendly:    f.pet_friendly || false,
          kids_friendly:   f.kids_friendly || false,
          wheelchair_accessible: f.wheelchair_accessible || false,
          serves_beer:     f.serves_beer || false,
          serves_wine:     f.serves_wine || false,
          serves_cocktails:f.serves_cocktails || false,
          good_for_groups: f.good_for_groups || false,
        },
        // Condo/hotel specific
        condo_amenities: f.condo_amenities || f.accommodation_amenities || [],
        room_types:      f.room_types || [],
        check_in_time:   f.check_in_time || '',
        check_out_time:  f.check_out_time || '',
        min_stay_nights: f.min_stay_nights || null,
        num_bedrooms:    f.num_bedrooms || null,
        num_bathrooms:   f.num_bathrooms || null,
        max_occupancy:   f.max_occupancy || null,
        pool:            f.pool || false,
        beachfront:      f.beachfront || false,
        gulf_views:      f.gulf_views || false,
      });
    }));

    done += batch.length;
    process.stdout.write(`\r  ${done}/${slim.length} entities synced...`);
  }

  console.log('\n\n✓ All files written across all section folders');
  console.log('Sync complete.');
}

syncAll().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
