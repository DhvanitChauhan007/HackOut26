import { defineEventHandler, createError, setResponseStatus, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { acceptRequest } from "@/services/recyclerFallback";

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireAuth(event);
  const listingId = getRouterParam(event, "id")!;

  if (!profile || profile.role !== "recycler") {
    throw createError({ statusCode: 403, message: "Only buyers (recyclers) can create requests" });
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    throw createError({ statusCode: 404, message: "Listing not found" });
  }

  if (listing.status !== "open") {
    throw createError({ statusCode: 400, message: "Listing is no longer open" });
  }

  const { data: request, error: reqError } = await supabaseAdmin
    .from("requests")
    .insert({ listing_id: listingId, buyer_id: user.id, status: "pending" })
    .select()
    .single();

  if (reqError) {
    console.error("Insert request error:", reqError);
    throw createError({ statusCode: 500, message: "Failed to create request" });
  }

  const { data: seller } = await supabaseAdmin
    .from("users")
    .select("auto_accept")
    .eq("id", listing.seller_id)
    .single();

  if (seller?.auto_accept) {
    try {
      await acceptRequest((request as { id: string }).id, listing);
      const { data: updatedRequest } = await supabaseAdmin
        .from("requests")
        .select("*")
        .eq("id", (request as { id: string }).id)
        .single();

      setResponseStatus(event, 201);
      return updatedRequest ?? request;
    } catch (acceptErr) {
      console.error("Auto-accept failed:", acceptErr);
      setResponseStatus(event, 201);
      return request;
    }
  }

  setResponseStatus(event, 201);
  return request;
});
