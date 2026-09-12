import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "./supabase";

/**
 * Call this hook in any protected page.
 * If the user is not logged in, it redirects to /auth?next=<current-path>.
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const router = useRouterState();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const next = router.location.pathname;
        navigate({ to: "/auth", search: { next } });
      }
    });
  }, [navigate, router.location.pathname]);
}
