import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Box, Check, Clock, PackageCheck, ShoppingBag, Truck, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthGuard } from "../../lib/auth";
import { apiRequest } from "../../lib/apiClient";

export const Route = createFileRoute("/dashboard/buyer")({
  component: RequestsPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Awaiting seller",  color: "bg-warning/40 text-warning-foreground" },
  accepted:  { label: "Accepted",         color: "bg-accent text-accent-foreground" },
  declined:  { label: "Declined",         color: "bg-destructive/15 text-destructive" },
  committed: { label: "In transit",       color: "bg-primary/15 text-primary" },
  completed: { label: "Completed",        color: "bg-foreground/10 text-foreground" },
  estimated: { label: "Awaiting commit",  color: "bg-highlight/50 text-foreground" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-foreground/10" };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

function RequestsPage() {
  const { loading: authLoading } = useAuthGuard();
  const [requests, setRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "orders">("requests");

  const fetchData = async () => {
    try {
      const [reqRes, trxRes] = await Promise.all([
        apiRequest("/api/requests"),
        apiRequest("/api/transactions"),
      ]);
      setRequests((await reqRes.json()) || []);
      setTransactions((await trxRes.json()) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading your requests...</p>
      </div>
    );
  }

  const pendingRequests  = requests.filter((r) => r.status === "pending");
  const acceptedRequests = requests.filter((r) => r.status === "accepted");
  const declinedRequests = requests.filter((r) => r.status === "declined");
  const activeOrders     = transactions.filter((t) => t.status !== "completed");
  const completedOrders  = transactions.filter((t) => t.status === "completed");

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Your activity</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Requests</h1>
        </div>
        <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-button-accent">
          <ShoppingBag className="size-4" /> Browse listings
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Clock className="size-5" />} value={pendingRequests.length} label="Pending" color="bg-warning/15" />
        <StatCard icon={<Check className="size-5" />} value={acceptedRequests.length} label="Accepted" color="bg-accent/20" />
        <StatCard icon={<Truck className="size-5" />} value={activeOrders.length} label="Active orders" color="bg-primary/10" />
        <StatCard icon={<PackageCheck className="size-5" />} value={completedOrders.length} label="Completed" color="bg-foreground/8" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-foreground/10 pb-0">
        <TabBtn active={activeTab === "requests"} onClick={() => setActiveTab("requests")}>
          Requests {requests.length > 0 && <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px]">{requests.length}</span>}
        </TabBtn>
        <TabBtn active={activeTab === "orders"} onClick={() => setActiveTab("orders")}>
          Orders {transactions.length > 0 && <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px]">{transactions.length}</span>}
        </TabBtn>
      </div>

      {/* Requests tab */}
      {activeTab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <Empty message="You haven't reserved any listings yet." cta="Browse Marketplace" to="/marketplace" />
          )}

          {/* Pending */}
          {pendingRequests.length > 0 && (
            <Group title="Awaiting seller response">
              {pendingRequests.map((req) => (
                <RequestRow key={req.id} req={req} />
              ))}
            </Group>
          )}

          {/* Accepted */}
          {acceptedRequests.length > 0 && (
            <Group title="Accepted — payment & pickup arranged">
              {acceptedRequests.map((req) => (
                <RequestRow key={req.id} req={req} />
              ))}
            </Group>
          )}

          {/* Declined */}
          {declinedRequests.length > 0 && (
            <Group title="Declined">
              {declinedRequests.map((req) => (
                <RequestRow key={req.id} req={req} />
              ))}
            </Group>
          )}
        </div>
      )}

      {/* Orders tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {transactions.length === 0 && (
            <Empty message="No orders yet. Reserve a listing to get started." cta="Go to Marketplace" to="/marketplace" />
          )}

          {activeOrders.length > 0 && (
            <Group title="Active orders">
              {activeOrders.map((trx) => (
                <OrderRow key={trx.id} trx={trx} />
              ))}
            </Group>
          )}

          {completedOrders.length > 0 && (
            <Group title="Completed orders">
              {completedOrders.map((trx) => (
                <OrderRow key={trx.id} trx={trx} />
              ))}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-4 ${color}`}>
      <span className="opacity-60">{icon}</span>
      <div>
        <p className="font-display text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`-mb-0.5 border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="divide-y-2 divide-dashed divide-foreground/8 rounded-panel border-2 border-foreground/10 bg-card">
        {children}
      </div>
    </div>
  );
}

function RequestRow({ req }: { req: any }) {
  const listing = req.listings;
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Box className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{listing?.sub_grade} {listing?.material_type}</p>
        <p className="text-xs text-muted-foreground">{listing?.quantity} {listing?.unit} · ₹{Number(listing?.list_price).toFixed(2)}/kg</p>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={req.status} />
        <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function OrderRow({ trx }: { trx: any }) {
  const listing = trx.listings;
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent/20">
        <Truck className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{listing?.sub_grade || "Bulk Lot"} {listing?.material_type || ""}</p>
        <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
          {trx.distance_km && <span>{trx.distance_km} km</span>}
          {trx.duration_min && <span>~{trx.duration_min} min ETA</span>}
          {trx.estimated_cost && <span>₹{Number(trx.estimated_cost).toFixed(0)} est. logistics</span>}
          {trx.impact_kg_diverted && <span>{trx.impact_kg_diverted} kg diverted</span>}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={trx.status} />
        <p className="text-[10px] text-muted-foreground">{new Date(trx.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function Empty({ message, cta, to }: { message: string; cta: string; to: string }) {
  return (
    <div className="rounded-panel border-2 border-dashed border-foreground/15 p-10 text-center">
      <Box className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-muted-foreground">{message}</p>
      <Link to={to} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
        {cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
