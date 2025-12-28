"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();

      const userEmail = data.user?.email ?? null;
      if (!userEmail) {
        window.location.replace("/login");
        return;
      }

      setEmail(userEmail);
    }

    load();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>{email ? `Logged in as: ${email}` : "Loading..."}</p>
    </main>
  );
}
