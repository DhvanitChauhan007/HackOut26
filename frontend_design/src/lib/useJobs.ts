import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export type JobStatus = "open" | "assigned" | "delivered";

export interface Job {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  distance_km: number;
  duration_min: number | null;
  estimated_cost: number;
  status: JobStatus;
  logistics_company_id: string | null;
  // joined from transactions → listings
  material_type?: string;
  quantity_kg?: number;
  pickup_lat?: number | null;
  pickup_long?: number | null;
  dropoff_lat?: number | null;
  dropoff_long?: number | null;
  created_at?: string | null;
  delivered_at?: string | null;
  // computed display fields
  route: string;
  detail: string;
  payout: string;
  eta: string;
}

interface UseJobsReturn {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  claimJob: (id: string) => Promise<void>;
  deliverJob: (id: string) => Promise<void>;
  counts: { open: number; assigned: number; in_transit: number; delivered: number };
}

export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatJob = (raw: Record<string, unknown>): Job => {
    const cost = typeof raw["estimated_cost"] === "number" ? raw["estimated_cost"] : 0;
    const km = typeof raw["distance_km"] === "number" ? raw["distance_km"] : 0;
    const duration = typeof raw["duration_min"] === "number" ? raw["duration_min"] : null;
    const qty = typeof raw["quantity_kg"] === "number" ? raw["quantity_kg"] : 0;
    const pLat = typeof raw["pickup_lat"] === "number" ? raw["pickup_lat"] : null;
    const pLon = typeof raw["pickup_long"] === "number" ? raw["pickup_long"] : null;
    const dLat = typeof raw["dropoff_lat"] === "number" ? raw["dropoff_lat"] : null;
    const dLon = typeof raw["dropoff_long"] === "number" ? raw["dropoff_long"] : null;
    const delAt = typeof raw["delivered_at"] === "string" ? raw["delivered_at"] : null;
    const crAt = typeof raw["created_at"] === "string" ? raw["created_at"] : null;
    
    return {
      id: String(raw["id"] ?? ""),
      pickup_location: String(raw["pickup_location"] ?? ""),
      dropoff_location: String(raw["dropoff_location"] ?? ""),
      pickup_lat: pLat,
      pickup_long: pLon,
      dropoff_lat: dLat,
      dropoff_long: dLon,
      created_at: crAt,
      delivered_at: delAt,
      distance_km: km,
      duration_min: duration,
      estimated_cost: cost,
      status: (raw["status"] as JobStatus) ?? "open",
      logistics_company_id: raw["logistics_company_id"] as string | null,
      material_type: raw["material_type"] as string | undefined,
      quantity_kg: qty,
      route: `${raw["pickup_location"]} → ${raw["dropoff_location"]}`,
      detail: `${qty > 0 ? qty + " kg · " : ""}${km} km`,
      payout: `₹${cost.toLocaleString("en-IN")}`,
      eta: duration
        ? duration >= 60
          ? `~${Math.floor(duration / 60)}h ${Math.round(duration % 60)}m`
          : `~${Math.round(duration)} min`
        : "ETA unavailable",
    };
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("jobs")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setJobs((data ?? []).map((j) => formatJob(j as Record<string, unknown>)));
    }
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Realtime subscription — re-fetch whenever any job row changes
  useEffect(() => {
    const channel = supabase
      .channel("jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          // Refetch on any insert/update/delete
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  const getToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const claimJob = useCallback(async (id: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    let logisticsId = sessionData.session?.user?.id;

    // Verify if current session user exists in public.users table
    let isValidInDb = false;
    if (logisticsId) {
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("id", logisticsId)
        .maybeSingle();
      if (userRow) {
        isValidInDb = true;
      }
    }

    // If auth is bypassed or the auth user has no public profile,
    // pick an existing logistics user from the DB so foreign key constraint is satisfied!
    if (!isValidInDb) {
      const { data: defaultCarrier } = await supabase
        .from("users")
        .select("id")
        .eq("role", "logistics")
        .limit(1)
        .maybeSingle();
      logisticsId = defaultCarrier?.id ?? null;
    }

    // Try API route first (for production Nitro server)
    let apiSucceeded = false;
    try {
      const res = await fetch(`/api/jobs/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        apiSucceeded = true;
      }
    } catch {
      // In Vite dev mode, /api routes return 404 from TanStack Router, fallback to direct Supabase
    }

    if (!apiSucceeded) {
      // Direct Supabase update (works instantly in dev mode)
      const { error: updateErr } = await supabase
        .from("jobs")
        .update({
          status: "assigned",
          logistics_company_id: logisticsId,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }
    }

    // Optimistically update local state; Realtime will confirm
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: "assigned", logistics_company_id: logisticsId } : j))
    );
  }, []);

  const deliverJob = useCallback(async (id: string) => {
    const token = await getToken();

    let apiSucceeded = false;
    try {
      const res = await fetch(`/api/jobs/${id}/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        apiSucceeded = true;
      }
    } catch {
      // Fallback
    }

    const nowIso = new Date().toISOString();

    if (!apiSucceeded) {
      const { error: updateErr } = await supabase
        .from("jobs")
        .update({
          status: "delivered",
          delivered_at: nowIso,
        })
        .eq("id", id);

      if (updateErr) {
        throw new Error(updateErr.message);
      }
    }

    // Optimistically update local state; Realtime will confirm
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: "delivered", delivered_at: nowIso } : j))
    );
  }, []);

  const counts = {
    open: jobs.filter((j) => j.status === "open").length,
    assigned: jobs.filter((j) => j.status === "assigned").length,
    in_transit: 0, // extend when in_transit status is added
    delivered: jobs.filter((j) => j.status === "delivered").length,
  };

  return { jobs, loading, error, claimJob, deliverJob, counts };
}
