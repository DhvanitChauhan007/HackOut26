import { defineEventHandler, createError, getQuery } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { haversine } from "@/services/haversine";
import { checkFormingLotTimeouts } from "@/services/bulkBatching";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const material_type = query["material_type"] as string | undefined;
  const max_distance_km = query["max_distance_km"] as string | undefined;
  const buyer_lat = query["buyer_lat"] as string | undefined;
  const buyer_long = query["buyer_long"] as string | undefined;

  // Lazy cleanup of expired forming lots
  checkFormingLotTimeouts().catch((err: unknown) =>
    console.error("checkFormingLotTimeouts error:", err)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery: any = supabaseAdmin.from("bulk_lots").select("*").eq("status", "open");
  if (material_type) dbQuery = dbQuery.eq("material_type", material_type);

  const { data: lots, error } = await dbQuery;
  if (error) {
    console.error("Fetch bulk_lots error:", error);
    throw createError({ statusCode: 500, message: "Failed to fetch bulk lots" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lots as any[]).map(async (lot: any) => {
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from("bulk_lot_items")
        .select("pickup_lat, pickup_long")
        .eq("bulk_lot_id", lot.id);

      if (itemsErr) {
        console.error(`Fetch items for lot ${lot.id} error:`, itemsErr);
        return null;
      }

      const item_count = items.length;
      const validCoords = items.filter(
        (i: { pickup_lat: unknown; pickup_long: unknown }) => i.pickup_lat != null && i.pickup_long != null
      ) as { pickup_lat: number; pickup_long: number }[];

      const centroid_lat =
        validCoords.length > 0
          ? validCoords.reduce((s, i) => s + i.pickup_lat, 0) / validCoords.length
          : null;
      const centroid_long =
        validCoords.length > 0
          ? validCoords.reduce((s, i) => s + i.pickup_long, 0) / validCoords.length
          : null;

      const total_price =
        parseFloat(String(lot.bulk_rate_per_kg)) * parseFloat(String(lot.total_quantity));

      return {
        id: lot.id as string,
        material_type: lot.material_type as string,
        sub_grade: lot.sub_grade as string | null,
        status: lot.status as string,
        total_quantity: lot.total_quantity as number,
        bulk_rate_per_kg: lot.bulk_rate_per_kg as number,
        total_price,
        item_count,
        centroid_lat,
        centroid_long,
        created_at: lot.created_at as string,
      };
    })
  );

  type EnrichedLot = Exclude<(typeof enriched)[number], null> & { distance_km?: number | null };
  let results: EnrichedLot[] = enriched.filter((x): x is Exclude<typeof x, null> => x !== null);

  const hasBuyerCoords =
    buyer_lat != null &&
    buyer_long != null &&
    !isNaN(parseFloat(buyer_lat)) &&
    !isNaN(parseFloat(buyer_long));

  if (hasBuyerCoords) {
    const bLat = parseFloat(buyer_lat!);
    const bLong = parseFloat(buyer_long!);
    const maxDist = max_distance_km ? parseFloat(max_distance_km) : null;

    results = results
      .map((lot): EnrichedLot => {
        if (lot.centroid_lat == null || lot.centroid_long == null) {
          return { ...lot, distance_km: null };
        }
        const distance_km = haversine(bLat, bLong, lot.centroid_lat, lot.centroid_long);
        return { ...lot, distance_km: Math.round(distance_km * 100) / 100 };
      })
      .filter((lot): lot is EnrichedLot => {
        if (maxDist != null && lot.distance_km != null) return lot.distance_km <= maxDist;
        return true;
      });
  }

  return { lots: results };
});
