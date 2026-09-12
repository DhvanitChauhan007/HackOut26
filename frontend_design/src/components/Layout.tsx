import { Bell, Menu, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { NotificationsPanel } from "./NotificationsPanel";

export function Layout({ children }: { children: React.ReactNode }) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-5">
          <Link to="/" className="flex items-center gap-3 text-left">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground shadow-mark">R</span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold">ReLoop</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">industrial reclaimed marketplace</span>
            </span>
          </Link>

          <nav className="hidden items-center rounded-xl border-2 border-foreground/10 bg-card p-1 text-sm font-semibold md:flex" aria-label="Dashboard navigation">
            <Link to="/marketplace" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Marketplace</Link>
            <Link to="/marketplace/bulk-lots" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Bulk lots</Link>
            <Link to="/dashboard/seller" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Seller Hub</Link>
            <Link to="/dashboard/buyer" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Buyer Hub</Link>
            <Link to="/dashboard/logistics" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Logistics</Link>
            <Link to="/impact" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Impact</Link>
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
            <Link to="/marketplace/new" className="hidden rounded-full bg-highlight px-4 py-2 font-display text-sm font-semibold shadow-button sm:inline-flex items-center">
              <Plus className="mr-1.5 size-4" /> List material
            </Link>
            <button aria-label="Open menu" onClick={() => setMobileOpen((open) => !open)} className="grid size-9 place-items-center rounded-full bg-foreground text-background md:hidden">
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-foreground/10 px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-2" aria-label="Dashboard navigation">
              <Link to="/marketplace" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Marketplace</Link>
              <Link to="/marketplace/bulk-lots" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Bulk lots</Link>
              <Link to="/dashboard/seller" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Seller Hub</Link>
              <Link to="/dashboard/buyer" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Buyer Hub</Link>
              <Link to="/dashboard/logistics" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Logistics</Link>
              <Link to="/impact" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Impact</Link>
            </div>
          </nav>
        )}

        {noticeOpen && <NotificationsPanel />}
      </header>
      
      <main className="mx-auto max-w-[1240px] space-y-7 px-4 py-6 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}
