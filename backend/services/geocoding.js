import { supabaseAdmin } from '../supabase.js';

// Landmark keywords for instant resolution
const LOCATION_PATTERNS = [
  // Gujarat Landmarks & Cities
  { pattern: /\b(daiict|da-iict|da iict)\b/i, lat: 23.188408, long: 72.627969 },
  { pattern: /\b(vr mall)\b/i, lat: 21.145022, long: 72.757319 },
  { pattern: /\b(vesu)\b/i, lat: 21.137108, long: 72.788677 },
  { pattern: /\b(surat)\b/i, lat: 21.170240, long: 72.831061 },
  { pattern: /\b(atman|surendranagar|wadhwan)\b/i, lat: 22.727100, long: 71.647500 },
  { pattern: /\b(zadeswar|zadeshwar|bharuch)\b/i, lat: 21.725800, long: 73.024200 },
  { pattern: /\b(bj medical|asarwa)\b/i, lat: 23.052447, long: 72.602771 },
  { pattern: /\b(gandhinagar|infocity)\b/i, lat: 23.215600, long: 72.636900 },
  { pattern: /\b(ahmedabad|amdavad)\b/i, lat: 23.022500, long: 72.571400 },
  { pattern: /\b(vadodara|baroda)\b/i, lat: 22.307200, long: 73.181200 },
  { pattern: /\b(rajkot)\b/i, lat: 22.303900, long: 70.802200 },
  { pattern: /\b(bhavnagar)\b/i, lat: 21.764500, long: 72.151900 },
  { pattern: /\b(anand)\b/i, lat: 22.564500, long: 72.928900 },
  { pattern: /\b(vapi)\b/i, lat: 20.389300, long: 72.910600 },
  { pattern: /\b(navsari)\b/i, lat: 20.946700, long: 72.952000 },
  { pattern: /\b(jamnagar)\b/i, lat: 22.470700, long: 70.057700 },

  // Karnataka & Bengaluru
  { pattern: /\b(peenya)\b/i, lat: 13.028500, long: 77.519700 },
  { pattern: /\b(whitefield|epip)\b/i, lat: 12.969800, long: 77.749900 },
  { pattern: /\b(bommasandra|hosur road)\b/i, lat: 12.801400, long: 77.675400 },
  { pattern: /\b(yeshwanthpur)\b/i, lat: 13.021900, long: 77.551200 },
  { pattern: /\b(hebbal)\b/i, lat: 13.035800, long: 77.597200 },
  { pattern: /\b(hoskote)\b/i, lat: 13.071200, long: 77.798300 },
  { pattern: /\b(electronic city)\b/i, lat: 12.839800, long: 77.679900 },
  { pattern: /\b(bengaluru|bangalore)\b/i, lat: 12.971600, long: 77.594600 },

  // Maharashtra & Other Metros
  { pattern: /\b(hinjewadi|pune)\b/i, lat: 18.591300, long: 73.738900 },
  { pattern: /\b(mumbai)\b/i, lat: 19.076000, long: 72.877700 },
  { pattern: /\b(delhi)\b/i, lat: 28.613900, long: 77.209000 },
  { pattern: /\b(hyderabad)\b/i, lat: 17.385000, long: 78.486700 },
  { pattern: /\b(chennai)\b/i, lat: 13.082700, long: 80.270700 },
  { pattern: /\b(kolkata)\b/i, lat: 22.572600, long: 88.363900 }
];

/**
 * Converts an address string into latitude and longitude coordinates.
 * Checks pattern rules first, then geocode_cache table, then Nominatim with fallback query simplifications.
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const cleanQuery = address.trim();
  if (cleanQuery.length < 2) return null;

  const normalized = cleanQuery.toLowerCase();

  // 1. Check known landmark & city patterns
  for (const item of LOCATION_PATTERNS) {
    if (item.pattern.test(normalized)) {
      return { lat: item.lat, long: item.long };
    }
  }

  // 2. Check geocode_cache table in Supabase
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

  // 3. Query OpenStreetMap Nominatim with progressive simplification
  const queriesToTry = [cleanQuery];

  // If address has multiple parts separated by commas, try the last 2 parts (city, state/country)
  if (cleanQuery.includes(',')) {
    const parts = cleanQuery.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      queriesToTry.push(parts.slice(-2).join(', '));
      queriesToTry.push(parts[parts.length - 1]);
    }
  }

  if (!cleanQuery.toLowerCase().includes('india')) {
    queriesToTry.push(`${cleanQuery}, India`);
  }

  for (const q of queriesToTry) {
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'ReRoute-CircularPackaging/1.0' }
      });
      const data = await res.json();

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
      console.warn(`Nominatim geocoding error for query "${q}":`, err.message);
    }
  }

  // 4. Regional fallback based on state cues
  if (/gujarat|surat|ahmedabad|gandhinagar|bharuch|rajkot/i.test(normalized)) {
    return { lat: 23.0225, long: 72.5714 };
  }
  if (/karnataka|bengaluru|bangalore|peenya|whitefield/i.test(normalized)) {
    return { lat: 13.0358, long: 77.5972 };
  }
  if (/maharashtra|pune|mumbai/i.test(normalized)) {
    return { lat: 18.5204, long: 73.8567 };
  }

  return { lat: 23.188408, long: 72.627969 }; // Default to DAIICT Gandhinagar
}
