import { createFileRoute } from "@tanstack/react-router";
import { Box, Recycle } from "lucide-react";
import { PageTitle } from "../../components/PageTitle";
import { MiniStat } from "../../components/views/BrowseView";

export const Route = createFileRoute("/marketplace/bulk-lots")({
  component: BulkLotsPage,
});

function BulkLotsPage() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle icon={<Box />} eyebrow="Stale-stock recovery" title="Bulk material pools" copy="Nearby near-floor listings combine automatically into purchasable lots." />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-panel border-2 border-warning bg-warning/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">OPEN FOR PURCHASE</span>
              <h2 className="mt-4 font-display text-3xl font-semibold">Reusable timber pallet pool</h2>
              <p className="mt-1 text-muted-foreground">BL-009 · 4 sellers · 3 pickup stops</p>
            </div>
            <p className="font-display text-3xl font-semibold">₹8.40<span className="text-base">/kg</span></p>
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
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-accent px-6 py-3 font-display font-semibold text-accent-foreground shadow-button-accent">Purchase & Create Route</button>
            <button className="rounded-full border-2 border-foreground/15 px-6 py-3 font-display font-semibold">View contributors</button>
          </div>
        </div>
        <div className="rounded-panel bg-foreground p-6 text-background">
          <Recycle className="size-8 text-highlight" />
          <h3 className="mt-4 font-display text-2xl font-semibold">Whichever resolves first wins.</h3>
          <p className="mt-3 text-sm leading-relaxed text-background/65">Each item keeps its recycler fallback clock while pooled. If the bulk lot sells first, a multi-stop job is created. If an item hits its deadline first, it exits the pool automatically.</p>
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
