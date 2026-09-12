/**
 * Server-side configuration — mirrors backend/src/config.js.
 * All values are read from environment variables with sensible defaults.
 */
const env = process.env;

export const config = {
  // Supabase
  SUPABASE_URL: env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "",
  SUPABASE_SERVICE_ROLE_KEY: env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",

  // Google Maps
  GOOGLE_MAPS_API_KEY: env["GOOGLE_MAPS_API_KEY"] ?? "",

  // Pricing / Decay
  COST_PER_KM: parseFloat(env["COST_PER_KM"] ?? "0.75"),
  DECAY_WINDOW_SECONDS: parseInt(env["DECAY_WINDOW_SECONDS"] ?? "604800", 10),
  DECAY_FLOOR_PCT: parseFloat(env["DECAY_FLOOR_PCT"] ?? "0.4"),
  RECYCLER_FALLBACK_TIMEOUT_SECONDS: parseInt(
    env["RECYCLER_FALLBACK_TIMEOUT_SECONDS"] ?? "172800",
    10
  ),

  // Bulk Batching
  BATCH_ELIGIBLE_DECAY_PCT: parseFloat(env["BATCH_ELIGIBLE_DECAY_PCT"] ?? "0.8"),
  BATCH_MATCH_RADIUS_KM: parseFloat(env["BATCH_MATCH_RADIUS_KM"] ?? "50"),
  BATCH_MIN_ITEMS: parseInt(env["BATCH_MIN_ITEMS"] ?? "2", 10),
  BATCH_MAX_ITEMS: parseInt(env["BATCH_MAX_ITEMS"] ?? "10", 10),
  BATCH_FORMING_TIMEOUT_SECONDS: parseInt(
    env["BATCH_FORMING_TIMEOUT_SECONDS"] ?? "259200",
    10
  ),
};
