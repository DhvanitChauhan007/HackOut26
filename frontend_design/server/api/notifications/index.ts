import { defineEventHandler, createError, getMethod } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const method = getMethod(event);

  // GET /api/notifications
  if (method === "GET") {
    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch notifications error:", error);
      throw createError({ statusCode: 500, message: "Failed to fetch notifications" });
    }

    return notifications;
  }

  throw createError({ statusCode: 405, message: "Method not allowed" });
});
