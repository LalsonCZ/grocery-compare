"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [baskets, setBaskets] = useState<BasketRow[]>([]);
  const [newBasketName, setNewBasketName] = useState("");

  const loadUserAndBaskets = async () => {
    setError(null);
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    if (!userRes.user) {
      setError("Not logged in.");
      setLoading(false);
      return;
    }

    setEmail(userRes.user.email ?? "");

    // ensure default basket exists
    const ensureRes = await fetch("/api/ensure-basket", { method: "POST" });
    if (!ensureRes.ok) {
      const body = await ensureRes.json().catch(() => ({}));
      setError(body?.error ?? "ensure-basket failed");
      setLoading(false);
      return;
    }

    // load baskets list
    const { data, error: selErr } = await supabase
      .from("baskets")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });

    if (selErr) {
      setError(selErr.message);
      setLoading(false);
      return;
    }

    setBaskets((data ?? []) as BasketRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadUserAndBaskets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBasket = async () => {
    setError(null);

    const name = newBasketName.trim();
    if (!name) return;

    // user_id se vyplní z appky -> ale vkládáme ho explicitně (bezpečnější s RLS)
    const { data: userRes } = await supabase.auth.getUser();
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
    await loadUserAndBaskets();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

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

      {error && (
        <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>
      )}

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
            placeholder="e.g. Nakup"
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
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {b.name ?? "(no name)"}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                  id: {b.id}
                </div>
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
