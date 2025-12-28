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
  key: string;
  displayName: string;
  qty: number;
  total: number;
};

type CompareMode = "unit" | "line";

type CompareRow = {
  key: string;
  name: string;

  aQty: number;
  aUnit: number;
  aTotal: number;

  bQty: number;
  bUnit: number;
  bTotal: number;

  cheaper: "A" | "B" | "Same" | "-";
  delta: number; // A - B (unit or line)
  matchType: "exact" | "fuzzy";
  aRawKey?: string;
  bRawKey?: string;
};

type BestItem = {
  name: string;
  qty: number;
  price: number;
  source: "A" | "B" | "Same";
};

function money(n: number) {
  return n.toFixed(2);
}

function normalizeBase(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(input: string) {
  return normalizeBase(input);
}

function tokenize(input: string) {
  const s = normalizeBase(input);
  if (!s) return [];
  return s.split(" ").filter(Boolean);
}

function similarity(aName: string, bName: string) {
  const a = tokenize(aName);
  const b = tokenize(bName);
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;

  const union = setA.size + setB.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;

  const aStr = a.join(" ");
  const bStr = b.join(" ");
  const containsBonus = aStr.includes(bStr) || bStr.includes(aStr) ? 0.15 : 0;

  const lastA = a[a.length - 1] ?? "";
  const lastB = b[b.length - 1] ?? "";
  const pluralBonus =
    (lastA.startsWith(lastB) || lastB.startsWith(lastA)) &&
    Math.min(lastA.length, lastB.length) >= 4
      ? 0.1
      : 0;

  return Math.min(1, jaccard + containsBonus + pluralBonus);
}

function aggregate(items: BasketItemRow[]) {
  const map = new Map<string, AggRow>();

  for (const it of items) {
    const rawName = (it.name ?? "").toString();
    const name = rawName.trim();
    if (!name) continue;

    const key = normalizeKey(name);
    const qty = Number(it.qty ?? 0) || 0;
    const price = Number(it.price ?? 0) || 0;
    const line = qty * price;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, { key, displayName: name, qty, total: line });
    } else {
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

function calcTotal(items: BasketItemRow[]) {
  return items.reduce((sum, it) => sum + (it.price ?? 0) * (it.qty ?? 0), 0);
}

function unitPrice(row?: AggRow) {
  if (!row || row.qty <= 0) return 0;
  return row.total / row.qty;
}

function buildMatchedRows(
  aggA: Map<string, AggRow>,
  aggB: Map<string, AggRow>,
  mode: CompareMode
) {
  const usedB = new Set<string>();
  const rows: CompareRow[] = [];

  // exact
  for (const [key, a] of aggA.entries()) {
    const b = aggB.get(key);
    if (!b) continue;

    usedB.add(key);

    const aQty = a.qty;
    const aTotal = a.total;
    const aUnit = unitPrice(a);

    const bQty = b.qty;
    const bTotal = b.total;
    const bUnit = unitPrice(b);

    const aMetric = mode === "unit" ? aUnit : aTotal;
    const bMetric = mode === "unit" ? bUnit : bTotal;

    const delta = aMetric - bMetric;

    let cheaper: CompareRow["cheaper"] = "Same";
    if (Math.abs(delta) < 0.000001) cheaper = "Same";
    else cheaper = delta < 0 ? "A" : "B";

    rows.push({
      key,
      name: a.displayName || b.displayName || key,
      aQty,
      aUnit,
      aTotal,
      bQty,
      bUnit,
      bTotal,
      cheaper,
      delta,
      matchType: "exact",
      aRawKey: a.key,
      bRawKey: b.key,
    });
  }

  // fuzzy
  const remainingA: AggRow[] = [];
  const remainingB: AggRow[] = [];
  for (const a of aggA.values()) if (!aggB.has(a.key)) remainingA.push(a);
  for (const b of aggB.values())
    if (!usedB.has(b.key) && !aggA.has(b.key)) remainingB.push(b);

  type Cand = { aKey: string; bKey: string; score: number };
  const cands: Cand[] = [];

  for (const a of remainingA) {
    for (const b of remainingB) {
      const score = similarity(a.displayName, b.displayName);
      if (score >= 0.6) cands.push({ aKey: a.key, bKey: b.key, score });
    }
  }

  cands.sort((x, y) => y.score - x.score);

  const matchedA = new Set<string>();
  const matchedB = new Set<string>();

  for (const c of cands) {
    if (matchedA.has(c.aKey) || matchedB.has(c.bKey)) continue;

    const a = aggA.get(c.aKey);
    const b = aggB.get(c.bKey);
    if (!a || !b) continue;

    matchedA.add(c.aKey);
    matchedB.add(c.bKey);

    const key = `${a.key}~${b.key}`;

    const aQty = a.qty;
    const aTotal = a.total;
    const aUnit = unitPrice(a);

    const bQty = b.qty;
    const bTotal = b.total;
    const bUnit = unitPrice(b);

    const aMetric = mode === "unit" ? aUnit : aTotal;
    const bMetric = mode === "unit" ? bUnit : bTotal;

    const delta = aMetric - bMetric;

    let cheaper: CompareRow["cheaper"] = "Same";
    if (Math.abs(delta) < 0.000001) cheaper = "Same";
    else cheaper = delta < 0 ? "A" : "B";

    rows.push({
      key,
      name: a.displayName.length >= b.displayName.length ? a.displayName : b.displayName,
      aQty,
      aUnit,
      aTotal,
      bQty,
      bUnit,
      bTotal,
      cheaper,
      delta,
      matchType: "fuzzy",
      aRawKey: a.key,
      bRawKey: b.key,
    });
  }

  // leftovers
  for (const a of aggA.values()) {
    const isExact = aggB.has(a.key);
    const isFuzzy = matchedA.has(a.key);
    if (isExact || isFuzzy) continue;

    rows.push({
      key: a.key,
      name: a.displayName,
      aQty: a.qty,
      aUnit: unitPrice(a),
      aTotal: a.total,
      bQty: 0,
      bUnit: 0,
      bTotal: 0,
      cheaper: "A",
      delta: mode === "unit" ? unitPrice(a) : a.total,
      matchType: "exact",
      aRawKey: a.key,
    });
  }

  for (const b of aggB.values()) {
    const isExact = aggA.has(b.key);
    const isFuzzy = matchedB.has(b.key);
    if (isExact || isFuzzy) continue;

    rows.push({
      key: b.key,
      name: b.displayName,
      aQty: 0,
      aUnit: 0,
      aTotal: 0,
      bQty: b.qty,
      bUnit: unitPrice(b),
      bTotal: b.total,
      cheaper: "B",
      delta: mode === "unit" ? -unitPrice(b) : -b.total,
      matchType: "exact",
      bRawKey: b.key,
    });
  }

  rows.sort((r1, r2) => {
    const both1 = r1.aQty > 0 && r1.bQty > 0 ? 1 : 0;
    const both2 = r2.aQty > 0 && r2.bQty > 0 ? 1 : 0;
    if (both1 !== both2) return both2 - both1;

    const d1 = Math.abs(r1.delta);
    const d2 = Math.abs(r2.delta);
    if (d1 !== d2) return d2 - d1;

    return r1.name.localeCompare(r2.name);
  });

  return rows;
}

function computeSavings(rows: CompareRow[]) {
  let savings = 0;
  for (const r of rows) {
    if (r.aQty > 0 && r.bQty > 0) {
      const commonQty = Math.min(r.aQty, r.bQty);
      const diff = Math.abs(r.aUnit - r.bUnit);
      savings += commonQty * diff;
    }
  }
  return savings;
}

// NEW: build best list + best total
function buildBestList(rows: CompareRow[]): { bestItems: BestItem[]; bestTotal: number } {
  const bestItems: BestItem[] = [];
  let bestTotal = 0;

  for (const r of rows) {
    // determine qty to buy: take max qty (so you cover what either basket has)
    const qty = Math.max(r.aQty, r.bQty);

    // if only exists in one basket
    if (r.aQty > 0 && r.bQty === 0) {
      bestItems.push({ name: r.name, qty, price: r.aUnit, source: "A" });
      bestTotal += qty * r.aUnit;
      continue;
    }
    if (r.bQty > 0 && r.aQty === 0) {
      bestItems.push({ name: r.name, qty, price: r.bUnit, source: "B" });
      bestTotal += qty * r.bUnit;
      continue;
    }

    // both exist
    if (r.aQty > 0 && r.bQty > 0) {
      if (Math.abs(r.aUnit - r.bUnit) < 0.000001) {
        bestItems.push({ name: r.name, qty, price: r.aUnit, source: "Same" });
        bestTotal += qty * r.aUnit;
      } else if (r.aUnit < r.bUnit) {
        bestItems.push({ name: r.name, qty, price: r.aUnit, source: "A" });
        bestTotal += qty * r.aUnit;
      } else {
        bestItems.push({ name: r.name, qty, price: r.bUnit, source: "B" });
        bestTotal += qty * r.bUnit;
      }
    }
  }

  // nice sorting: A/B/Same, then name
  bestItems.sort((x, y) => {
    const rank = (s: BestItem["source"]) => (s === "A" ? 0 : s === "B" ? 1 : 2);
    const r = rank(x.source) - rank(y.source);
    if (r !== 0) return r;
    return x.name.localeCompare(y.name);
  });

  return { bestItems, bestTotal };
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

  const [mode, setMode] = useState<CompareMode>("unit");

  const [creatingBest, setCreatingBest] = useState(false);
  const [createdBestId, setCreatedBestId] = useState<string | null>(null);

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
    setCreatedBestId(null);

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

  useEffect(() => {
    if (basketA && basketB && basketA !== basketB) runCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketA, basketB]);

  const totalA = calcTotal(itemsA);
  const totalB = calcTotal(itemsB);
  const diff = totalA - totalB;

  const nameById = (id: string) => baskets.find((x) => x.id === id)?.name ?? id;

  const aggA = useMemo(() => aggregate(itemsA), [itemsA]);
  const aggB = useMemo(() => aggregate(itemsB), [itemsB]);

  const rows = useMemo(() => buildMatchedRows(aggA, aggB, mode), [aggA, aggB, mode]);
  const savings = useMemo(() => computeSavings(rows), [rows]);

  const { bestItems, bestTotal } = useMemo(() => buildBestList(rows), [rows]);

  const matchedCount = rows.filter((r) => r.aQty > 0 && r.bQty > 0).length;
  const fuzzyCount = rows.filter((r) => r.matchType === "fuzzy").length;
  const onlyA = rows.filter((r) => r.aQty > 0 && r.bQty === 0).length;
  const onlyB = rows.filter((r) => r.bQty > 0 && r.aQty === 0).length;

  const createBestBasket = async () => {
    setError(null);
    setCreatedBestId(null);

    if (!basketA || !basketB) {
      setError("Select Basket A and Basket B.");
      return;
    }
    if (bestItems.length === 0) {
      setError("No best items to create.");
      return;
    }

    const aName = nameById(basketA);
    const bName = nameById(basketB);

    setCreatingBest(true);
    try {
      const res = await fetch("/api/create-best-basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketAName: aName,
          basketBName: bName,
          items: bestItems,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to create best basket");
        return;
      }

      setCreatedBestId(json.basketId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create best basket");
    } finally {
      setCreatingBest(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1250 }}>
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Compare by:</div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CompareMode)}
            style={{ padding: 10 }}
          >
            <option value="unit">Unit price</option>
            <option value="line">Line total</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
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

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 800 }}>Savings (common items)</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(savings)}</div>
          <div style={{ color: "#555", marginTop: 4 }}>min(qtyA, qtyB) × unit diff</div>
        </div>
      </div>

      <div style={{ marginBottom: 10, color: "#555" }}>
        Matched: <b>{matchedCount}</b> (fuzzy: <b>{fuzzyCount}</b>) | Only in A: <b>{onlyA}</b> | Only in B:{" "}
        <b>{onlyB}</b> | Mode: <b>{mode === "unit" ? "Unit price" : "Line total"}</b>
      </div>

      {/* NEW: Best basket section */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Best choice list</div>
            <div style={{ color: "#555" }}>
              Estimated best total (buy each product where it&apos;s cheaper):{" "}
              <b style={{ fontSize: 18 }}>{money(bestTotal)}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={createBestBasket} disabled={creatingBest || bestItems.length === 0}>
              {creatingBest ? "Creating..." : "Create basket: Best (auto)"}
            </button>

            {createdBestId && (
              <Link href={`/basket/${createdBestId}`} style={{ fontWeight: 800 }}>
                Open Best →
              </Link>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {bestItems.length === 0 ? (
            <div>No items.</div>
          ) : (
            bestItems.map((it, idx) => (
              <div
                key={`${it.name}-${idx}`}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{it.name}</div>
                  <div style={{ color: "#555", fontSize: 13 }}>
                    qty: {it.qty} | unit: {money(it.price)} | line: {money(it.qty * it.price)}
                  </div>
                </div>
                <div style={{ fontWeight: 900 }}>
                  {it.source === "Same" ? "Same" : it.source}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main compare table */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.1fr 1.5fr 1.5fr 0.8fr 1fr 0.9fr",
            padding: 12,
            fontWeight: 800,
            borderBottom: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <div>Product</div>
          <div>A (qty / unit / total)</div>
          <div>B (qty / unit / total)</div>
          <div>Cheaper</div>
          <div>Δ {mode === "unit" ? "unit" : "line"} (A-B)</div>
          <div>Match</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 12 }}>No items.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gridTemplateColumns: "2.1fr 1.5fr 1.5fr 0.8fr 1fr 0.9fr",
                padding: 12,
                borderBottom: "1px solid #f2f2f2",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>{r.name}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>
                  {r.matchType === "fuzzy" && r.aRawKey && r.bRawKey
                    ? `A:${r.aRawKey} | B:${r.bRawKey}`
                    : `key: ${r.key}`}
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

              <div style={{ fontWeight: 900 }}>
                {r.aQty > 0 && r.bQty > 0 ? (r.cheaper === "Same" ? "Same" : r.cheaper) : r.cheaper}
              </div>

              <div style={{ fontFamily: "monospace" }}>
                {r.aQty > 0 && r.bQty > 0 ? money(r.delta) : "-"}
              </div>

              <div style={{ fontWeight: 800 }}>{r.matchType === "exact" ? "Exact" : "Fuzzy"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
