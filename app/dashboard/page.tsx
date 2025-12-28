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
  const [busyBasketId, setBusyBasketId] = useState<string | null>(null);

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

    const { data, error: selErr } = await supabase
      .from("baskets")
      .select("id,name,created_at,user_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (selErr) {
      setError(selErr.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as BasketRow[];

    // if none exists, create default
    if (list.length === 0) {
      const { error: insErr } = await supabase.from("baskets").insert({
        user_id: user.id,
        name: "Nakup",
      });

      if (insErr) {
        setError(insErr.message);
        setLoading(false);
        return;
      }

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

    setBaskets(list);
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
    await loadBasketsAndEnsureDefault();
  };

  const deleteBasket = async (basketId: string, basketName: string) => {
    const ok = confirm(
      `Delete basket "${basketName}"?\n\nAll items inside will be deleted.`
    );
    if (!ok) return;

    setBusyBasketId(basketId);

    const { error: delErr } = await supabase
      .from("baskets")
      .delete()
      .eq("id", basketId);

    if (delErr) {
      setError(delErr.message);
      setBusyBasketId(null);
      return;
    }

    setBaskets((prev) => prev.filter((b) => b.id !== basketId));
    setBusyBasketId(null);

    if (baskets.length === 1) {
      await loadBasketsAndEnsureDefault();
    }
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
          </Link>{" "}
          <Link href="/compare" style={{ marginLeft: 12, fontWeight: 700 }}>
            Compare →
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
            placeholder="e.g. Lidl / Tesco"
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
          {baskets.map((b) => {
            const busy = busyBasketId === b.id;
            const name = b.name ?? "(no name)";
            return (
              <div
                key={b.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{name}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                    id: {b.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Link href={`/basket/${b.id}`} style={{ fontWeight: 600 }}>
                    Open →
                  </Link>
                  <button
                    disabled={busy}
                    onClick={() => deleteBasket(b.id, name)}
                    style={{ color: "crimson" }}
                  >
                    {busy ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
