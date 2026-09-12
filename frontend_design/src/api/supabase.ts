import { createClient } from "@supabase/supabase-js";

const env = process.env;
const supabaseUrl = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "";
const supabaseServiceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

if (!supabaseUrl) {
  console.warn("[api/supabase] SUPABASE_URL is not set — server-side DB calls will fail.");
}
if (!supabaseServiceRoleKey) {
  console.warn("[api/supabase] SUPABASE_SERVICE_ROLE_KEY is not set — server-side DB calls will fail.");
}

/**
 * Server-side Supabase client using the service role key.
 * This bypasses Row Level Security (RLS) — NEVER expose this to the browser.
 * Only import this file from server-only modules (src/api/ and src/routes/api/).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
