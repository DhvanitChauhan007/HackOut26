import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-display font-bold mb-4">Circular Packaging Exchange</h1>
      <p className="text-xl text-muted-foreground mb-8">Connecting waste generators, material buyers, and logistics companies.</p>
      <div className="flex gap-4">
        <Link to="/marketplace" className="rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground">Browse Marketplace</Link>
        <Link to="/dashboard/seller" className="rounded-full bg-secondary px-6 py-3 font-display font-semibold text-secondary-foreground">Seller Dashboard</Link>
      </div>
    </div>
  );
}