import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { createNotification } from "@/services/notifications";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;

  if (!profile || profile.role !== "logistics") {
    throw createError({ statusCode: 403, message: "Only logistics users can access this resource" });
  }

  const { data: job, error: fetchErr } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  if (job.status !== "open") {
    throw createError({ statusCode: 409, message: "Job is no longer open for claiming" });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("jobs")
    .update({ status: "assigned", logistics_company_id: user.id, assigned_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    console.error("Claim job update error:", updateErr);
    throw createError({ statusCode: 500, message: "Failed to claim job" });
  }

  const { data: txn } = await supabaseAdmin
    .from("transactions")
    .select("buyer_id, seller_id")
    .eq("id", job.transaction_id)
    .single();

  if (txn) {
    const targets = [txn.buyer_id, txn.seller_id].filter(Boolean);
    await Promise.all(
      targets.map((uid: string) =>
        createNotification(uid, "A carrier has been assigned to your shipment", "shipment")
      )
    );
  }

  return updated;
});
