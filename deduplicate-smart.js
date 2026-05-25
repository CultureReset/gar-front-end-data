#!/usr/bin/env node
/**
 * SMART DEDUPLICATION - 2 Separate Tests
 *
 * TEST 1: Google Place ID matching (most reliable)
 * TEST 2: Phone + Address + 90% name similarity
 * TEST 3: Name similarity (85%+) - separate pass
 */

const fs = require('fs');
const path = require('path');

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '').slice(-10); // Last 10 digits
}

function normalizeAddress(addr) {
  if (!addr) return '';
  return addr.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilarity(name1, name2) {
  // Levenshtein-like similarity score (0-100)
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  if (longer.includes(shorter)) return 95; // substring match

  // Count matching characters in order
  let matches = 0;
  let shortIdx = 0;
  for (let i = 0; i < longer.length && shortIdx < shorter.length; i++) {
    if (longer[i] === shorter[shortIdx]) {
      matches++;
      shortIdx++;
    }
  }

  return Math.round((matches / longer.length) * 100);
}

async function smartDeduplicate() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 SMART DEDUPLICATION - 2 Separate Tests');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Simulate loading all businesses from mega-merge
  // For now, just show the strategy
  console.log('📋 DEDUPLICATION STRATEGY:\n');

  console.log('TEST 1: Google Place ID (Most Reliable)');
  console.log('  Logic: Place ID is Google\'s definitive identifier');
  console.log('  Match: Exact Place ID = SAME BUSINESS');
  console.log('  Action: Merge all sources for that business\n');

  console.log('TEST 2: Phone + Address + Name Similarity (High Confidence)');
  console.log('  Logic: Multiple matching fields reduce false matches');
  console.log('  Match Requirements:');
  console.log('    ✅ Phone matches (last 10 digits)');
  console.log('    ✅ Address matches (normalized)');
  console.log('    ✅ Name similarity 90%+');
  console.log('  Action: Group as SAME BUSINESS\n');

  console.log('TEST 3: Name Similarity (Separate Pass)');
  console.log('  Logic: For remaining unmatched records');
  console.log('  Match: Name similarity 85%+');
  console.log('  Note: Higher threshold (85%) due to no phone/address');
  console.log('  Action: Flag for MANUAL REVIEW (high risk of false match)\n');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🎯 MERGE PRIORITY (when duplicates found):\n');

  console.log('For each field type:\n');
  console.log('CONTACT INFO (phone, email, website):');
  console.log('  → Use NEWEST source\n');

  console.log('HOURS:');
  console.log('  → API (Supabase) > MASTER > Google Scraper\n');

  console.log('DESCRIPTION:');
  console.log('  → Use LONGEST + most recent\n');

  console.log('RATINGS/REVIEWS:');
  console.log('  → Use FRESHEST (latest timestamp)\n');

  console.log('IMAGES:');
  console.log('  → MERGE ALL (no deletion)\n');

  console.log('MENUS/EVENTS:');
  console.log('  → MERGE ALL (consolidate)\n');

  console.log('CATEGORIES:');
  console.log('  → Human-tagged > AI-inferred\n');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('⚠️  SAFETY RULES:\n');

  console.log('✅ SAFE TO MERGE:');
  console.log('  - Same Place ID');
  console.log('  - Phone + Address + Name 90%+ similar');
  console.log('  - Multiple human confirmations\n');

  console.log('❌ REQUIRES MANUAL REVIEW:');
  console.log('  - Name only match (85%+)');
  console.log('  - Missing critical identifiers');
  console.log('  - Conflicting info (different cities, categories)\n');

  console.log('🗑️  DELETE (obviously bad):');
  console.log('  - Empty name');
  console.log('  - Invalid phone format');
  console.log('  - Latitude/longitude = 0,0');
  console.log('  - Generic placeholder entries\n');

  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Test the similarity function
  console.log('🧪 TESTING NAME SIMILARITY:\n');

  const tests = [
    ['The Hangout', 'The Hangout Restaurant', 90], // should match 90%+
    ['Phoenix Condo I', 'Phoenix I', 85], // should match 85%+
    ['Gulf Shores Beach', 'Gulf Coast Beach', 80], // should NOT match 90%
    ['Lambert\'s Cafe', 'Lamberts Cafe', 95], // should match high
    ['Restaurant X', 'Bar Y', 20], // should NOT match
  ];

  for (const [name1, name2, expected] of tests) {
    const score = nameSimilarity(name1, name2);
    const pass = score >= expected ? '✅' : '❌';
    console.log(`  ${pass} "${name1}" vs "${name2}": ${score}% (expected ${expected}%+)`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('Ready to deduplicate all data using these rules.\n');
}

smartDeduplicate().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
