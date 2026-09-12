import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seedBulk() {
  await supabase.from('bulk_lots').upsert([
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      material_type: 'Pallets',
      sub_grade: 'Mixed A/B',
      status: 'open',
      total_quantity: 3280,
      bulk_rate_per_kg: 8.40
    }
  ]);
  console.log('Bulk lot seeded');
}
seedBulk();
