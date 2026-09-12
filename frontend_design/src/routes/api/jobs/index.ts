import { defineEventHandler, createError, getQuery } from "h3";
import { supabaseAdmin } from "@/api/supabase";
import { requireAuth } from "@/api/auth";
import { haversine } from "@/services/haversine";

export default defineEventHandler(async (event) => {
  const { profile } = await requireAuth(event);

  if (!profile || profile.role !== "logistics") {
    throw createError({ statusCode: 403, message: "Only logistics users can access this resource" });
  }

  const query = getQuery(event);
  const status = query["status"] as string | undefined;
  const lat = query["lat"] as string | undefined;
  const long = query["long"] as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery: any = supabaseAdmin.from("jobs").select("*");
  if (status) dbQuery = dbQuery.eq("status", status);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: jobs, error } = await (dbQuery as any);
  if (error) {
    console.error("Fetch jobs error:", error);
    throw createError({ statusCode: 500, message: "Failed to fetch jobs" });
  }

  if (lat && long) {
    const userLat = parseFloat(lat);
    const userLon = parseFloat(long);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jobs as any[]).sort((a: any, b: any) => {
      const distA =
        a.pickup_lat != null && a.pickup_long != null
          ? haversine(userLat, userLon, a.pickup_lat as number, a.pickup_long as number)
          : Infinity;
      const distB =
        b.pickup_lat != null && b.pickup_long != null
          ? haversine(userLat, userLon, b.pickup_lat as number, b.pickup_long as number)
          : Infinity;
      return distA - distB;
    });
  }

  return jobs;
});
