"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (authError) { setError(authError.message); return; }
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) { setError(authError.message); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface, #1a1b1e)" }}>
      <div
        className="w-full max-w-sm rounded-xl p-8 shadow-xl"
        style={{ background: "var(--surface-elevated, #1e1f23)", border: "1px solid var(--border, #2c2d31)" }}
      >
        <h1 className="text-xl font-bold mb-6 text-center" style={{ color: "var(--text-primary, #fff)" }}>
          {mode === "signin" ? "Sign in to PlanCraft" : "Create account"}
        </h1>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface, #1a1b1e)",
              border: "1px solid var(--border, #2c2d31)",
              color: "var(--text-primary, #fff)",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface, #1a1b1e)",
              border: "1px solid var(--border, #2c2d31)",
              color: "var(--text-primary, #fff)",
            }}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent, #5865f2)" }}
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1" style={{ borderTop: "1px solid var(--border, #2c2d31)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted, #72767d)" }}>or</span>
          <div className="flex-1" style={{ borderTop: "1px solid var(--border, #2c2d31)" }} />
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            border: "1px solid var(--border, #2c2d31)",
            background: "var(--surface, #1a1b1e)",
            color: "var(--text-primary, #fff)",
          }}
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted, #72767d)" }}>
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="hover:underline"
                style={{ color: "var(--accent, #5865f2)" }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button
                onClick={() => setMode("signin")}
                className="hover:underline"
                style={{ color: "var(--accent, #5865f2)" }}
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-2 text-center text-xs" style={{ color: "var(--text-muted, #72767d)" }}>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="hover:underline"
          >
            Continue without account →
          </button>
        </p>
      </div>
    </div>
  );
}
