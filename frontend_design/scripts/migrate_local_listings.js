import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const SELLER_ID = "c19768e8-1ed8-4476-875c-edd4eda156c4"; // Dhvanit (dhvanit.b.chauhan@gmail.com)

const listingsToMigrate = [
  {
    seller_id: SELLER_ID,
    material_type: "Plastic",
    sub_grade: "P1",
    quantity: 800,
    unit: "kg",
    contamination_pct: 0,
    condition: "Torn in pieces Plastic (Pickup: DAIICT)",
    list_price: 79.95,
    price_floor: 70.00,
    decay_window_seconds: 86400,
    pickup_lat: 23.1885,
    pickup_long: 72.6289,
    status: "open",
  },
  {
    seller_id: SELLER_ID,
    material_type: "Pallets",
    sub_grade: "RPETA",
    quantity: 80,
    unit: "kg",
    contamination_pct: 0,
    condition: "Slightly Torn Wooden Pallets (Pickup: DAIICT)",
    list_price: 89.86,
    price_floor: 80.00,
    decay_window_seconds: 86400,
    pickup_lat: 23.1885,
    pickup_long: 72.6289,
    status: "open",
  },
  {
    seller_id: SELLER_ID,
    material_type: "Cardboard",
    sub_grade: "OCC 11",
    quantity: 10,
    unit: "kg",
    contamination_pct: 0,
    condition: "perfect (Pickup: Peenya)",
    list_price: 89.79,
    price_floor: 85.00,
    decay_window_seconds: 86400,
    pickup_lat: 13.0285,
    pickup_long: 77.5197,
    status: "open",
  },
  {
    seller_id: SELLER_ID,
    material_type: "Cardboard",
    sub_grade: "OCC 11",
    quantity: 700,
    unit: "kg",
    contamination_pct: 0,
    condition: "Perfect (Pickup: DAIICT)",
    list_price: 89.79,
    price_floor: 85.00,
    decay_window_seconds: 86400,
    pickup_lat: 23.1885,
    pickup_long: 72.6289,
    status: "open",
  },
];

async function run() {
  console.log(`Starting migration of ${listingsToMigrate.length} listings to Supabase for seller ${SELLER_ID}...`);

  for (const item of listingsToMigrate) {
    // Check if an identical listing already exists to prevent duplicate runs
    const { data: existing } = await supabase
      .from("listings")
      .select("id, condition")
      .eq("seller_id", SELLER_ID)
      .eq("condition", item.condition);

    if (existing && existing.length > 0) {
      console.log(`Listing already exists: ${item.condition} (ID: ${existing[0].id})`);
      continue;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error(`Failed to insert "${item.condition}":`, error.message);
    } else {
      console.log(`Successfully migrated: "${item.condition}" -> UUID: ${data.id}`);
    }
  }

  console.log("Migration finished.");
}

run();
