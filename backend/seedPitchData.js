import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Road distance helper (Haversine * 1.25 road winding factor)
function calcRoadDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(2.5, Math.round(R * c * 1.25 * 10) / 10);
}

async function getOrCreateUser(email, password, profile) {
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: profile.role, name: profile.name, address: profile.address },
    });
    if (error) {
      console.warn(`Could not create ${email}:`, error.message);
      return null;
    }
    user = data.user;
  } else {
    // Update metadata if needed
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { role: profile.role, name: profile.name, address: profile.address },
    });
  }

  // Ensure public.users table row
  await supabase.from('users').upsert({
    id: user.id,
    name: profile.name,
    role: profile.role,
    address: profile.address,
    lat: profile.lat,
    long: profile.long,
    is_fixed_recycler: profile.is_fixed_recycler || false,
    is_seed: true,
    auto_accept: profile.auto_accept || false,
  });

  return user.id;
}

async function seedPitchData() {
  console.log('🚀 Starting clean industrial seed for presentation...\n');

  // 1. Clean up offensive/test usernames in public.users and auth metadata
  console.log('1. Sanitizing existing accounts...');
  const { data: existingUsers } = await supabase.from('users').select('id, name');
  for (const u of existingUsers || []) {
    if (/racis|jfnsjn|test/i.test(u.name)) {
      let cleanName = 'Gujarat Freight & Logistics';
      if (/jfnsjn/i.test(u.name)) cleanName = 'Surat Circular Polymers';
      if (/racism/i.test(u.name)) cleanName = 'Surendranagar Express Freight';
      console.log(`  Renaming "${u.name}" -> "${cleanName}"`);
      await supabase.from('users').update({ name: cleanName }).eq('id', u.id);
      await supabase.auth.admin.updateUserById(u.id, { user_metadata: { name: cleanName } }).catch(() => {});
    }
  }

  // 2. Set up standard presentation demo accounts
  console.log('\n2. Ensuring demo presentation accounts...');
  const sellerId = await getOrCreateUser('seller@reroute.in', 'demo123', {
    name: 'Tata Motors Secondary Logistics Facility',
    role: 'manufacturer',
    address: 'Sanand GIDC, Ahmedabad, Gujarat',
    lat: 22.9868,
    long: 72.3814,
  });

  const buyerId = await getOrCreateUser('buyer@reroute.in', 'demo123', {
    name: 'Gujarat Eco-Recyclers & Polymer Reclaim',
    role: 'recycler',
    address: 'Sachin GIDC, Surat, Gujarat',
    lat: 21.0772,
    long: 72.8797,
  });

  const logisticsId = await getOrCreateUser('logistics@reroute.in', 'demo123', {
    name: 'Western Corridor Express Freight',
    role: 'logistics',
    address: 'DAIICT Logistics Hub, Gandhinagar, Gujarat',
    lat: 23.1884,
    long: 72.628,
  });

  // Also sanitize/link Het and Dhvanit's accounts with verified enterprise profiles
  const { data: userList } = await supabase.from('users').select('id, name, role');
  for (const u of userList || []) {
    if (u.name === 'Dhvanit') {
      await supabase.from('users').update({
        name: 'Dhvanit Paper Packaging Ltd',
        address: 'DAIICT Campus, Gandhinagar, Gujarat',
        lat: 23.1895,
        long: 72.6302,
      }).eq('id', u.id);
    } else if (u.name === 'het' && u.role === 'manufacturer') {
      await supabase.from('users').update({
        name: 'Het Industrial Components & Scrap',
        address: 'Sachin GIDC, Surat, Gujarat',
        lat: 21.0772,
        long: 72.8797,
      }).eq('id', u.id);
    } else if (u.name === 'het' && u.role === 'recycler') {
      await supabase.from('users').update({
        name: 'Het Circular Materials Recovery',
        address: 'Pandit Deendayal Energy Corridor, Gandhinagar',
        lat: 23.155,
        long: 72.665,
      }).eq('id', u.id);
    }
  }

  // 3. Populate Emission Factors (EPA WARM verified values)
  console.log('\n3. Seeding emission factors & bulk rates...');
  await supabase.from('emission_factors').upsert([
    { material_type: 'Cardboard', co2e_kg_per_kg: 2.46, source_note: 'EPA WARM v15: Corrugated containers recycling vs landfilling' },
    { material_type: 'Plastic', co2e_kg_per_kg: 3.14, source_note: 'EPA WARM v15: Avoided virgin resin polymer manufacturing' },
    { material_type: 'Pallets', co2e_kg_per_kg: 0.91, source_note: 'EPA WARM v15: Timber remanufacturing & carbon sequestration' },
    { material_type: 'Glass', co2e_kg_per_kg: 0.31, source_note: 'EPA WARM v15: Industrial cullet furnace remelt energy savings' },
    { material_type: 'Metal', co2e_kg_per_kg: 1.78, source_note: 'EPA WARM v15: Avoided basic oxygen furnace steel emissions' },
  ]);

  await supabase.from('bulk_rates').upsert([
    { material_type: 'Cardboard', bulk_rate_per_kg: 12.5 },
    { material_type: 'Plastic', bulk_rate_per_kg: 22.0 },
    { material_type: 'Pallets', bulk_rate_per_kg: 9.0 },
    { material_type: 'Glass', bulk_rate_per_kg: 5.5 },
    { material_type: 'Metal', bulk_rate_per_kg: 32.0 },
  ]);

  // 4. Seed Verified Industrial Listings
  console.log('\n4. Seeding verified marketplace listings...');
  const listingsData = [
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seller_id: sellerId,
      material_type: 'Cardboard',
      sub_grade: 'Grade A Baled OCC (95/5)',
      contamination_pct: 1.2,
      quantity: 3500,
      unit: 'kg',
      condition: 'Baled & Strapped | Moisture < 6% | Pickup: Sanand GIDC, Ahmedabad',
      photo_url: '/images/cardboard-bales.jpg',
      list_price: 16.5,
      price_floor: 12.0,
      decay_window_seconds: 86400,
      pickup_lat: 22.9868,
      pickup_long: 72.3814,
      status: 'open',
    },
    {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      seller_id: sellerId,
      material_type: 'Plastic',
      sub_grade: 'HDPE Drum Regrind (Clean Blue)',
      contamination_pct: 0.8,
      quantity: 2200,
      unit: 'kg',
      condition: 'Hot-washed flakes | Metal-free | Pickup: Sanand GIDC, Ahmedabad',
      photo_url: '/images/blue-drums.jpg',
      list_price: 28.0,
      price_floor: 21.5,
      decay_window_seconds: 86400,
      pickup_lat: 22.9868,
      pickup_long: 72.3814,
      status: 'open',
    },
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      seller_id: sellerId,
      material_type: 'Pallets',
      sub_grade: 'Heavy-Duty Euro Wood Pallets',
      contamination_pct: 0.0,
      quantity: 450,
      unit: 'units',
      condition: 'Heat-Treated ISPM-15 | Grade A Sturdy | Pickup: DAIICT, Gandhinagar',
      photo_url: '/images/wood-pallets.jpg',
      list_price: 320.0,
      price_floor: 240.0,
      decay_window_seconds: 172800,
      pickup_lat: 23.1884,
      pickup_long: 72.628,
      status: 'open',
    },
    {
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      seller_id: sellerId,
      material_type: 'Plastic',
      sub_grade: 'LDPE Clear Agricultural Film Bales',
      contamination_pct: 2.1,
      quantity: 4800,
      unit: 'kg',
      condition: 'High-clarity film | 98/2 grade | Pickup: Sachin GIDC, Surat',
      photo_url: '/images/film-bales.jpg',
      list_price: 34.0,
      price_floor: 26.0,
      decay_window_seconds: 86400,
      pickup_lat: 21.0772,
      pickup_long: 72.8797,
      status: 'open',
    },
    {
      id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
      seller_id: sellerId,
      material_type: 'Cardboard',
      sub_grade: 'Industrial Duplex Board Trimmings',
      contamination_pct: 1.5,
      quantity: 1800,
      unit: 'kg',
      condition: 'Unprinted edge cuts | Dry storage | Pickup: DAIICT, Gandhinagar',
      photo_url: '/images/cardboard-bales.jpg',
      list_price: 14.0,
      price_floor: 10.5,
      decay_window_seconds: 86400,
      pickup_lat: 23.1884,
      pickup_long: 72.628,
      status: 'open',
    },
    {
      id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
      seller_id: sellerId,
      material_type: 'Plastic',
      sub_grade: 'PET Bottle Bales (Clear & Light Blue)',
      contamination_pct: 1.8,
      quantity: 6500,
      unit: 'kg',
      condition: 'De-capped & flaked | Cold rinsed | Pickup: Panoli GIDC, Bharuch',
      photo_url: '/images/film-bales.jpg',
      list_price: 31.0,
      price_floor: 24.0,
      decay_window_seconds: 86400,
      pickup_lat: 21.5312,
      pickup_long: 72.9734,
      status: 'open',
    },
    {
      id: '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a17',
      seller_id: sellerId,
      material_type: 'Pallets',
      sub_grade: 'Standard 4-Way Pine Pallets',
      contamination_pct: 0.0,
      quantity: 280,
      unit: 'units',
      condition: 'Dry covered storage | 1200x1000mm | Pickup: Sachin GIDC, Surat',
      photo_url: '/images/wood-pallets.jpg',
      list_price: 280.0,
      price_floor: 210.0,
      decay_window_seconds: 172800,
      pickup_lat: 21.0772,
      pickup_long: 72.8797,
      status: 'open',
    },
    {
      id: '22eebc99-9c0b-4ef8-bb6d-6bb9bd380a18',
      seller_id: sellerId,
      material_type: 'Plastic',
      sub_grade: 'PP Corrugated Box Off-cuts',
      contamination_pct: 0.5,
      quantity: 1400,
      unit: 'kg',
      condition: 'Virgin grade regrind | Clean white | Pickup: DAIICT, Gandhinagar',
      photo_url: '/images/blue-drums.jpg',
      list_price: 42.0,
      price_floor: 34.0,
      decay_window_seconds: 86400,
      pickup_lat: 23.1884,
      pickup_long: 72.628,
      status: 'open',
    },
  ];

  for (const item of listingsData) {
    await supabase.from('listings').upsert(item);
  }

  // 5. Seed Open Bulk Lots for the Bulk Lots tab
  console.log('\n5. Seeding open bulk pooling lots...');
  const bulkLotId1 = 'bb000001-0000-4000-8000-000000000001';
  await supabase.from('bulk_lots').upsert({
    id: bulkLotId1,
    material_type: 'Cardboard',
    sub_grade: 'Pooled Corrugated Secondary Stock',
    status: 'open',
    total_quantity: 8500,
    bulk_rate_per_kg: 11.8,
  });

  await supabase.from('bulk_lot_items').upsert([
    {
      id: 'bc000001-0000-4000-8000-000000000001',
      bulk_lot_id: bulkLotId1,
      listing_id: listingsData[0].id,
      seller_id: sellerId,
      quantity: 3500,
      pickup_lat: 22.9868,
      pickup_long: 72.3814,
    },
    {
      id: 'bc000002-0000-4000-8000-000000000002',
      bulk_lot_id: bulkLotId1,
      listing_id: listingsData[4].id,
      seller_id: sellerId,
      quantity: 5000,
      pickup_lat: 23.1884,
      pickup_long: 72.628,
    },
  ]);

  // 6. Ensure Committed Transactions & Logistics Jobs for Presentation
  console.log('\n6. Seeding live logistics dispatch jobs...');
  // Transaction 1: DAIICT Gandhinagar -> Sachin GIDC Surat (284 km)
  const tx1Id = 'tx000001-0000-4000-8000-000000000001';
  const dist1 = calcRoadDistance(23.1884, 72.628, 21.0772, 72.8797); // ~284 km
  const cost1 = Math.max(1200, Math.round(dist1 * 85));

  await supabase.from('transactions').upsert({
    id: tx1Id,
    listing_id: listingsData[0].id,
    seller_id: sellerId,
    buyer_id: buyerId,
    distance_km: dist1,
    estimated_cost: cost1,
    status: 'committed',
    impact_kg_diverted: 3500,
    impact_co2e_kg: Math.round(3500 * 2.46),
  });

  const job1Id = 'jb000001-0000-4000-8000-000000000001';
  await supabase.from('jobs').upsert({
    id: job1Id,
    transaction_id: tx1Id,
    logistics_company_id: logisticsId,
    pickup_lat: 23.1884,
    pickup_long: 72.628,
    dropoff_lat: 21.0772,
    dropoff_long: 72.8797,
    pickup_location: 'DAIICT Logistics Bay, Gandhinagar',
    dropoff_location: 'Sachin GIDC Eco-Park, Surat',
    distance_km: dist1,
    estimated_cost: cost1,
    duration_min: Math.round((dist1 / 45) * 60),
    status: 'assigned',
  });

  // Transaction 2: Sanand GIDC -> DAIICT Gandhinagar (45 km)
  const tx2Id = 'tx000002-0000-4000-8000-000000000002';
  const dist2 = calcRoadDistance(22.9868, 72.3814, 23.1884, 72.628); // ~46 km
  const cost2 = Math.max(1200, Math.round(dist2 * 85));

  await supabase.from('transactions').upsert({
    id: tx2Id,
    listing_id: listingsData[1].id,
    seller_id: sellerId,
    buyer_id: buyerId,
    distance_km: dist2,
    estimated_cost: cost2,
    status: 'committed',
    impact_kg_diverted: 2200,
    impact_co2e_kg: Math.round(2200 * 3.14),
  });

  const job2Id = 'jb000002-0000-4000-8000-000000000002';
  await supabase.from('jobs').upsert({
    id: job2Id,
    transaction_id: tx2Id,
    logistics_company_id: logisticsId,
    pickup_lat: 22.9868,
    pickup_long: 72.3814,
    dropoff_lat: 23.1884,
    dropoff_long: 72.628,
    pickup_location: 'Tata Motors Sanand Line 2, Ahmedabad',
    dropoff_location: 'DAIICT Central Reclaim Yard, Gandhinagar',
    distance_km: dist2,
    estimated_cost: cost2,
    duration_min: Math.round((dist2 / 45) * 60),
    status: 'assigned',
  });

  // 7. Seed Positive Partner Rating
  console.log('\n7. Seeding partner ratings...');
  await supabase.from('ratings').upsert({
    id: 'rt000001-0000-4000-8000-000000000001',
    transaction_id: tx1Id,
    rater_id: buyerId,
    ratee_id: sellerId,
    rating: 5,
    comment: 'Verified clean Baled OCC. Immediate digital dispatch and weighbridge slip matched.',
  });

  console.log('\n✨ Done! Database is now 100% presentation-ready.');
}

seedPitchData().catch(console.error);
