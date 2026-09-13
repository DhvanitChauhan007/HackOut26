import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthGuard } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import {
  User,
  MapPin,
  Shield,
  Package,
  Truck,
  ShoppingBag,
  Star,
  Leaf,
  Calendar,
  CheckCircle2,
  Clock,
  ToggleRight,
  BadgeCheck,
  Recycle,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/profile/")({
  component: ProfilePage,
});

type UserProfile = {
  id: string;
  name: string;
  role: string;
  address: string | null;
  lat: number | null;
  long: number | null;
  is_fixed_recycler: boolean;
  is_seed: boolean;
  auto_accept: boolean;
  created_at: string;
};

type Stats = {
  listingsCount: number;
  requestsCount: number;
  transactionsCount: number;
  totalKgDiverted: number;
  totalCo2eKg: number;
  avgRating: number | null;
  ratingsCount: number;
  jobsCount: number;
};

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  manufacturer: {
    label: "Manufacturer",
    color: "bg-primary/10 text-primary",
    icon: <Package className="size-4" />,
    description: "Lists industrial scrap materials for buyers and recyclers.",
  },
  retailer: {
    label: "Retailer",
    color: "bg-highlight/30 text-foreground",
    icon: <ShoppingBag className="size-4" />,
    description: "Sources secondary packaging materials from verified sellers.",
  },
  recycler: {
    label: "Recycler",
    color: "bg-accent/20 text-accent-foreground",
    icon: <Recycle className="size-4" />,
    description: "Processes and recycles materials from the circular network.",
  },
  logistics: {
    label: "Logistics",
    color: "bg-warning/20 text-foreground",
    icon: <Truck className="size-4" />,
    description: "Picks up and delivers materials across the logistics network.",
  },
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-foreground/8 py-3 first:border-0">
      <span className="text-xs font-semibold uppercase text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { session, loading: authLoading } = useAuthGuard();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;

    const uid = session.user.id;
    setEmail(session.user.email ?? null);

    const load = async () => {
      // Fetch profile
      const { data: userRow } = await supabase
        .from("users")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      setProfile(userRow ?? null);

      // Fetch stats in parallel
      const [
        { count: listingsCount },
        { count: requestsCount },
        { data: txRows },
        { data: ratingRows },
        { count: jobsCount },
      ] = await Promise.all([
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", uid),
        supabase.from("requests").select("*", { count: "exact", head: true }).eq("buyer_id", uid),
        supabase
          .from("transactions")
          .select("impact_kg_diverted, impact_co2e_kg")
          .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
        supabase.from("ratings").select("rating").eq("ratee_id", uid),
        supabase.from("jobs").select("*", { count: "exact", head: true }).eq("logistics_company_id", uid),
      ]);

      const totalKgDiverted = (txRows ?? []).reduce((s, r) => s + Number(r.impact_kg_diverted ?? 0), 0);
      const totalCo2eKg = (txRows ?? []).reduce((s, r) => s + Number(r.impact_co2e_kg ?? 0), 0);
      const avgRating =
        ratingRows && ratingRows.length > 0
          ? ratingRows.reduce((s, r) => s + r.rating, 0) / ratingRows.length
          : null;

      setStats({
        listingsCount: listingsCount ?? 0,
        requestsCount: requestsCount ?? 0,
        transactionsCount: txRows?.length ?? 0,
        totalKgDiverted,
        totalCo2eKg,
        avgRating,
        ratingsCount: ratingRows?.length ?? 0,
        jobsCount: jobsCount ?? 0,
      });

      setLoading(false);
    };

    load();
  }, [session]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <User className="size-10 text-muted-foreground" />
        <p className="font-display text-xl font-semibold">Profile not found</p>
        <p className="text-sm text-muted-foreground">Your account details could not be loaded.</p>
      </div>
    );
  }

  const roleMeta = ROLE_META[profile.role] ?? {
    label: profile.role,
    color: "bg-foreground/10 text-foreground",
    icon: <User className="size-4" />,
    description: "",
  };

  const joinDate = new Date(profile.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isLogistics = profile.role === "logistics";
  const isSeller = ["manufacturer", "retailer", "recycler"].includes(profile.role);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-panel bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground shadow-panel sm:p-8">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Avatar */}
          <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary-foreground/20 text-3xl font-bold font-display">
            {profile.name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">{profile.name}</h1>
              {profile.is_seed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-highlight/40 px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                  <BadgeCheck className="size-3" /> Verified Seed
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-primary-foreground/70">{email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-primary-foreground/15`}>
                {roleMeta.icon} {roleMeta.label}
              </span>
              {profile.address && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                  <MapPin className="size-3" /> {profile.address}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
                <Calendar className="size-3" /> Joined {joinDate}
              </span>
            </div>
          </div>
        </div>
      </div>



      {/* Stats Grid */}
      {stats && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Activity Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {isSeller && (
              <StatCard
                icon={<Package className="size-4" />}
                label="Listings"
                value={stats.listingsCount}
                sub="Materials listed"
              />
            )}
            {!isLogistics && (
              <StatCard
                icon={<ShoppingBag className="size-4" />}
                label="Requests"
                value={stats.requestsCount}
                sub="Buy requests sent"
              />
            )}
            <StatCard
              icon={<CheckCircle2 className="size-4" />}
              label="Transactions"
              value={stats.transactionsCount}
              sub="Completed deals"
            />
            {isLogistics && (
              <StatCard
                icon={<Truck className="size-4" />}
                label="Jobs"
                value={stats.jobsCount}
                sub="Deliveries made"
              />
            )}
            <StatCard
              icon={<Leaf className="size-4" />}
              label="Diverted"
              value={`${(stats.totalKgDiverted / 1000).toFixed(1)} t`}
              sub="From landfill"
            />
            <StatCard
              icon={<Leaf className="size-4" />}
              label="CO₂e Saved"
              value={`${(stats.totalCo2eKg / 1000).toFixed(2)} t`}
              sub="Emissions avoided"
            />
            <StatCard
              icon={<Star className="size-4" />}
              label="Rating"
              value={stats.avgRating !== null ? `${stats.avgRating.toFixed(1)} ★` : "—"}
              sub={stats.ratingsCount > 0 ? `${stats.ratingsCount} reviews` : "No reviews yet"}
            />
          </div>
        </div>
      )}

      {/* Account Details */}
      <div className="rounded-panel border-2 border-foreground/10 bg-card p-5 sm:p-6">
        <h2 className="mb-1 font-display text-lg font-semibold">Account Details</h2>
        <div className="mt-3">
          <InfoRow label="Full Name" value={profile.name} />
          <InfoRow label="Email" value={email ?? "—"} />
          <InfoRow label="Role" value={
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleMeta.color}`}>
              {roleMeta.icon} {roleMeta.label}
            </span>
          } />
          <InfoRow label="Address" value={profile.address ?? <span className="text-muted-foreground">Not set</span>} />
          {profile.lat && profile.long && (
            <InfoRow
              label="Coordinates"
              value={
                <span className="font-mono text-xs">
                  {profile.lat.toFixed(4)}, {profile.long.toFixed(4)}
                </span>
              }
            />
          )}
          <InfoRow label="Member Since" value={joinDate} />
          <InfoRow label="User ID" value={<span className="font-mono text-[11px] text-muted-foreground">{profile.id}</span>} />
        </div>
      </div>
    </div>
  );
}
