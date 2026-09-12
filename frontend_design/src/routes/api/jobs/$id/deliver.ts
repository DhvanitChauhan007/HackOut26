import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { computeImpact } from "@/services/impactCalc";
import { createNotification } from "@/services/notifications";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;

  if (!profile || profile.role !== "logistics") {
    throw createError({ statusCode: 403, message: "Only logistics users can access this resource" });
  }

  const { data: job, error: fetchErr } = await supabaseAdmin.from("jobs").select("*").eq("id", id).single();
  if (fetchErr || !job) throw createError({ statusCode: 404, message: "Job not found" });
  if (job.status !== "assigned") throw createError({ statusCode: 409, message: "Job is not in assigned status" });
  if (job.logistics_company_id !== user.id) {
    throw createError({ statusCode: 403, message: "Only the assigned logistics company can deliver this job" });
  }

  const now = new Date().toISOString();

  const { data: updatedJob, error: jobUpdateErr } = await supabaseAdmin
    .from("jobs")
    .update({ status: "delivered", delivered_at: now })
    .eq("id", id)
    .select()
    .single();

  if (jobUpdateErr) throw createError({ statusCode: 500, message: "Failed to update job status" });

  const { data: transaction, error: txnErr } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", job.transaction_id)
    .single();

  if (txnErr || !transaction) throw createError({ statusCode: 500, message: "Failed to fetch associated transaction" });

  let totalKgDiverted = 0;
  let totalCo2eKg = 0;

  if (transaction.bulk_lot_id) {
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("listing_id")
      .eq("bulk_lot_id", transaction.bulk_lot_id);

    if (itemsErr) throw createError({ statusCode: 500, message: "Failed to fetch listings for impact calculation" });

    const listingIds = (items || []).map((i: { listing_id: string }) => i.listing_id);

    if (listingIds.length > 0) {
      const { data: listings } = await supabaseAdmin
        .from("listings")
        .select("id, material_type, quantity")
        .in("id", listingIds);

      if (listings) {
        const impacts = await Promise.all(
          listings.map((l: { material_type: string; quantity: number }) => computeImpact(l.material_type, l.quantity))
        );
        for (const impact of impacts) {
          totalKgDiverted += impact.impact_kg_diverted;
          totalCo2eKg += impact.impact_co2e_kg;
        }
        await supabaseAdmin.from("listings").update({ status: "completed" }).in("id", listingIds);
      }
    }

    await supabaseAdmin.from("bulk_lots").update({ status: "completed" }).eq("id", transaction.bulk_lot_id);
  } else {
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("id, material_type, quantity")
      .eq("id", transaction.listing_id)
      .single();

    if (listingErr || !listing) throw createError({ statusCode: 500, message: "Failed to fetch listing for impact calculation" });

    const impact = await computeImpact(listing.material_type, listing.quantity);
    totalKgDiverted = impact.impact_kg_diverted;
    totalCo2eKg = impact.impact_co2e_kg;

    await supabaseAdmin.from("listings").update({ status: "completed" }).eq("id", listing.id);
  }

  await supabaseAdmin
    .from("transactions")
    .update({ status: "completed", completed_at: now, impact_kg_diverted: totalKgDiverted, impact_co2e_kg: totalCo2eKg })
    .eq("id", job.transaction_id);

  let sellerIds: string[] = transaction.seller_id ? [transaction.seller_id] : [];
  if (transaction.bulk_lot_id) {
    const { data: bItems } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("seller_id")
      .eq("bulk_lot_id", transaction.bulk_lot_id);
    if (bItems) sellerIds = bItems.map((i: { seller_id: string }) => i.seller_id).filter(Boolean);
  }
  sellerIds = [...new Set(sellerIds)];

  await Promise.all([
    createNotification(transaction.buyer_id, "Your material has been delivered", "delivery"),
    ...sellerIds.map((uid) => createNotification(uid, "Delivery of your material has been confirmed", "delivery")),
  ]);

  return updatedJob;
});
