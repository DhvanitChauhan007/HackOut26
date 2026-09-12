import { defineEventHandler, createError, getRouterParam } from "h3";
import { supabaseAdmin } from "@/api/supabase";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing user id" });
  }

  const { data: ratings, error } = await supabaseAdmin
    .from("ratings")
    .select("*")
    .eq("ratee_id", id);

  if (error) {
    console.error("Fetch ratings error:", error);
    throw createError({ statusCode: 500, message: "Failed to fetch ratings" });
  }

  const count = ratings.length;
  const average =
    count > 0 ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / count : 0;

  return {
    ratings,
    average: Math.round(average * 100) / 100,
    count,
  };
});
