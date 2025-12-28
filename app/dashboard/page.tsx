"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string | null;
};

export default function DashboardPage() {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baskets, setBaskets] = useState<BasketRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        // 1) Must be logged in
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userData.user;
        if (!user) {
          window.location.replace("/login");
          return;
        }

        if (!cancelled) setEmail(user.email ?? "");

        // 2) Load baskets (RLS will filter to user_id = auth.uid())
        const { data: existing, error: loadErr } = await supabase
          .from("baskets")
          .select("*")
          .order("created_at", { ascending: false });

        if (loadErr) throw loadErr;

        // 3) If none exist, create one automatically
        if (!existing || existing.length === 0) {
          if (!cancelled) setCreating(true);

          const defaultName = "My first basket";

          const { data: inserted, error: insErr } = await supabase
            .from("baskets")
            .insert({
              user_id: user.id, // IMPORTANT for your RLS policy
              name: defaultName,
            })
            .select("*");

          if (insErr) throw insErr;

          const newList = (inserted as BasketRow[]) ?? [];
          if (!cancelled) setBaskets(newList);
        } else {
          if (!cancelled) setBaskets(existing as BasketRow[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unknown error");
      } finally {
        if (!cancelled) {
          setCreating(false);
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 6 }}>Dashboard</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Logged in as: {email || "—"}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        <button onClick={logout} style={{ padding: "8px 12px" }}>
          Logout
        </button>
        <Link href="/" style={{ alignSelf: "center" }}>
          Home
        </Link>
      </div>

      {loading && <p style={{ marginTop: 18 }}>Loading…</p>}

      {!loading && error && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px solid #f3b4b4",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: 0, color: "crimson" }}>
            <b>Error:</b> {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {creating && (
            <p style={{ marginTop: 18 }}>Creating your first basket…</p>
          )}

          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10, fontSize: 18 }}>Your baskets</h2>

            {baskets.length === 0 ? (
              <p>No baskets yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {baskets.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: 12,
                      border: "1px solid #eee",
                      borderRadius: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        id: <code>{b.id}</code>
                      </div>
                    </div>

                    <Link href={`/basket/${b.id}`}>Open →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
