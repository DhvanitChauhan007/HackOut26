import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Factory } from "lucide-react";
import { useState } from "react";
import { PageTitle } from "../../components/PageTitle";

export const Route = createFileRoute("/dashboard/seller")({
  component: SellerDashboard,
});

function SellerDashboard() {
  const [status, setStatus] = useState("Pending");

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle icon={<Factory />} eyebrow="Seller workspace" title="Your material listings" copy="Manage requests, price decay, and fallback status." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="rounded-full bg-highlight/60 px-3 py-1 text-xs font-semibold">CARDBOARD · OCC 11</span>
              <h2 className="mt-3 font-display text-2xl font-semibold">Double-wall corrugated bales</h2>
              <p className="text-sm text-muted-foreground">1,400 kg · Peenya · Listed 46 minutes ago</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-semibold">₹11.80/kg</p>
              <p className="text-xs text-muted-foreground">floor ₹9.20 · 3h 14m left</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-foreground/8">
            <div className="h-full w-[46%] bg-primary" />
          </div>
          <div className="mt-6 rounded-2xl bg-secondary p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Incoming request</p>
                <p className="mt-1 font-semibold">EcoForm Packaging · ★ 4.9</p>
                <p className="text-sm text-muted-foreground">Freight estimate ₹2,850</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Accepted" ? "bg-primary/15 text-primary" : status === "Declined" ? "bg-accent/15 text-accent" : "bg-warning/40"}`}>{status}</span>
            </div>
            {status === "Pending" && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => setStatus("Accepted")} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Accept & lock</button>
                <button onClick={() => setStatus("Declined")} className="rounded-full border-2 border-foreground/10 px-5 py-2 text-sm font-semibold">Decline</button>
              </div>
            )}
            {status !== "Pending" && <p className="mt-4 text-sm font-semibold">{status === "Accepted" ? "Listing locked. Logistics job J-208 created." : "Request closed. Listing remains open."}</p>}
          </div>
        </div>
        <div className="rounded-panel bg-primary p-6 text-primary-foreground">
          <Clock3 className="size-7" />
          <h3 className="mt-4 font-display text-2xl font-semibold">Fallback clock</h3>
          <p className="mt-2 text-sm text-primary-foreground/70">At 80% decay this listing joins a nearby bulk lot. At floor, the fixed recycler takes over.</p>
          <div className="mt-6 rounded-2xl bg-primary-foreground/10 p-4">
            <p className="text-xs uppercase text-primary-foreground/60">Next threshold</p>
            <p className="mt-1 font-display text-2xl font-semibold">2h 22m</p>
            <p className="mt-1 text-xs text-primary-foreground/60">Eligible for bulk batching</p>
          </div>
        </div>
      </div>
    </section>
  );
}
