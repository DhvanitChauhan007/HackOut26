import { useState, useMemo, useEffect } from "react";
import { Box, Check, MapPin, Recycle, RefreshCw, RouteIcon, Search, Sparkles, Star, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { apiRequest } from "../../lib/apiClient";
import { supabase } from "../../lib/supabase";

export type Listing = any;

export const jobs = [
  { id: "J-208", route: "Peenya → Hoskote", detail: "1,400 kg · 23 km", payout: "₹2,850", status: "Open" },
  { id: "J-204", route: "Whitefield → Bommasandra", detail: "820 kg · 19 km", payout: "₹2,240", status: "In transit" },
  { id: "J-198", route: "Yeshwanthpur → Hebbal", detail: "600 kg · 12 km", payout: "₹1,620", status: "Delivered" },
];

export function BrowseView() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const loadListings = async () => {
    try {
      const res = await fetch('/api/listings');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setListings(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Backend proxy not responding, falling back to direct Supabase query:", err);
    }

    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*, users(name, address, lat, long)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setListings(data);
      }
    } catch (sbErr) {
      console.error("Direct Supabase query failed:", sbErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();

    apiRequest('/api/requests')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setRequested(data.map((r: any) => r.listing_id));
        }
      })
      .catch(() => {});

    // Supabase realtime channel for instant seller listing detection
    const channel = supabase
      .channel('realtime_marketplace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
        loadListings();
      })
      .subscribe();

    // 5-second polling interval as backup
    const interval = setInterval(loadListings, 5000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const [material, setMaterial] = useState("All");
  const [distance, setDistance] = useState(25);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [requested, setRequested] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      if (material === "All") return true;
      const m1 = (item.material_type || "").toLowerCase().trim();
      const m2 = material.toLowerCase().trim();
      if (m1 === m2) return true;
      if (m2 === "plastic" && (m1.includes("pet") || m1.includes("hdpe") || m1.includes("ldpe") || m1.includes("film") || m1.includes("plastic"))) return true;
      if (m2 === "cardboard" && (m1.includes("cardboard") || m1.includes("occ") || m1.includes("paper") || m1.includes("duplex"))) return true;
      if (m2 === "pallets" && (m1.includes("pallet") || m1.includes("wood") || m1.includes("timber"))) return true;
      return false;
    });
  }, [material, listings]);

  const requestLot = async (id: string) => {
    try {
      const res = await apiRequest(`/api/listings/${id}/requests`, { method: 'POST' });
      if (res.ok) {
        setRequested((current) => (current.includes(id) ? current : [...current, id]));
        setSelected(null);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Reserve failed:', err);
        alert(err.error || 'Failed to send reservation request.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error connecting to backend.');
    }
  };

  return (
    <div className="space-y-7">
      <section className="grid gap-5 lg:grid-cols-12">
        <div className="relative flex min-h-[390px] flex-col justify-between overflow-hidden rounded-hero bg-primary p-6 text-primary-foreground lg:col-span-7 sm:p-8">
          <div className="absolute -right-12 top-10 size-48 rounded-full border-[28px] border-primary-foreground/10" />
          <div className="absolute -bottom-20 right-28 size-40 rotate-12 rounded-[2rem] border-[22px] border-highlight/20" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-highlight px-3 py-1 text-xs font-semibold uppercase text-foreground"><Sparkles className="size-3.5" /> {listings.length > 0 ? `${listings.length} lots live now` : "126 lots live now"}</span>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1] sm:text-6xl">Packaging waste has somewhere better to go.</h1>
            <p className="mt-4 max-w-lg text-primary-foreground/75">Buy, sell and move reusable cardboard, plastics and pallets before they reach landfill.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById("lots")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-highlight px-6 py-3 font-display font-semibold text-foreground shadow-button-dark">Browse listings</button>
            </div>
          </div>
          <div className="relative z-10 mt-8 grid grid-cols-3 gap-2 sm:gap-3">
            <Metric value="48,210 kg" label="Diverted" />
            <Metric value="36.4 t" label="CO₂e avoided" />
            <Metric value="₹12.8L" label="Saved" />
          </div>
        </div>

        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5 lg:col-span-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Filter the feed</h2><Search className="size-5 text-muted-foreground" /></div>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Material</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["All", "Cardboard", "Plastic", "Pallets"].map((item) => <button key={item} onClick={() => setMaterial(item)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${material === item ? "bg-foreground text-background" : "bg-foreground/5"}`}>{item}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Grade<select className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2.5 text-sm text-foreground"><option>Any grade</option><option>Grade A</option><option>Grade B</option></select></label>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Quantity<input className="mt-2 w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2.5 text-sm text-foreground" defaultValue="500+ kg" /></label>
            </div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground">Within <span className="text-foreground">{distance} km</span><input aria-label="Distance" type="range" min="5" max="50" value={distance} onChange={(event) => setDistance(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
            <div className="rounded-2xl bg-secondary p-3 text-sm"><strong>{filtered.length} matching lots</strong><p className="mt-0.5 text-xs text-muted-foreground">Sorted by distance from your facility</p></div>
            <button onClick={() => document.getElementById("lots")?.scrollIntoView({ behavior: "smooth" })} className="w-full rounded-full bg-accent py-3 font-display font-semibold text-accent-foreground shadow-button-accent">Show nearby lots</button>
          </div>
        </div>
      </section>

      <section id="lots" className="scroll-mt-24 rounded-panel bg-card/55 px-3 py-5 sm:px-5 sm:py-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase text-primary"><span className="size-2 rounded-full bg-highlight" /> Industrial exchange</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Matched lots near MetroPack</h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button onClick={loadListings} title="Fetch latest listings" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
              <RefreshCw className="size-3" /> Refresh live feed
            </button>
            <span className="text-muted-foreground">Showing {filtered.length} verified lots</span>
            <Link to="/dashboard/logistics" className="inline-flex items-center gap-1 font-semibold text-primary">View logistics map <MapPin className="size-3.5" /></Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? <p className="col-span-4 p-4 text-center text-muted-foreground">Loading live listings...</p> : filtered.map((item) => <ListingCard key={item.id} item={item} requested={requested.includes(item.id)} onView={() => setSelected(item)} onRequest={() => requestLot(item.id)} />)}
        </div>
        {!loading && filtered.length === 0 && <div className="rounded-panel border-2 border-dashed border-foreground/15 bg-card p-10 text-center"><Box className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-display text-xl font-semibold">No lots within {distance} km</p><button onClick={() => setDistance(50)} className="mt-3 rounded-full bg-foreground px-4 py-2 text-sm text-background">Expand search</button></div>}
      </section>

      {selected && <ListingDialog item={selected} onClose={() => setSelected(null)} onRequest={() => requestLot(selected.id)} requested={requested.includes(selected.id)} />}
    </div>
  );
}

// Subcomponents
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-primary-foreground/10 p-3 sm:p-4"><p className="font-display text-lg font-semibold sm:text-2xl">{value}</p><p className="mt-1 text-[10px] text-primary-foreground/65 sm:text-xs">{label}</p></div>; }

function ListingCard({ item, requested, onView, onRequest }: { item: Listing; requested: boolean; onView: () => void; onRequest: () => void }) {
  return <article className="flex min-h-[390px] flex-col rounded-card border border-foreground/10 bg-card p-3 transition-transform hover:-translate-y-1">
    <div className="flex items-center justify-between gap-2 px-0.5 pb-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">{item.material_type}</span><span className="font-display text-xl font-semibold text-primary">₹{Number(item.current_price || item.list_price).toFixed(2)}<span className="text-[10px] font-normal text-muted-foreground">/{item.unit}</span></span></div>
    <div className="relative overflow-hidden rounded-lg">
      <img src={item.photo_url || "/images/cardboard-bales.jpg"} alt={`${item.sub_grade} inventory`} loading="lazy" width={1024} height={640} className="aspect-[16/9] w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-card/90 px-2 py-1 font-mono text-[10px] font-semibold shadow-sm">Lot #{item.id.slice(0, 6)}</span>
    </div>
    <button onClick={onView} className="mt-3 text-left"><h3 className="font-display text-base font-semibold leading-tight">{item.sub_grade}</h3><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.users?.name}</p></button>
    <dl className="mt-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3" /> Distance</dt><dd className="font-semibold">{item.distance ?? 14} km</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Box className="size-3" /> Volume</dt><dd className="font-semibold">{item.quantity} {item.unit}</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3" /> Spec</dt><dd className="truncate font-semibold">{item.condition}</dd></div>
    </dl>
    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
      <button onClick={onView} className="rounded-lg bg-secondary py-2 text-xs font-semibold">Details</button>
      <button disabled={requested} onClick={onRequest} className={`rounded-lg py-2 text-xs font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}>{requested ? <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Reserved</span> : <span className="inline-flex items-center gap-1">Reserve <Check className="size-3.5" /></span>}</button>
    </div>
  </article>;
}

export function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-foreground/5 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-semibold">{value}</p></div>; }

function ListingDialog({ item, onClose, onRequest, requested }: { item: Listing; onClose: () => void; onRequest: () => void; requested: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label={`${item.sub_grade} details`} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-panel sm:max-w-2xl sm:rounded-panel"><div className="flex items-start justify-between"><div><span className="rounded-full bg-highlight/55 px-3 py-1 text-xs font-semibold uppercase">{item.material_type} · {item.sub_grade}</span><h2 className="mt-4 font-display text-3xl font-semibold">{item.sub_grade}</h2><p className="mt-1 text-sm text-muted-foreground">{item.users?.name} · {item.users?.address || "Bengaluru"}</p></div><button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-foreground/5"><X className="size-4" /></button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Quantity" value={`${item.quantity} ${item.unit}`} /><MiniStat label="Distance" value={`${item.distance ?? 14} km`} /><MiniStat label="Contamination" value={`${item.contamination_pct ?? 0}%`} /><MiniStat label="Current price" value={`₹${Number(item.current_price || item.list_price).toFixed(2)}/${item.unit}`} /></div><div className="mt-6 rounded-2xl bg-secondary p-4"><div className="flex items-center justify-between"><p className="font-semibold">Live price decay</p><span className="text-sm text-muted-foreground">floor ₹{item.price_floor}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-accent" style={{ width: `${item.decay_pct ?? 45}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Listed at ₹{item.list_price}</span><span>{item.decay_pct >= 90 ? "Eligible for bulk pooling" : `${100 - (item.decay_pct || 45)}% remaining to floor`}</span></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border-2 border-foreground/10 p-4"><RouteIcon className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Estimated logistics</p><p className="font-display text-2xl font-semibold">₹{Math.max(1200, Math.round((item.distance ?? 14) * 85 + (item.quantity / 1000) * 450))}</p><p className="text-xs text-muted-foreground">{item.distance ?? 14} km · calculated estimate</p></div><div className="rounded-2xl border-2 border-foreground/10 p-4"><Recycle className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Circular benefit</p><p className="font-display text-2xl font-semibold">{((item.quantity * 3.12) / 1000).toFixed(1)} t CO₂e</p><p className="text-xs text-muted-foreground">estimated avoided emissions</p></div></div><button disabled={requested} onClick={onRequest} className={`mt-6 w-full rounded-full py-3 font-display font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground shadow-button-accent"}`}>{requested ? "Request already sent" : "Send claim request"}</button></div></div>;
}
