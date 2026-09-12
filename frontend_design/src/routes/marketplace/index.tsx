import { createFileRoute } from "@tanstack/react-router";
import { BrowseView } from "../../components/views/BrowseView";
import { useAuthGuard } from "../../lib/auth";

export const Route = createFileRoute("/marketplace/")({
  component: MarketplacePage,
});

function MarketplacePage() {
  useAuthGuard();
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <BrowseView />
    </div>
  );
}
