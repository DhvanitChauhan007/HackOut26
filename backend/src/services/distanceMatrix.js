const config = require('../config');
const supabase = require('../supabaseClient');

/**
 * Round coordinates to 4 decimal places for cache key matching.
 * ~11m precision — sufficient for distance estimation.
 */
function roundCoord(val) {
  return Math.round(val * 10000) / 10000;
}

/**
 * Check the distance_cache table for a cached result.
 */
async function getCachedDistance(originLat, originLong, destLat, destLong) {
  const oLat = roundCoord(originLat);
  const oLng = roundCoord(originLong);
  const dLat = roundCoord(destLat);
  const dLng = roundCoord(destLong);

  const { data, error } = await supabase
    .from('distance_cache')
    .select('*')
    .eq('origin_lat', oLat)
    .eq('origin_long', oLng)
    .eq('dest_lat', dLat)
    .eq('dest_long', dLng)
    .order('cached_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Distance cache lookup error:', error);
    return null;
  }

  return data;
}

/**
 * Store a distance result in the cache.
 */
async function cacheDistance(originLat, originLong, destLat, destLong, distanceKm, durationMin) {
  const { error } = await supabase.from('distance_cache').insert({
    origin_lat: roundCoord(originLat),
    origin_long: roundCoord(originLong),
    dest_lat: roundCoord(destLat),
    dest_long: roundCoord(destLong),
    distance_km: distanceKm,
    duration_min: durationMin,
  });

  if (error) {
    console.error('Distance cache insert error:', error);
  }
}

/**
 * Call Google Distance Matrix API for driving distance/duration.
 * Falls back to a haversine stub if no API key is configured.
 */
async function getDistance(originLat, originLong, destLat, destLong) {
  // Check cache first
  const cached = await getCachedDistance(originLat, originLong, destLat, destLong);
  if (cached) {
    return {
      distance_km: parseFloat(cached.distance_km),
      duration_min: parseFloat(cached.duration_min),
      cached: true,
    };
  }

  let distanceKm, durationMin;

  if (config.GOOGLE_MAPS_API_KEY && config.GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key') {
    // Real Google Distance Matrix API call
    const fetch = require('node-fetch');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLong}&destinations=${destLat},${destLong}&mode=driving&key=${config.GOOGLE_MAPS_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (
        data.status === 'OK' &&
        data.rows[0] &&
        data.rows[0].elements[0] &&
        data.rows[0].elements[0].status === 'OK'
      ) {
        const element = data.rows[0].elements[0];
        distanceKm = element.distance.value / 1000; // meters to km
        durationMin = element.duration.value / 60;   // seconds to minutes
      } else {
        console.warn('Google Distance Matrix returned non-OK:', data);
        // Fallback to haversine estimate
        return fallbackDistance(originLat, originLong, destLat, destLong);
      }
    } catch (err) {
      console.error('Google Distance Matrix API error:', err);
      return fallbackDistance(originLat, originLong, destLat, destLong);
    }
  } else {
    // No API key — use haversine stub
    return fallbackDistance(originLat, originLong, destLat, destLong);
  }

  // Cache the result
  await cacheDistance(originLat, originLong, destLat, destLong, distanceKm, durationMin);

  return { distance_km: distanceKm, duration_min: durationMin, cached: false };
}

/**
 * Haversine-based fallback when no Google Maps API key is available.
 * Applies a 1.3x road-distance multiplier over straight-line distance.
 */
function fallbackDistance(originLat, originLong, destLat, destLong) {
  const { haversine } = require('../utils/haversine');
  const straightLine = haversine(originLat, originLong, destLat, destLong);
  const distanceKm = straightLine * 1.3; // rough road-distance multiplier
  const durationMin = distanceKm / 50 * 60; // assume ~50 km/h average

  // Don't cache fallback values — they should be replaced when real API is available
  return { distance_km: distanceKm, duration_min: durationMin, cached: false, stub: true };
}

module.exports = { getDistance, roundCoord };
