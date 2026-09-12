import { defineEventHandler, createError, setResponseStatus, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, "id")!;

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*, listing:listings(*)")
    .eq("id", id)
    .single();

  if (txError || !transaction) {
    throw createError({ statusCode: 404, message: "Transaction not found" });
  }

  if (transaction.status !== "estimated") {
    throw createError({ statusCode: 400, message: 'Transaction must be in "estimated" status to commit' });
  }

  const { data: buyer, error: buyerError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", transaction.buyer_id)
    .single();

  if (buyerError || !buyer) {
    throw createError({ statusCode: 404, message: "Buyer profile not found" });
  }

  let firstPickupLat: number | null = null;
  let firstPickupLong: number | null = null;
  let bulkItems: { listing_id: string; seller_id: string; pickup_lat: number; pickup_long: number }[] = [];

  if (transaction.bulk_lot_id) {
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("*")
      .eq("bulk_lot_id", transaction.bulk_lot_id)
      .order("created_at", { ascending: true });

    if (itemsErr || !items || items.length === 0) {
      throw createError({ statusCode: 400, message: "Bulk lot items not found" });
    }
    bulkItems = items;
    firstPickupLat = items[0].pickup_lat;
    firstPickupLong = items[0].pickup_long;
  } else {
    const listing = transaction.listing;
    if (!listing) throw createError({ statusCode: 404, message: "Associated listing not found" });
    firstPickupLat = listing.pickup_lat;
    firstPickupLong = listing.pickup_long;
  }

  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({ status: "committed" })
    .eq("id", id);

  if (updateError) {
    console.error("Commit transaction error:", updateError);
    throw createError({ statusCode: 500, message: "Failed to commit transaction" });
  }

  const listing = transaction.listing as Record<string, unknown> | null;
  const cond = typeof listing?.["condition"] === "string" ? listing["condition"] : "";
  const pickupLocation = cond.includes("Pickup: ") ? cond.split("Pickup: ")[1]?.replace(")", "") : (cond || "Seller Facility");

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .insert({
      transaction_id: id,
      pickup_lat: firstPickupLat,
      pickup_long: firstPickupLong,
      dropoff_lat: buyer.lat,
      dropoff_long: buyer.long,
      pickup_location: pickupLocation,
      dropoff_location: buyer.address || "Buyer Facility",
      distance_km: transaction.distance_km,
      duration_min: 38,
      estimated_cost: transaction.estimated_cost,
      status: "open",
    })
    .select()
    .single();

  if (jobError) {
    console.error("Create job error:", jobError);
    throw createError({ statusCode: 500, message: "Failed to create logistics job" });
  }

  if (transaction.bulk_lot_id && bulkItems.length > 0) {
    const stops = bulkItems.map((item, index) => ({
      job_id: (job as { id: string }).id,
      listing_id: item.listing_id,
      seller_id: item.seller_id,
      pickup_lat: item.pickup_lat,
      pickup_long: item.pickup_long,
      seq_order: index + 1,
    }));
    const { error: stopsErr } = await supabaseAdmin.from("job_stops").insert(stops);
    if (stopsErr) console.error("Failed to create job stops:", stopsErr);
  }

  setResponseStatus(event, 201);
  return job;
});
