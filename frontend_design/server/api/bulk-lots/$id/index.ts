import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;

  const { data: lot, error } = await supabaseAdmin
    .from("bulk_lots")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lot) {
    throw createError({ statusCode: 404, message: "Bulk lot not found" });
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("bulk_lot_items")
    .select("id")
    .eq("bulk_lot_id", lot.id);

  if (itemsErr) {
    console.error(`Fetch items for lot ${id} error:`, itemsErr);
    throw createError({ statusCode: 500, message: "Failed to fetch lot items" });
  }

  const total_price =
    parseFloat(lot.bulk_rate_per_kg) * parseFloat(lot.total_quantity);

  return {
    id: lot.id,
    material_type: lot.material_type,
    sub_grade: lot.sub_grade,
    total_quantity: lot.total_quantity,
    bulk_rate_per_kg: lot.bulk_rate_per_kg,
    total_price,
    item_count: items.length,
    status: lot.status,
    created_at: lot.created_at,
  };
});
