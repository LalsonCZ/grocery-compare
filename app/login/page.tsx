"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Sending login link...");

    const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: "http://localhost:3000/auth/callback",
  },
});

    setStatus(error ? error.message : "Check your email for the login link ✅");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Login</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10 }}
          required
        />
        <button type="submit" style={{ padding: "10px 14px" }}>
          Send login link
        </button>
      </form>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}

      <p style={{ marginTop: 16 }}>
        <a href="/">← Back to home</a>
      </p>
    </main>
  );
}

