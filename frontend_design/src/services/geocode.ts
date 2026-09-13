import { supabaseAdmin } from "@/api/supabase";

export async function geocodeAddress(address: string): Promise<{ lat: number; long: number } | null> {
  const normalizedQuery = address.trim().toLowerCase();

  // 1. Check cache
  const { data: cached } = await supabaseAdmin
    .from("geocode_cache")
    .select("lat, long")
    .eq("query", normalizedQuery)
    .single();

  if (cached) {
    return { lat: cached.lat, long: cached.long };
  }

  // 2. Fetch from Nominatim (OpenStreetMap)
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalizedQuery)}&format=json&limit=1&countrycodes=in`;
    let response = await fetch(url, {
      headers: {
        "User-Agent": "circular-packaging-exchange/1.0",
      },
    });

    let data = response.ok ? await response.json() : [];

    // Fallback: if not found, try appending ", India"
    if ((!data || data.length === 0) && !normalizedQuery.includes("india")) {
      url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalizedQuery + ", india")}&format=json&limit=1`;
      response = await fetch(url, {
        headers: {
          "User-Agent": "circular-packaging-exchange/1.0",
        },
      });
      if (response.ok) {
        data = await response.json();
      }
    }

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const long = parseFloat(data[0].lon);

      // 3. Save to cache
      await supabaseAdmin.from("geocode_cache").insert({
        query: normalizedQuery,
        lat,
        long,
      });

      return { lat, long };
    }
  } catch (error) {
    console.error("Geocoding failed:", error);
  }

  return null;
}
