import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log('Seeding database...');
  
  // 1. Create a mock user (Fixed Recycler)
  const { data: recycler, error: userError } = await supabase.auth.admin.createUser({
    email: 'recycler@example.com',
    password: 'password123',
    email_confirm: true,
  });

  if (userError) {
    console.error('Error creating user', userError);
  }

  const recyclerId = recycler?.user?.id || 'd3885d56-7ef2-487b-8b5e-44e21a7cd9a4';

  await supabase.from('users').upsert({
    id: recyclerId,
    name: 'Auto-Recycle Partner',
    role: 'recycler',
    is_fixed_recycler: true,
    is_seed: true,
    auto_accept: true,
    address: 'City Dump',
    lat: 12.9716,
    long: 77.5946
  });

  // 2. Create another mock user (Seller)
  const { data: seller, error: sellerError } = await supabase.auth.admin.createUser({
    email: 'seller@example.com',
    password: 'password123',
    email_confirm: true,
  });

  const sellerId = seller?.user?.id || 'f11b2256-4ef2-117b-8b5e-44e21a7cd9a5';

  await supabase.from('users').upsert({
    id: sellerId,
    name: 'BrightCart Retail',
    role: 'retailer',
    is_seed: true,
    address: 'Peenya Industrial Area',
    lat: 13.0285,
    long: 77.5197
  });

  // 3. Insert listings
  await supabase.from('listings').upsert([
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      seller_id: sellerId,
      material_type: 'Cardboard',
      sub_grade: 'OCC 11',
      contamination_pct: 2.1,
      quantity: 1400,
      unit: 'kg',
      condition: 'Clean',
      list_price: 14.00,
      price_floor: 9.20,
      decay_window_seconds: 180,
      pickup_lat: 13.0285,
      pickup_long: 77.5197,
      status: 'open'
    },
    {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      seller_id: sellerId,
      material_type: 'Plastic',
      sub_grade: 'rPET A',
      contamination_pct: 0.8,
      quantity: 820,
      unit: 'kg',
      condition: 'Washed',
      list_price: 46.00,
      price_floor: 34.00,
      decay_window_seconds: 180,
      pickup_lat: 12.9698,
      pickup_long: 77.7499,
      status: 'open'
    }
  ]);

  console.log('Seed complete.');
}

seed();
