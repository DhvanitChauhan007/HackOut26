import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getOrCreate(email, password, profileData) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role: profileData.role }
  });

  let id;
  if (error?.message?.includes('already registered')) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find(u => u.email === email);
    id = existing?.id;
  } else {
    id = data?.user?.id;
  }
  if (!id) { console.warn(`Could not create/find user ${email}`); return null; }
  await supabase.from('users').upsert({ id, ...profileData });
  return id;
}

// ─── SEED ───────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱  Seeding database with full mock data...\n');

  // ── 1. USERS ──────────────────────────────────────────────────────────────
  console.log('Creating users...');

  const buyerId = await getOrCreate('buyer@example.com', 'password123', {
    name: 'MetroPack Industries', role: 'manufacturer', is_seed: true,
    address: 'Hebbal, Bengaluru', lat: 13.0358, long: 77.5972
  });

  const sellerId1 = await getOrCreate('seller1@example.com', 'password123', {
    name: 'BrightCart Retail', role: 'retailer', is_seed: true,
    address: 'Peenya Industrial Area', lat: 13.0285, long: 77.5197
  });

  const sellerId2 = await getOrCreate('seller2@example.com', 'password123', {
    name: 'Aster Beverages', role: 'manufacturer', is_seed: true,
    address: 'Whitefield, Bengaluru', lat: 12.9698, long: 77.7499
  });

  const sellerId3 = await getOrCreate('seller3@example.com', 'password123', {
    name: 'GreenPoly Material Yards', role: 'retailer', is_seed: true,
    address: 'Bommasandra Industrial Area', lat: 12.8014, long: 77.6754
  });

  const recyclerId = await getOrCreate('recycler@example.com', 'password123', {
    name: 'Auto-Recycle Partner', role: 'recycler', is_seed: true,
    is_fixed_recycler: true, auto_accept: true,
    address: 'Electronic City', lat: 12.8398, long: 77.6799
  });

  const logisticsId = await getOrCreate('logistics@example.com', 'password123', {
    name: 'SwiftHaul Logistics', role: 'logistics', is_seed: true,
    address: 'Yeshwanthpur, Bengaluru', lat: 13.0219, long: 77.5512
  });

  console.log('✓ Users created\n');

  // ── 2. EMISSION FACTORS ───────────────────────────────────────────────────
  console.log('Inserting emission factors...');
  await supabase.from('emission_factors').upsert([
    { material_type: 'Cardboard', co2e_kg_per_kg: 3.12, source_note: 'IPCC 2021' },
    { material_type: 'Plastic',   co2e_kg_per_kg: 6.00, source_note: 'IPCC 2021' },
    { material_type: 'Pallets',   co2e_kg_per_kg: 0.81, source_note: 'IPCC 2021' },
    { material_type: 'Glass',     co2e_kg_per_kg: 0.87, source_note: 'IPCC 2021' },
    { material_type: 'Metal',     co2e_kg_per_kg: 2.50, source_note: 'IPCC 2021' },
  ]);
  console.log('✓ Emission factors inserted\n');

  // ── 3. BULK RATES ──────────────────────────────────────────────────────────
  await supabase.from('bulk_rates').upsert([
    { material_type: 'Cardboard', bulk_rate_per_kg: 8.50 },
    { material_type: 'Plastic',   bulk_rate_per_kg: 32.00 },
    { material_type: 'Pallets',   bulk_rate_per_kg: 8.40 },
  ]);

  // ── 4. LISTINGS ───────────────────────────────────────────────────────────
  console.log('Inserting listings...');

  const listingIds = {
    cardboard: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    rPET:      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    pallets:   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    ldpe:      'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
    claimed:   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
  };

  await supabase.from('listings').upsert([
    {
      id: listingIds.cardboard, seller_id: sellerId1,
      material_type: 'Cardboard', sub_grade: 'OCC 11',
      contamination_pct: 2.1, quantity: 1400, unit: 'kg',
      condition: 'Certified clean',
      list_price: 14.00, price_floor: 9.20, decay_window_seconds: 7200,
      pickup_lat: 13.0285, pickup_long: 77.5197, status: 'open'
    },
    {
      id: listingIds.rPET, seller_id: sellerId2,
      material_type: 'Plastic', sub_grade: 'rPET A',
      contamination_pct: 0.8, quantity: 820, unit: 'kg',
      condition: 'Washed & inspected',
      list_price: 46.00, price_floor: 34.00, decay_window_seconds: 7200,
      pickup_lat: 12.9698, pickup_long: 77.7499, status: 'open'
    },
    {
      id: listingIds.pallets, seller_id: sellerId1,
      material_type: 'Pallets', sub_grade: 'Grade A',
      contamination_pct: 0.0, quantity: 200, unit: 'units',
      condition: 'Heat treated, reusable',
      list_price: 120.00, price_floor: 80.00, decay_window_seconds: 14400,
      pickup_lat: 13.0285, pickup_long: 77.5197, status: 'open'
    },
    {
      id: listingIds.ldpe, seller_id: sellerId3,
      material_type: 'Plastic', sub_grade: 'LDPE Film',
      contamination_pct: 2.0, quantity: 2400, unit: 'kg',
      condition: '98% transparency',
      list_price: 31.00, price_floor: 22.00, decay_window_seconds: 7200,
      pickup_lat: 12.8014, pickup_long: 77.6754, status: 'open'
    },
    {
      id: listingIds.claimed, seller_id: sellerId2,
      material_type: 'Cardboard', sub_grade: 'Duplex Board',
      contamination_pct: 3.5, quantity: 600, unit: 'kg',
      condition: 'Good condition',
      list_price: 12.00, price_floor: 8.00, decay_window_seconds: 3600,
      pickup_lat: 12.9698, pickup_long: 77.7499, status: 'claimed'
    },
  ]);
  console.log('✓ Listings inserted\n');

  // ── 5. REQUESTS ───────────────────────────────────────────────────────────
  console.log('Inserting requests...');

  const requestIds = {
    pending:  'req00001-9c0b-4ef8-bb6d-6bb9bd380a11',
    accepted: 'req00002-9c0b-4ef8-bb6d-6bb9bd380a12',
    declined: 'req00003-9c0b-4ef8-bb6d-6bb9bd380a13',
  };

  if (buyerId) {
    await supabase.from('requests').upsert([
      {
        id: requestIds.pending, listing_id: listingIds.rPET,
        buyer_id: buyerId, status: 'pending'
      },
      {
        id: requestIds.accepted, listing_id: listingIds.cardboard,
        buyer_id: buyerId, status: 'accepted'
      },
      {
        id: requestIds.declined, listing_id: listingIds.ldpe,
        buyer_id: buyerId, status: 'declined'
      },
    ]);
    console.log('✓ Requests inserted\n');

    // ── 6. TRANSACTIONS ───────────────────────────────────────────────────
    console.log('Inserting transactions...');

    const txIds = {
      pending:   'tx000001-9c0b-4ef8-bb6d-6bb9bd380a11',
      estimated: 'tx000002-9c0b-4ef8-bb6d-6bb9bd380a12',
      committed: 'tx000003-9c0b-4ef8-bb6d-6bb9bd380a13',
      completed: 'tx000004-9c0b-4ef8-bb6d-6bb9bd380a14',
    };

    await supabase.from('transactions').upsert([
      {
        id: txIds.pending, listing_id: listingIds.rPET,
        request_id: requestIds.pending,
        buyer_id: buyerId, seller_id: sellerId2,
        status: 'pending',
        impact_kg_diverted: 820, impact_co2e_kg: 4920,
      },
      {
        id: txIds.estimated, listing_id: listingIds.cardboard,
        request_id: requestIds.accepted,
        buyer_id: buyerId, seller_id: sellerId1,
        status: 'estimated', distance_km: 18, estimated_cost: 2850,
        impact_kg_diverted: 1400, impact_co2e_kg: 4368,
      },
      {
        id: txIds.committed, listing_id: listingIds.pallets,
        buyer_id: buyerId, seller_id: sellerId1,
        status: 'committed', distance_km: 12, estimated_cost: 1620,
        impact_kg_diverted: 500, impact_co2e_kg: 405,
      },
      {
        id: txIds.completed, listing_id: listingIds.claimed,
        buyer_id: buyerId, seller_id: sellerId2,
        status: 'completed', distance_km: 23, estimated_cost: 3100,
        impact_kg_diverted: 600, impact_co2e_kg: 1872,
        completed_at: new Date().toISOString(),
      },
    ]);
    console.log('✓ Transactions inserted\n');

    // ── 7. JOBS ───────────────────────────────────────────────────────────
    console.log('Inserting jobs...');

    const jobIds = {
      open:      'job00001-9c0b-4ef8-bb6d-6bb9bd380a11',
      assigned:  'job00002-9c0b-4ef8-bb6d-6bb9bd380a12',
      delivered: 'job00003-9c0b-4ef8-bb6d-6bb9bd380a13',
    };

    await supabase.from('jobs').upsert([
      {
        id: jobIds.open, transaction_id: txIds.estimated,
        pickup_lat: 13.0285, pickup_long: 77.5197,
        dropoff_lat: 13.0358, dropoff_long: 77.5972,
        distance_km: 18, estimated_cost: 2850,
        status: 'open',
      },
      {
        id: jobIds.assigned, transaction_id: txIds.committed,
        logistics_company_id: logisticsId,
        pickup_lat: 13.0285, pickup_long: 77.5197,
        dropoff_lat: 13.0358, dropoff_long: 77.5972,
        distance_km: 12, estimated_cost: 1620,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      },
      {
        id: jobIds.delivered, transaction_id: txIds.completed,
        logistics_company_id: logisticsId,
        pickup_lat: 12.9698, pickup_long: 77.7499,
        dropoff_lat: 13.0358, dropoff_long: 77.5972,
        distance_km: 23, estimated_cost: 3100,
        status: 'delivered',
        assigned_at: new Date(Date.now() - 86400000).toISOString(),
        delivered_at: new Date().toISOString(),
      },
    ]);
    console.log('✓ Jobs inserted\n');

    // ── 8. RATINGS ────────────────────────────────────────────────────────
    console.log('Inserting ratings...');
    await supabase.from('ratings').upsert([
      {
        id: 'rat00001-9c0b-4ef8-bb6d-6bb9bd380a11',
        transaction_id: txIds.completed,
        rater_id: buyerId, ratee_id: sellerId2,
        rating: 5, comment: 'Great quality material, packed well!'
      },
      {
        id: 'rat00002-9c0b-4ef8-bb6d-6bb9bd380a12',
        transaction_id: txIds.completed,
        rater_id: sellerId2, ratee_id: buyerId,
        rating: 4, comment: 'Prompt pickup, smooth transaction.'
      },
    ]);
    console.log('✓ Ratings inserted\n');
  }

  // ── 9. BULK LOT ───────────────────────────────────────────────────────────
  console.log('Inserting bulk lot...');
  const bulkLotId = 'blot0001-9c0b-4ef8-bb6d-6bb9bd380a11';
  await supabase.from('bulk_lots').upsert([
    {
      id: bulkLotId,
      material_type: 'Pallets', sub_grade: 'Mixed A/B',
      status: 'open',
      total_quantity: 3280, bulk_rate_per_kg: 8.40,
    }
  ]);

  if (sellerId1) {
    await supabase.from('bulk_lot_items').upsert([
      {
        id: 'bli00001-9c0b-4ef8-bb6d-6bb9bd380a11',
        bulk_lot_id: bulkLotId, listing_id: listingIds.pallets,
        seller_id: sellerId1, quantity: 1640,
        pickup_lat: 13.0285, pickup_long: 77.5197,
      },
      {
        id: 'bli00002-9c0b-4ef8-bb6d-6bb9bd380a12',
        bulk_lot_id: bulkLotId, listing_id: listingIds.ldpe,
        seller_id: sellerId3, quantity: 1640,
        pickup_lat: 12.8014, pickup_long: 77.6754,
      },
    ]);
  }
  console.log('✓ Bulk lot inserted\n');

  // ── 10. NOTIFICATIONS ─────────────────────────────────────────────────────
  if (buyerId) {
    console.log('Inserting notifications...');
    await supabase.from('notifications').upsert([
      {
        id: 'notif001-9c0b-4ef8-bb6d-6bb9bd380a11',
        user_id: buyerId, read: false, type: 'request_accepted',
        message: 'Your request for Cardboard OCC 11 was accepted by BrightCart Retail!'
      },
      {
        id: 'notif002-9c0b-4ef8-bb6d-6bb9bd380a12',
        user_id: buyerId, read: false, type: 'job_assigned',
        message: 'SwiftHaul Logistics has picked up your pallet order.'
      },
      {
        id: 'notif003-9c0b-4ef8-bb6d-6bb9bd380a13',
        user_id: buyerId, read: true, type: 'transaction_completed',
        message: 'Transaction completed: Duplex Board 600 kg. Rate your seller!'
      },
    ]);
    console.log('✓ Notifications inserted\n');
  }

  console.log('─────────────────────────────────────────────────────────');
  console.log('✅  Seed complete!\n');
  console.log('Test Accounts:');
  console.log('  buyer@example.com      / password123  (role: manufacturer / buyer)');
  console.log('  seller1@example.com    / password123  (role: retailer / seller)');
  console.log('  seller2@example.com    / password123  (role: manufacturer / seller)');
  console.log('  seller3@example.com    / password123  (role: retailer / seller)');
  console.log('  logistics@example.com  / password123  (role: logistics)');
  console.log('  recycler@example.com   / password123  (role: recycler / fixed fallback)');
  console.log('─────────────────────────────────────────────────────────');
}

seed().catch(console.error);
