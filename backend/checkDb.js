import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { error } = await supabase.from('bulk_lots').select('*').limit(1);
  if (error) {
    console.log('Error accessing bulk_lots:', error.message);
  } else {
    console.log('bulk_lots table exists!');
  }
}
check();
