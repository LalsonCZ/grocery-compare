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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [baskets, setBaskets] = useState<BasketRow[]>([]);
  const [newName, setNewName] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      if (!userData?.user) {
        window.location.replace("/login");
        return;
      }

      setEmail(userData.user.email ?? "");

      const { data, error } = await supabase
        .from("baskets")
        .select("id,user_id,name,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBaskets((data as BasketRow[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBasket() {
    try {
      setBusy(true);
      setError(null);

      const name = newName.trim();
      if (!name) {
        setError("Please enter basket name.");
        return;
      }

      const supabase = getSupabaseBrowserClient();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData?.user) {
        window.location.replace("/login");
        return;
      }

      const { error } = await supabase.from("baskets").insert({
        user_id: userData.user.id,
        name,
      });

      if (error) throw error;

      setNewName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 6 }}>Dashboard</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Logged in as: {email || "—"}</p>

      <button onClick={logout} style={{ padding: "8px 12px", marginBottom: 18 }}>
        Logout
      </button>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <div style={{ padding: 12, border: "1px solid #f3b4b4", borderRadius: 8 }}>
          <p style={{ margin: 0, color: "crimson" }}>
            <b>Error:</b> {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            style={{
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
              marginBottom: 18,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Create basket</h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Nakup"
                style={{ padding: 10, minWidth: 260 }}
              />
              <button
                onClick={createBasket}
                disabled={busy}
                style={{ padding: "10px 14px" }}
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </section>

          <section>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Your baskets</h2>

            {baskets.length === 0 ? (
              <p>No baskets yet. Create one above.</p>
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
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.name}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        id: <code>{b.id}</code>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <Link href={`/basket/${b.id}`}>Open →</Link>
                    </div>
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
