import { supabaseAdmin } from '../supabase.js';

// Known landmark fallbacks for quick local resolution
const KNOWN_LOCATIONS = {
  'daiict': { lat: 23.188408, long: 72.627969 },
  'daiict gandhinagar': { lat: 23.188408, long: 72.627969 },
  'peenya': { lat: 13.033051, long: 77.533223 },
  'peenya, bengaluru': { lat: 13.0285, long: 77.5197 },
  'hebbal': { lat: 13.038218, long: 77.5919 },
  'hebbal, bengaluru': { lat: 13.0358, long: 77.5972 },
  'whitefield': { lat: 12.9698, long: 77.7499 },
  'whitefield, bengaluru': { lat: 12.9698, long: 77.7499 },
  'vesu': { lat: 21.137108, long: 72.788677 },
  'vesu, surat': { lat: 21.137108, long: 72.788677 },
  'surat': { lat: 21.170240, long: 72.831061 },
  'electronic city': { lat: 12.8398, long: 77.6799 },
  'electronic city, bengaluru': { lat: 12.8398, long: 77.6799 },
  'bommasandra': { lat: 12.8014, long: 77.6754 }
};

/**
 * Converts an address string into latitude and longitude coordinates.
 * Checks geocode_cache table first. If not found, calls Nominatim and caches the result.
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const cleanQuery = address.trim();
  if (cleanQuery.length < 2) return null;

  const normalized = cleanQuery.toLowerCase();

  // 1. Check known landmarks
  if (KNOWN_LOCATIONS[normalized]) {
    return KNOWN_LOCATIONS[normalized];
  }

  // 2. Check geocode_cache table
  try {
    const { data: cached } = await supabaseAdmin
      .from('geocode_cache')
      .select('lat, long')
      .eq('query', normalized)
      .maybeSingle();

    if (cached && cached.lat && cached.long) {
      return { lat: parseFloat(cached.lat), long: parseFloat(cached.long) };
    }
  } catch (err) {
    console.warn('geocode_cache lookup warning:', err.message);
  }

  // 3. Query OpenStreetMap Nominatim
  try {
    let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1`;
    let res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'ReRoute-CircularPackaging/1.0' }
    });
    let data = await res.json();

    // If no result and single word, try appending India
    if ((!data || data.length === 0) && !cleanQuery.includes(',')) {
      searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery + ', India')}&limit=1`;
      res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'ReRoute-CircularPackaging/1.0' }
      });
      data = await res.json();
    }

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const long = parseFloat(data[0].lon);

      // Cache in geocode_cache table
      try {
        await supabaseAdmin.from('geocode_cache').upsert({
          query: normalized,
          lat,
          long,
          cached_at: new Date().toISOString()
        }, { onConflict: 'query' });
      } catch (cacheErr) {
        console.warn('Failed to cache geocode result:', cacheErr.message);
      }

      return { lat, long };
    }
  } catch (err) {
    console.error('Nominatim geocoding error:', err.message);
  }

  // 4. Default fallback if unresolvable
  return { lat: 13.0358, long: 77.5972 }; // Default to Bengaluru center
}
