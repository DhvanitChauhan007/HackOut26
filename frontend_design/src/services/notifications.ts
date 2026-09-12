import { supabaseAdmin } from "../api/supabase";

/**
 * Create a notification row. Supabase Realtime handles push to the frontend.
 * Mirrors backend/src/services/notifications.js
 */
export async function createNotification(
  userId: string,
  message: string,
  type = "general"
): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    message,
    type,
    read: false,
  });

  if (error) {
    console.error("Notification insert error:", error);
  }
}
