import { defineEventHandler, readBody, createError, setResponseStatus, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { createNotification } from "@/services/notifications";

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;
  const raw = await readBody<Record<string, unknown>>(event);
  const body = raw ?? {};
  let ratee_id = body["ratee_id"] as string | undefined;
  const rating = body["rating"] as number | undefined;
  const comment = body["comment"] as string | undefined;

  if (rating == null || typeof rating !== "number" || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, message: "rating is required and must be between 1 and 5" });
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (txError || !transaction) {
    throw createError({ statusCode: 404, message: "Transaction not found" });
  }

  if (transaction.status !== "completed") {
    throw createError({ statusCode: 400, message: "Ratings can only be submitted for completed transactions" });
  }

  const callerId = user.id;
  const isBuyer = callerId === transaction.buyer_id;
  const isSingleSeller = callerId === transaction.seller_id;

  let isBulkSeller = false;
  if (!isBuyer && !isSingleSeller && transaction.bulk_lot_id) {
    const { data: lotItems } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("seller_id")
      .eq("bulk_lot_id", transaction.bulk_lot_id);

    if (lotItems) {
      isBulkSeller = lotItems.some((i: { seller_id: string }) => i.seller_id === callerId);
    }
  }

  if (!isBuyer && !isSingleSeller && !isBulkSeller) {
    throw createError({ statusCode: 403, message: "Only transaction parties can submit ratings" });
  }

  if (!ratee_id) {
    if (transaction.bulk_lot_id) {
      throw createError({ statusCode: 400, message: "ratee_id is required for bulk transactions" });
    }
    ratee_id = isBuyer ? transaction.seller_id : transaction.buyer_id;
  }

  if (transaction.bulk_lot_id) {
    const validParties = new Set<string>([transaction.buyer_id]);
    const { data: lotItems } = await supabaseAdmin
      .from("bulk_lot_items")
      .select("seller_id")
      .eq("bulk_lot_id", transaction.bulk_lot_id);

    if (lotItems) lotItems.forEach((i: { seller_id: string }) => validParties.add(i.seller_id));
    if (!ratee_id || !validParties.has(ratee_id)) {
      throw createError({ statusCode: 400, message: "ratee_id must be a valid party in this transaction" });
    }
  }

  // ratee_id is guaranteed set at this point
  const definedRateeId = ratee_id!;

  if (callerId === definedRateeId) {
    throw createError({ statusCode: 400, message: "You cannot rate yourself" });
  }

  const { data: existing, error: existError } = await supabaseAdmin
    .from("ratings")
    .select("id")
    .eq("transaction_id", id)
    .eq("rater_id", callerId)
    .eq("ratee_id", definedRateeId)
    .maybeSingle();

  if (existError) throw createError({ statusCode: 500, message: "Failed to verify rating uniqueness" });
  if (existing) throw createError({ statusCode: 409, message: "You have already rated this party for this transaction" });

  const { data: ratingRow, error: insertError } = await supabaseAdmin
    .from("ratings")
    .insert({ transaction_id: id, rater_id: callerId, ratee_id: definedRateeId, rating, comment: comment ?? null })
    .select()
    .single();

  if (insertError) {
    console.error("Rating insert error:", insertError);
    throw createError({ statusCode: 500, message: "Failed to submit rating" });
  }

  await createNotification(definedRateeId, `You received a ${rating}-star rating.`, "rating_received");

  setResponseStatus(event, 201);
  return ratingRow;
});

