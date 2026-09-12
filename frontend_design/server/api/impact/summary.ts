import { defineEventHandler, createError } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const userId = user.id;

  const { data: userItems } = await supabaseAdmin
    .from("bulk_lot_items")
    .select("bulk_lot_id, quantity")
    .eq("seller_id", userId);

  const userBulkItems = userItems || [];
  const bulkLotIds = [...new Set(userBulkItems.map((i: { bulk_lot_id: string }) => i.bulk_lot_id))];

  let query = supabaseAdmin
    .from("transactions")
    .select("*, listing:listings(list_price), bulk_lot:bulk_lots(total_quantity, bulk_rate_per_kg)")
    .eq("status", "completed");

  if (bulkLotIds.length > 0) {
    query = query.or(
      `buyer_id.eq.${userId},seller_id.eq.${userId},bulk_lot_id.in.(${bulkLotIds.join(",")})`
    );
  } else {
    query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  }

  const { data: transactions, error } = await query;
  if (error) {
    console.error("Fetch impact transactions error:", error);
    throw createError({ statusCode: 500, message: "Failed to fetch transactions" });
  }

  let totalKgDiverted = 0;
  let totalCo2eAvoided = 0;
  let totalCostSavings = 0;

  for (const txn of transactions) {
    const isBuyer = txn.buyer_id === userId;
    const isSingleSeller = txn.seller_id === userId;
    const isBulkSeller = txn.bulk_lot_id && bulkLotIds.includes(txn.bulk_lot_id);

    if (isBuyer) {
      totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0);
      totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0);
      totalCostSavings += parseFloat(txn.estimated_cost || 0);
    } else if (isSingleSeller) {
      totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0);
      totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0);
      if (txn.listing?.list_price) totalCostSavings += parseFloat(txn.listing.list_price);
    } else if (isBulkSeller) {
      const contributedItems = userBulkItems.filter(
        (i: { bulk_lot_id: string }) => i.bulk_lot_id === txn.bulk_lot_id
      );
      const userQty = contributedItems.reduce(
        (sum: number, i: { quantity: number }) => sum + parseFloat(String(i.quantity || 0)),
        0
      );
      const totalLotQty =
        txn.bulk_lot?.total_quantity ? parseFloat(txn.bulk_lot.total_quantity) : 1;
      const portion = userQty / totalLotQty;

      totalKgDiverted += parseFloat(txn.impact_kg_diverted || 0) * portion;
      totalCo2eAvoided += parseFloat(txn.impact_co2e_kg || 0) * portion;
      if (txn.bulk_lot?.bulk_rate_per_kg) {
        totalCostSavings += parseFloat(txn.bulk_lot.bulk_rate_per_kg) * userQty;
      }
    }
  }

  return {
    total_kg_diverted: Math.round(totalKgDiverted * 100) / 100,
    total_co2e_avoided: Math.round(totalCo2eAvoided * 100) / 100,
    total_cost_savings: Math.round(totalCostSavings * 100) / 100,
    transaction_count: transactions.length,
  };
});
