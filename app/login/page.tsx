"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) setStatus(`Error: ${error.message}`);
      else setStatus("✅ Check your email for the magic link.");
    } catch (err: any) {
      setStatus(`Unexpected error: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Enter your email and we’ll send you a magic link.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12, fontSize: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 12, fontSize: 16, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>

        {status && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{status}</p>}
      </form>
    </main>
  );
}
