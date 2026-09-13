import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { config } from "@/api/config";
import { requireAuth } from "@/api/auth";
import { getDistance } from "@/services/distanceMatrix";

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*, listing:listings(*)")
    .eq("id", id)
    .single();

  if (txError || !transaction) {
    throw createError({ statusCode: 404, message: "Transaction not found" });
  }

  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", transaction.buyer_id)
    .single();

  if (buyerError || !buyer) {
    throw createError({ statusCode: 404, message: "Buyer profile not found" });
  }

  if (buyer.lat == null || buyer.long == null) {
    throw createError({ statusCode: 400, message: "Buyer profile is missing location coordinates" });
  }

  let total_distance_km = 0;
  let total_duration_min = 0;

  if (transaction.bulk_lot_id) {
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("*")
      .eq("bulk_lot_id", transaction.bulk_lot_id)
      .order("created_at", { ascending: true });

    if (itemsErr || !items || items.length === 0) {
      throw createError({ statusCode: 400, message: "Bulk lot items not found" });
    }

    let prevLat: number | null = null;
    let prevLong: number | null = null;

    for (const item of items) {
      if (item.pickup_lat == null || item.pickup_long == null) continue;
      if (prevLat != null && prevLong != null) {
        const leg = await getDistance(prevLat, prevLong, item.pickup_lat, item.pickup_long);
        total_distance_km += leg.distance_km;
        total_duration_min += leg.duration_min;
      }
      prevLat = item.pickup_lat;
      prevLong = item.pickup_long;
    }

    if (prevLat != null && prevLong != null) {
      const leg = await getDistance(prevLat, prevLong, buyer.lat, buyer.long);
      total_distance_km += leg.distance_km;
      total_duration_min += leg.duration_min;
    }
  } else {
    const listing = transaction.listing;
    if (!listing) throw createError({ statusCode: 404, message: "Associated listing not found" });
    
    let pLat = listing.pickup_lat;
    let pLong = listing.pickup_long;
    if (pLat == null || pLong == null) {
      const { data: seller } = await supabaseAdmin
        .from("users")
        .select("lat, long")
        .eq("id", transaction.seller_id)
        .single();
      pLat = seller?.lat ?? null;
      pLong = seller?.long ?? null;
    }

    if (pLat == null || pLong == null) {
      throw createError({ statusCode: 400, message: "Listing/Seller is missing pickup coordinates" });
    }

    const leg = await getDistance(pLat, pLong, buyer.lat, buyer.long);
    total_distance_km = leg.distance_km;
    total_duration_min = leg.duration_min;
  }

  const estimated_cost = Math.round(total_distance_km * config.COST_PER_KM * 100) / 100;

  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({ distance_km: total_distance_km, estimated_cost, duration_min: total_duration_min, status: "estimated" })
    .eq("id", id);

  if (updateError) {
    console.error("Update transaction estimate error:", updateError);
    throw createError({ statusCode: 500, message: "Failed to update transaction estimate" });
  }

  return { distance_km: total_distance_km, estimated_cost, duration_min: total_duration_min };
});
