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

type AggRow = {
  key: string; // normalized key
  displayName: string; // best display name we saw
  qty: number;
  total: number; // total cost
};

type CompareRow = {
  key: string;
  name: string;
  aQty: number;
  aUnit: number; // unit price (avg)
  aTotal: number;
  bQty: number;
  bUnit: number;
  bTotal: number;
  cheaper: "A" | "B" | "Same" | "-";
  deltaUnit: number; // aUnit - bUnit
};

function normalizeName(input: string) {
  const trimmed = input.trim().toLowerCase();
  // remove diacritics (Czech: mléko -> mleko)
  // NFD splits letters + diacritics, then remove diacritic marks
  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function calcTotal(items: BasketItemRow[]) {
  return items.reduce((sum, it) => sum + (it.price ?? 0) * (it.qty ?? 0), 0);
}

function aggregate(items: BasketItemRow[]) {
  const map = new Map<string, AggRow>();

  for (const it of items) {
    const rawName = (it.name ?? "").toString();
    const name = rawName.trim();
    if (!name) continue;

    const key = normalizeName(name);
    const qty = Number(it.qty ?? 0) || 0;
    const price = Number(it.price ?? 0) || 0;
    const line = qty * price;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        key,
        displayName: name, // first seen
        qty,
        total: line,
      });
    } else {
      // keep "nicer" displayName: prefer one with uppercase or diacritics or longer
      const betterName =
        prev.displayName.length >= name.length ? prev.displayName : name;

      map.set(key, {
        key,
        displayName: betterName,
        qty: prev.qty + qty,
        total: prev.total + line,
      });
    }
  }

  return map;
}

function unitPrice(row: AggRow) {
  if (!row || row.qty <= 0) return 0;
  return row.total / row.qty;
}

function money(n: number) {
  return n.toFixed(2);
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

  // SMART AGGREGATION + MATCHING
  const aggA = useMemo(() => aggregate(itemsA), [itemsA]);
  const aggB = useMemo(() => aggregate(itemsB), [itemsB]);

  const rows: CompareRow[] = useMemo(() => {
    const keys = new Set<string>();
    for (const k of aggA.keys()) keys.add(k);
    for (const k of aggB.keys()) keys.add(k);

    const out: CompareRow[] = [];
    for (const key of keys) {
      const a = aggA.get(key);
      const b = aggB.get(key);

      const aQty = a?.qty ?? 0;
      const aTotal = a?.total ?? 0;
      const aUnit = aQty > 0 ? aTotal / aQty : 0;

      const bQty = b?.qty ?? 0;
      const bTotal = b?.total ?? 0;
      const bUnit = bQty > 0 ? bTotal / bQty : 0;

      const name =
        a?.displayName || b?.displayName || key;

      let cheaper: CompareRow["cheaper"] = "-";
      let deltaUnit = 0;

      if (aQty > 0 && bQty > 0) {
        deltaUnit = aUnit - bUnit;
        if (Math.abs(deltaUnit) < 0.000001) cheaper = "Same";
        else cheaper = deltaUnit < 0 ? "A" : "B"; // if aUnit < bUnit => A cheaper
      } else if (aQty > 0 && bQty === 0) {
        cheaper = "A";
      } else if (bQty > 0 && aQty === 0) {
        cheaper = "B";
      }

      out.push({
        key,
        name,
        aQty,
        aUnit,
        aTotal,
        bQty,
        bUnit,
        bTotal,
        cheaper,
        deltaUnit,
      });
    }

    // sort: both present first, then cheaper savings largest, then name
    out.sort((r1, r2) => {
      const both1 = r1.aQty > 0 && r1.bQty > 0 ? 1 : 0;
      const both2 = r2.aQty > 0 && r2.bQty > 0 ? 1 : 0;
      if (both1 !== both2) return both2 - both1;

      // larger unit diff first (absolute)
      const d1 = Math.abs(r1.deltaUnit);
      const d2 = Math.abs(r2.deltaUnit);
      if (d1 !== d2) return d2 - d1;

      return r1.name.localeCompare(r2.name);
    });

    return out;
  }, [aggA, aggB]);

  const matchedCount = rows.filter((r) => r.aQty > 0 && r.bQty > 0).length;
  const onlyA = rows.filter((r) => r.aQty > 0 && r.bQty === 0).length;
  const onlyB = rows.filter((r) => r.bQty > 0 && r.aQty === 0).length;

  if (loading && baskets.length === 0) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </div>

      <h2>Compare baskets (smart)</h2>

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
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(totalA)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>{basketA ? nameById(basketA) : ""}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Total B</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(totalB)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>{basketB ? nameById(basketB) : ""}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Difference (A - B)</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(diff)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>
            {diff === 0 ? "Same total" : diff > 0 ? "B is cheaper" : "A is cheaper"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10, color: "#555" }}>
        Matched: <b>{matchedCount}</b> | Only in A: <b>{onlyA}</b> | Only in B: <b>{onlyB}</b>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.6fr 1.6fr 0.9fr 1fr",
            padding: 12,
            fontWeight: 800,
            borderBottom: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <div>Product (normalized match)</div>
          <div>A (qty / unit / total)</div>
          <div>B (qty / unit / total)</div>
          <div>Cheaper</div>
          <div>Δ unit (A-B)</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 12 }}>No items.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.6fr 1.6fr 0.9fr 1fr",
                padding: 12,
                borderBottom: "1px solid #f2f2f2",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{r.name}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>
                  key: {r.key}
                </div>
              </div>

              <div style={{ color: r.aQty > 0 ? "#111" : "#888" }}>
                {r.aQty > 0 ? (
                  <>
                    <div>qty: {r.aQty}</div>
                    <div>unit: {money(r.aUnit)}</div>
                    <div>total: {money(r.aTotal)}</div>
                  </>
                ) : (
                  <div>-</div>
                )}
              </div>

              <div style={{ color: r.bQty > 0 ? "#111" : "#888" }}>
                {r.bQty > 0 ? (
                  <>
                    <div>qty: {r.bQty}</div>
                    <div>unit: {money(r.bUnit)}</div>
                    <div>total: {money(r.bTotal)}</div>
                  </>
                ) : (
                  <div>-</div>
                )}
              </div>

              <div style={{ fontWeight: 800 }}>
                {r.aQty > 0 && r.bQty > 0
                  ? r.cheaper === "Same"
                    ? "Same"
                    : r.cheaper
                  : r.cheaper}
              </div>

              <div style={{ fontFamily: "monospace" }}>
                {r.aQty > 0 && r.bQty > 0 ? money(r.deltaUnit) : "-"}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
        Tip: “Mléko / mleko / MLEKO” se sloučí automaticky (lowercase + bez diakritiky).
      </div>
    </div>
  );
}
