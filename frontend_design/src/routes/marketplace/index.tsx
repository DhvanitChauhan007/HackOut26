import { createFileRoute } from "@tanstack/react-router";
import { BrowseView } from "../../components/views/BrowseView";
import { useAuthGuard } from "../../lib/auth";
import { ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace/")({
  component: MarketplacePage,
});

function MarketplacePage() {
  const { role, loading } = useAuthGuard();

  if (loading) return null;

  if (role === "logistics") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <span className="grid size-20 place-items-center rounded-2xl bg-destructive/10 mb-6">
          <ShieldAlert className="size-10 text-destructive" />
        </span>
        <h1 className="text-4xl font-display font-semibold">Access Denied</h1>
        <p className="mt-3 text-muted-foreground max-w-md">
          Logistics partners do not have access to the marketplace. Your role is focused on claiming and delivering materials.
        </p>
        <Link 
          to="/dashboard/logistics" 
          className="mt-8 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          Go to Logistics Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <BrowseView />
    </div>
  );
}
