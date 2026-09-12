import { defineEventHandler, readBody, createError, setResponseStatus, getMethod } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { geocodeAddress } from "../../../src/services/geocode";

const VALID_ROLES = ["manufacturer", "retailer", "recycler", "logistics"];

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const method = getMethod(event);

  // GET /api/users/me
  if (method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      throw createError({ statusCode: 404, message: "Profile not found" });
    }

    return data;
  }

  // POST /api/users/me — create or upsert profile
  if (method === "POST") {
    const raw = await readBody<Record<string, unknown>>(event);
    const body = raw ?? {};
    const name = body["name"] as string | undefined;
    const role = body["role"] as string | undefined;
    const address = body["address"] as string | undefined;
    const lat = body["lat"] as number | undefined;
    const long = body["long"] as number | undefined;

    if (!name || !role) {
      throw createError({ statusCode: 400, message: "name and role are required" });
    }

    if (!VALID_ROLES.includes(role)) {
      throw createError({
        statusCode: 400,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    let finalLat = lat ?? null;
    let finalLong = long ?? null;

    // Geocode if:
    // 1. No explicit lat/long sent in the request body, AND
    // 2. Either the user has no coords yet, OR the address has changed since last geocode
    if (finalLat === null && finalLong === null && address) {
      // Check what's already stored for this user
      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("lat, long, address")
        .eq("id", user.id)
        .single();

      const coordsMissing = existing?.lat == null || existing?.long == null;
      const addressChanged = existing?.address !== address;

      if (coordsMissing || addressChanged) {
        const geo = await geocodeAddress(address);
        if (geo) {
          finalLat = geo.lat;
          finalLong = geo.long;
        }
      } else {
        // Keep the existing coords — no need to re-geocode
        finalLat = existing!.lat;
        finalLong = existing!.long;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: user.id,
          name,
          role,
          address: address ?? null,
          lat: finalLat,
          long: finalLong,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Upsert user error:", error);
      throw createError({ statusCode: 500, message: "Failed to create/update profile" });
    }

    setResponseStatus(event, 201);
    return data;
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
