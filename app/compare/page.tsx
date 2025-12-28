"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  name: string | null;
  created_at: string | null;
  user_id: string;
};

type BasketItemRow = {
  id: string;
  basket_id: string;
  name: string | null;
  price: number | null;
  qty: number | null;
  created_at: string | null;
};

function calcTotal(items: BasketItemRow[]) {
  return items.reduce((sum, it) => sum + (it.price ?? 0) * (it.qty ?? 0), 0);
}

export default function ComparePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [baskets, setBaskets] = useState<BasketRow[]>([]);
  const [basketA, setBasketA] = useState<string>("");
  const [basketB, setBasketB] = useState<string>("");

  const [itemsA, setItemsA] = useState<BasketItemRow[]>([]);
  const [itemsB, setItemsB] = useState<BasketItemRow[]>([]);

  const loadBaskets = async () => {
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
    setBaskets(list);

    // preselect newest two if available
    if (list.length >= 2) {
      setBasketA(list[0].id);
      setBasketB(list[1].id);
    } else if (list.length === 1) {
      setBasketA(list[0].id);
      setBasketB("");
    }

    setLoading(false);
  };

  const loadItemsForBasket = async (basketId: string) => {
    if (!basketId) return [];

    const { data, error: err } = await supabase
      .from("basket_items")
      .select("id,basket_id,name,price,qty,created_at")
      .eq("basket_id", basketId)
      .order("created_at", { ascending: false });

    if (err) throw err;
    return (data ?? []) as BasketItemRow[];
  };

  const runCompare = async () => {
    setError(null);

    if (!basketA || !basketB) {
      setError("Select Basket A and Basket B.");
      return;
    }
    if (basketA === basketB) {
      setError("Basket A and Basket B must be different.");
      return;
    }

    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        loadItemsForBasket(basketA),
        loadItemsForBasket(basketB),
      ]);
      setItemsA(a);
      setItemsB(b);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaskets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-run compare when both selected
  useEffect(() => {
    if (basketA && basketB && basketA !== basketB) {
      runCompare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketA, basketB]);

  const totalA = calcTotal(itemsA);
  const totalB = calcTotal(itemsB);
  const diff = totalA - totalB;

  const nameById = (id: string) =>
    baskets.find((x) => x.id === id)?.name ?? id;

  const maxLen = Math.max(itemsA.length, itemsB.length);

  if (loading && baskets.length === 0) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </div>

      <h2>Compare baskets</h2>

      {error && <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 260 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Basket A</div>
          <select
            value={basketA}
            onChange={(e) => setBasketA(e.target.value)}
            style={{ padding: 10, width: "100%" }}
          >
            <option value="">-- select --</option>
            {baskets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? "(no name)"} ({b.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Basket B</div>
          <select
            value={basketB}
            onChange={(e) => setBasketB(e.target.value)}
            style={{ padding: 10, width: "100%" }}
          >
            <option value="">-- select --</option>
            {baskets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? "(no name)"} ({b.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <button onClick={runCompare} disabled={!basketA || !basketB || basketA === basketB}>
          Compare
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Total A</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{totalA.toFixed(2)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>{basketA ? nameById(basketA) : ""}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Total B</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{totalB.toFixed(2)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>{basketB ? nameById(basketB) : ""}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Difference (A - B)</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{diff.toFixed(2)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            {diff === 0
              ? "Same total"
              : diff > 0
              ? "B is cheaper"
              : "A is cheaper"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Basket A items</div>
          {itemsA.length === 0 ? (
            <div>No items</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {itemsA.map((it) => (
                <div
                  key={it.id}
                  style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
                >
                  <div style={{ fontWeight: 800 }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    qty: {it.qty ?? 0} | price: {it.price ?? 0} | line:{" "}
                    {((it.price ?? 0) * (it.qty ?? 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Basket B items</div>
          {itemsB.length === 0 ? (
            <div>No items</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {itemsB.map((it) => (
                <div
                  key={it.id}
                  style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
                >
                  <div style={{ fontWeight: 800 }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    qty: {it.qty ?? 0} | price: {it.price ?? 0} | line:{" "}
                    {((it.price ?? 0) * (it.qty ?? 0)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* optional: quick debug row counts */}
      <div style={{ marginTop: 16, color: "#666", fontSize: 12 }}>
        Rows: A={itemsA.length} | B={itemsB.length}
      </div>
    </div>
  );
}
