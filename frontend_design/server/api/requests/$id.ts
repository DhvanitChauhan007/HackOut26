import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { acceptRequest } from "@/services/recyclerFallback";

const VALID_STATUSES = ["accepted", "declined"];

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, "id")!;
  const raw = await readBody<Record<string, unknown>>(event);
  const body = raw ?? {};
  const status = body["status"] as string | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `status is required and must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const { data: request, error: reqError } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (reqError || !request) {
    throw createError({ statusCode: 404, message: "Request not found" });
  }

  if (request.status !== "pending") {
    throw createError({ statusCode: 400, message: "Request has already been processed" });
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", request.listing_id)
    .single();

  if (listingError || !listing) {
    throw createError({ statusCode: 404, message: "Listing not found" });
  }

  if (listing.seller_id !== user.id) {
    throw createError({ statusCode: 403, message: "Only the listing seller can manage requests" });
  }

  if (status === "accepted") {
    const { transaction, request: updatedRequest } = await acceptRequest(id, listing);
    return { request: updatedRequest, transaction };
  }

  const { data: declined, error: declineError } = await supabaseAdmin
    .from("requests")
    .update({ status: "declined" })
    .eq("id", id)
    .select()
    .single();

  if (declineError) {
    console.error("Decline request error:", declineError);
    throw createError({ statusCode: 500, message: "Failed to decline request" });
  }

  return { request: declined };
});
