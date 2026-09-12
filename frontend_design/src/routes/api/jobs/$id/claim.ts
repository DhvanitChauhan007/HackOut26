import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);

  if (profile?.role !== "logistics") {
    throw createError({ statusCode: 403, message: "Only logistics users can claim jobs" });
  }

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, message: "Missing job id" });

  // Fetch the job first to make sure it's still open
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("jobs")
    .select("id, status")
    .eq("id", id)
    .single();

  if (fetchErr || !job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  if (job.status !== "open") {
    throw createError({ statusCode: 409, message: "Job is no longer available" });
  }

  // Claim the job
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned", logistics_company_id: user.id })
    .eq("id", id)
    .eq("status", "open") // double-check to prevent race conditions
    .select()
    .single();

  if (updateErr || !updated) {
    throw createError({ statusCode: 409, message: "Job was already claimed by another carrier" });
  }

  // Insert notifications for buyer and seller via the notifications table
  // Fetch transaction to get buyer/seller ids
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("buyer_id, seller_id")
    .eq("id", updated.transaction_id)
    .single();

  if (transaction) {
    const carrierName = profile?.name ?? "A logistics carrier";
    const notifRows = [transaction.buyer_id, transaction.seller_id]
      .filter(Boolean)
      .map((uid) => ({
        user_id: uid,
        message: `${carrierName} has been assigned to your job and is on the way.`,
        read: false,
      }));

    if (notifRows.length > 0) {
      await supabaseAdmin.from("notifications").insert(notifRows);
    }
  }

  return updated;
});
