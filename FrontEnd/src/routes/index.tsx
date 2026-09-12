import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Factory,
  Leaf,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  Recycle,
  RouteIcon,
  Search,
  Sparkles,
  Star,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import blueDrumsImage from "@/assets/blue-drums.jpg";
import cardboardBalesImage from "@/assets/cardboard-bales.jpg";
import filmBalesImage from "@/assets/film-bales.jpg";
import woodPalletsImage from "@/assets/wood-pallets.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReLoop Exchange — Circular Materials Marketplace" },
      {
        name: "description",
        content:
          "Buy, sell, batch, and transport reclaimed packaging materials with live pricing and measurable impact.",
      },
      { property: "og:title", content: "ReLoop Exchange — Circular Materials Marketplace" },
      {
        property: "og:description",
        content: "A circular marketplace for reclaimed packaging materials and logistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type View = "Browse" | "My listings" | "Logistics" | "Bulk lots" | "Impact";
type Role = "Buyer" | "Seller";

const listings = [
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

const jobs = [
  { id: "J-208", route: "Peenya → Hoskote", detail: "1,400 kg · 23 km", payout: "₹2,850", status: "Open" },
  { id: "J-204", route: "Whitefield → Bommasandra", detail: "820 kg · 19 km", payout: "₹2,240", status: "In transit" },
  { id: "J-198", route: "Yeshwanthpur → Hebbal", detail: "600 kg · 12 km", payout: "₹1,620", status: "Delivered" },
];

function Index() {
  const [view, setView] = useState<View>("Browse");
  const [role, setRole] = useState<Role>("Buyer");
  const [material, setMaterial] = useState("All");
  const [distance, setDistance] = useState(25);
  const [selected, setSelected] = useState<(typeof listings)[number] | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jobState, setJobState] = useState<Record<string, string>>({});

  const filtered = useMemo(
    () => listings.filter((item) => (material === "All" || item.material === material) && item.distance <= distance),
    [material, distance],
  );

  const chooseView = (next: View) => {
    setView(next);
    setMobileOpen(false);
  };

  const chooseMarketplaceRole = (next: Role) => {
    setRole(next);
    chooseView(next === "Buyer" ? "Browse" : "My listings");
  };

  const requestLot = (id: string) => {
    setRequested((current) => (current.includes(id) ? current : [...current, id]));
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-5">
          <button className="flex items-center gap-3 text-left" onClick={() => chooseView("Browse")}>
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-mark">R</span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold">ReLoop</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">industrial reclaimed marketplace</span>
            </span>
          </button>

          <nav className="hidden items-center rounded-xl border-2 border-foreground/10 bg-card p-1 text-sm font-semibold md:flex" aria-label="Dashboard navigation">
            <button onClick={() => chooseView(role === "Buyer" ? "Browse" : "My listings")} className={`rounded-lg px-5 py-2 transition-colors ${view !== "Logistics" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}>Buy or sell</button>
            <button onClick={() => chooseView("Logistics")} className={`rounded-lg px-5 py-2 transition-colors ${view === "Logistics" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"}`}>Logistics</button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              onClick={() => setNoticeOpen((open) => !open)}
              className="relative grid size-9 place-items-center rounded-full bg-warning/35 transition-transform hover:-translate-y-0.5"
            >
              <Bell className="size-4" />
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">3</span>
            </button>
            <button onClick={() => chooseMarketplaceRole("Seller")} className="hidden rounded-full bg-highlight px-4 py-2 font-display text-sm font-semibold shadow-button sm:inline-flex">
              <Plus className="mr-1.5 size-4" /> List material
            </button>
            <button aria-label="Open menu" onClick={() => setMobileOpen((open) => !open)} className="grid size-9 place-items-center rounded-full bg-foreground text-background md:hidden">
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-foreground/10 px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-2" aria-label="Dashboard navigation">
              <button onClick={() => chooseView(role === "Buyer" ? "Browse" : "My listings")} className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${view !== "Logistics" ? "bg-foreground text-background" : "bg-card"}`}>Buy or sell</button>
              <button onClick={() => chooseView("Logistics")} className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${view === "Logistics" ? "bg-foreground text-background" : "bg-card"}`}>Logistics</button>
            </div>
          </nav>
        )}

        {noticeOpen && (
          <div className="absolute right-4 top-14 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-2 border-foreground/10 bg-card p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between"><strong className="font-display">Notifications</strong><span className="text-xs text-muted-foreground">3 new</span></div>
            <Notice dot="bg-primary" text="Carrier GreenMiles assigned to RL-1022." />
            <Notice dot="bg-accent" text="Cardboard lot RL-1048 dropped to ₹11.80/kg." />
            <Notice dot="bg-highlight" text="Bulk lot BL-009 is open for purchase." />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1240px] space-y-7 px-4 py-6 sm:px-5 sm:py-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">SegFaults · HackOut ’26</p>
            <p className="font-display text-xl font-semibold">{view === "Logistics" ? "Logistics operations" : "Good morning, MetroPack Industries"}</p>
          </div>
          {view !== "Logistics" && <div className="flex w-fit rounded-xl border-2 border-foreground/10 bg-card p-1 text-xs font-semibold" aria-label="Marketplace mode">
            {(["Buyer", "Seller"] as Role[]).map((item) => <button key={item} onClick={() => chooseMarketplaceRole(item)} className={`rounded-lg px-5 py-2 ${role === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{item === "Buyer" ? "Buy materials" : "Sell materials"}</button>)}
          </div>}
        </div>

        {view !== "Logistics" && <nav className="flex gap-2 overflow-x-auto border-b-2 border-foreground/10 pb-3" aria-label="Marketplace sections">
          {(["Browse", "My listings", "Bulk lots", "Impact"] as View[]).map((item) => <button key={item} onClick={() => chooseView(item)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${view === item ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{item}</button>)}
        </nav>}

        {view === "Browse" && (
          <BrowseView
            role={role}
            material={material}
            setMaterial={setMaterial}
            distance={distance}
            setDistance={setDistance}
            filtered={filtered}
            requested={requested}
            setSelected={setSelected}
            requestLot={requestLot}
            chooseView={chooseView}
          />
        )}
        {view === "My listings" && <ListingsView />}
        {view === "Logistics" && <LogisticsView jobState={jobState} setJobState={setJobState} />}
        {view === "Bulk lots" && <BulkView onSelect={() => {
          const bulkLot = listings.find((item) => item.bulk);
          if (bulkLot) setSelected(bulkLot);
        }} />}
        {view === "Impact" && <ImpactView />}
      </main>

      {selected && <ListingDialog item={selected} onClose={() => setSelected(null)} onRequest={() => requestLot(selected.id)} requested={requested.includes(selected.id)} />}
    </div>
  );
}

function BrowseView({ role, material, setMaterial, distance, setDistance, filtered, requested, setSelected, requestLot, chooseView }: {
  role: Role;
  material: string;
  setMaterial: (value: string) => void;
  distance: number;
  setDistance: (value: number) => void;
  filtered: typeof listings;
  requested: string[];
  setSelected: (item: (typeof listings)[number]) => void;
  requestLot: (id: string) => void;
  chooseView: (view: View) => void;
}) {
  return <>
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
            <button onClick={() => chooseView("Logistics")} className="rounded-full border-2 border-primary-foreground/35 px-6 py-3 font-display font-semibold">Open job board</button>
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
          <button onClick={() => chooseView("Logistics")} className="inline-flex items-center gap-1 font-semibold text-primary">View logistics map <MapPin className="size-3.5" /></button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {filtered.map((item) => <ListingCard key={item.id} item={item} requested={requested.includes(item.id)} onView={() => setSelected(item)} onRequest={() => requestLot(item.id)} />)}
      </div>
      {filtered.length === 0 && <div className="rounded-panel border-2 border-dashed border-foreground/15 bg-card p-10 text-center"><Box className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-display text-xl font-semibold">No lots within {distance} km</p><button onClick={() => setDistance(50)} className="mt-3 rounded-full bg-foreground px-4 py-2 text-sm text-background">Expand search</button></div>}
    </section>

    <section className="grid gap-5 lg:grid-cols-12">
      <div className="rounded-panel border-2 border-foreground/10 bg-card p-5 lg:col-span-7 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Live logistics</h2><button onClick={() => chooseView("Logistics")} className="flex items-center gap-1 text-sm font-semibold text-primary">View board <ArrowRight className="size-4" /></button></div>
        <div className="mt-3 divide-y-2 divide-dashed divide-foreground/10">{jobs.map((job) => <JobRow key={job.id} job={job} />)}</div>
      </div>
      <div className="flex flex-col rounded-panel bg-foreground p-6 text-background lg:col-span-5">
        <span className="w-fit rounded-full bg-highlight px-3 py-1 text-xs font-semibold uppercase text-foreground">Next transaction</span>
        <h3 className="mt-3 font-display text-2xl font-semibold">Commit cardboard pickup</h3>
        <div className="mt-5 space-y-2 text-sm"><InfoRow label="Route distance" value="23 km" /><InfoRow label="Load weight" value="1,400 kg" /><InfoRow label="Estimated freight" value="₹2,850" /><InfoRow label="CO₂e avoided" value="+1.9 t" accent /></div>
        <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/15 p-3 text-xs"><p className="font-semibold text-highlight">Guaranteed recycler fallback</p><p className="mt-1 text-background/65">If this lot remains unsold at floor, GreenLoop Recyclers accepts it automatically.</p></div>
        <button className="mt-5 rounded-full bg-highlight py-3 font-display font-semibold text-foreground shadow-button-dark">Review & commit</button>
      </div>
    </section>
  </>;
}

function ListingCard({ item, requested, onView, onRequest }: { item: (typeof listings)[number]; requested: boolean; onView: () => void; onRequest: () => void }) {
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
    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
      <button onClick={onView} className="rounded-lg bg-secondary py-2 text-xs font-semibold">Details</button>
      <button disabled={requested} onClick={onRequest} className={`rounded-lg py-2 text-xs font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"}`}>{requested ? <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Reserved</span> : <span className="inline-flex items-center gap-1">Reserve <Check className="size-3.5" /></span>}</button>
    </div>
  </article>;
}

function ListingsView() {
  const [status, setStatus] = useState("Pending");
  return <section>
    <PageTitle icon={<Factory />} eyebrow="Seller workspace" title="Your material listings" copy="Manage requests, price decay, and fallback status." />
    <div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
      <div className="rounded-panel border-2 border-foreground/10 bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="rounded-full bg-highlight/60 px-3 py-1 text-xs font-semibold">CARDBOARD · OCC 11</span><h2 className="mt-3 font-display text-2xl font-semibold">Double-wall corrugated bales</h2><p className="text-sm text-muted-foreground">1,400 kg · Peenya · Listed 46 minutes ago</p></div><div className="text-right"><p className="font-display text-3xl font-semibold">₹11.80/kg</p><p className="text-xs text-muted-foreground">floor ₹9.20 · 3h 14m left</p></div></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-foreground/8"><div className="h-full w-[46%] bg-primary" /></div><div className="mt-6 rounded-2xl bg-secondary p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Incoming request</p><p className="mt-1 font-semibold">EcoForm Packaging · ★ 4.9</p><p className="text-sm text-muted-foreground">Freight estimate ₹2,850</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Accepted" ? "bg-primary/15 text-primary" : status === "Declined" ? "bg-accent/15 text-accent" : "bg-warning/40"}`}>{status}</span></div>{status === "Pending" && <div className="mt-4 flex gap-2"><button onClick={() => setStatus("Accepted")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Accept & lock</button><button onClick={() => setStatus("Declined")} className="rounded-full border-2 border-foreground/10 px-5 py-2 text-sm font-semibold">Decline</button></div>}{status !== "Pending" && <p className="mt-4 text-sm font-semibold">{status === "Accepted" ? "Listing locked. Logistics job J-208 created." : "Request closed. Listing remains open."}</p>}</div></div>
      <div className="rounded-panel bg-primary p-6 text-primary-foreground"><Clock3 className="size-7" /><h3 className="mt-4 font-display text-2xl font-semibold">Fallback clock</h3><p className="mt-2 text-sm text-primary-foreground/70">At 80% decay this listing joins a nearby bulk lot. At floor, the fixed recycler takes over.</p><div className="mt-6 rounded-2xl bg-primary-foreground/10 p-4"><p className="text-xs uppercase text-primary-foreground/60">Next threshold</p><p className="mt-1 font-display text-2xl font-semibold">2h 22m</p><p className="mt-1 text-xs text-primary-foreground/60">Eligible for bulk batching</p></div></div>
    </div>
  </section>;
}

function LogisticsView({ jobState, setJobState }: { jobState: Record<string, string>; setJobState: (value: Record<string, string>) => void }) {
  const update = (id: string, current: string) => setJobState({ ...jobState, [id]: current === "Open" ? "Assigned" : current === "Assigned" || current === "In transit" ? "Delivered" : current });
  return <section>
    <PageTitle icon={<Truck />} eyebrow="Logistics dashboard" title="Pickup & delivery jobs" copy="Manage available, assigned, in-transit, and delivered loads from one workspace." />
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Available" value="1 job" /><MiniStat label="Assigned" value="1 job" /><MiniStat label="In transit" value="1 job" /><MiniStat label="Delivered today" value="6 jobs" /></div>
    <div className="grid gap-5 lg:grid-cols-3">
      {jobs.map((job, index) => { const status = jobState[job.id] ?? job.status; return <article key={job.id} className="rounded-card border-2 border-foreground/10 bg-card p-5"><div className="flex items-center justify-between"><span className="font-display text-lg font-semibold">{job.id}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Open" ? "bg-accent text-accent-foreground" : status === "Delivered" ? "bg-primary/15 text-primary" : "bg-warning/45"}`}>{status}</span></div><div className="my-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-secondary"><MapPin className="size-5" /></span><div><p className="font-semibold">{job.route}</p><p className="text-sm text-muted-foreground">{job.detail}</p></div></div><div className="flex items-end justify-between"><div><p className="text-xs uppercase text-muted-foreground">Carrier payout</p><p className="font-display text-2xl font-semibold">{job.payout}</p></div>{status !== "Delivered" && <button onClick={() => update(job.id, status)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{status === "Open" ? "Claim job" : "Mark delivered"}</button>}{status === "Delivered" && <PackageCheck className="size-7 text-primary" />}</div>{index === 0 && status === "Assigned" && <p className="mt-4 rounded-xl bg-highlight/40 p-3 text-xs font-semibold">Buyer and seller notified. Job locked to GreenMiles Logistics.</p>}</article>; })}
    </div>
  </section>;
}

function BulkView({ onSelect }: { onSelect: () => void }) {
  return <section><PageTitle icon={<Box />} eyebrow="Stale-stock recovery" title="Bulk material pools" copy="Nearby near-floor listings combine automatically into purchasable lots." /><div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="rounded-panel border-2 border-warning bg-warning/20 p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">OPEN FOR PURCHASE</span><h2 className="mt-4 font-display text-3xl font-semibold">Reusable timber pallet pool</h2><p className="mt-1 text-muted-foreground">BL-009 · 4 sellers · 3 pickup stops</p></div><p className="font-display text-3xl font-semibold">₹8.40<span className="text-base">/kg</span></p></div><div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Total weight" value="3,280 kg" /><MiniStat label="Pickup radius" value="18 km" /><MiniStat label="Saved vs new" value="₹42,800" /><MiniStat label="CO₂e benefit" value="2.4 t" /></div><div className="flex items-center gap-2"><span className="size-3 rounded-full bg-primary" /><span className="h-0.5 flex-1 bg-foreground/15" /><span className="size-3 rounded-full bg-primary" /><span className="h-0.5 flex-1 bg-foreground/15" /><span className="size-3 rounded-full bg-primary" /><span className="h-0.5 flex-1 bg-foreground/15" /><span className="size-3 rounded-full bg-accent" /></div><div className="mt-6 flex flex-wrap gap-3"><button onClick={onSelect} className="rounded-full bg-accent px-6 py-3 font-display font-semibold text-accent-foreground shadow-button-accent">Review bulk lot</button><button className="rounded-full border-2 border-foreground/15 px-6 py-3 font-display font-semibold">View contributors</button></div></div><div className="rounded-panel bg-foreground p-6 text-background"><Recycle className="size-8 text-highlight" /><h3 className="mt-4 font-display text-2xl font-semibold">Whichever resolves first wins.</h3><p className="mt-3 text-sm leading-relaxed text-background/65">Each item keeps its recycler fallback clock while pooled. If the bulk lot sells first, a multi-stop job is created. If an item hits its deadline first, it exits the pool automatically.</p><div className="mt-6 rounded-2xl bg-background/10 p-4"><p className="text-xs uppercase text-background/55">Forming pool</p><p className="mt-1 font-semibold">rPET flakes · 2 of 4 lots</p><div className="mt-3 h-2 rounded-full bg-background/10"><div className="h-full w-1/2 rounded-full bg-highlight" /></div></div></div></div></section>;
}

function ImpactView() {
  return <section><PageTitle icon={<Leaf />} eyebrow="Verified after delivery" title="Circular impact" copy="Environmental and economic outcomes from completed exchanges." /><div className="grid gap-5 md:grid-cols-3"><ImpactCard icon={<Recycle />} label="Diverted from landfill" value="48,210 kg" change="+8.4% this month" tone="bg-highlight/45" /><ImpactCard icon={<Leaf />} label="Estimated CO₂e avoided" value="36.4 t" change="EPA WARM factors" tone="bg-primary/15" /><ImpactCard icon={<CircleDollarSign />} label="Combined cost savings" value="₹12.8L" change="Buyer + seller value" tone="bg-info/20" /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="rounded-panel border-2 border-foreground/10 bg-card p-6"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Material diverted</h2><span className="text-xs text-muted-foreground">Last 6 months</span></div><div className="mt-8 flex h-52 items-end gap-3 sm:gap-5">{[38,54,48,68,76,92].map((height, index) => <div key={height + index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-xl bg-primary" style={{ height: `${height}%` }} /><span className="text-xs text-muted-foreground">{["Apr","May","Jun","Jul","Aug","Sep"][index]}</span></div>)}</div></div><div className="rounded-panel bg-primary p-6 text-primary-foreground"><Users className="size-8" /><h3 className="mt-4 font-display text-2xl font-semibold">Circular network</h3><div className="mt-5 space-y-4"><InfoRow label="Waste generators" value="42" /><InfoRow label="Material buyers" value="31" /><InfoRow label="Logistics partners" value="12" /><InfoRow label="Completed exchanges" value="186" /></div><div className="mt-6 rounded-2xl bg-primary-foreground/10 p-4 text-sm">Average partner rating <strong className="float-right">★ 4.8</strong></div></div></div></section>;
}

function ListingDialog({ item, onClose, onRequest, requested }: { item: (typeof listings)[number]; onClose: () => void; onRequest: () => void; requested: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label={`${item.title} details`} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-panel sm:max-w-2xl sm:rounded-panel"><div className="flex items-start justify-between"><div><span className="rounded-full bg-highlight/55 px-3 py-1 text-xs font-semibold uppercase">{item.material} · {item.grade}</span><h2 className="mt-4 font-display text-3xl font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.company} · <Star className="inline size-3.5 fill-primary text-primary" /> {item.rating}</p></div><button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-foreground/5"><X className="size-4" /></button></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Quantity" value={item.weight} /><MiniStat label="Distance" value={`${item.distance} km`} /><MiniStat label="Contamination" value={item.contamination} /><MiniStat label="Current price" value={`${item.price}/kg`} /></div><div className="mt-6 rounded-2xl bg-secondary p-4"><div className="flex items-center justify-between"><p className="font-semibold">Live price decay</p><span className="text-sm text-muted-foreground">floor {item.floor}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-accent" style={{ width: `${item.decay}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Listed at {item.oldPrice}</span><span>2h 22m to bulk eligibility</span></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border-2 border-foreground/10 p-4"><RouteIcon className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Estimated logistics</p><p className="font-display text-2xl font-semibold">₹2,850</p><p className="text-xs text-muted-foreground">23 km · cached estimate</p></div><div className="rounded-2xl border-2 border-foreground/10 p-4"><Recycle className="size-5 text-primary" /><p className="mt-3 text-xs uppercase text-muted-foreground">Circular benefit</p><p className="font-display text-2xl font-semibold">1.9 t CO₂e</p><p className="text-xs text-muted-foreground">estimated avoided emissions</p></div></div><button disabled={requested} onClick={onRequest} className={`mt-6 w-full rounded-full py-3 font-display font-semibold ${requested ? "bg-primary/15 text-primary" : "bg-accent text-accent-foreground shadow-button-accent"}`}>{requested ? "Request already sent" : item.bulk ? "Purchase lot & create multi-stop job" : "Send claim request"}</button></div></div>;
}

function PageTitle({ icon, eyebrow, title, copy }: { icon: React.ReactNode; eyebrow: string; title: string; copy: string }) { return <div className="mb-6 flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-highlight [&>svg]:size-6">{icon}</span><div><p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p><h1 className="font-display text-4xl font-semibold">{title}</h1><p className="mt-1 text-muted-foreground">{copy}</p></div></div>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl bg-primary-foreground/10 p-3 sm:p-4"><p className="font-display text-lg font-semibold sm:text-2xl">{value}</p><p className="mt-1 text-[10px] text-primary-foreground/65 sm:text-xs">{label}</p></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-foreground/5 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-semibold">{value}</p></div>; }
function Notice({ dot, text }: { dot: string; text: string }) { return <div className="flex gap-3 border-t border-foreground/8 py-3 first:border-0"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} /><p className="text-sm leading-snug">{text}</p></div>; }
function JobRow({ job }: { job: (typeof jobs)[number] }) { return <div className="flex items-center gap-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.status === "Open" ? "bg-accent text-accent-foreground" : job.status === "Delivered" ? "bg-primary/15 text-primary" : "bg-warning/45"}`}>{job.status}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{job.route}</p><p className="text-xs text-muted-foreground">{job.detail} · {job.payout}</p></div><ChevronRight className="size-4 text-muted-foreground" /></div>; }
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className="flex justify-between gap-4"><span className="opacity-60">{label}</span><strong className={accent ? "text-highlight" : ""}>{value}</strong></div>; }
function ImpactCard({ icon, label, value, change, tone }: { icon: React.ReactNode; label: string; value: string; change: string; tone: string }) { return <article className="rounded-card border-2 border-foreground/10 bg-card p-5"><span className={`grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</span><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 font-display text-4xl font-semibold">{value}</p><p className="mt-2 text-xs font-semibold text-primary">{change}</p></article>; }