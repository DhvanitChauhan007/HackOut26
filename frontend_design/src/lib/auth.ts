import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Call this hook in any protected page.
 * If the user is not logged in, it redirects to /auth?next=<current-path>.
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const router = useRouterState();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const next = router.location.pathname;
        navigate({ to: "/auth", search: { next } });
      } else {
        setSession(session);
      }
      setLoading(false);
    });
  }, [navigate, router.location.pathname]);

  return { 
    session, 
    loading, 
    role: session?.user?.user_metadata?.["role"] as string | undefined 
  };
}
