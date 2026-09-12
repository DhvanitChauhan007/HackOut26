import { defineEventHandler, createError, setResponseStatus, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;

  if (!profile || !["manufacturer", "retailer"].includes(profile.role)) {
    throw createError({
      statusCode: 403,
      message: "Only buyers (manufacturer/retailer) can purchase bulk lots",
    });
  }

  const { data: lot, error: lotErr } = await supabaseAdmin
    .from("bulk_lots")
    .select("*")
    .eq("id", id)
    .single();

  if (lotErr || !lot) {
    throw createError({ statusCode: 404, message: "Bulk lot not found" });
  }

  if (lot.status !== "open") {
    throw createError({
      statusCode: 409,
      message: `Lot is not open for purchase (current status: ${lot.status})`,
    });
  }

  // Step a: Set lot status → claimed
  const { error: lotUpdateErr } = await supabaseAdmin
    .from("bulk_lots")
    .update({ status: "claimed" })
    .eq("id", id);

  if (lotUpdateErr) {
    console.error("Update lot status error:", lotUpdateErr);
    throw createError({ statusCode: 500, message: "Failed to claim lot" });
  }

  // Step b: Set all contributing listings → claimed
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("bulk_lot_items")
    .select("listing_id")
    .eq("bulk_lot_id", id);

  if (itemsErr) {
    console.error("Fetch lot items error:", itemsErr);
    throw createError({ statusCode: 500, message: "Failed to fetch lot items" });
  }

  const listingIds = (items ?? []).map((i: { listing_id: string }) => i.listing_id);
  if (listingIds.length > 0) {
    const { error: listingsUpdateErr } = await supabaseAdmin
      .from("listings")
      .update({ status: "claimed" })
      .in("id", listingIds);

    if (listingsUpdateErr) {
      console.error("Update listings status error:", listingsUpdateErr);
      throw createError({ statusCode: 500, message: "Failed to claim listings" });
    }
  }

  // Step c: Create transaction
  const total_price = parseFloat(lot.bulk_rate_per_kg) * parseFloat(lot.total_quantity);

  const { data: transaction, error: txErr } = await supabaseAdmin
    .from("transactions")
    .insert({
      bulk_lot_id: id,
      listing_id: null,
      seller_id: null,
      buyer_id: user.id,
      status: "pending",
      estimated_cost: total_price,
    })
    .select()
    .single();

  if (txErr) {
    console.error("Create transaction error:", txErr);
    throw createError({ statusCode: 500, message: "Failed to create transaction" });
  }

  setResponseStatus(event, 201);
  return transaction;
});
