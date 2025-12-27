"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setStatus("Please enter your email.");
      return;
    }

    setLoading(true);
    setStatus("Sending login link...");

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anon) {
        setStatus("Missing Supabase env vars on this deployment.");
        setLoading(false);
        return;
      }

      const supabase = createClient(url, anon);

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Works on localhost AND on Vercel automatically
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus("✅ Check your email for the login link.");
      }
    } catch (err: any) {
      setStatus(`Unexpected error: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 480 }}>
      <h1 style={{ marginBottom: 12 }}>Login</h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Enter your email and we’ll send you a magic link.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>

        {status && (
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {status}
          </p>
        )}
      </form>
    </main>
  );
}
