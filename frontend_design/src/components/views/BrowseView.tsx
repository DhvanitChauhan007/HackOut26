import { useState, useMemo, useEffect, useRef } from "react";
import { Box, Check, Clock, MapPin, Navigation, Recycle, RefreshCw, RouteIcon, Search, Sparkles, Star, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { apiRequest } from "../../lib/apiClient";
import { supabase } from "../../lib/supabase";
import { haversine } from "../../services/haversine";
import { geocodeAddress } from "../../services/geocode";

export type Listing = any;

export const jobs = [
  { id: "J-208", route: "Peenya → Hoskote", detail: "1,400 kg · 23 km", payout: "₹2,850", status: "Open" },
  { id: "J-204", route: "Whitefield → Bommasandra", detail: "820 kg · 19 km", payout: "₹2,240", status: "In transit" },
  { id: "J-198", route: "Yeshwanthpur → Hebbal", detail: "600 kg · 12 km", payout: "₹1,620", status: "Delivered" },
];

export function BrowseView({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyerCoords, setBuyerCoords] = useState<{ lat: number; long: number }>({ lat: 23.188408, long: 72.627969 });
  const [locationLabel, setLocationLabel] = useState("DAIICT / Gandhinagar");
  const buyerCoordsRef = useRef(buyerCoords);

  const [material, setMaterial] = useState("All");
  const [distance, setDistance] = useState(1500);
  const [grade, setGrade] = useState("Any grade");
  const [minQty, setMinQty] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [requested, setRequested] = useState<Record<string, string>>({});

  const enrichListings = (rawListings: any[], targetCoords: { lat: number; long: number }) => {
    const bLat = targetCoords.lat;
    const bLong = targetCoords.long;

    return rawListings.map((item) => {
      let pLat = Number(item.pickup_lat || item.users?.lat);
      let pLong = Number(item.pickup_long || item.users?.long);

      // Resolve missing coordinates from address keywords
      if ((!pLat || !pLong || isNaN(pLat) || isNaN(pLong)) && item.users?.address) {
        const addr = item.users.address.toLowerCase();
        if (addr.includes("daiict") || addr.includes("gandhinagar")) {
          pLat = 23.1895; pLong = 72.6302;
        } else if (addr.includes("surat")) {
          pLat = 21.1702; pLong = 72.8311;
        } else if (addr.includes("ahmedabad")) {
          pLat = 23.0225; pLong = 72.5714;
        } else if (addr.includes("peenya")) {
          pLat = 13.0285; pLong = 77.5197;
        } else if (addr.includes("whitefield")) {
          pLat = 12.9698; pLong = 77.7499;
        } else if (addr.includes("bommasandra")) {
          pLat = 12.8014; pLong = 77.6754;
        }
      }

      let dist = item.distance;
      if (pLat && pLong && bLat && bLong && !isNaN(pLat) && !isNaN(pLong)) {
        const direct = haversine(bLat, bLong, pLat, pLong);
        dist = Math.max(1.2, Math.round(direct * 1.25 * 10) / 10);
      }
      return {
        ...item,
        distance: typeof dist === "number" ? dist : 10.5,
        pickup_lat: pLat || item.pickup_lat,
        pickup_long: pLong || item.pickup_long,
      };
    });
  };

  const loadListings = async (coords = buyerCoordsRef.current) => {
    const bLat = coords.lat;
    const bLong = coords.long;

    try {
      const res = await fetch(`/api/listings?buyer_lat=${bLat}&buyer_long=${bLong}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setListings(enrichListings(data, coords));
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Backend proxy not responding, falling back to direct Supabase query:", err);
    }

    try {
      const { data, error } = await supabase
        .from("listings")
        .select("*, users(name, address, lat, long)")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setListings(enrichListings(data, coords));
      }
    } catch (sbErr) {
      console.error("Direct Supabase query failed:", sbErr);
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = (coords: { lat: number; long: number }, label: string) => {
    setBuyerCoords(coords);
    buyerCoordsRef.current = coords;
    setLocationLabel(label);
    setListings((prev) => enrichListings(prev, coords));
    loadListings(coords);
  };

  const detectDeviceLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, long: pos.coords.longitude };
          updateLocation(coords, "Current Device GPS");
        },
        () => {
          alert("Could not detect device location. Please ensure location permissions are granted.");
        },
        { timeout: 8000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  useEffect(() => {
    const initBuyerLocation = async () => {
      let currentCoords = { lat: 23.188408, long: 72.627969 };
      let label = "DAIICT / Gandhinagar";

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        const meta = session?.user?.user_metadata;

        if (uid) {
          const { data: userProfile } = await supabase
            .from("users")
            .select("lat, long, address, name")
            .eq("id", uid)
            .maybeSingle();

          if (userProfile?.lat && userProfile?.long) {
            currentCoords = { lat: Number(userProfile.lat), long: Number(userProfile.long) };
            label = userProfile.address || userProfile.name || "Your Profile";
          } else if (userProfile?.address) {
            const resolved = await geocodeAddress(userProfile.address);
            if (resolved) {
              currentCoords = resolved;
              label = userProfile.address;
            }
          }
        }

        if (label === "DAIICT / Gandhinagar" && meta?.["address"]) {
          const resolved = await geocodeAddress(meta["address"] as string);
          if (resolved) {
            currentCoords = resolved;
            label = meta["address"] as string;
          }
        }
      } catch (err) {
        console.warn("Could not determine buyer location on mount:", err);
      }

      setBuyerCoords(currentCoords);
      buyerCoordsRef.current = currentCoords;
      setLocationLabel(label);
      loadListings(currentCoords);
    };

    initBuyerLocation();

    // Load existing request statuses
    const loadRequests = async () => {
      try {
        const res = await apiRequest("/api/requests");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const map: Record<string, string> = {};
            data.forEach((r: any) => { map[r.listing_id] = r.status ?? "pending"; });
            setRequested(map);
          }
        }
      } catch {}
    };
    loadRequests();

    // Supabase realtime: listings updates
    const listingsChannel = supabase
      .channel("realtime_marketplace")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        loadListings(buyerCoordsRef.current);
      })
      .subscribe();

    // Supabase realtime: requests updates (status changes → remove accepted; delete → revert to unreserved)
    const requestsChannel = supabase
      .channel("realtime_requests")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "requests" }, (payload) => {
        const r = payload.new as any;
        setRequested((prev) => ({ ...prev, [r.listing_id]: r.status }));
        // If accepted/declined, refresh listings so claimed ones disappear
        if (r.status === "accepted") {
          loadListings(buyerCoordsRef.current);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "requests" }, (payload) => {
        const r = payload.old as any;
        if (r?.listing_id) {
          setRequested((prev) => {
            const next = { ...prev };
            delete next[r.listing_id];
            return next;
          });
        } else {
          loadRequests();
        }
      })
      .subscribe();

    // 10-second polling interval as backup
    const interval = setInterval(() => {
      loadListings(buyerCoordsRef.current);
    }, 10000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(listingsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, []);

  const filtered = useMemo(() => {
    const list = listings.filter((item) => {
      // Distance filter: when distance is < 1500, apply strict radius filter
      if (distance < 1500 && typeof item.distance === "number" && item.distance > distance) {
        return false;
      }
      // Material filter
      if (material !== "All") {
        const m1 = (item.material_type || "").toLowerCase().trim();
        const m2 = material.toLowerCase().trim();
        let matches = m1 === m2;
        if (!matches && m2 === "plastic" && (m1.includes("pet") || m1.includes("hdpe") || m1.includes("ldpe") || m1.includes("film") || m1.includes("plastic"))) matches = true;
        if (!matches && m2 === "cardboard" && (m1.includes("cardboard") || m1.includes("occ") || m1.includes("paper") || m1.includes("duplex"))) matches = true;
        if (!matches && m2 === "pallets" && (m1.includes("pallet") || m1.includes("wood") || m1.includes("timber"))) matches = true;
        if (!matches) return false;
      }
      // Search keyword filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const haystack = [
          item.material_type,
          item.sub_grade,
          item.condition,
          item.users?.name,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Grade filter
      if (grade !== "Any grade") {
        const g = (item.sub_grade || "").toLowerCase();
        const targetG = grade.toLowerCase().replace("grade ", "");
        if (!g.includes(targetG)) return false;
      }
      // Min Quantity filter
      if (minQty > 0 && Number(item.quantity || 0) < minQty) {
        return false;
      }

      return true;
    });

    // Sort by distance: closest lots first
    return [...list].sort((a, b) => {
      const da = typeof a.distance === "number" ? a.distance : 99999;
      const db = typeof b.distance === "number" ? b.distance : 99999;
      return da - db;
    });
  }, [material, distance, grade, minQty, search, listings]);

  const requestLot = async (id: string) => {
    if (readOnly) return;
    if (!window.confirm("Are you okay with price?")) {
      return;
    }
    try {
      const res = await apiRequest(`/api/listings/${id}/requests`, {
        method: "POST",
      });
      if (res.ok) {
        setRequested((prev) => ({ ...prev, [id]: "pending" }));
      } else {
        const err = await res.json();
        alert("Failed to send request: " + (err.error || "Unknown error"));
      }
    } catch {
      alert("Failed to connect to server. Please try again.");
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-12 sm:gap-6">
        <div className="relative flex flex-col overflow-hidden rounded-panel bg-gradient-to-br from-primary via-primary/95 to-primary/85 p-6 text-primary-foreground shadow-panel lg:col-span-7 sm:p-10">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative z-10 max-w-xl flex-1">
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Industrial scrap marketplace
            </h1>
            <p className="mt-4 text-base text-primary-foreground/80 sm:text-lg">
              Source verified secondary materials directly from manufacturing lines. Dynamic pricing with automatic road logistics routing.
            </p>
          </div>
          <div className="relative z-10 mt-10 grid grid-cols-3 gap-3">
            <Metric value="100% Live" label="Verified Supabase sync" />
            <Metric value="Automated" label="Escrow-backed dispatch" />
            <Metric value="Dynamic" label="Real-time decay pricing" />
          </div>
        </div>

        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5 lg:col-span-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Filter the feed</h2>
            <Search className="size-5 text-muted-foreground" />
          </div>
          <div className="mt-5 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search material, grade, condition…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-2 border-foreground/10 bg-background py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {/* Material */}
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Material</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["All", "Cardboard", "Plastic", "Pallets"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMaterial(item)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      material === item ? "bg-foreground text-background" : "bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade & Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Grade
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2.5 text-sm text-foreground"
                >
                  <option value="Any grade">Any grade</option>
                  <option value="Grade A">Grade A</option>
                  <option value="Grade B">Grade B</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Quantity
                <input
                  type="text"
                  placeholder="500+ kg"
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setMinQty(isNaN(num) ? 0 : num);
                  }}
                  className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </label>
            </div>

            {/* Distance Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                <span>Radius: <span className="font-bold text-primary">{distance >= 1500 ? "All India" : `${distance} KM`}</span></span>
              </div>
              <input
                aria-label="Distance"
                type="range"
                min="10"
                max="1500"
                step="25"
                value={distance}
                onChange={(event) => setDistance(Number(event.target.value))}
                className="mt-3 w-full accent-primary cursor-pointer"
              />
            </div>

            <div className="rounded-2xl bg-secondary p-3 text-sm">
              <strong>{filtered.length} matching lots</strong>
              <p className="mt-0.5 text-xs text-muted-foreground">Filtered by material &amp; specs</p>
            </div>
            <button
              type="button"
              onClick={() => document.getElementById("lots")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full rounded-full bg-accent py-3 font-display font-semibold text-accent-foreground shadow-button-accent"
            >
              Show available lots
            </button>
          </div>
        </div>
      </section>

      <section id="lots" className="scroll-mt-[4.5rem] rounded-panel bg-card/55 px-3 py-5 sm:px-5 sm:py-6">
        <div className="mb-5">
          <h2 className="font-display text-3xl font-semibold">Live lots on network</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <p className="col-span-4 p-4 text-center text-muted-foreground">Loading live listings...</p>
          ) : (
            filtered.map((item) => (
              <ListingCard
                key={item.id}
                item={item}
                requestStatus={requested[item.id]}
                onView={() => setSelected(item)}
                onRequest={() => requestLot(item.id)}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
        {!loading && filtered.length === 0 && (
          <div className="rounded-panel border-2 border-dashed border-foreground/15 bg-card p-10 text-center">
            <Box className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-display text-xl font-semibold">
              No lots within {distance >= 1500 ? "the network" : `${distance} km`}
            </p>
            <button
              onClick={() => setDistance(1500)}
              className="mt-3 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Expand to All India
            </button>
          </div>
        )}
      </section>

      {selected && (
        <ListingDialog
          item={selected}
          onClose={() => setSelected(null)}
          onRequest={() => requestLot(selected.id)}
          requestStatus={requested[selected.id]}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

// Subcomponents
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-primary-foreground/10 p-4 sm:p-5"><p className="font-display text-xl font-semibold sm:text-2xl lg:text-3xl">{value}</p><p className="mt-1.5 text-xs text-primary-foreground/65 sm:text-sm">{label}</p></div>; }

function ListingCard({ item, requestStatus, onView, onRequest, readOnly }: { item: Listing; requestStatus?: string | undefined; onView: () => void; onRequest: () => void | Promise<void>; readOnly?: boolean }) {
  return <article className="flex min-h-[390px] flex-col rounded-card border border-foreground/10 bg-card p-3 transition-transform hover:-translate-y-1">
    <div className="flex items-center justify-between gap-2 px-0.5 pb-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">{item.material_type}</span><span className="font-display text-xl font-semibold text-primary">₹{Number(item.current_price || item.list_price).toFixed(2)}<span className="text-[10px] font-normal text-muted-foreground">/{item.unit}</span></span></div>
    <div className="relative overflow-hidden rounded-lg">
      <img src={item.photo_url || "/images/cardboard-bales.jpg"} alt={`${item.sub_grade} inventory`} loading="lazy" width={1024} height={640} className="aspect-[16/9] w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-card/90 px-2 py-1 font-mono text-[10px] font-semibold shadow-sm">Lot #{item.id.slice(0, 6)}</span>
    </div>
    <button onClick={onView} className="mt-3 text-left"><h3 className="font-display text-base font-semibold leading-tight">{item.sub_grade}</h3><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.users?.name}</p></button>
    <dl className="mt-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3" /> Distance</dt><dd className="font-semibold">{item.distance != null ? `${item.distance} km` : "Calculated on route"}</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Box className="size-3" /> Volume</dt><dd className="font-semibold">{item.quantity} {item.unit}</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3" /> Spec</dt><dd className="truncate font-semibold">{item.condition}</dd></div>
    </dl>
    <div className="mt-auto pt-4">
      {requestStatus === "pending" ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-warning/20 py-2.5 text-xs font-semibold text-foreground">
          <Clock className="size-3.5" /> Pending approval
        </div>
      ) : readOnly ? (
        <button onClick={onView} className="w-full rounded-lg bg-secondary py-2 text-xs font-semibold">Details</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onView} className="rounded-lg bg-secondary py-2 text-xs font-semibold">Details</button>
          <button onClick={onRequest} className="rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground"><span className="inline-flex items-center gap-1">Reserve <Check className="size-3.5" /></span></button>
        </div>
      )}
    </div>
  </article>;
}

export function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-foreground/5 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-semibold">{value}</p></div>; }

function ListingDialog({ item, onClose, onRequest, requestStatus, readOnly }: { item: Listing; onClose: () => void; onRequest: () => void | Promise<void>; requestStatus?: string | undefined; readOnly?: boolean }) {
  const distVal = item.distance != null ? item.distance : 10.5;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label={`${item.sub_grade} details`} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-panel sm:max-w-2xl sm:rounded-panel"><div className="flex items-start justify-between"><div><span className="rounded-full bg-highlight/55 px-3 py-1 text-xs font-semibold uppercase">{item.material_type} · {item.sub_grade}</span><h2 className="mt-4 font-display text-3xl font-semibold">{item.sub_grade}</h2><p className="mt-1 text-sm text-muted-foreground">{item.users?.name} · {item.users?.address || "Bengaluru"}</p></div><button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-foreground/5"><X className="size-4" /></button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Quantity" value={`${item.quantity} ${item.unit}`} /><MiniStat label="Distance" value={`${distVal} km`} /><MiniStat label="Contamination" value={`${item.contamination_pct ?? 0}%`} /><MiniStat label="Current price" value={`₹${Number(item.current_price || item.list_price).toFixed(2)}/${item.unit}`} /></div><div className="mt-6 rounded-2xl bg-secondary p-4"><div className="flex items-center justify-between"><p className="font-semibold">Live price decay</p><span className="text-sm text-muted-foreground">floor ₹{item.price_floor}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-accent" style={{ width: `${item.decay_pct ?? 45}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Listed at ₹{item.list_price}</span><span>{item.decay_pct >= 90 ? "Eligible for bulk pooling" : `${100 - (item.decay_pct || 45)}% remaining to floor`}</span></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border-2 border-foreground/10 p-4"><RouteIcon className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Estimated logistics</p><p className="font-display text-2xl font-semibold">₹{Math.max(1200, Math.round(distVal * 85 + (item.quantity / 1000) * 450))}</p><p className="text-xs text-muted-foreground">{distVal} km · calculated estimate</p></div><div className="rounded-2xl border-2 border-foreground/10 p-4"><Recycle className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Circular benefit</p><p className="font-display text-2xl font-semibold">{((item.quantity * 3.12) / 1000).toFixed(1)} t CO₂e</p><p className="text-xs text-muted-foreground">estimated avoided emissions</p></div></div>
    {readOnly ? (
      <div className="mt-6 rounded-full bg-secondary py-3 text-center font-display text-xs font-semibold text-muted-foreground">Marketplace Feed · Read-only for sellers</div>
    ) : requestStatus === "pending" ? (
      <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-warning/20 py-3 font-display text-sm font-semibold text-foreground"><Clock className="size-4" /> Pending approval</div>
    ) : (
      <button onClick={onRequest} className="mt-6 w-full rounded-full bg-accent py-3 font-display font-semibold text-accent-foreground shadow-button-accent">Send claim request</button>
    )}
  </div></div>;
}