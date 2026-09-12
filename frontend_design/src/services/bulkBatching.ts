import { supabaseAdmin } from "../api/supabase";
import { config } from "../api/config";
import { haversine } from "./haversine";
import { isBatchEligible } from "./priceDecay";

interface ListingForBatch {
  id: string;
  seller_id: string;
  material_type: string;
  sub_grade?: string;
  quantity: number;
  pickup_lat?: number | null;
  pickup_long?: number | null;
  created_at: string;
  decay_window_seconds: number;
  list_price: number;
  price_floor: number;
}

/**
 * Check if a listing has decayed enough to enter a bulk lot.
 * Mirrors backend/src/services/bulkBatching.js checkBatchEligibility.
 */
export async function checkBatchEligibility(
  listing: ListingForBatch
): Promise<{ batched: boolean; bulk_lot_id?: string }> {
  if (!isBatchEligible(listing, config.BATCH_ELIGIBLE_DECAY_PCT)) {
    return { batched: false };
  }

  const { data: existingItem, error: existErr } = await supabaseAdmin
    .from("bulk_lot_items")
    .select("id")
    .eq("listing_id", listing.id)
    .maybeSingle();

  if (existErr) throw existErr;
  if (existingItem) return { batched: false };

  const lot = await findFormingLot(listing);
  if (lot) return joinLot(lot, listing);
  return createLot(listing);
}

async function findFormingLot(listing: ListingForBatch) {
  const { data: candidates, error } = await supabaseAdmin
    .from("bulk_lots")
    .select("*, bulk_lot_items(pickup_lat, pickup_long)")
    .eq("material_type", listing.material_type)
    .eq("sub_grade", listing.sub_grade)
    .eq("status", "forming");

  if (error) throw error;
  if (!candidates || candidates.length === 0) return null;

  for (const lot of candidates) {
    const items = (lot.bulk_lot_items || []) as { pickup_lat: number; pickup_long: number }[];
    if (items.length >= config.BATCH_MAX_ITEMS) continue;

    const withinRadius = items.some(
      (item) =>
        listing.pickup_lat != null &&
        listing.pickup_long != null &&
        haversine(listing.pickup_lat, listing.pickup_long, item.pickup_lat, item.pickup_long) <=
          config.BATCH_MATCH_RADIUS_KM
    );

    if (withinRadius) return lot;
  }

  return null;
}

async function joinLot(
  lot: { id: string; total_quantity: number; bulk_lot_items?: unknown[] },
  listing: ListingForBatch
): Promise<{ batched: boolean; bulk_lot_id: string }> {
  const { error: insertErr } = await supabaseAdmin.from("bulk_lot_items").insert({
    bulk_lot_id: lot.id,
    listing_id: listing.id,
    seller_id: listing.seller_id,
    quantity: listing.quantity,
    pickup_lat: listing.pickup_lat,
    pickup_long: listing.pickup_long,
  });

  if (insertErr) throw insertErr;

  const newTotal = (lot.total_quantity || 0) + listing.quantity;
  const newItemCount = (lot.bulk_lot_items?.length || 0) + 1;
  const updates: { total_quantity: number; status?: string } = { total_quantity: newTotal };
  if (newItemCount >= config.BATCH_MIN_ITEMS) updates.status = "open";

  const { error: updateErr } = await supabaseAdmin
    .from("bulk_lots")
    .update(updates)
    .eq("id", lot.id);

  if (updateErr) throw updateErr;
  return { batched: true, bulk_lot_id: lot.id };
}

async function createLot(
  listing: ListingForBatch
): Promise<{ batched: boolean; bulk_lot_id: string }> {
  const { data: rateRow, error: rateErr } = await supabaseAdmin
    .from("bulk_rates")
    .select("rate_per_kg")
    .eq("material_type", listing.material_type)
    .maybeSingle();

  if (rateErr) throw rateErr;
  const bulkRatePerKg = rateRow ? rateRow.rate_per_kg : 1.0;

  const { data: newLot, error: lotErr } = await supabaseAdmin
    .from("bulk_lots")
    .insert({
      material_type: listing.material_type,
      sub_grade: listing.sub_grade,
      status: "forming",
      total_quantity: listing.quantity,
      bulk_rate_per_kg: bulkRatePerKg,
    })
    .select()
    .single();

  if (lotErr) throw lotErr;

  const { error: itemErr } = await supabaseAdmin.from("bulk_lot_items").insert({
    bulk_lot_id: (newLot as { id: string }).id,
    listing_id: listing.id,
    seller_id: listing.seller_id,
    quantity: listing.quantity,
    pickup_lat: listing.pickup_lat,
    pickup_long: listing.pickup_long,
  });

  if (itemErr) throw itemErr;

  if (1 >= config.BATCH_MIN_ITEMS) {
    await supabaseAdmin
      .from("bulk_lots")
      .update({ status: "open" })
      .eq("id", (newLot as { id: string }).id);
  }

  return { batched: true, bulk_lot_id: (newLot as { id: string }).id };
}

/**
 * Dissolve forming lots that have exceeded BATCH_FORMING_TIMEOUT_SECONDS.
 * Mirrors backend/src/services/bulkBatching.js checkFormingLotTimeouts.
 */
export async function checkFormingLotTimeouts(): Promise<number> {
  const cutoff = new Date(Date.now() - config.BATCH_FORMING_TIMEOUT_SECONDS * 1000).toISOString();

  const { data: staleLots, error: fetchErr } = await supabaseAdmin
    .from("bulk_lots")
    .select("id")
    .eq("status", "forming")
    .lte("created_at", cutoff);

  if (fetchErr) throw fetchErr;
  if (!staleLots || staleLots.length === 0) return 0;

  const lotIds = staleLots.map((l: { id: string }) => l.id);

  const { error: delItemsErr } = await supabaseAdmin
    .from("bulk_lot_items")
    .delete()
    .in("bulk_lot_id", lotIds);

  if (delItemsErr) throw delItemsErr;

  const { error: dissolveErr } = await supabaseAdmin
    .from("bulk_lots")
    .update({ status: "dissolved" })
    .in("id", lotIds);

  if (dissolveErr) throw dissolveErr;

  return lotIds.length;
}
