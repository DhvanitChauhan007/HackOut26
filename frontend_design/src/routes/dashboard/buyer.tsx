import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Leaf,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuthGuard } from "../../lib/auth";
import { apiRequest } from "../../lib/apiClient";
import { supabase } from "../../lib/supabase";

export const Route = createFileRoute("/dashboard/buyer")({
  component: RequestsPage,
});

type TabType = "all" | "requests" | "shipments" | "completed";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; border: string; icon: any }
> = {
  pending: {
    label: "Awaiting Seller",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: Clock,
  },
  accepted: {
    label: "Seller Accepted",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    color: "bg-destructive/15 text-destructive",
    border: "border-destructive/30",
    icon: X,
  },
  estimated: {
    label: "Awaiting Commit",
    color: "bg-highlight/50 text-foreground",
    border: "border-highlight",
    icon: Clock,
  },
  committed: {
    label: "In Transit / Dispatched",
    color: "bg-primary/15 text-primary",
    border: "border-primary/30",
    icon: Truck,
  },
  completed: {
    label: "Delivered & Verified",
    color: "bg-foreground/10 text-foreground",
    border: "border-foreground/20",
    icon: PackageCheck,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "bg-foreground/10 text-foreground",
    border: "border-foreground/20",
    icon: Package,
  };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.color} ${cfg.border}`}
    >
      <Icon className="size-3.5" />
      {cfg.label}
    </span>
  );
}

function RequestsPage() {
  const { loading: authLoading } = useAuthGuard();
  const [requests, setRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<{
    type: "request" | "transaction";
    data: any;
  } | null>(null);
  const [ratingModalItem, setRatingModalItem] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      let reqData: any[] | null = null;
      let trxData: any[] | null = null;

      // 1. First try Express backend API
      try {
        const [reqRes, trxRes] = await Promise.all([
          apiRequest("/api/requests"),
          apiRequest("/api/transactions"),
        ]);
        if (reqRes.ok) {
          const json = await reqRes.json();
          if (Array.isArray(json)) reqData = json;
        }
        if (trxRes.ok) {
          const json = await trxRes.json();
          if (Array.isArray(json)) trxData = json;
        }
      } catch (backendErr) {
        console.warn("Backend API unreachable, falling back to direct Supabase:", backendErr);
      }

      // 2. Direct Supabase fallback if backend returned non-array or failed
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      if (!reqData) {
        try {
          let query = supabase
            .from("requests")
            .select("*, listings(*, users(name, address))")
            .order("created_at", { ascending: false });

          if (currentUserId) {
            query = query.eq("buyer_id", currentUserId);
          }

          const { data, error } = await query;
          if (!error && data) {
            reqData = data;
          }
        } catch (sbErr) {
          console.error("Direct Supabase requests query failed:", sbErr);
        }
      }

      if (!trxData) {
        try {
          let query = supabase
            .from("transactions")
            .select("*, listings(*, users(name, address)), seller:seller_id(name, address), jobs(*, users:logistics_company_id(name))")
            .order("created_at", { ascending: false });

          if (currentUserId) {
            query = query.eq("buyer_id", currentUserId);
          }

          const { data, error } = await query;
          if (!error && data) {
            trxData = data;
          }
        } catch (sbErr) {
          console.error("Direct Supabase transactions query failed:", sbErr);
        }
      }

      setRequests(reqData || []);
      setTransactions(trxData || []);
    } catch (e) {
      console.error("Failed to load requests dashboard data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    fetchData();

    // Realtime subscription for requests & transactions
    const channel = supabase
      .channel("buyer_dashboard_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading]);

  // Derived metrics
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const acceptedRequests = requests.filter((r) => r.status === "accepted");
  const inTransitOrders = transactions.filter(
    (t) => t.status === "committed" || t.status === "estimated"
  );
  const completedOrders = transactions.filter((t) => t.status === "completed");

  const totalDivertedKg = transactions.reduce(
    (acc, t) => acc + (Number(t.impact_kg_diverted) || 0),
    0
  );
  const totalCo2eSaved = transactions.reduce(
    (acc, t) => acc + (Number(t.impact_co2e_kg) || 0),
    0
  );

  // Filtered lists
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch =
        !searchQuery ||
        r.listings?.sub_grade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.listings?.material_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.listings?.users?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [requests, searchQuery]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const title =
        t.listings?.sub_grade || t.bulk_lot_id ? "Bulk Material" : "";
      const matchSearch =
        !searchQuery ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.seller?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.jobs?.[0]?.users?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [transactions, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse text-sm font-medium text-muted-foreground">
          Loading your circular exchange requests...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── 1. Hero Header Banner ── */}
      <section className="relative overflow-hidden rounded-hero bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="absolute -right-12 top-6 size-48 rounded-full border-[28px] border-primary-foreground/10" />
        <div className="absolute -bottom-16 right-36 size-40 rotate-12 rounded-[2rem] border-[20px] border-highlight/20" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-3 py-1 text-xs font-semibold uppercase text-foreground">
              <ShieldCheck className="size-3.5" /> Buyer Operations Hub
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Requests & Exchange Orders
            </h1>
            <p className="mt-2 text-sm text-primary-foreground/80 sm:text-base">
              Track your material reservations, dispatch logistics, and verified landfill diversion impact in real time.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-2.5 text-xs font-semibold text-primary-foreground backdrop-blur-sm transition-all hover:bg-primary-foreground/20"
            >
              <RefreshCw
                className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Sync live status
            </button>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full bg-highlight px-5 py-2.5 font-display text-sm font-semibold text-foreground shadow-button-dark transition-transform hover:-translate-y-0.5"
            >
              <ShoppingBag className="size-4" /> Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Real-time KPI summary inside Hero */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 border-t border-primary-foreground/15 pt-6 sm:grid-cols-4">
          <HeroStat
            label="Pending Approval"
            value={pendingRequests.length}
            sub="Awaiting sellers"
          />
          <HeroStat
            label="Active Shipments"
            value={inTransitOrders.length}
            sub="Carrier en route"
          />
          <HeroStat
            label="Waste Diverted"
            value={`${(totalDivertedKg / 1000).toFixed(1)} t`}
            sub={`${totalDivertedKg.toLocaleString()} kg total`}
          />
          <HeroStat
            label="CO₂e Avoided"
            value={`${(totalCo2eSaved / 1000).toFixed(2)} t`}
            sub="Lifecycle emissions"
          />
        </div>
      </section>

      {/* ── 2. Filter & Navigation Bar ── */}
      <div className="flex flex-col justify-between gap-4 rounded-panel border-2 border-foreground/10 bg-card p-4 sm:flex-row sm:items-center">
        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-1.5">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="All Activity"
            count={requests.length + transactions.length}
          />
          <TabButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            label="Reservations"
            count={requests.length}
          />
          <TabButton
            active={activeTab === "shipments"}
            onClick={() => setActiveTab("shipments")}
            label="In Transit"
            count={inTransitOrders.length}
          />
          <TabButton
            active={activeTab === "completed"}
            onClick={() => setActiveTab("completed")}
            label="Completed"
            count={completedOrders.length}
          />
        </div>

        {/* Search filter */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search material or seller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border-2 border-foreground/10 bg-background py-2 pl-10 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* ── 3. Main Content Sections ── */}

      {/* VIEW: All or Requests tab */}
      {(activeTab === "all" || activeTab === "requests") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-xl font-semibold">
              Material Reservations ({filteredRequests.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              Direct claims sent to verified industrial sellers
            </span>
          </div>

          {filteredRequests.length === 0 ? (
            <EmptyState
              title="No reservations found"
              message={
                searchQuery
                  ? "No reservations match your current search query."
                  : "You haven't reserved any materials yet. Browse available lots in the marketplace to start trading."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onView={() =>
                    setSelectedItem({ type: "request", data: req })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: All or Shipments/Completed tab */}
      {(activeTab === "all" ||
        activeTab === "shipments" ||
        activeTab === "completed") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 pt-2">
            <h2 className="font-display text-xl font-semibold">
              Logistics & Dispatched Orders ({filteredTransactions.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              Shipments with verified carrier waypoints and delivery proof
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              title="No active or completed orders"
              message={
                searchQuery
                  ? "No orders match your current search query."
                  : "Orders appear here once a seller accepts your reservation and the transaction is committed."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTransactions.map((trx) => (
                <TransactionCard
                  key={trx.id}
                  trx={trx}
                  onView={() =>
                    setSelectedItem({ type: "transaction", data: trx })
                  }
                  onRate={() => setRatingModalItem(trx)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 4. Item Detail Inspection Drawer/Modal ── */}
      {selectedItem && (
        <DetailDialog
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRate={() => {
            const t = selectedItem.data;
            setSelectedItem(null);
            setRatingModalItem(t);
          }}
        />
      )}

      {/* ── 5. Star Rating Modal ── */}
      {ratingModalItem && (
        <RatingDialog
          trx={ratingModalItem}
          onClose={() => setRatingModalItem(null)}
          onSuccess={() => {
            setRatingModalItem(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/70">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-primary-foreground/60">{sub}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          active ? "bg-background/20 text-background" : "bg-foreground/10 text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function RequestCard({ req, onView }: { req: any; onView: () => void }) {
  const listing = req.listings;
  const seller = listing?.users;

  return (
    <article className="flex flex-col justify-between rounded-card border-2 border-foreground/10 bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md">
      <div>
        {/* Header: Material badge + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {listing?.material_type || "Recyclable"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Req #{req.id.slice(0, 6)}
            </span>
          </div>
          <StatusBadge status={req.status} />
        </div>

        {/* Title & Seller */}
        <div className="mt-3 flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5">
            <img
              src={listing?.photo_url || "/images/cardboard-bales.jpg"}
              alt="Material preview"
              className="size-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold leading-tight">
              {listing?.sub_grade || "Industrial Lot"}
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Seller: <strong className="text-foreground">{seller?.name || "Verified Partner"}</strong>
            </p>
            {seller?.address && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3 shrink-0" /> {seller.address}
              </p>
            )}
          </div>
        </div>

        {/* Metric pills */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-secondary/50 p-2.5 text-center text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Quantity</p>
            <p className="mt-0.5 font-semibold">
              {listing?.quantity} {listing?.unit}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Price/unit</p>
            <p className="mt-0.5 font-semibold">
              ₹{Number(listing?.list_price || 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Estimated Total</p>
            <p className="mt-0.5 font-semibold text-primary">
              ₹{(Number(listing?.list_price || 0) * Number(listing?.quantity || 1)).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-dashed border-foreground/10 pt-3 text-xs">
        <span className="text-muted-foreground text-[11px]">
          Requested {new Date(req.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={onView}
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <Eye className="size-3.5" /> View Details
        </button>
      </div>
    </article>
  );
}

function TransactionCard({
  trx,
  onView,
  onRate,
}: {
  trx: any;
  onView: () => void;
  onRate: () => void;
}) {
  const listing = trx.listings;
  const seller = trx.seller || listing?.users;
  const job = trx.jobs?.[0];
  const isCompleted = trx.status === "completed";

  return (
    <article className="flex flex-col justify-between rounded-card border-2 border-foreground/10 bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/25 px-3 py-1 text-xs font-semibold text-accent-foreground">
              {trx.bulk_lot_id ? "Bulk Pool" : listing?.material_type || "Exchange"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Order #{trx.id.slice(0, 6)}
            </span>
          </div>
          <StatusBadge status={trx.status} />
        </div>

        {/* Title and Logistics Partner */}
        <div className="mt-3">
          <h3 className="font-display text-lg font-semibold leading-tight">
            {trx.bulk_lot_id
              ? "Aggregated Bulk Pool Order"
              : `${listing?.sub_grade || "Industrial Lot"} ${listing?.material_type || ""}`}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Partner:{" "}
              <strong className="text-foreground">
                {seller?.name || "Multi-Seller Network"}
              </strong>
            </span>
            {job?.users?.name && (
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <Truck className="size-3" /> Carrier: {job.users.name}
              </span>
            )}
          </div>
        </div>

        {/* Route / Location pill */}
        <div className="mt-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="size-3 text-primary" />
              {job?.pickup_location || "Seller Depot"}
            </span>
            <span>→</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              {job?.dropoff_location || "Buyer Facility"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-foreground/5 pt-2 text-[11px] text-muted-foreground">
            <span>Distance: <strong>{trx.distance_km || job?.distance_km || 15} km</strong></span>
            {trx.duration_min && <span>ETA: <strong>~{trx.duration_min} mins</strong></span>}
            <span>Freight: <strong>₹{Number(trx.estimated_cost || 0).toFixed(0)}</strong></span>
          </div>
        </div>

        {/* Eco impact badge */}
        {trx.impact_kg_diverted && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Leaf className="size-3.5 shrink-0" />
            <span>
              {trx.impact_kg_diverted} kg diverted · {trx.impact_co2e_kg ? `${Number(trx.impact_co2e_kg).toFixed(1)} kg CO₂e saved` : "Zero landfill"}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-dashed border-foreground/10 pt-3 text-xs">
        <span className="text-muted-foreground text-[11px]">
          {new Date(trx.created_at).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-3">
          {isCompleted && (
            <button
              onClick={onRate}
              className="inline-flex items-center gap-1 rounded-full bg-highlight/60 px-3 py-1 font-semibold text-foreground hover:bg-highlight"
            >
              <Star className="size-3 text-amber-500" /> Rate Partner
            </button>
          )}
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <Eye className="size-3.5" /> Order Details
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-panel border-2 border-dashed border-foreground/15 bg-card/60 p-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-foreground/5 text-muted-foreground">
        <Box className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {message}
      </p>
      <Link
        to="/marketplace"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-button transition-transform hover:-translate-y-0.5"
      >
        <ShoppingBag className="size-3.5" /> Go to Marketplace <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function DetailDialog({
  item,
  onClose,
  onRate,
}: {
  item: { type: "request" | "transaction"; data: any };
  onClose: () => void;
  onRate: () => void;
}) {
  const d = item.data;
  const isTrx = item.type === "transaction";
  const listing = isTrx ? d.listings : d.listings;
  const seller = isTrx ? d.seller || listing?.users : listing?.users;
  const job = isTrx ? d.jobs?.[0] : null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-panel border-2 border-foreground/10 bg-card p-6 shadow-panel animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {isTrx ? "Exchange Order" : "Claim Reservation"}
              </span>
              <StatusBadge status={d.status} />
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              {listing?.sub_grade || (isTrx && d.bulk_lot_id ? "Bulk Material Lot" : "Material Lot")}
            </h2>
            <p className="text-xs text-muted-foreground">
              Reference ID: <span className="font-mono">{d.id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-foreground/5 hover:bg-foreground/10"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Timeline tracker */}
        <div className="mt-6 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Progress Tracking
          </p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <TimelineStep
              label="Reserved"
              done={true}
              date={new Date(d.created_at).toLocaleDateString()}
            />
            <div className="h-0.5 flex-1 bg-foreground/15" />
            <TimelineStep
              label="Accepted"
              done={d.status !== "pending" && d.status !== "declined"}
            />
            <div className="h-0.5 flex-1 bg-foreground/15" />
            <TimelineStep
              label="Dispatched"
              done={d.status === "committed" || d.status === "completed"}
            />
            <div className="h-0.5 flex-1 bg-foreground/15" />
            <TimelineStep label="Delivered" done={d.status === "completed"} />
          </div>
        </div>

        {/* Partner Info */}
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-foreground/10 p-3.5 text-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Seller Partner
            </p>
            <p className="mt-1 font-display text-base font-semibold">
              {seller?.name || "Verified Network Seller"}
            </p>
            {seller?.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="size-3" /> {seller.address}
              </p>
            )}
          </div>

          {/* Logistics Carrier (if transaction) */}
          {isTrx && (
            <div className="rounded-xl border border-foreground/10 p-3.5 text-xs">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Logistics Carrier
              </p>
              <p className="mt-1 font-display text-base font-semibold text-primary">
                {job?.users?.name || "Carrier Dispatch in Progress"}
              </p>
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>Route: {job?.pickup_location || "Origin"} → {job?.dropoff_location || "Destination"}</span>
                {job?.duration_min && <span>ETA: ~{job.duration_min} mins</span>}
              </div>
            </div>
          )}

          {/* Eco stats */}
          {(d.impact_kg_diverted || listing?.quantity) && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-primary/10 p-3 text-xs">
              <div>
                <p className="text-[10px] text-primary">Material Diverted</p>
                <p className="font-display text-lg font-semibold text-primary">
                  {d.impact_kg_diverted || listing?.quantity} kg
                </p>
              </div>
              <div>
                <p className="text-[10px] text-primary">Estimated CO₂e Saved</p>
                <p className="font-display text-lg font-semibold text-primary">
                  {d.impact_co2e_kg ? `${d.impact_co2e_kg} kg` : "3.12 t equivalent"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {isTrx && d.status === "completed" && (
            <button
              onClick={onRate}
              className="flex-1 rounded-full bg-accent py-2.5 text-xs font-semibold text-accent-foreground shadow-button-accent"
            >
              ★ Rate Partner Experience
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-foreground py-2.5 text-xs font-semibold text-background"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({
  label,
  done,
  date,
}: {
  label: string;
  done: boolean;
  date?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${
          done ? "bg-primary text-primary-foreground" : "bg-foreground/15 text-muted-foreground"
        }`}
      >
        {done ? <Check className="size-3.5" /> : "·"}
      </div>
      <span className="mt-1 text-[11px] font-medium">{label}</span>
      {date && <span className="text-[9px] text-muted-foreground">{date}</span>}
    </div>
  );
}

function RatingDialog({
  trx,
  onClose,
  onSuccess,
}: {
  trx: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest(`/api/transactions/${trx.id}/ratings`, {
        method: "POST",
        body: JSON.stringify({
          ratee_id: trx.seller_id || trx.listings?.seller_id,
          rating,
          comment,
        }),
      });
      if (res.ok) {
        alert("Thank you! Your feedback helps build trust in the circular network.");
        onSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to submit rating.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-panel border-2 border-foreground/10 bg-card p-6 shadow-panel animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Rate Experience</h3>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-foreground/5"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Leave a verified review for{" "}
          <strong className="text-foreground">
            {trx.seller?.name || trx.listings?.users?.name || "Seller"}
          </strong>
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Rating
            </label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`grid size-10 place-items-center rounded-xl border text-base transition-all ${
                    star <= rating
                      ? "border-amber-500 bg-amber-500/15 text-amber-500"
                      : "border-foreground/10 text-muted-foreground hover:bg-foreground/5"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Review Comment
            </label>
            <textarea
              required
              rows={3}
              placeholder="Material quality, accurate volume, prompt handover..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border-2 border-foreground/10 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-button hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
