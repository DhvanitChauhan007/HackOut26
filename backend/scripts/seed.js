/**
 * Idempotent seed script for the Circular Packaging & Materials Exchange.
 *
 * Clears existing seed data before re-inserting, so it is safe to run
 * multiple times. Creates 6 accounts across all 4 roles, inserts emission
 * factors (blended, not material-specific), bulk rates (illustrative),
 * and 8–10 sample listings with varied decay states.
 *
 * Usage: node scripts/seed.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Seed account definitions ─────────────────────────────────
const SEED_PASSWORD = 'SeedPassword123!';

const SEED_USERS = [
  {
    email: 'manufacturer1@seed.local',
    name: 'Delhi Packaging Co.',
    role: 'manufacturer',
    address: 'Industrial Area, Delhi',
    lat: 28.6139,
    long: 77.2090,
    is_fixed_recycler: false,
    auto_accept: false,
  },
  {
    email: 'manufacturer2@seed.local',
    name: 'Mumbai Materials Ltd.',
    role: 'manufacturer',
    address: 'Andheri East, Mumbai',
    lat: 19.0760,
    long: 72.8777,
    is_fixed_recycler: false,
    auto_accept: false,
  },
  {
    email: 'retailer1@seed.local',
    name: 'Bangalore Retail Hub',
    role: 'retailer',
    address: 'Electronic City, Bangalore',
    lat: 12.9716,
    long: 77.5946,
    is_fixed_recycler: false,
    auto_accept: false,
  },
  {
    email: 'recycler1@seed.local',
    name: 'Chennai Green Recyclers',
    role: 'recycler',
    address: 'Ambattur Industrial Estate, Chennai',
    lat: 13.0827,
    long: 80.2707,
    is_fixed_recycler: true,
    auto_accept: true,
  },
  {
    email: 'buyer1@seed.local',
    name: 'Hyderabad Eco Supplies',
    role: 'retailer',
    address: 'HITEC City, Hyderabad',
    lat: 17.3850,
    long: 78.4867,
    is_fixed_recycler: false,
    auto_accept: true,
  },
  {
    email: 'logistics1@seed.local',
    name: 'Pune Fast Freight',
    role: 'logistics',
    address: 'Hinjewadi, Pune',
    lat: 18.5204,
    long: 73.8567,
    is_fixed_recycler: false,
    auto_accept: true,
  },
];

// ── Emission factors (blended, not material-specific) ────────
const EMISSION_SOURCE_NOTE =
  'Blended from EPA mixed-recyclables factor: 2.83 MTCO2E avoided per short ton recycled vs. landfilled (EPA Greenhouse Gas Equivalencies Calculator). Converted to kg. NOT material-specific — swap in EPA WARM per-material recycling factors for precision.';

const MATERIAL_TYPES = ['cardboard', 'PET', 'HDPE', 'LDPE', 'wood_pallet', 'mixed_plastic'];

const EMISSION_FACTORS = MATERIAL_TYPES.map((mt) => ({
  material_type: mt,
  co2e_kg_per_kg: 3.12,
  source_note: EMISSION_SOURCE_NOTE,
}));

// ── Bulk rates (illustrative, not real market pricing) ───────
const BULK_RATES = [
  { material_type: 'cardboard', bulk_rate_per_kg: 0.15 },
  { material_type: 'PET', bulk_rate_per_kg: 0.35 },
  { material_type: 'HDPE', bulk_rate_per_kg: 0.30 },
  { material_type: 'LDPE', bulk_rate_per_kg: 0.25 },
  { material_type: 'wood_pallet', bulk_rate_per_kg: 0.10 },
  { material_type: 'mixed_plastic', bulk_rate_per_kg: 0.20 },
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting seed...\n');

  // ─── Step 1: Clear existing seed data ──────────────────────
  console.log('Clearing existing seed data...');

  // Get seed user IDs first
  const { data: existingSeedUsers } = await supabase
    .from('users')
    .select('id')
    .eq('is_seed', true);

  const seedUserIds = (existingSeedUsers || []).map((u) => u.id);

  if (seedUserIds.length > 0) {
    // Delete in dependency order
    // Ratings, job_stops, jobs, transactions, requests, notifications, bulk_lot_items, bulk_lots, listings
    const { data: seedListings } = await supabase
      .from('listings')
      .select('id')
      .in('seller_id', seedUserIds);
    const seedListingIds = (seedListings || []).map((l) => l.id);

    if (seedListingIds.length > 0) {
      await supabase.from('bulk_lot_items').delete().in('listing_id', seedListingIds);
    }

    const { data: seedTxns } = await supabase
      .from('transactions')
      .select('id')
      .or(seedUserIds.map((id) => `buyer_id.eq.${id},seller_id.eq.${id}`).join(','));
    const seedTxnIds = (seedTxns || []).map((t) => t.id);

    if (seedTxnIds.length > 0) {
      await supabase.from('ratings').delete().in('transaction_id', seedTxnIds);
      const { data: seedJobs } = await supabase
        .from('jobs')
        .select('id')
        .in('transaction_id', seedTxnIds);
      const seedJobIds = (seedJobs || []).map((j) => j.id);
      if (seedJobIds.length > 0) {
        await supabase.from('job_stops').delete().in('job_id', seedJobIds);
      }
      await supabase.from('jobs').delete().in('transaction_id', seedTxnIds);
      await supabase.from('transactions').delete().in('id', seedTxnIds);
    }

    if (seedListingIds.length > 0) {
      await supabase.from('requests').delete().in('listing_id', seedListingIds);
      await supabase.from('listings').delete().in('id', seedListingIds);
    }

    await supabase.from('notifications').delete().in('user_id', seedUserIds);
    await supabase.from('users').delete().eq('is_seed', true);

    // Delete auth users
    for (const uid of seedUserIds) {
      await supabase.auth.admin.deleteUser(uid).catch(() => {});
    }
  }

  // Clear bulk lots that might be orphaned
  await supabase.from('bulk_lot_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bulk_lots').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Clear reference data
  await supabase.from('emission_factors').delete().neq('material_type', '');
  await supabase.from('bulk_rates').delete().neq('material_type', '');
  await supabase.from('distance_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('  ✅ Cleared existing seed data\n');

  // ─── Step 2: Create auth users + profiles ──────────────────
  console.log('Creating seed users...');
  const userIdMap = {}; // email -> uuid

  for (const user of SEED_USERS) {
    // Delete existing auth user if present (by email lookup)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = (existingUsers?.users || []).find((u) => u.email === user.email);
    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id);
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: SEED_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      console.error(`  ❌ Failed to create auth user ${user.email}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    userIdMap[user.email] = userId;

    // Create profile
    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      name: user.name,
      role: user.role,
      address: user.address,
      lat: user.lat,
      long: user.long,
      is_fixed_recycler: user.is_fixed_recycler,
      is_seed: true,
      auto_accept: user.auto_accept,
    });

    if (profileError) {
      console.error(`  ❌ Failed to create profile for ${user.email}:`, profileError.message);
      continue;
    }

    const flags = [
      user.is_fixed_recycler && 'FIXED_RECYCLER',
      user.auto_accept && 'AUTO_ACCEPT',
    ].filter(Boolean).join(', ');

    console.log(`  ✅ ${user.email} (${user.role})${flags ? ` [${flags}]` : ''}`);
  }

  console.log('');

  // ─── Step 3: Insert emission factors ───────────────────────
  console.log('Inserting emission factors...');
  const { error: efError } = await supabase.from('emission_factors').insert(EMISSION_FACTORS);
  if (efError) {
    console.error('  ❌ Emission factors insert failed:', efError.message);
  } else {
    console.log(`  ✅ ${EMISSION_FACTORS.length} emission factors (blended 3.12 kg CO2e/kg)`);
  }
  console.log('');

  // ─── Step 4: Insert bulk rates ─────────────────────────────
  console.log('Inserting bulk rates (illustrative, not real market pricing)...');
  const { error: brError } = await supabase.from('bulk_rates').insert(BULK_RATES);
  if (brError) {
    console.error('  ❌ Bulk rates insert failed:', brError.message);
  } else {
    console.log(`  ✅ ${BULK_RATES.length} bulk rates`);
  }
  console.log('');

  // ─── Step 5: Insert sample listings ────────────────────────
  console.log('Inserting sample listings...');

  const mfr1 = userIdMap['manufacturer1@seed.local'];
  const mfr2 = userIdMap['manufacturer2@seed.local'];
  const retailer = userIdMap['retailer1@seed.local'];

  if (!mfr1 || !mfr2 || !retailer) {
    console.error('  ❌ Cannot create listings — seed users not found');
    process.exit(1);
  }

  const now = new Date();
  const DEMO_DECAY = 180; // 3 minutes for demo visibility

  // Helper: timestamp N seconds ago
  const ago = (seconds) => new Date(now.getTime() - seconds * 1000).toISOString();

  const listings = [
    // Fresh listings (just created)
    {
      seller_id: mfr1,
      material_type: 'cardboard',
      sub_grade: 'OCC',
      contamination_pct: 2,
      quantity: 500,
      unit: 'kg',
      condition: 'Dry, baled, stored indoors',
      list_price: 8.00,
      price_floor: 3.20,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 28.6139,
      pickup_long: 77.2090,
      status: 'open',
      created_at: now.toISOString(),
    },
    {
      seller_id: mfr1,
      material_type: 'PET',
      sub_grade: 'clear',
      contamination_pct: 5,
      quantity: 200,
      unit: 'kg',
      condition: 'Clean, sorted, no caps',
      list_price: 12.50,
      price_floor: 5.00,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 28.6200,
      pickup_long: 77.2150,
      status: 'open',
      created_at: now.toISOString(),
    },
    {
      seller_id: mfr2,
      material_type: 'HDPE',
      sub_grade: 'natural',
      contamination_pct: 3,
      quantity: 350,
      unit: 'kg',
      condition: 'Post-industrial, granulated',
      list_price: 15.00,
      price_floor: 6.00,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 19.0760,
      pickup_long: 72.8777,
      status: 'open',
      created_at: now.toISOString(),
    },

    // Partially decayed (~60% through decay window)
    {
      seller_id: mfr2,
      material_type: 'LDPE',
      sub_grade: 'film',
      contamination_pct: 8,
      quantity: 150,
      unit: 'kg',
      condition: 'Stretch wrap, baled',
      list_price: 6.00,
      price_floor: 2.40,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 19.0800,
      pickup_long: 72.8800,
      status: 'open',
      created_at: ago(Math.floor(DEMO_DECAY * 0.6)),
    },
    {
      seller_id: retailer,
      material_type: 'cardboard',
      sub_grade: 'DLK',
      contamination_pct: 4,
      quantity: 800,
      unit: 'kg',
      condition: 'Mixed quality, some moisture exposure',
      list_price: 5.00,
      price_floor: 2.00,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 12.9716,
      pickup_long: 77.5946,
      status: 'open',
      created_at: ago(Math.floor(DEMO_DECAY * 0.5)),
    },

    // Fully decayed at floor (for batch eligibility testing)
    {
      seller_id: mfr1,
      material_type: 'mixed_plastic',
      sub_grade: 'mixed',
      contamination_pct: 15,
      quantity: 400,
      unit: 'kg',
      condition: 'Unsorted, some contamination',
      list_price: 4.00,
      price_floor: 1.60,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 28.6300,
      pickup_long: 77.2200,
      status: 'open',
      created_at: ago(DEMO_DECAY + 5),
    },
    {
      seller_id: mfr2,
      material_type: 'mixed_plastic',
      sub_grade: 'mixed',
      contamination_pct: 12,
      quantity: 300,
      unit: 'kg',
      condition: 'Post-consumer, partially sorted',
      list_price: 3.50,
      price_floor: 1.40,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 19.0900,
      pickup_long: 72.8900,
      status: 'open',
      created_at: ago(DEMO_DECAY + 5),
    },

    // Past floor + fallback timeout (for recycler auto-acceptance testing)
    {
      seller_id: retailer,
      material_type: 'wood_pallet',
      sub_grade: 'standard',
      contamination_pct: 0,
      quantity: 50,
      unit: 'units',
      condition: 'Used, structurally sound',
      list_price: 10.00,
      price_floor: 4.00,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 12.9800,
      pickup_long: 77.6000,
      status: 'open',
      // Past decay window + recycler fallback timeout (using demo fallback = 30s)
      created_at: ago(DEMO_DECAY + 60),
    },

    // Another stale listing for testing
    {
      seller_id: mfr1,
      material_type: 'PET',
      sub_grade: 'colored',
      contamination_pct: 10,
      quantity: 180,
      unit: 'kg',
      condition: 'Post-consumer bottles, colored',
      list_price: 9.00,
      price_floor: 3.60,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 28.6400,
      pickup_long: 77.2300,
      status: 'open',
      created_at: ago(Math.floor(DEMO_DECAY * 0.85)),
    },

    // One more fresh listing
    {
      seller_id: retailer,
      material_type: 'HDPE',
      sub_grade: 'colored',
      contamination_pct: 6,
      quantity: 250,
      unit: 'kg',
      condition: 'Detergent bottles, rinsed',
      list_price: 11.00,
      price_floor: 4.40,
      decay_window_seconds: DEMO_DECAY,
      pickup_lat: 12.9600,
      pickup_long: 77.5800,
      status: 'open',
      created_at: now.toISOString(),
    },
  ];

  const { data: insertedListings, error: listingsError } = await supabase
    .from('listings')
    .insert(listings)
    .select();

  if (listingsError) {
    console.error('  ❌ Listings insert failed:', listingsError.message);
  } else {
    console.log(`  ✅ ${insertedListings.length} listings created`);

    // Categorize
    const fresh = insertedListings.filter((l) => {
      const elapsed = (now.getTime() - new Date(l.created_at).getTime()) / 1000;
      return elapsed < l.decay_window_seconds * 0.3;
    });
    const partial = insertedListings.filter((l) => {
      const elapsed = (now.getTime() - new Date(l.created_at).getTime()) / 1000;
      const frac = elapsed / l.decay_window_seconds;
      return frac >= 0.3 && frac < 1.0;
    });
    const atFloor = insertedListings.filter((l) => {
      const elapsed = (now.getTime() - new Date(l.created_at).getTime()) / 1000;
      return elapsed >= l.decay_window_seconds;
    });

    console.log(`     - ${fresh.length} fresh, ${partial.length} partially decayed, ${atFloor.length} at floor`);
  }
  console.log('');

  // ─── Done ──────────────────────────────────────────────────
  console.log('🌱 Seed complete!\n');
  console.log('Login credentials for all seed accounts:');
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log('  Emails:');
  for (const user of SEED_USERS) {
    console.log(`    - ${user.email} (${user.role})`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
