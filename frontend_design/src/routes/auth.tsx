import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeft, Loader2, Recycle, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: (search["next"] as string | undefined) ?? "/marketplace",
  }),
  component: AuthPage,
});

type Tab = "signin" | "signup" | "forgot";



const INPUT =
  "block w-full rounded-xl border-2 border-foreground/10 bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const BTN_PRIMARY =
  "relative flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-lg font-semibold text-primary-foreground shadow-button transition-all duration-300 hover:-translate-y-1 hover:bg-primary/90 disabled:opacity-50 disabled:translate-y-0";

const BTN_GHOST =
  "relative flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground/10 bg-card py-3 font-semibold text-foreground transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:bg-foreground/5 hover:shadow-sm";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up additional state
  const isLogistics = next === "/dashboard/logistics";
  const [name, setName] = useState("");
  const [role, setRole] = useState(isLogistics ? "logistics" : "manufacturer");
  const [address, setAddress] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Handle Supabase OAuth callback — only redirect on explicit sign-in, not initial session restore
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate({ to: next as "/marketplace" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, next]);

  function resetMessages() {
    setMessage(null);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: next as "/marketplace" });
    } catch (err: unknown) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role, address } },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("user already exists") || (msg.includes("email") && msg.includes("taken"))) {
          throw new Error("An account with this email already exists. Try signing in instead.");
        }
        throw error;
      }

      // Supabase returns a user but empty identities[] when the email is already taken
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error("An account with this email already exists. Try signing in instead.");
      }

      // Create profile via API if session exists immediately (no email confirm required)
      if (data.session) {
        const profileRes = await fetch("/api/users/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ name, role, address }),
        });
        if (!profileRes.ok) {
          const profileErr = await profileRes.json().catch(() => ({})) as Record<string, unknown>;
          console.warn("Note: Profile API returned an error, but proceeding to UI.", profileErr);
        }
        navigate({ to: next as "/marketplace" });
      } else {
        setMessage({ text: "Check your email to confirm your account.", type: "success" });
      }
    } catch (err: unknown) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setMessage({ text: "Password reset link sent! Check your inbox.", type: "success" });
    } catch (err: unknown) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    resetMessages();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?next=${next}`,
      },
    });
    if (error) {
      setMessage({ text: error.message, type: "error" });
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Back link */}
        <Link to="/" className="group mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:-translate-x-1 hover:text-foreground">
          <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" /> Back to home
        </Link>

        {/* Brand Logo */}
        <div className="mb-8 flex justify-center">
          <img src="/logo.png" alt="ReRoute" className="h-10 w-auto mix-blend-multiply" />
        </div>

        <div className="overflow-hidden rounded-panel border-2 border-foreground/10 bg-card shadow-panel">

          {/* Card header */}
          <div className="relative overflow-hidden bg-primary px-7 py-7 text-primary-foreground">
            <div className="absolute -right-8 -top-4 size-32 rounded-full border-[20px] border-primary-foreground/10" />
            <div className="relative z-10 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-foreground/15">
                <Recycle className="size-5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase text-primary-foreground/60">
                  {next === "/dashboard/logistics" ? "Logistics Portal" : "Marketplace"}
                </p>
                <p className="font-display text-xl font-semibold">
                  {tab === "signin" ? "Welcome back" : tab === "signup" ? "Create your account" : "Reset password"}
                </p>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 px-7 pt-7 pb-2">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); resetMessages(); }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "bg-foreground text-background"
                    : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div className="space-y-5 px-7 pb-7 pt-4">
            {/* Google OAuth button — shown on sign in & sign up */}
            {tab !== "forgot" && (
              <>
                <button onClick={handleGoogle} disabled={loading} className={BTN_GHOST}>
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-foreground/10" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-foreground/10" />
                </div>
              </>
            )}

            {/* Toast message */}
            {message && (
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                message.type === "error"
                  ? "bg-destructive/12 text-destructive"
                  : "bg-primary/12 text-primary"
              }`}>
                {message.text}
              </div>
            )}

            {/* SIGN IN FORM */}
            {tab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-3">
                  <input type="email" required placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
                  <input type="password" required placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
                </div>

                <button type="submit" disabled={loading || !email.trim() || !password.trim()} className={BTN_PRIMARY}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Sign in
                </button>

                <button type="button" onClick={() => setTab("forgot")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot your password?
                </button>
              </form>
            )}

            {/* SIGN UP FORM */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-3">
                  <input type="text" required placeholder="Company / Full name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />

                  {!isLogistics ? (
                    <div className="flex rounded-xl border-2 border-foreground/10 bg-background p-1">
                      <button
                        type="button"
                        onClick={() => setRole("manufacturer")}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                          role === "manufacturer"
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        Seller
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("recycler")}
                        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                          role === "recycler"
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        Buyer / Recycler
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border-2 border-foreground/10 bg-background/60 px-4 py-3.5 text-sm font-semibold text-muted-foreground">
                      <Truck className="size-4" />
                      Signing up as Logistics Provider
                    </div>
                  )}

                  <input type="text" required placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT} />

                  <input type="email" required placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />

                  <input type="password" required placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />

                  <input type="password" required placeholder="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={INPUT} />
                </div>

                <button type="submit" disabled={loading || !name.trim() || !address.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()} className={BTN_PRIMARY}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Create account
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {tab === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a password reset link.
                </p>
                <input type="email" required placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />

                <button type="submit" disabled={loading || !email.trim()} className={BTN_PRIMARY}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Send reset link
                </button>

                <button type="button" onClick={() => setTab("signin")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {tab === "signin" ? (
            <>No account yet?{" "}
              <button onClick={() => setTab("signup")} className="font-semibold text-primary hover:underline">Sign up for free</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setTab("signin")} className="font-semibold text-primary hover:underline">Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
