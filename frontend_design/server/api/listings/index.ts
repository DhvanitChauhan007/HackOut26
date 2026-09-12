import { defineEventHandler, readBody, createError, setResponseStatus, getMethod, getQuery } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { config } from "@/api/config";
import { requireAuth } from "@/api/auth";
import { computeCurrentPrice } from "@/services/priceDecay";
import { haversine } from "@/services/haversine";
import { checkAndTriggerFallback } from "@/services/recyclerFallback";
import { checkBatchEligibility } from "@/services/bulkBatching";

const LISTING_FIELDS = [
  "material_type", "sub_grade", "contamination_pct", "quantity", "unit",
  "condition", "photo_url", "list_price", "price_floor", "pickup_lat", "pickup_long",
] as const;

const SELLER_ROLES = ["manufacturer", "retailer"];

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  // GET /api/listings
  if (method === "GET") {
    const query = getQuery(event);
    const material_type = query["material_type"] as string | undefined;
    const max_distance_km = query["max_distance_km"] as string | undefined;
    const buyer_lat = query["buyer_lat"] as string | undefined;
    const buyer_long = query["buyer_long"] as string | undefined;
    const min_quantity = query["min_quantity"] as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbQuery: any = supabaseAdmin
      .from("listings")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (material_type) dbQuery = dbQuery.eq("material_type", material_type);
    if (min_quantity) dbQuery = dbQuery.gte("quantity", parseFloat(min_quantity));

    const { data: listings, error } = await dbQuery;
    if (error) {
      console.error("Fetch listings error:", error);
      throw createError({ statusCode: 500, message: "Failed to fetch listings" });
    }

    const hasBuyerLocation = buyer_lat !== undefined && buyer_long !== undefined;
    const parsedBuyerLat = hasBuyerLocation ? parseFloat(buyer_lat!) : null;
    const parsedBuyerLong = hasBuyerLocation ? parseFloat(buyer_long!) : null;
    const parsedMaxDistance = max_distance_km ? parseFloat(max_distance_km) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enriched: any[] = (listings as Record<string, unknown>[]).map((listing) => {
      const current_price = computeCurrentPrice(listing as unknown as Parameters<typeof computeCurrentPrice>[0]);
      const entry: Record<string, unknown> = { ...listing, current_price };

      if (hasBuyerLocation && listing["pickup_lat"] != null && listing["pickup_long"] != null) {
        entry["distance_km"] =
          Math.round(
            haversine(parsedBuyerLat!, parsedBuyerLong!, listing["pickup_lat"] as number, listing["pickup_long"] as number) * 100
          ) / 100;
      }
      return entry;
    });

    if (hasBuyerLocation && parsedMaxDistance != null) {
      enriched = enriched.filter(
        (l) => l["distance_km"] !== undefined && (l["distance_km"] as number) <= parsedMaxDistance
      );
    }

    for (const listing of enriched) {
      checkAndTriggerFallback(listing as Parameters<typeof checkAndTriggerFallback>[0]).catch((err: unknown) =>
        console.error("Fallback check error for listing", listing.id, err)
      );
      checkBatchEligibility(listing as Parameters<typeof checkBatchEligibility>[0]).catch((err: unknown) =>
        console.error("Batch eligibility check error for listing", listing.id, err)
      );
    }

    return enriched;
  }

  // POST /api/listings
  if (method === "POST") {
    const { user, profile } = await requireAuth(event);

    if (!profile || !SELLER_ROLES.includes(profile.role)) {
      throw createError({ statusCode: 403, message: "Only manufacturers and retailers can create listings" });
    }

    const raw = await readBody<Record<string, unknown>>(event);
    const body = raw ?? {};
    const payload: Record<string, unknown> = {};
    for (const field of LISTING_FIELDS) {
      if (body[field] !== undefined) payload[field] = body[field];
    }

    if (!payload["material_type"] || payload["list_price"] == null || payload["price_floor"] == null) {
      throw createError({ statusCode: 400, message: "material_type, list_price, and price_floor are required" });
    }

    payload["seller_id"] = user.id;
    payload["decay_window_seconds"] = config.DECAY_WINDOW_SECONDS;
    payload["status"] = "open";

    const { data, error } = await supabaseAdmin.from("listings").insert(payload).select().single();

    if (error) {
      console.error("Insert listing error:", error);
      throw createError({ statusCode: 500, message: "Failed to create listing" });
    }

    setResponseStatus(event, 201);
    return data;
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
