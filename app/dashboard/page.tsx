"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  name: string | null;
  created_at: string | null;
  user_id?: string | null;
};

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [baskets, setBaskets] = useState<BasketRow[]>([]);
  const [newBasketName, setNewBasketName] = useState("");

  const loadBasketsAndEnsureDefault = async () => {
    setError(null);
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    const user = userRes.user;
    if (!user) {
      setError("Not logged in.");
      setLoading(false);
      return;
    }

    setEmail(user.email ?? "");

    // 1) load baskets
    const { data: list1, error: selErr1 } = await supabase
      .from("baskets")
      .select("id,name,created_at,user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (selErr1) {
      setError(selErr1.message);
      setLoading(false);
      return;
    }

    const existing = (list1 ?? []) as BasketRow[];

    // 2) if none -> create default basket
    if (existing.length === 0) {
      const { error: insErr } = await supabase.from("baskets").insert({
        user_id: user.id,
        name: "Nakup",
      });

      if (insErr) {
        setError(insErr.message);
        setLoading(false);
        return;
      }

      // 3) reload after insert
      const { data: list2, error: selErr2 } = await supabase
        .from("baskets")
        .select("id,name,created_at,user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (selErr2) {
        setError(selErr2.message);
        setLoading(false);
        return;
      }

      setBaskets((list2 ?? []) as BasketRow[]);
      setLoading(false);
      return;
    }

    setBaskets(existing);
    setLoading(false);
  };

  useEffect(() => {
    loadBasketsAndEnsureDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBasket = async () => {
    setError(null);

    const name = newBasketName.trim();
    if (!name) return;

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      return;
    }

    const user = userRes.user;
    if (!user) {
      setError("Not logged in.");
      return;
    }

    const { error: insErr } = await supabase.from("baskets").insert({
      user_id: user.id,
      name,
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setNewBasketName("");
    await loadBasketsAndEnsureDefault();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>Dashboard</h2>

      <div style={{ marginBottom: 16 }}>
        <div>Logged in as: {email}</div>
        <div style={{ marginTop: 8 }}>
          <button onClick={logout}>Logout</button>{" "}
          <Link href="/" style={{ marginLeft: 12 }}>
            Home
          </Link>
        </div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h3>Create basket</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={newBasketName}
            onChange={(e) => setNewBasketName(e.target.value)}
            placeholder="e.g. Novy basket"
            style={{ padding: 10, width: 320 }}
          />
          <button onClick={createBasket}>Create</button>
        </div>
      </div>

      <h3>Your baskets</h3>
      {baskets.length === 0 ? (
        <div>No baskets yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {baskets.map((b) => (
            <div
              key={b.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{b.name ?? "(no name)"}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12 }}>id: {b.id}</div>
              </div>
              <Link href={`/basket/${b.id}`} style={{ fontWeight: 600 }}>
                Open →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
