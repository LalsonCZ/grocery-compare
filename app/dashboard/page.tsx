"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        const userEmail = data.user?.email ?? null;

        // Not logged in → go to login
        if (!userEmail) {
          window.location.replace("/login");
          return;
        }

        setEmail(userEmail);
      } catch (e: any) {
        setError(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function signOut() {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.replace("/login");
    }
  }

  if (loading) {
    return <p style={{ padding: 24 }}>Loading dashboard…</p>;
  }

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Dashboard</h1>
        <p style={{ color: "crimson" }}>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      <p>
        Logged in as: <b>{email}</b>
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button onClick={signOut}>Sign out</button>
        <button onClick={() => window.location.replace("/")}>Home</button>
      </div>
    </main>
  );
}
