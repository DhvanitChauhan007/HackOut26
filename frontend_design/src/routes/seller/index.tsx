import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createListing, updateRequest, getListings, getJobs } from "../../lib/api";
import { BrowseView, MiniStat } from "../../components/views/BrowseView";
import { PageTitle } from "../../components/PageTitle";
import { computeCurrentPrice, decayFraction, getFallbackTiming } from "../../services/priceDecay";
import {
  ArrowUpRight,
  Box,
  Check,
  Clock3,
  Factory,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Recycle,
  RefreshCw,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";

export const Route = createFileRoute("/seller/")({
  component: SellerPortal,
});

// Roles that map to "seller" in the data model
const SELLER_ROLES = ["manufacturer", "retailer"];

type Tab = "hub" | "marketplace" | "bulk-lots" | "earnings";

const TABS: { id: Tab; label: string }[] = [
  { id: "hub", label: "Seller Hub" },
  { id: "marketplace", label: "Marketplace" },
  { id: "bulk-lots", label: "Bulk Lots" },
  { id: "earnings", label: "Earnings" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seller-specific navbar — 3 items only, matches existing header styling
// ─────────────────────────────────────────────────────────────────────────────
function SellerNavbar({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    navigate({ to: "/" });
    setTimeout(() => {
      supabase.auth.signOut();
    }, 50);
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="ReRoute"
            className="h-10 w-auto mix-blend-multiply"
          />
        </Link>

        {/* Desktop nav — 3 seller tabs */}
        <nav
          className="hidden items-center rounded-xl border-2 border-foreground/10 bg-card p-1 text-sm font-semibold md:flex"
          aria-label="Seller navigation"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`rounded-lg px-5 py-2 transition-colors ${
                tab === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Log out"
            onClick={handleLogout}
            title="Log out"
            className="grid size-9 place-items-center rounded-full bg-destructive/15 text-destructive transition-all duration-300 hover:-translate-y-0.5 hover:bg-destructive hover:text-white"
          >
            <LogOut className="size-4" />
          </button>

          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-full bg-foreground text-background md:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile nav — same 3 tabs */}
      {mobileOpen && (
        <nav
          className="border-t border-foreground/10 px-4 py-3 md:hidden"
          aria-label="Seller navigation"
        >
          <div className="grid grid-cols-3 gap-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  onTabChange(id);
                  setMobileOpen(false);
                }}
                className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  tab === id
                    ? "bg-foreground text-background"
                    : "bg-card"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}

    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root portal — role guard + layout shell
// ─────────────────────────────────────────────────────────────────────────────
function SellerPortal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("hub");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/auth", search: { next: "/seller" } });
        return;
      }
      const role = session.user.user_metadata?.["role"] as string | undefined;
      if (!role || !SELLER_ROLES.includes(role)) {
        navigate({ to: "/auth", search: { next: "/seller" } });
        return;
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SellerNavbar tab={tab} onTabChange={setTab} />
      <main className="mx-auto max-w-[1240px] space-y-7 px-4 py-6 sm:px-5 sm:py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Marketplace: renders BrowseView unchanged.
              When the buyer branch merges and BrowseView switches to real API data,
              this tab automatically reflects those changes — no edits needed here. */}
          {tab === "marketplace" && <BrowseView readOnly={true} />}
          {tab === "bulk-lots" && <BulkLotsView />}
          {tab === "hub" && <SellerHub />}
          {tab === "earnings" && <EarningsView />}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Lots — read-only awareness view for sellers (source file not touched)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Earnings — total revenue from sold listings + job list
// ─────────────────────────────────────────────────────────────────────────────
type EarningJob = {
  id: string;
  material_type: string;
  quantity: number;
  unit: string;
  list_price: number;
  status: string;
  created_at: string;
};

function EarningsView() {
  const [jobs, setJobs] = useState<EarningJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Real API: fetch seller's sold listings
        const data = await getListings({ status: "sold" });
        setJobs(Array.isArray(data) ? data : data?.listings ?? []);
      } catch {
        // Demo fallback: read from localStorage
        try {
          const local: EarningJob[] = JSON.parse(
            localStorage.getItem("seller_listings") ?? "[]"
          );
          setJobs(local);
        } catch {
          setJobs([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalEarnings = jobs.reduce(
    (sum, j) => sum + (j.list_price ?? 0) * (j.quantity ?? 0),
    0
  );
  const avgPerJob = jobs.length ? totalEarnings / jobs.length : 0;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <PageTitle
        icon={<TrendingUp />}
        eyebrow="Revenue overview"
        title="Your earnings"
        copy="A running total of every completed sale from your listings."
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total earnings</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {loading ? "—" : `₹${totalEarnings.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Jobs completed</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {loading ? "—" : jobs.length}
          </p>
        </div>
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Avg. per job</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {loading ? "—" : `₹${avgPerJob.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </p>
        </div>
      </div>

      {/* Job list */}
      <div className="rounded-panel border-2 border-foreground/10 bg-card">
        <div className="border-b-2 border-foreground/10 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Completed listings</h2>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No completed sales yet. Post a listing to get started.
          </p>
        )}

        {!loading && jobs.length > 0 && (
          <ul className="divide-y-2 divide-foreground/6">
            {jobs.map((job, i) => {
              const jobEarning = (job.list_price ?? 0) * (job.quantity ?? 0);
              return (
                <li key={job.id ?? i} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-semibold capitalize">
                      {job.material_type?.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {job.quantity} {job.unit} · {job.id}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold">
                      ₹{jobEarning.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                      {job.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function BulkLotsView() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle
        icon={<Box />}
        eyebrow="Stale-stock recovery"
        title="Bulk material pools"
        copy="Nearby near-floor listings combine automatically into purchasable lots."
      />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-panel border-2 border-warning bg-warning/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                OPEN FOR PURCHASE
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold">
                Reusable timber pallet pool
              </h2>
              <p className="mt-1 text-muted-foreground">
                BL-009 · 4 sellers · 3 pickup stops
              </p>
            </div>
            <p className="font-display text-3xl font-semibold">
              ₹8.40<span className="text-base">/kg</span>
            </p>
          </div>
          <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total weight" value="3,280 kg" />
            <MiniStat label="Pickup radius" value="18 km" />
            <MiniStat label="Saved vs new" value="₹42,800" />
            <MiniStat label="CO₂e benefit" value="2.4 t" />
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-primary" />
            <span className="h-0.5 flex-1 bg-foreground/15" />
            <span className="size-3 rounded-full bg-primary" />
            <span className="h-0.5 flex-1 bg-foreground/15" />
            <span className="size-3 rounded-full bg-primary" />
            <span className="h-0.5 flex-1 bg-foreground/15" />
            <span className="size-3 rounded-full bg-accent" />
          </div>
        </div>
        <div className="rounded-panel bg-foreground p-6 text-background">
          <Recycle className="size-8 text-highlight" />
          <h3 className="mt-4 font-display text-2xl font-semibold">
            Whichever resolves first wins.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-background/65">
            Each item keeps its recycler fallback clock while pooled. If the
            bulk lot sells first, a multi-stop job is created. If an item hits
            its deadline first, it exits the pool automatically.
          </p>
          <div className="mt-6 rounded-2xl bg-background/10 p-4">
            <p className="text-xs uppercase text-background/55">Forming pool</p>
            <p className="mt-1 font-semibold">rPET flakes · 2 of 4 lots</p>
            <div className="mt-3 h-2 rounded-full bg-background/10">
              <div className="h-full w-1/2 rounded-full bg-highlight" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller Hub — owned by seller feature: post listings + manage requests
// ─────────────────────────────────────────────────────────────────────────────
const INPUT =
  "block w-full rounded-xl border-2 border-foreground/10 bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const LABEL =
  "block text-xs font-semibold uppercase text-muted-foreground mb-1.5";

type RequestStatus = "Pending" | "Accepted" | "Declined";

const BLANK_FORM = {
  material_type: "cardboard",
  sub_grade: "",
  contamination_pct: "",
  quantity: "",
  unit: "kg",
  condition: "",
  photo_url: "",
  list_price: "",
  price_floor: "",
};

function SellerHub() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  // User & Address pre-filled from signed-in user's metadata
  const [sellerId, setSellerId] = useState<string>("");
  const [sellerAddress, setSellerAddress] = useState<string>("");

  // Dynamic listings state
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Store incoming requests mapped strictly by listing_id: { [listingId]: RequestItem[] }
  const [requestsByListing, setRequestsByListing] = useState<Record<string, any[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("seller_requests_by_listing") ?? "{}");
      } catch {
        return {};
      }
    }
    return {};
  });
  const [submittingReqId, setSubmittingReqId] = useState<string | null>(null);

  // Fetch listings and their requests from Supabase & local storage
  const loadSellerData = async (userId?: string) => {
    const uid = userId || sellerId;
    setLoadingListings(true);
    try {
      let dbItems: any[] = [];
      if (uid) {
        const { data, error } = await supabase
          .from("listings")
          .select("*, requests(*, buyer:users(*))")
          .eq("seller_id", uid)
          .order("created_at", { ascending: false });
        if (!error && data) {
          dbItems = data;
        }
      }

      const localItems: any[] = JSON.parse(
        localStorage.getItem("seller_listings") ?? "[]"
      );

      // Deduplicate and self-heal: sync any valid unmigrated RL- local items to Supabase
      const cleanedLocalItems: any[] = [];
      for (const loc of localItems) {
        if (loc.id && String(loc.id).startsWith("RL-")) {
          // Check if an equivalent record is already present in dbItems
          const alreadyInDb = dbItems.some(
            (db) =>
              (db.condition && loc.condition && db.condition.includes(loc.condition.split(" (Pickup:")[0])) ||
              (db.material_type === loc.material_type && Number(db.quantity) === Number(loc.quantity))
          );
          if (alreadyInDb) {
            // Already synced to Supabase; purge obsolete mock entry
            continue;
          }

          // If not in DB yet and user is authenticated, auto-sync to Supabase
          if (uid) {
            try {
              const { pickup_address, id, requests, ...dbPayload } = loc;
              const cond = pickup_address
                ? (dbPayload.condition ? `${dbPayload.condition} | Pickup: ${pickup_address}` : `Pickup: ${pickup_address}`)
                : dbPayload.condition;
              const { data: uploaded, error: upErr } = await supabase
                .from("listings")
                .insert({
                  ...dbPayload,
                  condition: cond,
                  seller_id: uid,
                  status: "open",
                })
                .select()
                .single();
              if (!upErr && uploaded) {
                dbItems.push(uploaded);
                cleanedLocalItems.push(uploaded);
                continue;
              }
            } catch {
              // keep local if network fails
            }
          }
        }
        cleanedLocalItems.push(loc);
      }

      try {
        localStorage.setItem("seller_listings", JSON.stringify(cleanedLocalItems));
      } catch {}

      const merged = [...dbItems];
      for (const loc of cleanedLocalItems) {
        if (!merged.some((m) => m.id === loc.id)) {
          merged.push(loc);
        }
      }
      setMyListings(merged);

      // Collect all requests per listing
      const reqMap: Record<string, any[]> = {};

      // 1. From database joined requests
      for (const item of merged) {
        if (item.requests && Array.isArray(item.requests) && item.requests.length > 0) {
          reqMap[item.id] = item.requests;
        }
      }

      // 2. Query requests table directly for all listing IDs to catch requests created by buyer branch
      const allIds = merged.map((m) => m.id).filter(Boolean);
      if (allIds.length > 0) {
        const { data: directReqs, error: dirErr } = await supabase
          .from("requests")
          .select("*, buyer:users(*)")
          .in("listing_id", allIds);

        if (!dirErr && directReqs && directReqs.length > 0) {
          for (const req of directReqs) {
            const lid = req.listing_id;
            if (!reqMap[lid]) reqMap[lid] = [];
            if (!reqMap[lid].some((r: any) => r.id === req.id)) {
              reqMap[lid].push(req);
            }
          }
        }
      }

      // 3. Merge local cached requests
      const savedLocalReqs: Record<string, any[]> = JSON.parse(
        localStorage.getItem("seller_requests_by_listing") ?? "{}"
      );
      for (const [lid, reqs] of Object.entries(savedLocalReqs)) {
        if (!reqMap[lid]) reqMap[lid] = [];
        for (const r of reqs as any[]) {
          if (!reqMap[lid].some((existing: any) => existing.id === r.id)) {
            reqMap[lid].push(r);
          }
        }
      }

      // 4. Bind seed demo request ONLY to RL-1048 if present, never to new listings
      if (merged.some((m) => m.id === "RL-1048") || merged.length === 0) {
        const savedDemoStatus = localStorage.getItem("demo_rl1048_req_status") || "pending";
        if (!reqMap["RL-1048"] || reqMap["RL-1048"].length === 0) {
          reqMap["RL-1048"] = [
            {
              id: "req-1048",
              listing_id: "RL-1048",
              buyer_name: "EcoForm Packaging",
              buyer_rating: "★ 4.9",
              quantity: 1400,
              unit: "kg",
              freight_estimate: 2850,
              status: savedDemoStatus,
            },
          ];
        }
      }

      setRequestsByListing(reqMap);
      localStorage.setItem("seller_requests_by_listing", JSON.stringify(reqMap));
    } catch (err) {
      console.warn("Could not query listings from Supabase, using local state:", err);
      const localItems: any[] = JSON.parse(
        localStorage.getItem("seller_listings") ?? "[]"
      );
      setMyListings(localItems);
    } finally {
      setLoadingListings(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (uid) {
        setSellerId(uid);
        loadSellerData(uid);
      } else {
        loadSellerData();
      }
      const addr = session?.user?.user_metadata?.["address"] as string | undefined;
      if (addr) setSellerAddress(addr);
    });

    // Auto-poll requests every 12 seconds so reservations sent by buyer branch appear dynamically
    const timer = setInterval(() => {
      loadSellerData();
    }, 12000);
    return () => clearInterval(timer);
  }, [sellerId]);

  function handleField(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || sellerId;

    const payload = {
      ...form,
      contamination_pct: Number(form.contamination_pct),
      quantity: Number(form.quantity),
      list_price: Number(form.list_price),
      price_floor: Number(form.price_floor),
      pickup_address: sellerAddress || undefined,
      pickup_lat: 12.9716,
      pickup_long: 77.5946,
      decay_window_seconds: 86400,
      status: "open",
    };

    let createdRecord: any = null;
    let pushDestination = "";

    // 1. Try server API
    try {
      createdRecord = await createListing(payload);
      pushDestination = "database API";
    } catch (apiErr) {
      console.warn("POST /api/listings failed, falling back to direct Supabase client:", apiErr);
      // 2. Direct Supabase insert
      try {
        const { pickup_address, ...dbPayload } = payload;
        const conditionWithAddress = pickup_address
          ? (dbPayload.condition ? `${dbPayload.condition} | Pickup: ${pickup_address}` : `Pickup: ${pickup_address}`)
          : dbPayload.condition;

        const { data, error } = await supabase
          .from("listings")
          .insert({
            ...dbPayload,
            condition: conditionWithAddress,
            seller_id: uid,
          })
          .select()
          .single();

        if (error) throw error;
        createdRecord = data;
        pushDestination = "Supabase database";
      } catch (sbErr) {
        console.warn("Direct Supabase insert failed, saving to local cache:", sbErr);
        // 3. Fallback demo record
        createdRecord = {
          ...payload,
          id: `RL-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        pushDestination = "local demo workspace";
      }
    }

    if (createdRecord) {
      try {
        const existing: any[] = JSON.parse(
          localStorage.getItem("seller_listings") ?? "[]"
        );
        localStorage.setItem(
          "seller_listings",
          JSON.stringify([createdRecord, ...existing.filter((l: any) => l.id !== createdRecord.id)])
        );
        setMyListings((prev) => [createdRecord, ...prev.filter((l) => l.id !== createdRecord.id)]);
        setSubmitMsg({
          text: `Listing posted successfully and pushed to ${pushDestination}!`,
          ok: true,
        });
      } catch {
        setSubmitMsg({ text: "Listing created.", ok: true });
      }
    }

    setShowForm(false);
    setForm({ ...BLANK_FORM });
    setSubmitting(false);
  }

  // Handle buyer reservation requests: Approve/Decline per listing and trigger database logistics flow
  async function handleRequest(
    status: "accepted" | "declined" | "pending",
    requestId: string,
    listingId: string,
    freightPayout = 2850
  ) {
    setSubmittingReqId(requestId);

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || sellerId;

    // Find the target listing and request from local state for enriched database outputs
    const targetListing = myListings.find((l) => l.id === listingId);
    const targetReq = (requestsByListing[listingId] ?? []).find((r) => r.id === requestId);
    const buyerId = targetReq?.buyer_id || targetReq?.buyer?.id || "2988f73a-313c-4a8b-8913-c423c87f11f3";
    const buyerAddress = targetReq?.buyer?.address || "Hebbal Facility, Bengaluru";
    const buyerLat = Number(targetReq?.buyer?.lat) || 13.0358;
    const buyerLong = Number(targetReq?.buyer?.long) || 77.5972;

    const qtyKg = Number(targetListing?.quantity) || 1000;
    const co2eSaved = Math.round(qtyKg * 3.12 * 10) / 10;
    const pickupLoc =
      targetListing?.pickup_address ||
      (targetListing?.condition?.includes("Pickup: ")
        ? targetListing.condition.split("Pickup: ")[1]?.replace(")", "")
        : "") ||
      sellerAddress ||
      "DAIICT Facility";
    const pickupLat = Number(targetListing?.pickup_lat) || 12.9716;
    const pickupLong = Number(targetListing?.pickup_long) || 77.5946;

    if (status === "accepted" || status === "declined") {
      let apiSucceeded = false;
      // 1. Try server API
      try {
        await updateRequest(requestId, status);
        apiSucceeded = true;
      } catch (apiErr) {
        console.warn("API updateRequest failed, updating Supabase database directly:", apiErr);
      }

      // 2. Direct Supabase updates if API wasn't reachable
      if (!apiSucceeded) {
        try {
          await supabase
            .from("requests")
            .update({ status })
            .eq("id", requestId);

          if (status === "accepted") {
            await supabase
              .from("listings")
              .update({ status: "claimed" })
              .eq("id", listingId);

            const { data: tx } = await supabase
              .from("transactions")
              .insert({
                listing_id: listingId,
                request_id: requestId,
                seller_id: uid,
                buyer_id: buyerId,
                distance_km: 18,
                estimated_cost: freightPayout,
                status: "committed",
                impact_kg_diverted: qtyKg,
                impact_co2e_kg: co2eSaved,
              })
              .select()
              .single();

            await supabase
              .from("jobs")
              .insert({
                transaction_id: tx?.id || undefined,
                pickup_lat: pickupLat,
                pickup_long: pickupLong,
                dropoff_lat: buyerLat,
                dropoff_long: buyerLong,
                distance_km: 18,
                duration_min: 38,
                estimated_cost: freightPayout,
                pickup_location: pickupLoc,
                dropoff_location: buyerAddress,
                status: "open",
              });
          }
        } catch (sbErr) {
          console.warn("Direct Supabase update failed, continuing with local demo state:", sbErr);
        }
      }
    }

    // Update state specifically for this listing & request:
    setRequestsByListing((prev) => {
      const existing = prev[listingId] ?? [];
      const updated = existing.map((r) =>
        r.id === requestId ? { ...r, status } : r
      );
      if (!updated.some((r) => r.id === requestId)) {
        updated.push({
          id: requestId,
          listing_id: listingId,
          status,
          freight_estimate: freightPayout,
        });
      }
      const newMap = { ...prev, [listingId]: updated };
      localStorage.setItem("seller_requests_by_listing", JSON.stringify(newMap));
      return newMap;
    });

    if (listingId === "RL-1048") {
      localStorage.setItem("demo_rl1048_req_status", status);
    }

    if (status === "accepted") {
      // Mark this listing claimed
      setMyListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: "claimed" } : l))
      );

      const existingJobs: any[] = JSON.parse(
        localStorage.getItem("logistics_jobs") ?? "[]"
      );
      const targetListing = myListings.find((l) => l.id === listingId);
      const jobId = `J-${listingId.replace(/\D/g, "").slice(-3) || "208"}`;
      const newJob = {
        id: jobId,
        transaction_id: `TX-${Date.now()}`,
        listing_id: listingId,
        route: `${targetListing?.pickup_address || sellerAddress || "Peenya Industrial Area"} → Hoskote Facility`,
        detail: `${targetListing?.quantity || 1400} ${targetListing?.unit || "kg"} · 23 km`,
        payout: `₹${freightPayout.toLocaleString("en-IN")}`,
        status: "Open",
        buyer: "EcoForm Packaging",
        material: `${targetListing?.material_type || "Material"} lot`,
        created_at: new Date().toISOString(),
      };
      const filtered = existingJobs.filter((j) => j.id !== jobId);
      localStorage.setItem("logistics_jobs", JSON.stringify([newJob, ...filtered]));

      const localListings: any[] = JSON.parse(
        localStorage.getItem("seller_listings") ?? "[]"
      );
      localStorage.setItem(
        "seller_listings",
        JSON.stringify(
          localListings.map((l) => (l.id === listingId ? { ...l, status: "claimed" } : l))
        )
      );
    } else if (status === "pending") {
      setMyListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: "open" } : l))
      );
    }

    setSubmittingReqId(null);
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <PageTitle
        icon={<Factory />}
        eyebrow="Seller workspace"
        title="Your material listings"
        copy="Manage requests, price decay, and fallback status."
      />

      {/* Toast */}
      {submitMsg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            submitMsg.ok
              ? "bg-primary/12 text-primary"
              : "bg-destructive/12 text-destructive"
          }`}
        >
          {submitMsg.text}
        </div>
      )}

      {/* ── Post new listing ── */}
      <div className="rounded-panel border-2 border-foreground/10 bg-card">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Post a new listing
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              List reusable packaging for sale on the marketplace.
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setSubmitMsg(null);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-button transition-all hover:-translate-y-0.5"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Cancel" : "New listing"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateListing}
            className="border-t-2 border-foreground/10 p-5 space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Material type */}
              <div>
                <label className={LABEL}>Material type</label>
                <select
                  name="material_type"
                  value={form.material_type}
                  onChange={handleField}
                  className={INPUT}
                >
                  <option value="cardboard">Cardboard</option>
                  <option value="PET">PET Plastic</option>
                  <option value="HDPE">HDPE Plastic</option>
                  <option value="LDPE">LDPE Plastic</option>
                  <option value="wood_pallet">Wood Pallet</option>
                  <option value="mixed_plastic">Mixed Plastic</option>
                </select>
              </div>

              {/* Sub-grade */}
              <div>
                <label className={LABEL}>Sub-grade / spec</label>
                <input
                  name="sub_grade"
                  value={form.sub_grade}
                  onChange={handleField}
                  placeholder="e.g. OCC 11, rPET A"
                  className={INPUT}
                  required
                />
              </div>

              {/* Quantity + unit — fused group */}
              <div>
                <label className={LABEL}>Quantity</label>
                <div className="flex overflow-hidden rounded-xl border-2 border-foreground/10 bg-background transition-colors focus-within:border-primary">
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={handleField}
                    placeholder="e.g. 1400"
                    required
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <select
                    name="unit"
                    value={form.unit}
                    onChange={handleField}
                    className="border-l-2 border-foreground/10 bg-background px-3 py-3 text-sm font-semibold text-foreground focus:outline-none"
                  >
                    <option value="kg">kg</option>
                    <option value="pieces">pcs</option>
                    <option value="tonnes">t</option>
                  </select>
                </div>
              </div>

              {/* Contamination */}
              <div>
                <label className={LABEL}>Contamination %</label>
                <input
                  name="contamination_pct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.contamination_pct}
                  onChange={handleField}
                  placeholder="e.g. 2.1"
                  className={INPUT}
                  required
                />
              </div>

              {/* List price */}
              <div>
                <label className={LABEL}>List price (₹ / unit)</label>
                <input
                  name="list_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.list_price}
                  onChange={handleField}
                  placeholder="e.g. 14.00"
                  className={INPUT}
                  required
                />
              </div>

              {/* Price floor */}
              <div>
                <label className={LABEL}>Price floor (₹ / unit)</label>
                <input
                  name="price_floor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_floor}
                  onChange={handleField}
                  placeholder="e.g. 9.20"
                  className={INPUT}
                  required
                />
              </div>

            </div>

            {/* Pickup address — pre-filled from user metadata, editable */}
            <div>
              <label className={LABEL}>Pickup address</label>
              <input
                type="text"
                name="pickup_address"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                placeholder="e.g. 42 Industrial Area, Phase 2, Peenya, Bengaluru"
                className={INPUT}
                required
              />
            </div>

            {/* Condition */}
            <div>
              <label className={LABEL}>Condition description</label>
              <textarea
                name="condition"
                value={form.condition}
                onChange={handleField}
                rows={2}
                placeholder="e.g. Certified clean, double-wall bales"
                className={INPUT}
                required
              />
            </div>

            {/* Photo URL */}
            <div>
              <label className={LABEL}>Photo URL (optional)</label>
              <input
                name="photo_url"
                value={form.photo_url}
                onChange={handleField}
                placeholder="https://..."
                className={INPUT}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-display font-semibold text-accent-foreground shadow-button-accent transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Post listing
            </button>
          </form>
        )}
      </div>

      {/* ── Active listing + incoming requests ── */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
        <div className="space-y-5">
          {/* Dynamic listings feed */}
          {loadingListings && (
            <div className="flex items-center justify-center rounded-panel border-2 border-foreground/10 bg-card p-10">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}

          {!loadingListings && (
            (myListings.length > 0 ? myListings : [
              {
                id: "RL-1048",
                material_type: "Cardboard",
                sub_grade: "OCC 11",
                condition: "Double-wall corrugated bales",
                quantity: 1400,
                unit: "kg",
                list_price: 11.8,
                price_floor: 9.2,
                pickup_address: "Peenya Industrial Area",
                decay_window_seconds: 14400,
                created_at: new Date(Date.now() - 46 * 60 * 1000).toISOString(),
                status: "open",
              },
            ]).map((item, index) => {
              const currentPrice = computeCurrentPrice({
                list_price: Number(item.list_price),
                price_floor: Number(item.price_floor),
                decay_window_seconds: item.decay_window_seconds || 86400,
                created_at: item.created_at || new Date().toISOString(),
              });
              const decayPct = Math.round(
                decayFraction({
                  list_price: Number(item.list_price),
                  price_floor: Number(item.price_floor),
                  decay_window_seconds: item.decay_window_seconds || 86400,
                  created_at: item.created_at || new Date().toISOString(),
                }) * 100
              );
              const timing = getFallbackTiming({
                list_price: Number(item.list_price),
                price_floor: Number(item.price_floor),
                decay_window_seconds: item.decay_window_seconds || 86400,
                created_at: item.created_at || new Date().toISOString(),
              });

              const itemRequests = requestsByListing[item.id] ?? [];

              return (
                <div key={item.id ?? index} className="rounded-panel border-2 border-foreground/10 bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-highlight/60 px-3 py-1 text-xs font-semibold uppercase">
                        {item.material_type?.replace(/_/g, " ")} {item.sub_grade ? `· ${item.sub_grade}` : ""}
                      </span>
                      <h2 className="mt-3 font-display text-2xl font-semibold">
                        {item.condition
                          ? item.condition.split(" (Pickup:")[0].split(" | Pickup:")[0]
                          : `${item.material_type} lot`}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unit} · {item.pickup_address || (item.condition?.includes("Pickup: ") ? item.condition.split("Pickup: ")[1]?.replace(")", "") : "") || "DAIICT"} · {item.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl font-semibold">
                        ₹{currentPrice.toFixed(2)}/{item.unit || "kg"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        floor ₹{Number(item.price_floor).toFixed(2)} · {decayPct}% decay · Bulk in {timing.timeTo80Formatted}
                      </p>
                    </div>
                  </div>

                  {/* Decay bar */}
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-foreground/8">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(8, Math.min(100, decayPct))}%` }}
                    />
                  </div>

                  {/* Requests specifically belonging to this listing */}
                  {itemRequests.length > 0 ? (
                    itemRequests.map((req: any) => {
                      const isAccepted = req.status === "accepted";
                      const isDeclined = req.status === "declined";
                      const isPending = !isAccepted && !isDeclined;

                      return (
                        <div key={req.id} className="mt-6 rounded-2xl bg-secondary p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Incoming buyer request
                              </p>
                              <p className="mt-1 font-display text-lg font-semibold">
                                {req.buyer?.name || req.buyer_name || "Verified Buyer"} {req.buyer?.role ? `(${req.buyer.role})` : ""} · {req.buyer_rating || "★ 4.9"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Reserved {req.quantity || item.quantity} {req.unit || item.unit} · {req.buyer?.address || "Buyer Facility"} · Freight estimate ₹{(req.freight_estimate || 2850).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isAccepted
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : isDeclined
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-warning/40 text-foreground"
                              }`}
                            >
                              {isAccepted ? "Approved & Dispatched" : isDeclined ? "Declined" : "Pending"}
                            </span>
                          </div>

                          {isPending && (
                            <div className="mt-4 space-y-3">
                              <p className="text-xs text-muted-foreground">
                                Approving confirms this buyer reservation, locks the listing on the marketplace, and immediately dispatches a pickup job to logistics carriers.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  disabled={submittingReqId === req.id}
                                  onClick={() => handleRequest("accepted", req.id, item.id, req.freight_estimate || 2850)}
                                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-button transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                >
                                  {submittingReqId === req.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Check className="size-4" />
                                  )}
                                  Approve &amp; dispatch to logistics
                                </button>
                                <button
                                  disabled={submittingReqId === req.id}
                                  onClick={() => handleRequest("declined", req.id, item.id, req.freight_estimate || 2850)}
                                  className="rounded-full border-2 border-foreground/15 bg-background px-5 py-2 text-sm font-semibold text-foreground hover:bg-foreground/5 disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}

                          {isAccepted && (
                            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
                              <div className="flex items-start gap-3">
                                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                                  <Truck className="size-4" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-primary">
                                    Listing locked &amp; dispatched to Logistics
                                  </p>
                                  <p className="mt-0.5 text-xs text-foreground/75">
                                    Logistics Job <strong>#J-{item.id.replace(/\D/g, "").slice(-3) || "208"}</strong> has been created and synced with carrier payout <strong>₹{(req.freight_estimate || 2850).toLocaleString("en-IN")}</strong>. Route: {item.pickup_address || sellerAddress || "Peenya Industrial Area"} → Hoskote Facility.
                                  </p>
                                  <div className="mt-3 flex items-center gap-4">
                                    <Link
                                      to="/dashboard/logistics"
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                    >
                                      View logistics board <ArrowUpRight className="size-3.5" />
                                    </Link>
                                    <button
                                      onClick={() => handleRequest("pending", req.id, item.id, req.freight_estimate || 2850)}
                                      className="text-xs text-muted-foreground hover:underline"
                                    >
                                      Reset demo status
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {isDeclined && (
                            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                              <p className="font-semibold">Request declined.</p>
                              <p className="mt-0.5 text-foreground/70">The listing remains open and active for other buyers on the marketplace.</p>
                              <button
                                onClick={() => handleRequest("pending", req.id, item.id, req.freight_estimate || 2850)}
                                className="mt-2 text-xs font-semibold underline text-foreground hover:opacity-75"
                              >
                                Reset demo status
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-2.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2 font-medium text-foreground/80">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live on marketplace
                      </span>
                      <span>Waiting for buyer reservation</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Continuous Multi-Listing Fallback Clock Sidebar */}
        <div className="self-start sticky top-20 space-y-4">
          <div className="rounded-panel bg-primary p-6 text-primary-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock3 className="size-6 text-highlight" />
                <h3 className="font-display text-2xl font-semibold">
                  Fallback clocks
                </h3>
              </div>
              <button
                onClick={() => loadSellerData()}
                title="Refresh listings & requests from database"
                className="grid size-8 place-items-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground transition-colors"
              >
                <RefreshCw className={`size-3.5 ${loadingListings ? "animate-spin" : ""}`} />
              </button>
            </div>

            <p className="mt-2 text-xs text-primary-foreground/75 leading-relaxed">
              At 80% decay, unpurchased lots join nearby bulk pools. At floor (100%), the fixed recycler takes over automatically.
            </p>

            {/* Continuous list of all active listings */}
            <div className="mt-5 space-y-3">
              {(myListings.length > 0 ? myListings : [
                {
                  id: "RL-1048",
                  material_type: "Cardboard",
                  sub_grade: "OCC 11",
                  condition: "Double-wall corrugated bales",
                  quantity: 1400,
                  unit: "kg",
                  list_price: 11.8,
                  price_floor: 9.2,
                  pickup_address: "Peenya Industrial Area",
                  decay_window_seconds: 14400,
                  created_at: new Date(Date.now() - 46 * 60 * 1000).toISOString(),
                  status: "open",
                },
              ]).map((item) => {
                const timing = getFallbackTiming({
                  list_price: Number(item.list_price),
                  price_floor: Number(item.price_floor),
                  decay_window_seconds: item.decay_window_seconds || 86400,
                  created_at: item.created_at || new Date().toISOString(),
                });
                const decayPct = Math.round(
                  decayFraction({
                    list_price: Number(item.list_price),
                    price_floor: Number(item.price_floor),
                    decay_window_seconds: item.decay_window_seconds || 86400,
                    created_at: item.created_at || new Date().toISOString(),
                  }) * 100
                );

                return (
                  <div
                    key={`clock-${item.id}`}
                    className="rounded-2xl bg-primary-foreground/10 p-3.5 text-xs transition-colors hover:bg-primary-foreground/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm">
                          {item.condition
                            ? item.condition.split(" (Pickup:")[0].split(" | Pickup:")[0]
                            : `${item.material_type} lot`}
                        </p>
                        <p className="text-[10px] text-primary-foreground/60 truncate">
                          {item.quantity} {item.unit} · {item.pickup_address || (item.condition?.includes("Pickup: ") ? item.condition.split("Pickup: ")[1]?.replace(")", "") : "") || "DAIICT"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-highlight/25 px-2 py-0.5 text-[10px] font-semibold text-highlight">
                        {decayPct}% decayed
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-xl bg-black/15 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-primary-foreground/60">
                          Bulk pool (80%)
                        </p>
                        <p className="font-display text-sm font-semibold text-white mt-0.5">
                          {timing.timeTo80Formatted}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/15 p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-primary-foreground/60">
                          Recycler (Floor)
                        </p>
                        <p className="font-display text-sm font-semibold text-white mt-0.5">
                          {timing.timeToFloorFormatted}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
