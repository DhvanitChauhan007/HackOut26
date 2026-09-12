import { createFileRoute } from "@tanstack/react-router";
import { MapPin, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { jobs } from "../../components/views/BrowseView";
import { MiniStat } from "../../components/views/BrowseView";

export const Route = createFileRoute("/dashboard/logistics")({
  component: LogisticsDashboard,
});

function LogisticsDashboard() {
  const [jobState, setJobState] = useState<Record<string, string>>({});
  
  const update = (id: string, current: string) => {
    setJobState({ 
      ...jobState, 
      [id]: current === "Open" ? "Assigned" : current === "Assigned" || current === "In transit" ? "Delivered" : current 
    });
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle icon={<Truck />} eyebrow="Logistics dashboard" title="Pickup & delivery jobs" copy="Manage available, assigned, in-transit, and delivered loads from one workspace." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Available" value="1 job" />
        <MiniStat label="Assigned" value="1 job" />
        <MiniStat label="In transit" value="1 job" />
        <MiniStat label="Delivered today" value="6 jobs" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {jobs.map((job, index) => { 
          const status = jobState[job.id] ?? job.status; 
          return (
            <article key={job.id} className="rounded-card border-2 border-foreground/10 bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">{job.id}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Open" ? "bg-accent text-accent-foreground" : status === "Delivered" ? "bg-primary/15 text-primary" : "bg-warning/45"}`}>{status}</span>
              </div>
              <div className="my-5 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-secondary"><MapPin className="size-5" /></span>
                <div>
                  <p className="font-semibold">{job.route}</p>
                  <p className="text-sm text-muted-foreground">{job.detail}</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Carrier payout</p>
                  <p className="font-display text-2xl font-semibold">{job.payout}</p>
                </div>
                {status !== "Delivered" && (
                  <button onClick={() => update(job.id, status)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{status === "Open" ? "Claim job" : "Mark delivered"}</button>
                )}
                {status === "Delivered" && <PackageCheck className="size-7 text-primary" />}
              </div>
              {index === 0 && status === "Assigned" && <p className="mt-4 rounded-xl bg-highlight/40 p-3 text-xs font-semibold">Buyer and seller notified. Job locked to GreenMiles Logistics.</p>}
            </article>
          ); 
        })}
      </div>
    </section>
  );
}
