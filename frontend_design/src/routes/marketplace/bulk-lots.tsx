import { createFileRoute } from "@tanstack/react-router";
import { Box, Recycle, Users, X } from "lucide-react";
import { PageTitle } from "../../components/PageTitle";
import { MiniStat } from "../../components/views/BrowseView";
import { useState, useEffect } from "react";
import { apiRequest } from "../../lib/apiClient";

export const Route = createFileRoute("/marketplace/bulk-lots")({
  component: BulkLotsPage,
});

function BulkLotsPage() {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [contributors, setContributors] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/bulk-lots")
      .then((res) => res.json())
      .then((data) => { setLots(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handlePurchase = async (lot: any) => {
    setPurchasing(lot.id);
    try {
      const res = await apiRequest(`/api/bulk-lots/${lot.id}/purchase`, { method: "POST" });
      if (res.ok) {
        alert(`Bulk lot purchased! A multi-stop job has been created for logistics.`);
        setLots((prev) => prev.filter((l) => l.id !== lot.id));
      } else {
        const err = await res.json();
        alert("Purchase failed: " + (err.error || "Unknown error"));
      }
    } catch {
      alert("Failed to connect to server.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle icon={<Box />} eyebrow="Stale-stock recovery" title="Bulk material pools" copy="Nearby near-floor listings combine automatically into purchasable lots." />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        {/* Left: Lots list */}
        <div className="space-y-4">
          {loading && <p className="text-muted-foreground">Loading open pools...</p>}
          {!loading && lots.length === 0 && (
            <div className="rounded-panel border-2 border-dashed border-foreground/15 p-10 text-center">
              <Box className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-display text-xl font-semibold">No open pools right now</p>
              <p className="mt-1 text-sm text-muted-foreground">Lots form automatically when multiple sellers near each other hit the price floor.</p>
            </div>
          )}

          {lots.map((lot) => (
            <div key={lot.id} className="rounded-panel border-2 border-warning bg-warning/20 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">OPEN FOR PURCHASE</span>
                  <h2 className="mt-4 font-display text-3xl font-semibold">{lot.sub_grade} {lot.material_type} pool</h2>
                  <p className="mt-1 text-muted-foreground">Lot #{lot.id.slice(0, 6)} · {lot.bulk_lot_items?.length ?? 0} contributor{lot.bulk_lot_items?.length !== 1 ? "s" : ""}</p>
                </div>
                <p className="font-display text-3xl font-semibold">
                  ₹{Number(lot.bulk_rate_per_kg).toFixed(2)}<span className="text-base font-normal text-muted-foreground">/kg</span>
                </p>
              </div>

              <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Total weight" value={`${lot.total_quantity} kg`} />
                <MiniStat label="Pickup stops" value={`${lot.bulk_lot_items?.length ?? 1}`} />
                <MiniStat label="Total value" value={`₹${(lot.total_quantity * lot.bulk_rate_per_kg).toFixed(0)}`} />
                <MiniStat label="CO₂e saved" value={`${((lot.total_quantity * 3.12) / 1000).toFixed(1)} t`} />
              </div>

              {/* Pickup route dots */}
              {(lot.bulk_lot_items?.length ?? 0) > 1 && (
                <div className="mb-6 flex items-center gap-2">
                  {lot.bulk_lot_items.map((_: any, i: number) => (
                    <div key={i} className="flex flex-1 items-center gap-2">
                      <span className="size-3 rounded-full bg-primary flex-shrink-0" />
                      {i < lot.bulk_lot_items.length - 1 && <span className="h-0.5 flex-1 bg-foreground/15" />}
                    </div>
                  ))}
                  <span className="size-3 rounded-full bg-accent flex-shrink-0" />
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handlePurchase(lot)}
                  disabled={purchasing === lot.id}
                  className="rounded-full bg-accent px-6 py-3 font-display font-semibold text-accent-foreground shadow-button-accent disabled:opacity-60"
                >
                  {purchasing === lot.id ? "Processing..." : "Purchase & Create Route"}
                </button>
                {lot.bulk_lot_items?.length > 0 && (
                  <button
                    onClick={() => setContributors(lot.bulk_lot_items)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-foreground/15 px-6 py-3 font-display font-semibold"
                  >
                    <Users className="size-4" /> View contributors
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Info panel */}
        <div className="flex flex-col rounded-panel bg-foreground p-6 text-background">
          <Recycle className="size-8 text-highlight" />
          <h3 className="mt-4 font-display text-2xl font-semibold">Whichever resolves first wins.</h3>
          <p className="mt-3 text-sm leading-relaxed text-background/65">
            Each item keeps its recycler fallback clock while pooled. If the bulk lot sells first, a multi-stop job is created. If an item hits its deadline first, it exits the pool automatically.
          </p>

          {lots.length > 0 && lots[0].bulk_lot_items?.length > 0 && (
            <div className="mt-6 rounded-2xl bg-background/10 p-4">
              <p className="text-xs uppercase text-background/55">Forming pool</p>
              <p className="mt-1 font-semibold">{lots[0].sub_grade} {lots[0].material_type} · {lots[0].bulk_lot_items.length} of {lots[0].bulk_lot_items.length} lots</p>
              <div className="mt-3 h-2 rounded-full bg-background/10">
                <div className="h-full rounded-full bg-highlight" style={{ width: "100%" }} />
              </div>
              <p className="mt-2 text-xs text-background/50">{lots[0].total_quantity} kg ready for purchase</p>
            </div>
          )}

          <div className="mt-auto pt-6 rounded-2xl bg-background/10 p-4 text-sm">
            <p className="font-semibold text-highlight">How bulk pricing works</p>
            <p className="mt-1 text-background/65">Sellers opt in at near-floor prices. You get a flat bulk rate cheaper than buying individually. Logistics creates one multi-stop route.</p>
          </div>
        </div>
      </div>

      {/* Contributors Modal */}
      {contributors && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 backdrop-blur-sm p-4" onClick={() => setContributors(null)}>
          <div className="w-full max-w-md rounded-panel bg-card p-6 shadow-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-xl font-semibold">Pool contributors</h3>
              <button onClick={() => setContributors(null)} className="grid size-8 place-items-center rounded-full bg-foreground/5"><X className="size-4" /></button>
            </div>
            <div className="space-y-3">
              {contributors.map((item: any, i: number) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 p-3">
                  <span className="grid size-8 place-items-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{i + 1}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{item.users?.name ?? "Unknown seller"}</p>
                    <p className="text-xs text-muted-foreground">{item.listings?.sub_grade} {item.listings?.material_type} · {item.quantity} kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
