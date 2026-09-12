import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageTitle } from "../../components/PageTitle";
import { jobs } from "../../components/views/BrowseView";

export const Route = createFileRoute("/dashboard/buyer")({
  component: BuyerDashboard,
});

function BuyerDashboard() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-5 lg:col-span-7 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Live logistics</h2>
            <Link to="/dashboard/logistics" className="flex items-center gap-1 text-sm font-semibold text-primary">View board <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-3 divide-y-2 divide-dashed divide-foreground/10">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 py-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.status === "Open" ? "bg-accent text-accent-foreground" : job.status === "Delivered" ? "bg-primary/15 text-primary" : "bg-warning/45"}`}>{job.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{job.route}</p>
                  <p className="text-xs text-muted-foreground">{job.detail} · {job.payout}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-panel bg-foreground p-6 text-background lg:col-span-5">
          <span className="w-fit rounded-full bg-highlight px-3 py-1 text-xs font-semibold uppercase text-foreground">Next transaction</span>
          <h3 className="mt-3 font-display text-2xl font-semibold">Commit cardboard pickup</h3>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="opacity-60">Route distance</span><strong>23 km</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">Load weight</span><strong>1,400 kg</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">Estimated freight</span><strong>₹2,850</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">CO₂e avoided</span><strong className="text-highlight">+1.9 t</strong></div>
          </div>
          <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/15 p-3 text-xs">
            <p className="font-semibold text-highlight">Guaranteed recycler fallback</p>
            <p className="mt-1 text-background/65">If this lot remains unsold at floor, GreenLoop Recyclers accepts it automatically.</p>
          </div>
          <button className="mt-5 rounded-full bg-highlight py-3 font-display font-semibold text-foreground shadow-button-dark">Review & commit</button>
        </div>
      </div>
    </section>
  );
}
