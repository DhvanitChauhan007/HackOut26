import { useState, useMemo } from "react";
import { ArrowRight, Box, Check, MapPin, Recycle, RouteIcon, Search, Sparkles, Star, X } from "lucide-react";
import blueDrumsImage from "@/assets/blue-drums.jpg";
import cardboardBalesImage from "@/assets/cardboard-bales.jpg";
import filmBalesImage from "@/assets/film-bales.jpg";
import woodPalletsImage from "@/assets/wood-pallets.jpg";
import { Link } from "@tanstack/react-router";

// Mock Data
export const listings = [
  {
    id: "RL-1048",
    material: "Cardboard",
    grade: "OCC 11",
    title: "Double-wall corrugated bales",
    company: "BrightCart Retail",
    location: "Peenya Industrial Area",
    distance: 8,
    weight: "1,400 kg",
    price: "₹11.80",
    oldPrice: "₹14.00",
    floor: "₹9.20",
    rating: "4.8",
    contamination: "2.1%",
    lotCode: "CP-884",
    spec: "Certified clean",
    image: cardboardBalesImage,
    color: "lime",
    decay: 46,
  },
  {
    id: "RL-1022",
    material: "Plastic",
    grade: "rPET A",
    title: "Clear PET bottle flakes",
    company: "Aster Beverages",
    location: "Whitefield",
    distance: 14,
    weight: "820 kg",
    price: "₹41.50",
    oldPrice: "₹46.00",
    floor: "₹34.00",
    rating: "5.0",
    contamination: "0.8%",
    lotCode: "HD-512",
    spec: "Washed & inspected",
    image: blueDrumsImage,
    color: "sky",
    decay: 34,
  },
  {
    id: "BL-009",
    material: "Pallets",
    grade: "Mixed A/B",
    title: "Reusable timber pallet pool",
    company: "4 verified sellers",
    location: "North Bengaluru cluster",
    distance: 21,
    weight: "3,280 kg",
    price: "₹8.40",
    oldPrice: "Bulk rate",
    floor: "flat price",
    rating: "4.7",
    contamination: "3 stops",
    lotCode: "WP-201",
    spec: "Grade A heat treated",
    image: woodPalletsImage,
    color: "sun",
    decay: 82,
    bulk: true,
  },
  {
    id: "RL-0993",
    material: "Plastic",
    grade: "LDPE Film",
    title: "Clear LDPE film bales",
    company: "GreenPoly Material Yards",
    location: "Bommasandra Industrial Area",
    distance: 24,
    weight: "2,400 kg",
    price: "₹26.00",
    oldPrice: "₹31.00",
    floor: "₹22.00",
    rating: "4.9",
    contamination: "2.0%",
    lotCode: "LD-993",
    spec: "98% transparency",
    image: filmBalesImage,
    color: "sky",
    decay: 58,
  },
];

export const jobs = [
  { id: "J-208", route: "Peenya → Hoskote", detail: "1,400 kg · 23 km", payout: "₹2,850", status: "Open" },
  { id: "J-204", route: "Whitefield → Bommasandra", detail: "820 kg · 19 km", payout: "₹2,240", status: "In transit" },
  { id: "J-198", route: "Yeshwanthpur → Hebbal", detail: "600 kg · 12 km", payout: "₹1,620", status: "Delivered" },
];

export function BrowseView({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [material, setMaterial] = useState("All");
  const [distance, setDistance] = useState(25);
  const [selected, setSelected] = useState<(typeof listings)[number] | null>(null);
  const [requested, setRequested] = useState<string[]>([]);

  const filtered = useMemo(
    () => listings.filter((item) => (material === "All" || item.material === material) && item.distance <= distance),
    [material, distance],
  );

  const requestLot = (id: string) => {
    if (readOnly) return;
    setRequested((current) => (current.includes(id) ? current : [...current, id]));
    setSelected(null);
  };

  return (
    <>
      <section className="grid gap-5 lg:grid-cols-12">
        <div className="relative flex min-h-[390px] flex-col justify-between overflow-hidden rounded-hero bg-primary p-6 text-primary-foreground lg:col-span-7 sm:p-8">
          <div className="absolute -right-12 top-10 size-48 rounded-full border-[28px] border-primary-foreground/10" />
          <div className="absolute -bottom-20 right-28 size-40 rotate-12 rounded-[2rem] border-[22px] border-highlight/20" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-highlight px-3 py-1 text-xs font-semibold uppercase text-foreground"><Sparkles className="size-3.5" /> 126 lots live now</span>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-[1] sm:text-6xl">Packaging waste has somewhere better to go.</h1>
            <p className="mt-4 max-w-lg text-primary-foreground/75">Buy, sell and move reusable cardboard, plastics and pallets before they reach landfill.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById("lots")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-highlight px-6 py-3 font-display font-semibold text-foreground shadow-button-dark">Browse listings</button>
              <Link to="/dashboard/logistics" className="rounded-full border-2 border-primary-foreground/35 px-6 py-3 font-display font-semibold inline-flex items-center">Open job board</Link>
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
            <span className="text-muted-foreground">Showing {filtered.length} verified lots</span>
            <Link to="/dashboard/logistics" className="inline-flex items-center gap-1 font-semibold text-primary">View logistics map <MapPin className="size-3.5" /></Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((item) => <ListingCard key={item.id} item={item} requested={requested.includes(item.id)} onView={() => setSelected(item)} onRequest={() => requestLot(item.id)} readOnly={readOnly} />)}
        </div>
        {filtered.length === 0 && <div className="rounded-panel border-2 border-dashed border-foreground/15 bg-card p-10 text-center"><Box className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-display text-xl font-semibold">No lots within {distance} km</p><button onClick={() => setDistance(50)} className="mt-3 rounded-full bg-foreground px-4 py-2 text-sm text-background">Expand search</button></div>}
      </section>

      {selected && <ListingDialog item={selected} onClose={() => setSelected(null)} onRequest={() => requestLot(selected.id)} requested={requested.includes(selected.id)} readOnly={readOnly} />}
    </>
  );
}

// Subcomponents
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-primary-foreground/10 p-3 sm:p-4"><p className="font-display text-lg font-semibold sm:text-2xl">{value}</p><p className="mt-1 text-[10px] text-primary-foreground/65 sm:text-xs">{label}</p></div>; }

function ListingCard({ item, requested, onView, onRequest, readOnly }: { item: (typeof listings)[number]; requested: boolean; onView: () => void; onRequest: () => void; readOnly?: boolean }) {
  return <article className="flex min-h-[390px] flex-col rounded-card border border-foreground/10 bg-card p-3 transition-transform hover:-translate-y-1">
    <div className="flex items-center justify-between gap-2 px-0.5 pb-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">{item.material}</span><span className="font-display text-xl font-semibold text-primary">{item.price}<span className="text-[10px] font-normal text-muted-foreground">/{item.material === "Pallets" ? "unit" : "kg"}</span></span></div>
    <div className="relative overflow-hidden rounded-lg">
      <img src={item.image} alt={`${item.title} inventory`} loading="lazy" width={1024} height={640} className="aspect-[16/9] w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-card/90 px-2 py-1 font-mono text-[10px] font-semibold shadow-sm">Lot #{item.lotCode}</span>
    </div>
    <button onClick={onView} className="mt-3 text-left"><h3 className="font-display text-base font-semibold leading-tight">{item.title}</h3><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.company}</p></button>
    <dl className="mt-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3" /> Distance</dt><dd className="font-semibold">{item.distance} km</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Box className="size-3" /> Volume</dt><dd className="font-semibold">{item.weight} ready</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3" /> Spec</dt><dd className="truncate font-semibold">{item.spec}</dd></div>
    </dl>
    <div className={`mt-auto grid gap-2 pt-4 ${readOnly ? "grid-cols-1" : "grid-cols-2"}`}>
      <button onClick={onView} className="rounded-lg bg-secondary py-2 text-xs font-semibold">Details</button>
      {!readOnly && (
        <button disabled={requested} onClick={onRequest} className={`rounded-lg py-2 text-xs font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}>{requested ? <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Reserved</span> : <span className="inline-flex items-center gap-1">Reserve <Check className="size-3.5" /></span>}</button>
      )}
    </div>
  </article>;
}

export function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-foreground/5 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-semibold">{value}</p></div>; }

function ListingDialog({ item, onClose, onRequest, requested, readOnly }: { item: (typeof listings)[number]; onClose: () => void; onRequest: () => void; requested: boolean; readOnly?: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label={`${item.title} details`} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-panel sm:max-w-2xl sm:rounded-panel"><div className="flex items-start justify-between"><div><span className="rounded-full bg-highlight/55 px-3 py-1 text-xs font-semibold uppercase">{item.material} · {item.grade}</span><h2 className="mt-4 font-display text-3xl font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.company} · <Star className="inline size-3.5 fill-primary text-primary" /> {item.rating}</p></div><button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-foreground/5"><X className="size-4" /></button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Quantity" value={item.weight} /><MiniStat label="Distance" value={`${item.distance} km`} /><MiniStat label="Contamination" value={item.contamination} /><MiniStat label="Current price" value={`${item.price}/kg`} /></div><div className="mt-6 rounded-2xl bg-secondary p-4"><div className="flex items-center justify-between"><p className="font-semibold">Live price decay</p><span className="text-sm text-muted-foreground">floor {item.floor}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-accent" style={{ width: `${item.decay}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Listed at {item.oldPrice}</span><span>2h 22m to bulk eligibility</span></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border-2 border-foreground/10 p-4"><RouteIcon className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Estimated logistics</p><p className="font-display text-2xl font-semibold">₹2,850</p><p className="text-xs text-muted-foreground">23 km · cached estimate</p></div><div className="rounded-2xl border-2 border-foreground/10 p-4"><Recycle className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Circular benefit</p><p className="font-display text-2xl font-semibold">1.9 t CO₂e</p><p className="text-xs text-muted-foreground">estimated avoided emissions</p></div></div>{!readOnly ? <button disabled={requested} onClick={onRequest} className={`mt-6 w-full rounded-full py-3 font-display font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground shadow-button-accent"}`}>{requested ? "Request already sent" : item.bulk ? "Purchase lot & create multi-stop job" : "Send claim request"}</button> : <div className="mt-6 rounded-full bg-secondary py-3 text-center font-display text-xs font-semibold text-muted-foreground">Marketplace Feed · Read-only for sellers</div>}</div></div>;
}
