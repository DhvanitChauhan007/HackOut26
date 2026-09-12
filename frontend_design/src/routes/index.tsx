import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Recycle, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
      {/* Top Header - Logo on the left */}
      <div className="mx-auto w-full max-w-[1400px]">
        <img src="/logo.png" alt="ReRoute" className="h-20 w-auto mix-blend-multiply sm:h-24" />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12">
        {/* Hero text */}
        <div className="text-center">
        <h1 className="font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
          Where does your <br className="hidden sm:block" />
          <span className="text-primary">packaging waste go?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Connect with verified buyers, recyclers, and logistics companies. Divert materials from landfill — and get paid for it.
        </p>
      </div>

      {/* Two choice cards */}
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {/* Marketplace card */}
        <Link
          to="/auth"
          search={{ next: "/marketplace" }}
          className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-hero bg-primary p-6 text-primary-foreground
            transition-all duration-300 ease-out
            hover:-translate-y-2 hover:scale-[1.03] hover:shadow-[0_24px_60px_oklch(0.51_0.13_157/0.40)]"
        >
          {/* Background shapes */}
          <div className="absolute -right-8 -top-5 size-36 rounded-full border-[22px] border-primary-foreground/10 transition-transform duration-300 group-hover:scale-110" />
          <div className="absolute -bottom-14 right-16 size-28 rotate-12 rounded-[2rem] border-[16px] border-highlight/20 transition-transform duration-300 group-hover:-rotate-6" />

          <div className="relative z-10">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/15 transition-colors duration-300 group-hover:bg-highlight/30">
              <Recycle className="size-5 transition-transform duration-300 group-hover:rotate-180" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">
              Marketplace
            </h2>
            <p className="mt-1.5 text-sm text-primary-foreground/70">
              Buy and sell reusable packaging — cardboard, plastics, pallets and more.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex gap-2">
              <MiniChip label="126 lots live" />
              <MiniChip label="₹12.8L saved" />
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-highlight text-foreground shadow-button-dark transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110">
              <ArrowRight className="size-4" />
            </span>
          </div>
        </Link>

        {/* Logistics card */}
        <Link
          to="/auth"
          search={{ next: "/dashboard/logistics" }}
          className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-hero border-2 border-foreground/10 bg-card p-6
            transition-all duration-300 ease-out
            hover:-translate-y-2 hover:scale-[1.03] hover:border-primary/35 hover:shadow-[0_24px_60px_oklch(0.51_0.13_157/0.28)]"
        >
          {/* Background shapes */}
          <div className="absolute -right-8 -top-5 size-36 rounded-full border-[22px] border-foreground/5 transition-transform duration-300 group-hover:scale-110 group-hover:border-primary/15" />
          <div className="absolute -bottom-14 right-16 size-28 rotate-12 rounded-[2rem] border-[16px] border-foreground/5 transition-transform duration-300 group-hover:-rotate-6 group-hover:border-primary/20" />

          <div className="relative z-10">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-foreground/8 transition-colors duration-300 group-hover:bg-primary/15">
              <Truck className="size-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold leading-tight transition-colors duration-300 group-hover:text-primary">
              Logistics
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pick up and deliver circular materials across the city. Claim jobs, earn per delivery.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex gap-2">
              <MiniChip label="3 open jobs" dark />
              <MiniChip label="23 km avg" dark />
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-foreground text-background transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110 group-hover:bg-primary">
              <ArrowRight className="size-4" />
            </span>
          </div>
        </Link>
      </div>

      {/* Footer metrics */}
      <div className="flex flex-wrap items-center justify-center gap-8 text-center text-xs text-muted-foreground">
        <Metric value="48,210 kg" label="Diverted from landfill" />
        <Metric value="36.4 t" label="CO₂e avoided" />
        <Metric value="94" label="Verified companies" />
      </div>
      </div>
    </div>
  );
}

function MiniChip({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${dark ? "bg-foreground/8 text-foreground" : "bg-primary-foreground/15 text-primary-foreground"}`}>
      {label}
    </span>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-0.5">{label}</p>
    </div>
  );
}