require('dotenv').config();

module.exports = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Google Maps
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

  // Server
  PORT: parseInt(process.env.PORT, 10) || 4000,

  // Pricing / Decay
  COST_PER_KM: parseFloat(process.env.COST_PER_KM) || 0.75,
  DECAY_WINDOW_SECONDS: parseInt(process.env.DECAY_WINDOW_SECONDS, 10) || 604800,
  DECAY_FLOOR_PCT: parseFloat(process.env.DECAY_FLOOR_PCT) || 0.4,
  RECYCLER_FALLBACK_TIMEOUT_SECONDS: parseInt(process.env.RECYCLER_FALLBACK_TIMEOUT_SECONDS, 10) || 172800,

  // Bulk Batching
  BATCH_ELIGIBLE_DECAY_PCT: parseFloat(process.env.BATCH_ELIGIBLE_DECAY_PCT) || 0.8,
  BATCH_MATCH_RADIUS_KM: parseFloat(process.env.BATCH_MATCH_RADIUS_KM) || 50,
  BATCH_MIN_ITEMS: parseInt(process.env.BATCH_MIN_ITEMS, 10) || 2,
  BATCH_MAX_ITEMS: parseInt(process.env.BATCH_MAX_ITEMS, 10) || 10,
  BATCH_FORMING_TIMEOUT_SECONDS: parseInt(process.env.BATCH_FORMING_TIMEOUT_SECONDS, 10) || 259200,
};
