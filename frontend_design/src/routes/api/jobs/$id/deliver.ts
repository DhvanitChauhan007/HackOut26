import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);

  if (profile?.role !== "logistics") {
    throw createError({ statusCode: 403, message: "Only logistics users can deliver jobs" });
  }

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing job id" });

  // Verify this logistics company owns this job
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("jobs")
    .select("id, status, logistics_company_id, transaction_id")
    .eq("id", id)
    .single();

  if (fetchErr || !job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  if (job.logistics_company_id !== user.id) {
    throw createError({ statusCode: 403, message: "You are not assigned to this job" });
  }

  if (job.status === "delivered") {
    throw createError({ statusCode: 409, message: "Job already marked as delivered" });
  }

  // Mark as delivered
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("jobs")
    .update({ status: "delivered" })
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !updated) {
    throw createError({ statusCode: 500, message: "Failed to update job" });
  }

  // Send delivery notifications to buyer and seller
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("buyer_id, seller_id")
    .eq("id", job.transaction_id)
    .single();

  if (transaction) {
    const notifRows = [
      transaction.buyer_id && {
        user_id: transaction.buyer_id,
        message: "Your material has been delivered. Please confirm receipt.",
        read: false,
      },
      transaction.seller_id && {
        user_id: transaction.seller_id,
        message: "Delivery confirmed complete for your listing.",
        read: false,
      },
    ].filter(Boolean);

    if (notifRows.length > 0) {
      await supabaseAdmin.from("notifications").insert(notifRows);
    }
  }

  return updated;
});
