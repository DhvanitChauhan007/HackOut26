import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/seller")({
  beforeLoad: () => {
    throw redirect({ to: "/seller" });
  },
  component: () => null,
});
