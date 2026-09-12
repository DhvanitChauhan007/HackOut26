import type { H3Event } from "h3";
import { getHeader, createError } from "h3";
import { supabaseAdmin } from "./supabase";

export interface AuthUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  address?: string | null;
  lat?: number | null;
  long?: number | null;
  auto_accept?: boolean;
  is_fixed_recycler?: boolean;
  [key: string]: unknown;
}

export interface AuthContext {
  user: AuthUser;
  profile: UserProfile | null;
}

/**
 * Extracts and verifies the Bearer token from the request.
 * Returns { user, profile } or throws an H3 401 error.
 * Mirrors backend/src/middleware/auth.js requireAuth.
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  const authHeader = getHeader(event, "authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      message: "Missing or invalid authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw createError({
      statusCode: 401,
      message: "Invalid or expired token",
    });
  }

  // Fetch the full user profile (may be null if not yet created)
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user: user as unknown as AuthUser, profile: profile || null };
}
