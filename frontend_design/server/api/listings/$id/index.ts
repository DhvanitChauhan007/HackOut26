import { defineEventHandler, readBody, createError, setResponseStatus, getMethod, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { computeCurrentPrice } from "@/services/priceDecay";
import { checkAndTriggerFallback } from "@/services/recyclerFallback";
import { checkBatchEligibility } from "@/services/bulkBatching";

const LISTING_FIELDS = [
  "material_type", "sub_grade", "contamination_pct", "quantity", "unit",
  "condition", "photo_url", "list_price", "price_floor", "pickup_lat", "pickup_long",
] as const;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const method = getMethod(event);

  // GET /api/listings/:id
  if (method === "GET") {
    const { data: listing, error } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !listing) {
      throw createError({ statusCode: 404, message: "Listing not found" });
    }

    listing.current_price = computeCurrentPrice(listing);

    checkAndTriggerFallback(listing).catch((err: unknown) =>
      console.error("Fallback check error for listing", id, err)
    );
    checkBatchEligibility(listing).catch((err: unknown) =>
      console.error("Batch eligibility check error for listing", id, err)
    );

    return listing;
  }

  // PATCH /api/listings/:id
  if (method === "PATCH") {
    const { user } = await requireAuth(event);

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      throw createError({ statusCode: 404, message: "Listing not found" });
    }

    if (existing.seller_id !== user.id) {
      throw createError({ statusCode: 403, message: "You can only update your own listings" });
    }

    if (existing.status !== "open") {
      throw createError({ statusCode: 400, message: "Only open listings can be updated" });
    }

    const raw = await readBody<Record<string, unknown>>(event);
    const body = raw ?? {};
    const updates: Record<string, unknown> = {};
    for (const field of LISTING_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      throw createError({ statusCode: 400, message: "No valid fields to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("listings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update listing error:", error);
      throw createError({ statusCode: 500, message: "Failed to update listing" });
    }

    return data;
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
