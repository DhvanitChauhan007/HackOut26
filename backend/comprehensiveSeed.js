import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getOrCreateUser(email, password, profile) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: profile.name, role: profile.role, address: profile.address }
  });

  let id;
  if (error?.message?.includes('already registered')) {
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find(u => u.email === email);
    id = existing?.id;
  } else {
    id = data?.user?.id;
  }

  if (id) {
    await supabase.from('users').upsert({
      id,
      name: profile.name,
      role: profile.role,
      address: profile.address,
      lat: profile.lat,
      long: profile.long,
      is_fixed_recycler: profile.is_fixed_recycler || false,
      is_seed: true,
      auto_accept: profile.auto_accept || false
    }, { onConflict: 'id' });
  }

  return id;
}

async function seed() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // 1. Create / Sync All Key Users
  console.log('1. Setting up users with complete profile data...');

  const users = {
    buyer: await getOrCreateUser('buyer@example.com', 'password123', {
      name: 'MetroPack Industries', role: 'manufacturer',
      address: 'Plot 42, Hebbal Industrial Area, Bengaluru, Karnataka 560024',
      lat: 13.0358, long: 77.5972
    }),
    hetRecycler: await getOrCreateUser('hetthakkar5586@gmail.com', 'password123', {
      name: 'Het Thakkar (GreenCycle Labs)', role: 'recycler',
      address: 'Near DAIICT, Gandhinagar / Bengaluru Hub',
      lat: 12.9716, long: 77.5946
    }),
    seller1: await getOrCreateUser('seller1@example.com', 'password123', {
      name: 'BrightCart Retail Hub', role: 'retailer',
      address: 'Phase 2, Peenya Industrial Area, Bengaluru 560058',
      lat: 13.0285, long: 77.5197
    }),
    seller2: await getOrCreateUser('seller2@example.com', 'password123', {
      name: 'Aster Beverages & Bottling Ltd', role: 'manufacturer',
      address: 'EPIP Zone, Whitefield, Bengaluru 560066',
      lat: 12.9698, long: 77.7499
    }),
    seller3: await getOrCreateUser('seller3@example.com', 'password123', {
      name: 'GreenPoly Material Yards', role: 'retailer',
      address: 'Hosur Road, Bommasandra Industrial Area, Bengaluru 560099',
      lat: 12.8014, long: 77.6754
    }),
    logistics1: await getOrCreateUser('logistics@example.com', 'password123', {
      name: 'SwiftHaul Circular Logistics', role: 'logistics',
      address: 'Outer Ring Road, Yeshwanthpur Transport Yard, Bengaluru 560022',
      lat: 13.0219, long: 77.5512
    }),
    logistics2: await getOrCreateUser('logistics2@example.com', 'password123', {
      name: 'Pune Fast Freight & Fleets', role: 'logistics',
      address: 'Peenya Cargo Hub, Bengaluru 560058',
      lat: 13.0310, long: 77.5250
    }),
    recycler: await getOrCreateUser('recycler@example.com', 'password123', {
      name: 'EcoCore Recyclers & Compounders', role: 'recycler',
      address: 'Phase 1, Electronic City, Bengaluru 560100',
      lat: 12.8398, long: 77.6799,
      is_fixed_recycler: true, auto_accept: true
    })
  };

  console.log('   Users ready:', Object.keys(users).length);

  // 2. Emission Factors
  console.log('2. Inserting emission factors with complete documentation...');
  await supabase.from('emission_factors').upsert([
    { material_type: 'Cardboard', co2e_kg_per_kg: 3.12, source_note: 'IPCC 2021 & WRAP Virgin vs Recycled Pulp Benchmark' },
    { material_type: 'Plastic', co2e_kg_per_kg: 6.00, source_note: 'Association of Plastic Recyclers (APR) Life Cycle Study' },
    { material_type: 'Pallets', co2e_kg_per_kg: 0.81, source_note: 'US Forest Service Wood Reuse GHG Offset Protocol' },
    { material_type: 'Glass', co2e_kg_per_kg: 0.87, source_note: 'Glass Packaging Institute (GPI) Container Recycling Life Cycle' },
    { material_type: 'Metal', co2e_kg_per_kg: 2.50, source_note: 'International Aluminium Institute & BIR Secondary Smelting' },
  ], { onConflict: 'material_type' });

  // 3. Bulk Rates
  console.log('3. Inserting bulk rates...');
  await supabase.from('bulk_rates').upsert([
    { material_type: 'Cardboard', bulk_rate_per_kg: 8.50 },
    { material_type: 'Plastic', bulk_rate_per_kg: 32.00 },
    { material_type: 'Pallets', bulk_rate_per_kg: 8.40 },
    { material_type: 'Glass', bulk_rate_per_kg: 4.20 },
    { material_type: 'Metal', bulk_rate_per_kg: 45.00 },
  ], { onConflict: 'material_type' });

  // 4. Clean up and insert listings with full fields (including photo_url)
  console.log('4. Inserting detailed listings with photos and full spec...');

  const listingsData = [
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seller_id: users.seller1,
      material_type: 'Cardboard',
      sub_grade: 'OCC 11 High-Grade',
      contamination_pct: 1.8,
      quantity: 1400,
      unit: 'kg',
      condition: 'Baled, dry & certified clean double-wall corrugated',
      photo_url: '/images/cardboard-bales.jpg',
      list_price: 14.00,
      price_floor: 9.20,
      decay_window_seconds: 7200,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      status: 'open',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      seller_id: users.seller2,
      material_type: 'Plastic',
      sub_grade: 'rPET Flakes Clear',
      contamination_pct: 0.8,
      quantity: 820,
      unit: 'kg',
      condition: 'Hot-washed, optical sorted & flake size < 12mm',
      photo_url: '/images/blue-drums.jpg',
      list_price: 46.00,
      price_floor: 34.00,
      decay_window_seconds: 10800,
      pickup_lat: 12.9698,
      pickup_long: 77.7499,
      status: 'open',
      created_at: new Date(Date.now() - 5400000).toISOString()
    },
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      seller_id: users.seller1,
      material_type: 'Pallets',
      sub_grade: 'Grade A Euro Timber',
      contamination_pct: 0.0,
      quantity: 320,
      unit: 'units',
      condition: 'Heat-treated ISPM-15, dry stored, 4-way entry',
      photo_url: '/images/wood-pallets.jpg',
      list_price: 120.00,
      price_floor: 85.00,
      decay_window_seconds: 14400,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      status: 'open',
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      seller_id: users.seller3,
      material_type: 'Plastic',
      sub_grade: 'LDPE 98/2 Clear Film',
      contamination_pct: 1.5,
      quantity: 2400,
      unit: 'kg',
      condition: '98% clear stretch film, baled on site with wire ties',
      photo_url: '/images/film-bales.jpg',
      list_price: 31.00,
      price_floor: 22.00,
      decay_window_seconds: 7200,
      pickup_lat: 12.8014,
      pickup_long: 77.6754,
      status: 'open',
      created_at: new Date(Date.now() - 4200000).toISOString()
    },
    {
      id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
      seller_id: users.seller2,
      material_type: 'Cardboard',
      sub_grade: 'Duplex Board & Cores',
      contamination_pct: 2.9,
      quantity: 950,
      unit: 'kg',
      condition: 'Industrial winding cores and packaging cuttings',
      photo_url: '/images/cardboard-bales.jpg',
      list_price: 13.50,
      price_floor: 9.00,
      decay_window_seconds: 7200,
      pickup_lat: 12.9698,
      pickup_long: 77.7499,
      status: 'claimed',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
      seller_id: users.seller3,
      material_type: 'Plastic',
      sub_grade: 'HDPE Regrind Drums',
      contamination_pct: 0.5,
      quantity: 1100,
      unit: 'kg',
      condition: 'Triple-rinsed blue barrel regrind, melt flow 0.05',
      photo_url: '/images/blue-drums.jpg',
      list_price: 52.00,
      price_floor: 38.00,
      decay_window_seconds: 14400,
      pickup_lat: 12.8014,
      pickup_long: 77.6754,
      status: 'open',
      created_at: new Date(Date.now() - 2400000).toISOString()
    }
  ];

  await supabase.from('listings').upsert(listingsData, { onConflict: 'id' });
  console.log('   Listings ready:', listingsData.length);

  // 5. Insert Requests for Het and Buyer
  console.log('5. Inserting realistic requests...');
  const requestsData = [
    {
      id: 'req00001-9c0b-4ef8-bb6d-6bb9bd380a11',
      listing_id: listingsData[0].id,
      buyer_id: users.hetRecycler,
      status: 'accepted',
      created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'req00002-9c0b-4ef8-bb6d-6bb9bd380a12',
      listing_id: listingsData[1].id,
      buyer_id: users.hetRecycler,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'req00003-9c0b-4ef8-bb6d-6bb9bd380a13',
      listing_id: listingsData[3].id,
      buyer_id: users.buyer,
      status: 'pending',
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'req00004-9c0b-4ef8-bb6d-6bb9bd380a14',
      listing_id: listingsData[4].id,
      buyer_id: users.hetRecycler,
      status: 'accepted',
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  await supabase.from('requests').upsert(requestsData, { onConflict: 'id' });
  console.log('   Requests ready:', requestsData.length);

  // 6. Bulk Lots & Items
  console.log('6. Inserting multi-seller bulk lot pools...');
  const bulkLotId1 = 'blot0001-9c0b-4ef8-bb6d-6bb9bd380a11';
  const bulkLotId2 = 'blot0002-9c0b-4ef8-bb6d-6bb9bd380a12';

  await supabase.from('bulk_lots').upsert([
    {
      id: bulkLotId1,
      material_type: 'Pallets',
      sub_grade: 'Mixed Industrial Reusable',
      status: 'open',
      total_quantity: 3280,
      bulk_rate_per_kg: 8.40,
      created_at: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: bulkLotId2,
      material_type: 'Plastic',
      sub_grade: 'LDPE / LLDPE Bundled Film',
      status: 'open',
      total_quantity: 4800,
      bulk_rate_per_kg: 24.50,
      created_at: new Date(Date.now() - 7200000).toISOString()
    }
  ], { onConflict: 'id' });

  await supabase.from('bulk_lot_items').upsert([
    {
      id: 'bli00001-9c0b-4ef8-bb6d-6bb9bd380a11',
      bulk_lot_id: bulkLotId1,
      listing_id: listingsData[2].id,
      seller_id: users.seller1,
      quantity: 1640,
      pickup_lat: 13.0285,
      pickup_long: 77.5197
    },
    {
      id: 'bli00002-9c0b-4ef8-bb6d-6bb9bd380a12',
      bulk_lot_id: bulkLotId1,
      listing_id: listingsData[3].id,
      seller_id: users.seller3,
      quantity: 1640,
      pickup_lat: 12.8014,
      pickup_long: 77.6754
    },
    {
      id: 'bli00003-9c0b-4ef8-bb6d-6bb9bd380a13',
      bulk_lot_id: bulkLotId2,
      listing_id: listingsData[3].id,
      seller_id: users.seller3,
      quantity: 4800,
      pickup_lat: 12.8014,
      pickup_long: 77.6754
    }
  ], { onConflict: 'id' });
  console.log('   Bulk pools & items ready');

  // 7. Transactions
  console.log('7. Inserting transactions across all status stages...');
  const txData = [
    {
      id: 'tx000001-9c0b-4ef8-bb6d-6bb9bd380a11',
      listing_id: listingsData[0].id,
      request_id: requestsData[0].id,
      buyer_id: users.hetRecycler,
      seller_id: users.seller1,
      status: 'committed',
      distance_km: 18.5,
      estimated_cost: 2850.00,
      impact_kg_diverted: 1400,
      impact_co2e_kg: 4368.00,
      created_at: new Date(Date.now() - 7000000).toISOString()
    },
    {
      id: 'tx000002-9c0b-4ef8-bb6d-6bb9bd380a12',
      listing_id: listingsData[1].id,
      request_id: requestsData[1].id,
      buyer_id: users.hetRecycler,
      seller_id: users.seller2,
      status: 'estimated',
      distance_km: 24.2,
      estimated_cost: 3200.00,
      impact_kg_diverted: 820,
      impact_co2e_kg: 4920.00,
      created_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'tx000003-9c0b-4ef8-bb6d-6bb9bd380a13',
      listing_id: listingsData[4].id,
      request_id: requestsData[3].id,
      buyer_id: users.hetRecycler,
      seller_id: users.seller2,
      status: 'completed',
      distance_km: 16.0,
      estimated_cost: 2150.00,
      impact_kg_diverted: 950,
      impact_co2e_kg: 2964.00,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      completed_at: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: 'tx000004-9c0b-4ef8-bb6d-6bb9bd380a14',
      bulk_lot_id: bulkLotId1,
      buyer_id: users.buyer,
      status: 'committed',
      distance_km: 32.0,
      estimated_cost: 4800.00,
      impact_kg_diverted: 3280,
      impact_co2e_kg: 2656.80,
      created_at: new Date(Date.now() - 10000000).toISOString()
    }
  ];

  await supabase.from('transactions').upsert(txData, { onConflict: 'id' });
  console.log('   Transactions ready:', txData.length);

  // 8. Logistics Jobs & Multi-Stop Stops
  console.log('8. Inserting logistics jobs with geo-coordinates and multi-stop waypoints...');
  const jobsData = [
    {
      id: 'job00001-9c0b-4ef8-bb6d-6bb9bd380a11',
      transaction_id: txData[0].id,
      logistics_company_id: users.logistics1,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      dropoff_lat: 12.9716,
      dropoff_long: 77.5946,
      distance_km: 18.5,
      estimated_cost: 2850.00,
      status: 'open',
      created_at: new Date(Date.now() - 6500000).toISOString()
    },
    {
      id: 'job00002-9c0b-4ef8-bb6d-6bb9bd380a12',
      transaction_id: txData[3].id,
      logistics_company_id: users.logistics1,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      dropoff_lat: 13.0358,
      dropoff_long: 77.5972,
      distance_km: 32.0,
      estimated_cost: 4800.00,
      status: 'assigned',
      created_at: new Date(Date.now() - 9500000).toISOString(),
      assigned_at: new Date(Date.now() - 4000000).toISOString()
    },
    {
      id: 'job00003-9c0b-4ef8-bb6d-6bb9bd380a13',
      transaction_id: txData[2].id,
      logistics_company_id: users.logistics2,
      pickup_lat: 12.9698,
      pickup_long: 77.7499,
      dropoff_lat: 12.9716,
      dropoff_long: 77.5946,
      distance_km: 16.0,
      estimated_cost: 2150.00,
      status: 'delivered',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      assigned_at: new Date(Date.now() - 60000000).toISOString(),
      delivered_at: new Date(Date.now() - 43200000).toISOString()
    }
  ];

  await supabase.from('jobs').upsert(jobsData, { onConflict: 'id' });

  // Multi-stop stops for the bulk lot job
  await supabase.from('job_stops').upsert([
    {
      id: 'stop0001-9c0b-4ef8-bb6d-6bb9bd380a11',
      job_id: jobsData[1].id,
      listing_id: listingsData[2].id,
      seller_id: users.seller1,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      seq_order: 1
    },
    {
      id: 'stop0002-9c0b-4ef8-bb6d-6bb9bd380a12',
      job_id: jobsData[1].id,
      listing_id: listingsData[3].id,
      seller_id: users.seller3,
      pickup_lat: 12.8014,
      pickup_long: 77.6754,
      seq_order: 2
    }
  ], { onConflict: 'id' });
  console.log('   Jobs & Multi-Stop stops ready');

  // 9. Ratings
  console.log('9. Inserting verified ratings and feedback...');
  await supabase.from('ratings').upsert([
    {
      id: 'rat00001-9c0b-4ef8-bb6d-6bb9bd380a11',
      transaction_id: txData[2].id,
      rater_id: users.hetRecycler,
      ratee_id: users.seller2,
      rating: 5,
      comment: 'Material was exactly as described, moisture-free and baled tightly. Fast handover!',
      created_at: new Date(Date.now() - 40000000).toISOString()
    },
    {
      id: 'rat00002-9c0b-4ef8-bb6d-6bb9bd380a12',
      transaction_id: txData[2].id,
      rater_id: users.seller2,
      ratee_id: users.hetRecycler,
      rating: 5,
      comment: 'Great recycling partner, driver arrived with accurate paperwork and clean vehicle.',
      created_at: new Date(Date.now() - 38000000).toISOString()
    }
  ], { onConflict: 'id' });
  console.log('   Ratings ready');

  // 10. Distance Cache
  console.log('10. Pre-warming distance cache...');
  await supabase.from('distance_cache').upsert([
    {
      origin_lat: 13.0285, origin_long: 77.5197,
      dest_lat: 13.0358, dest_long: 77.5972,
      distance_km: 18.2, duration_min: 38
    },
    {
      origin_lat: 12.9698, origin_long: 77.7499,
      dest_lat: 12.9716, dest_long: 77.5946,
      distance_km: 24.5, duration_min: 52
    },
    {
      origin_lat: 12.8014, origin_long: 77.6754,
      dest_lat: 13.0358, dest_long: 77.5972,
      distance_km: 32.1, duration_min: 65
    }
  ], { onConflict: 'origin_lat,origin_long,dest_lat,dest_long' });
  console.log('   Distance cache ready');

  // 11. Notifications
  console.log('11. Generating notifications for accounts...');
  await supabase.from('notifications').upsert([
    {
      id: 'notif001-9c0b-4ef8-bb6d-6bb9bd380a11',
      user_id: users.hetRecycler,
      message: 'Your request for Cardboard OCC 11 was accepted by BrightCart Retail Hub!',
      type: 'request_accepted',
      read: false,
      created_at: new Date(Date.now() - 7100000).toISOString()
    },
    {
      id: 'notif002-9c0b-4ef8-bb6d-6bb9bd380a12',
      user_id: users.hetRecycler,
      message: 'SwiftHaul Circular Logistics has opened dispatch routing for Peenya → Hebbal.',
      type: 'job_open',
      read: false,
      created_at: new Date(Date.now() - 6400000).toISOString()
    },
    {
      id: 'notif003-9c0b-4ef8-bb6d-6bb9bd380a13',
      user_id: users.hetRecycler,
      message: 'Order #e0eebc delivered successfully! You saved 2.96 t CO₂e.',
      type: 'transaction_completed',
      read: true,
      created_at: new Date(Date.now() - 43000000).toISOString()
    },
    {
      id: 'notif004-9c0b-4ef8-bb6d-6bb9bd380a14',
      user_id: users.buyer,
      message: 'Bulk pool for Mixed Industrial Pallets is now open for purchase!',
      type: 'bulk_pool_open',
      read: false,
      created_at: new Date(Date.now() - 14000000).toISOString()
    }
  ], { onConflict: 'id' });
  console.log('   Notifications ready');

  console.log('\n======================================================');
  console.log('🎉 ALL MOCK DATA WITH FULL FIELDS SEEDED SUCCESSFULLY!');
  console.log('======================================================\n');
}

seed().catch(err => {
  console.error('Seeding error:', err);
});
