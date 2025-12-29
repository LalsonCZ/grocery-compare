"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  name?: string | null;
  created_at?: string | null;
};

type BasketItemRow = {
  id: string;
  basket_id: string;
  name?: string | null;
  price?: number | null;
  qty?: number | null;
  created_at?: string | null;
};

function money(n: number) {
  return n.toFixed(2);
}

// ---- Price helpers (text input + normalization) ----
function normalizePriceInput(raw: string) {
  let s = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  if (s.includes(".")) {
    const [a, b] = s.split(".");
    const aa = a.replace(/^0+(?=\d)/, "") || "0";
    return `${aa}.${b ?? ""}`;
  }

  s = s.replace(/^0+(?=\d)/, "");
  return s;
}

function toNumberPrice(raw: string) {
  const s = normalizePriceInput(raw);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ---- Qty helpers ----
function normalizeQtyInput(raw: string) {
  let s = raw.replace(/[^\d]/g, "");
  s = s.replace(/^0+(?=\d)/, "");
  return s;
}

function toIntQty(raw: string) {
  const s = normalizeQtyInput(raw);
  const n = parseInt(s || "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default function BasketIdPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const basketId = Array.isArray(rawId) ? rawId[0] : rawId;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [basket, setBasket] = useState<BasketRow | null>(null);
  const [items, setItems] = useState<BasketItemRow[]>([]);

  // form
  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState(""); // ✅ text (prevents 030 UX weirdness)
  const [qtyText, setQtyText] = useState("1");

  const total = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + Number(it.price ?? 0) * Number(it.qty ?? 0),
      0
    );
  }, [items]);

  const load = async () => {
    if (!basketId) return;

    setError(null);
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: b, error: bErr } = await supabase
      .from("baskets")
      .select("id,name,created_at")
      .eq("id", basketId)
      .maybeSingle();

    if (bErr) {
      setError(bErr.message);
      setLoading(false);
      return;
    }
    setBasket(b ?? null);

    const { data: its, error: iErr } = await supabase
      .from("basket_items")
      .select("id,basket_id,name,price,qty,created_at")
      .eq("basket_id", basketId)
      .order("created_at", { ascending: false });

    if (iErr) {
      setError(iErr.message);
      setLoading(false);
      return;
    }

    setItems((its ?? []) as BasketItemRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketId]);

  // ✅ Add item via server upsert (prevents duplicates)
  const addItem = async () => {
    if (!basketId) return;

    setBusy(true);
    setError(null);
    setInfo(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Item name is required");
      setBusy(false);
      return;
    }

    const price = toNumberPrice(priceText);
    const qty = toIntQty(qtyText);

    try {
      const res = await fetch("/api/upsert-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, name: trimmed, price, qty }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setError(json?.error ?? "Add failed");
        setBusy(false);
        return;
      }

      setInfo(json?.message ?? "Done.");

      if (json?.action === "inserted" || json?.action === "merged") {
        setName("");
        setPriceText("");
        setQtyText("1");
      }

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.from("basket_items").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    await load();
    setBusy(false);
  };

  // OPTIONAL: keep if you still want cleanup button
  const cleanupMerge = async () => {
    if (!basketId) return;

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/cleanup-basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setError(json?.error ?? "Cleanup failed");
      } else {
        setInfo(`Cleanup done. Merged ${json?.merged ?? 0} duplicates.`);
        await load();
      }
    } catch (e: any) {
      setError(e?.message ?? "Cleanup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </div>

      <h2>Basket</h2>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}
      {info && <div style={{ color: "green", marginBottom: 12 }}>{info}</div>}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {basket?.name ?? "(no name)"}
            </div>
            <div style={{ fontFamily: "monospace", color: "#666" }}>
              id: {basketId}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={cleanupMerge} disabled={busy}>
                Cleanup & merge duplicates
              </button>
              <Link href="/compare">Go to compare →</Link>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 16,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 900 }}>Total</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{money(total)}</div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Add item</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <input
                placeholder="Item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                placeholder="Price"
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(normalizePriceInput(e.target.value))}
                onBlur={() => {
                  const n = toNumberPrice(priceText);
                  setPriceText(n ? String(n) : "");
                }}
              />

              <input
                placeholder="Qty"
                inputMode="numeric"
                value={qtyText}
                onChange={(e) => setQtyText(normalizeQtyInput(e.target.value))}
                onBlur={() => setQtyText(String(toIntQty(qtyText)))}
              />

              <button onClick={addItem} disabled={busy}>
                Add
              </button>
            </div>
          </div>

          <div style={{ fontWeight: 900, marginBottom: 8 }}>Items</div>

          {items.length === 0 ? (
            <div>No items yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((it) => {
                const q = Number(it.qty ?? 0);
                const p = Number(it.price ?? 0);
                return (
                  <div
                    key={it.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>{it.name}</div>
                      <div style={{ color: "#555", fontSize: 13 }}>
                        qty: {q} | price: {money(p)} | line: {money(q * p)}
                      </div>
                    </div>
                    <button onClick={() => deleteItem(it.id)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
