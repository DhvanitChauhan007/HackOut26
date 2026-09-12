import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, Leaf, Recycle, Users } from "lucide-react";
import { PageTitle } from "../../components/PageTitle";

export const Route = createFileRoute("/impact/")({
  component: ImpactDashboard,
});

function ImpactDashboard() {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageTitle icon={<Leaf />} eyebrow="Verified after delivery" title="Circular impact" copy="Environmental and economic outcomes from completed exchanges." />
      <div className="grid gap-5 md:grid-cols-3">
        <ImpactCard icon={<Recycle />} label="Diverted from landfill" value="48,210 kg" change="+8.4% this month" tone="bg-highlight/45" />
        <ImpactCard icon={<Leaf />} label="Estimated CO₂e avoided" value="36.4 t" change="EPA WARM factors" tone="bg-primary/15" />
        <ImpactCard icon={<CircleDollarSign />} label="Combined cost savings" value="₹12.8L" change="Buyer + seller value" tone="bg-info/20" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-panel border-2 border-foreground/10 bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Material diverted</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <div className="mt-8 flex h-52 items-end gap-3 sm:gap-5">
            {[38,54,48,68,76,92].map((height, index) => (
              <div key={height + index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-xl bg-primary" style={{ height: `${height}%` }} />
                <span className="text-xs text-muted-foreground">{["Apr","May","Jun","Jul","Aug","Sep"][index]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-panel bg-primary p-6 text-primary-foreground">
          <Users className="size-8" />
          <h3 className="mt-4 font-display text-2xl font-semibold">Circular network</h3>
          <div className="mt-5 space-y-4">
            <div className="flex justify-between gap-4"><span className="opacity-60">Waste generators</span><strong>42</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">Material buyers</span><strong>31</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">Logistics partners</span><strong>12</strong></div>
            <div className="flex justify-between gap-4"><span className="opacity-60">Completed exchanges</span><strong>186</strong></div>
          </div>
          <div className="mt-6 rounded-2xl bg-primary-foreground/10 p-4 text-sm">Average partner rating <strong className="float-right">★ 4.8</strong></div>
        </div>
      </div>
    </section>
  );
}

function ImpactCard({ icon, label, value, change, tone }: { icon: React.ReactNode; label: string; value: string; change: string; tone: string }) { 
  return (
    <article className="rounded-card border-2 border-foreground/10 bg-card p-5">
      <span className={`grid size-10 place-items-center rounded-xl ${tone} [&>svg]:size-5`}>{icon}</span>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold">{value}</p>
      <p className="mt-2 text-xs font-semibold text-primary">{change}</p>
    </article>
  ); 
}
