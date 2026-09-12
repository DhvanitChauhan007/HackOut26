import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { useJobs, Job } from "../../lib/useJobs";
import {
  Wallet,
  TrendingUp,
  Calendar,
  Award,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  PackageCheck,
  Truck,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard/wages")({
  component: WagesPage,
});

const PIE_COLORS = ["#16a34a", "#0284c7", "#f59e0b", "#8b5cf6", "#ec4899"];

function WagesPage() {
  const { jobs, loading } = useJobs();
  const [timeframe, setTimeframe] = useState<"week" | "month">("week");

  // Calculate delivered jobs and in-transit jobs
  const deliveredJobs = useMemo(() => {
    return jobs.filter((j) => j.status === "delivered");
  }, [jobs]);

  const inTransitJobs = useMemo(() => {
    return jobs.filter((j) => j.status === "assigned");
  }, [jobs]);

  // Date boundaries
  const now = new Date();
  const todayStr = now.toDateString();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Today's Wages
  const todayStats = useMemo(() => {
    const todayDelivered = deliveredJobs.filter((j) => {
      const dateVal = j.delivered_at || j.created_at;
      if (!dateVal) return false;
      return new Date(dateVal).toDateString() === todayStr;
    });
    const amount = todayDelivered.reduce((sum, j) => sum + j.estimated_cost, 0);
    return { amount, count: todayDelivered.length };
  }, [deliveredJobs, todayStr]);

  // 2. Month's Wages
  const monthStats = useMemo(() => {
    const monthDelivered = deliveredJobs.filter((j) => {
      const dateVal = j.delivered_at || j.created_at;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const amount = monthDelivered.reduce((sum, j) => sum + j.estimated_cost, 0);
    return { amount, count: monthDelivered.length };
  }, [deliveredJobs, currentMonth, currentYear]);

  // 3. Lifetime Wages
  const lifetimeStats = useMemo(() => {
    const amount = deliveredJobs.reduce((sum, j) => sum + j.estimated_cost, 0);
    const totalKm = deliveredJobs.reduce((sum, j) => sum + j.distance_km, 0);
    return { amount, count: deliveredJobs.length, totalKm: Math.round(totalKm) };
  }, [deliveredJobs]);

  // 4. Pending Wages (assigned, will unlock when delivered)
  const pendingWages = useMemo(() => {
    return inTransitJobs.reduce((sum, j) => sum + j.estimated_cost, 0);
  }, [inTransitJobs]);

  // Chart 1: Daily Earnings Trend
  const trendData = useMemo(() => {
    // Generate data points for the past 7 or 14 days
    const days: { date: string; displayDate: string; wages: number; count: number }[] = [];
    const numDays = timeframe === "week" ? 7 : 14;

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dString = d.toDateString();
      const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

      const dayJobs = deliveredJobs.filter((j) => {
        const dateVal = j.delivered_at || j.created_at;
        if (!dateVal) return false;
        return new Date(dateVal).toDateString() === dString;
      });

      const dayTotal = dayJobs.reduce((sum, j) => sum + j.estimated_cost, 0);
      days.push({
        date: dString,
        displayDate: label,
        wages: dayTotal,
        count: dayJobs.length,
      });
    }
    return days;
  }, [deliveredJobs, timeframe]);

  // Chart 2: Payout Breakdown by Distance Category (Donut Chart)
  const categoryData = useMemo(() => {
    let local = 0;
    let regional = 0;
    let longHaul = 0;

    deliveredJobs.forEach((j) => {
      if (j.distance_km <= 25) {
        local += j.estimated_cost;
      } else if (j.distance_km <= 150) {
        regional += j.estimated_cost;
      } else {
        longHaul += j.estimated_cost;
      }
    });

    const data = [
      { name: "Local (<25 km)", value: local, jobs: deliveredJobs.filter((j) => j.distance_km <= 25).length },
      { name: "Regional (25-150 km)", value: regional, jobs: deliveredJobs.filter((j) => j.distance_km > 25 && j.distance_km <= 150).length },
      { name: "Long-Haul (>150 km)", value: longHaul, jobs: deliveredJobs.filter((j) => j.distance_km > 150).length },
    ].filter((item) => item.value > 0);

    // If no deliveries yet, show sample breakdown for infographic visualization
    if (data.length === 0) {
      return [
        { name: "Local (<25 km)", value: 2850, jobs: 1 },
        { name: "Regional (25-150 km)", value: 3800, jobs: 1 },
        { name: "Long-Haul (>150 km)", value: 5700, jobs: 2 },
      ];
    }
    return data;
  }, [deliveredJobs]);

  const monthName = now.toLocaleDateString("en-IN", { month: "long" });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle
        icon={<Wallet />}
        eyebrow="Carrier Settlement & Earnings"
        title="Wages & Payouts"
        copy="Real-time wage ledger calculated automatically whenever loads are marked delivered."
      />

      {/* ── Top Hero Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Wages */}
        <div className="relative overflow-hidden rounded-panel border-2 border-foreground/10 bg-card p-5 shadow-panel transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Wages</span>
            <div className="grid size-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Calendar className="size-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">
            ₹{todayStats.amount.toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            <span>{todayStats.count} {todayStats.count === 1 ? "delivery" : "deliveries"} completed today</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (todayStats.amount / 5000) * 100)}%` }}
            />
          </div>
        </div>

        {/* This Month's Wages */}
        <div className="relative overflow-hidden rounded-panel border-2 border-foreground/10 bg-card p-5 shadow-panel transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{monthName} Wages</span>
            <div className="grid size-9 place-items-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">
            ₹{monthStats.amount.toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
            <Award className="size-3.5" />
            <span>{monthStats.count} {monthStats.count === 1 ? "job settled" : "jobs settled"} this month</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (monthStats.amount / 25000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Lifetime Wages */}
        <div className="relative overflow-hidden rounded-panel bg-primary p-5 text-primary-foreground shadow-panel transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-foreground/75">Lifetime Earnings</span>
            <div className="grid size-9 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">
            ₹{lifetimeStats.amount.toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/80">
            <PackageCheck className="size-3.5" />
            <span>{lifetimeStats.count} total loads • {lifetimeStats.totalKm} km routed</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/20">
            <div className="h-full w-full bg-highlight" />
          </div>
        </div>

        {/* Pending In-Transit Payout */}
        <div className="relative overflow-hidden rounded-panel border-2 border-foreground/10 bg-card p-5 shadow-panel transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In Transit (Pending)</span>
            <div className="grid size-9 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Truck className="size-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">
            ₹{pendingWages.toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="size-3.5" />
            <span>{inTransitJobs.length} {inTransitJobs.length === 1 ? "job" : "jobs"} pending delivery</span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-muted-foreground">
            Click "Mark delivered" on any job to instantly credit payout.
          </p>
        </div>
      </div>

      {/* ── Infographic Visualizations: Area Chart & Donut Chart ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Earnings Over Time Area Chart */}
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-6 shadow-panel lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Earnings Activity</h2>
              <p className="text-xs text-muted-foreground">Daily wage accumulation from completed deliveries</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-muted/40 p-1">
              <button
                onClick={() => setTimeframe("week")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  timeframe === "week"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeframe("month")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  timeframe === "month"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                14 Days
              </button>
            </div>
          </div>

          <div className="mt-6 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="wageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="displayDate" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Wages"]}
                  contentStyle={{
                    backgroundColor: "var(--card, #fff)",
                    borderColor: "rgba(0,0,0,0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                />
                <Area type="monotone" dataKey="wages" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#wageGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payout Distribution Donut Chart */}
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-6 shadow-panel lg:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Revenue by Route Tier</h2>
            <p className="text-xs text-muted-foreground">Distribution of payouts across haul distances</p>
          </div>

          <div className="relative my-4 flex h-[220px] items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Total"]}
                  contentStyle={{
                    backgroundColor: "var(--card, #fff)",
                    borderColor: "rgba(0,0,0,0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Summary Text */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-2xl font-bold text-foreground">
                {deliveredJobs.length}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Deliveries
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="space-y-2 pt-2 border-t border-foreground/10">
            {categoryData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-bold text-foreground">₹{item.value.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Settled Deliveries Payout Ledger ── */}
      <div className="rounded-panel border-2 border-foreground/10 bg-card p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Delivered Payout Ledger</h2>
            <p className="text-xs text-muted-foreground">Detailed history of earnings unlocked upon delivery completion</p>
          </div>
          <Link
            to="/dashboard/logistics"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline"
          >
            Manage active jobs <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {deliveredJobs.length === 0 ? (
          <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foreground/10 p-6 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-foreground/5 text-muted-foreground">
              <PackageCheck className="size-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">No delivered jobs yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Go to the Logistics board, claim a job, and click "Mark delivered" to settle your first wage payment!
            </p>
            <Link
              to="/dashboard/logistics"
              className="mt-4 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Open Job Board
            </Link>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-foreground/10 overflow-hidden">
            {deliveredJobs.map((job) => {
              const deliveryDate = job.delivered_at ? new Date(job.delivered_at) : null;
              const formattedDate = deliveryDate
                ? deliveryDate.toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recently delivered";

              return (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3.5">
                    <div className="grid size-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          J-{job.id.slice(-4).toUpperCase()}
                        </span>
                        <p className="font-semibold text-foreground">{job.route}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.detail} • Settled on {formattedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 font-display text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        + ₹{job.estimated_cost.toLocaleString("en-IN")}
                      </span>
                      <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground uppercase">Paid to Wallet</p>
                    </div>
                    <Link
                      to="/dashboard/map/$id"
                      params={{ id: job.id }}
                      className="grid size-8 place-items-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                      title="View delivery route map"
                    >
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
