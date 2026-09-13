import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env["VITE_SUPABASE_URL"] ||
  "https://qjedhcxrtgjlsryrgijt.supabase.co";
const supabaseAnonKey =
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZWRoY3hydGdqbHNyeXJnaWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDQ5OTIsImV4cCI6MjEwNDc4MDk5Mn0.P5SgcYilVIeAiISuwHFH5HBse7utbSJzYKULVpPqB04";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
