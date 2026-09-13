import { Bell, LogOut, Menu, User, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { NotificationsPanel } from "./NotificationsPanel";
import { supabase } from "../lib/supabase";

const HIDE_NAV_ROUTES = ["/auth", "/", "/seller", "/seller/"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const { location } = useRouterState();
  const navigate = useNavigate();
  const hideNav = HIDE_NAV_ROUTES.includes(location.pathname);

  useEffect(() => {
    const handleRoleCheck = (userRole: string | undefined | null) => {
      const normalized = userRole?.toLowerCase().trim() || null;
      setRole(normalized);
      if (normalized === "logistics" || normalized === "carrier") {
        const path = location.pathname;
        const allowed = path === "/" ||
                        path.startsWith("/dashboard/logistics") || 
                        path.startsWith("/dashboard/wages") || 
                        path.startsWith("/dashboard/map") ||
                        path.startsWith("/impact") || 
                        path === "/auth";
        if (!allowed) {
          navigate({ to: "/dashboard/logistics" });
        }
      }
    };

    const resolveRole = async (session: any) => {
      let r = (session?.user?.user_metadata?.["role"] as string | undefined) || null;
      if (!r && session?.user?.id) {
        try {
          const { data } = await supabase.from("users").select("role").eq("id", session.user.id).maybeSingle();
          if (data?.role) r = data.role;
        } catch (err) {
          console.warn("Could not load user role from users table", err);
        }
      }
      handleRoleCheck(r);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveRole(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveRole(session);
    });

    return () => subscription.unsubscribe();
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    setRole(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    // Cleanly redirect to main landing page of the website
    window.location.href = "/";
  };

  const normalizedRole = role?.toLowerCase().trim() || null;
  const isLogistics = normalizedRole === "logistics" || normalizedRole === "carrier";
  const isSeller = normalizedRole === "manufacturer" || normalizedRole === "retailer" || normalizedRole === "seller";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNav && (
        <header className="relative sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-[4.5rem] max-w-[1240px] items-center justify-between px-4 sm:px-5">
            <Link to="/" className="flex items-center">
              <img src="/logo.png" alt="ReRoute" className="h-14 w-auto mix-blend-multiply" />
            </Link>

            <nav className="hidden items-center rounded-xl border-2 border-foreground/10 bg-card p-1 text-sm font-semibold md:flex" aria-label="Dashboard navigation">
              {isLogistics ? (
                <>
                  <Link to="/dashboard/logistics" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Logistics</Link>
                  <Link to="/dashboard/wages" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Wages</Link>
                  <Link to="/impact" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Impact</Link>
                </>
              ) : isSeller ? (
                <>
                  <Link to="/marketplace" activeOptions={{ exact: true }} className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Marketplace</Link>
                  <Link to="/marketplace/bulk-lots" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Bulk lots</Link>
                  <Link to="/seller" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Seller Hub</Link>
                  <Link to="/impact" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Impact</Link>
                </>
              ) : (
                <>
                  <Link to="/marketplace" activeOptions={{ exact: true }} className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Marketplace</Link>
                  <Link to="/marketplace/bulk-lots" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Bulk lots</Link>
                  <Link to="/dashboard/buyer" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Requests</Link>
                  <Link to="/impact" className="[&.active]:bg-foreground [&.active]:text-background rounded-lg px-5 py-2 transition-colors text-muted-foreground hover:bg-foreground/5">Impact</Link>
                </>
              )}
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

              <Link
                to="/profile"
                aria-label="Profile"
                title="My Profile"
                className="grid size-9 place-items-center rounded-full bg-foreground/8 text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-foreground/15"
              >
                <User className="size-4" />
              </Link>
              <button
                aria-label="Log out"
                onClick={handleLogout}
                title="Log out"
                className="grid size-9 place-items-center rounded-full bg-destructive/15 text-destructive transition-all duration-300 hover:-translate-y-0.5 hover:bg-destructive hover:text-white"
              >
                <LogOut className="size-4" />
              </button>
              <button aria-label="Open menu" onClick={() => setMobileOpen((open) => !open)} className="grid size-9 place-items-center rounded-full bg-foreground text-background md:hidden">
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav className="border-t border-foreground/10 px-4 py-3 md:hidden">
              <div className="grid grid-cols-2 gap-2" aria-label="Dashboard navigation">
              {isLogistics ? (
                <>
                  <Link to="/dashboard/logistics" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Logistics</Link>
                  <Link to="/dashboard/wages" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Wages</Link>
                  <Link to="/impact" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Impact</Link>
                </>
              ) : isSeller ? (
                <>
                  <Link to="/marketplace" activeOptions={{ exact: true }} className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Marketplace</Link>
                  <Link to="/marketplace/bulk-lots" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Bulk lots</Link>
                  <Link to="/seller" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Seller Hub</Link>
                  <Link to="/impact" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Impact</Link>
                </>
              ) : (
                <>
                  <Link to="/marketplace" activeOptions={{ exact: true }} className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Marketplace</Link>
                  <Link to="/marketplace/bulk-lots" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Bulk lots</Link>
                  <Link to="/dashboard/buyer" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Requests</Link>
                  <Link to="/impact" className="rounded-xl px-3 py-2 text-left text-sm font-semibold bg-card [&.active]:bg-foreground [&.active]:text-background">Impact</Link>
                </>
              )}
              </div>
            </nav>
          )}

          {noticeOpen && <NotificationsPanel onClose={() => setNoticeOpen(false)} />}
        </header>
      )}

      {hideNav ? (
        <div className="min-h-screen">
          {children}
        </div>
      ) : (
        <main className="mx-auto max-w-[1240px] space-y-7 px-4 py-6 sm:px-5 sm:py-8">
          {children}
        </main>
      )}
    </div>
  );
}

