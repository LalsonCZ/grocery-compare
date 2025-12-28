"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        window.location.replace("/login");
        return;
      }

      setEmail(data.user.email ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      <p>Logged in as: {email}</p>

      <button onClick={logout} style={{ padding: 12, fontSize: 16 }}>
        Logout
      </button>
    </main>
  );
}
