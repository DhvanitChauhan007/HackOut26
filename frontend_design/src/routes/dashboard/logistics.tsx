import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Map, MapPin, PackageCheck, Truck, AlertCircle } from "lucide-react";
import { useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { MiniStat } from "../../components/views/BrowseView";
import { useAuthGuard } from "../../lib/auth";
import { useJobs } from "../../lib/useJobs";

export const Route = createFileRoute("/dashboard/logistics")({
  component: LogisticsDashboard,
});

function LogisticsDashboard() {
  useAuthGuard();
  const { jobs, loading, error, claimJob, deliverJob, counts } = useJobs();
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleClaim = async (id: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      await claimJob(id);
      setJustClaimed(id);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliver = async (id: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      await deliverJob(id);
      if (justClaimed === id) setJustClaimed(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "open") return "Open";
    if (s === "assigned") return "Assigned";
    if (s === "delivered") return "Delivered";
    return s;
  };

  const statusClass = (s: string) => {
    if (s === "open") return "bg-accent text-accent-foreground";
    if (s === "delivered") return "bg-primary/15 text-primary";
    return "bg-warning/45";
  };

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle
        icon={<Truck />}
        eyebrow="Logistics dashboard"
        title="Pickup & delivery jobs"
        copy="Manage available, assigned, in-transit, and delivered loads from one workspace."
      />

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Available" value={loading ? "—" : `${counts.open} job${counts.open !== 1 ? "s" : ""}`} />
        <MiniStat label="Assigned" value={loading ? "—" : `${counts.assigned} job${counts.assigned !== 1 ? "s" : ""}`} />
        <MiniStat label="In transit" value={loading ? "—" : `${counts.in_transit} jobs`} />
        <MiniStat label="Delivered today" value={loading ? "—" : `${counts.delivered} job${counts.delivered !== 1 ? "s" : ""}`} />
      </div>

      {/* Global action error */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/12 px-4 py-3 text-sm font-semibold text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5 text-destructive">
          <AlertCircle className="size-8" />
          <p className="font-semibold">Failed to load jobs</p>
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && jobs.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-foreground/15 bg-card text-muted-foreground">
          <Truck className="size-8 opacity-40" />
          <p className="font-semibold">No jobs available right now</p>
          <p className="text-xs">New jobs appear here once a buyer commits to a transaction.</p>
        </div>
      )}

      {/* Job cards */}
      {!loading && !error && jobs.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          {jobs.map((job) => {
            const isLoading = actionLoading === job.id;
            return (
              <article key={job.id} className="flex flex-col rounded-card border-2 border-foreground/10 bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold">
                    J-{job.id.slice(-4).toUpperCase()}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(job.status)}`}>
                    {statusLabel(job.status)}
                  </span>
                </div>

                <div className="my-5 flex items-start gap-3">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
                    <MapPin className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{job.route}</p>
                    <p className="text-sm text-muted-foreground">{job.detail} • {job.eta}</p>
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-xs uppercase text-muted-foreground">Carrier payout</p>
                  <p className="font-display text-2xl font-semibold">{job.payout}</p>
                </div>

                <div className="mt-4">
                  {job.status === "open" ? (
                    <button
                      onClick={() => handleClaim(job.id)}
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 disabled:translate-y-0"
                    >
                      {isLoading && <Loader2 className="size-3.5 animate-spin" />}
                      Claim job
                    </button>
                  ) : job.status !== "delivered" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to="/dashboard/map/$id"
                        params={{ id: job.id }}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-amber-950 transition-all hover:-translate-y-0.5 hover:bg-amber-400/90"
                      >
                        <Map className="size-3.5" /> View Map
                      </Link>
                      <button
                        onClick={() => handleDeliver(job.id)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 disabled:translate-y-0"
                      >
                        {isLoading && <Loader2 className="size-3.5 animate-spin" />}
                        Mark delivered
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary">
                      <PackageCheck className="size-4" /> Delivered
                    </div>
                  )}
                </div>

                {justClaimed === job.id && job.status === "assigned" && (
                  <p className="mt-4 animate-in fade-in slide-in-from-top-2 rounded-xl bg-highlight/40 p-3 text-xs font-semibold text-foreground">
                    Buyer and seller notified. Job locked to your logistics profile.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
