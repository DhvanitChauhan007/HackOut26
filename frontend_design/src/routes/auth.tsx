import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("manufacturer");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Redirect to dashboard logic here
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              name,
              role,
              address
            }
          }
        });
        if (signUpError) throw signUpError;
        // In a real app we'd also call /api/users/me here, but backend handles webhook often
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border-2 border-foreground/10 bg-card p-8">
        <div>
          <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground">
            {isLogin ? "Sign in to ReLoop" : "Create your account"}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="sr-only">Company Name</label>
                  <input id="name" name="name" type="text" required
                    className="relative block w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                    placeholder="Company Name"
                    value={name} onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="role" className="sr-only">Role</label>
                  <select id="role" name="role" required
                    className="relative block w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                    value={role} onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="manufacturer">Manufacturer</option>
                    <option value="retailer">Retailer</option>
                    <option value="recycler">Recycler</option>
                    <option value="logistics">Logistics Company</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="address" className="sr-only">Address</label>
                  <input id="address" name="address" type="text" required
                    className="relative block w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                    placeholder="Address (Places Autocomplete)"
                    value={address} onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input id="email-address" name="email" type="email" autoComplete="email" required
                className="relative block w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required
                className="relative block w-full rounded-xl border-2 border-foreground/10 bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button type="submit" disabled={loading}
              className="group relative flex w-full justify-center rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Please wait..." : (isLogin ? "Sign in" : "Sign up")}
            </button>
          </div>
        </form>
        <div className="text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-semibold text-primary hover:text-primary/80">
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
