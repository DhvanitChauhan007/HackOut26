import { supabaseAdmin } from "../api/supabase";
import { config } from "../api/config";
import { haversine } from "./haversine";

/** Round coordinates to 4 decimal places for cache key matching (~11m precision). */
function roundCoord(val: number): number {
  return Math.round(val * 10000) / 10000;
}

async function getCachedDistance(
  originLat: number,
  originLong: number,
  destLat: number,
  destLong: number
) {
  const { data, error } = await supabaseAdmin
    .from("distance_cache")
    .select("*")
    .eq("origin_lat", roundCoord(originLat))
    .eq("origin_long", roundCoord(originLong))
    .eq("dest_lat", roundCoord(destLat))
    .eq("dest_long", roundCoord(destLong))
    .order("cached_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Distance cache lookup error:", error);
    return null;
  }
  return data;
}

async function cacheDistance(
  originLat: number,
  originLong: number,
  destLat: number,
  destLong: number,
  distanceKm: number,
  durationMin: number
) {
  const { error } = await supabaseAdmin.from("distance_cache").insert({
    origin_lat: roundCoord(originLat),
    origin_long: roundCoord(originLong),
    dest_lat: roundCoord(destLat),
    dest_long: roundCoord(destLong),
    distance_km: distanceKm,
    duration_min: durationMin,
  });
  if (error) console.error("Distance cache insert error:", error);
}

function fallbackDistance(
  originLat: number,
  originLong: number,
  destLat: number,
  destLong: number
) {
  const straightLine = haversine(originLat, originLong, destLat, destLong);
  const distanceKm = straightLine * 1.3; // rough road-distance multiplier
  const durationMin = (distanceKm / 50) * 60; // assume ~50 km/h average
  return { distance_km: distanceKm, duration_min: durationMin, cached: false, stub: true };
}

/**
 * Get driving distance/duration between two coordinate pairs.
 * Uses Google Distance Matrix API when key is available, falls back to haversine.
 * Mirrors backend/src/services/distanceMatrix.js
 */
export async function getDistance(
  originLat: number,
  originLong: number,
  destLat: number,
  destLong: number
): Promise<{ distance_km: number; duration_min: number; cached?: boolean; stub?: boolean }> {
  const cached = await getCachedDistance(originLat, originLong, destLat, destLong);
  if (cached) {
    return {
      distance_km: parseFloat(cached.distance_km),
      duration_min: parseFloat(cached.duration_min),
      cached: true,
    };
  }

  if (config.GOOGLE_MAPS_API_KEY && config.GOOGLE_MAPS_API_KEY !== "your-google-maps-api-key") {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLong}&destinations=${destLat},${destLong}&mode=driving&key=${config.GOOGLE_MAPS_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = (await response.json()) as {
        status: string;
        rows: { elements: { status: string; distance: { value: number }; duration: { value: number } }[] }[];
      };

      if (
        data.status === "OK" &&
        data.rows[0]?.elements[0]?.status === "OK"
      ) {
        const element = data.rows[0].elements[0];
        const distanceKm = element.distance.value / 1000;
        const durationMin = element.duration.value / 60;
        await cacheDistance(originLat, originLong, destLat, destLong, distanceKm, durationMin);
        return { distance_km: distanceKm, duration_min: durationMin, cached: false };
      } else {
        console.warn("Google Distance Matrix returned non-OK:", data);
        return fallbackDistance(originLat, originLong, destLat, destLong);
      }
    } catch (err) {
      console.error("Google Distance Matrix API error:", err);
      return fallbackDistance(originLat, originLong, destLat, destLong);
    }
  }

  return fallbackDistance(originLat, originLong, destLat, destLong);
}
