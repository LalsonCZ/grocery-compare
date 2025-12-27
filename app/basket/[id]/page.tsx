"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Basket = {
  id: string;
  name: string;
  created_at: string;
};

type Item = {
  id: string;
  basket_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price_rohlik: number | null;
  price_kosik: number | null;
  created_at: string;
};

function money(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function BasketPage() {
  const params = useParams<{ id: string }>();
  const basketId = params?.id;

  const [loading, setLoading] = useState(true);
  const [basket, setBasket] = useState<Basket | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // add item form
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");

  // ✅ C: bulk paste
  const [bulkText, setBulkText] = useState("");

  async function load(id: string) {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: basketData, error: basketErr } = await supabase
      .from("baskets")
      .select("*")
      .eq("id", id)
      .single();

    if (basketErr) {
      setMsg(basketErr.message);
      setBasket(null);
      setLoading(false);
      return;
    }

    setBasket(basketData as Basket);

    const { data: itemsData, error: itemsErr } = await supabase
      .from("basket_items")
      .select("*")
      .eq("basket_id", id)
      .order("created_at", { ascending: false });

    if (itemsErr) setMsg(itemsErr.message);
    else setItems((itemsData as Item[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!basketId) return;
    load(basketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketId]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!basketId) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    const qty = Number(quantity);
    if (!productName.trim()) return setMsg("Please enter product name.");
    if (!Number.isFinite(qty) || qty <= 0) return setMsg("Quantity must be > 0.");

    const { error } = await supabase.from("basket_items").insert({
      basket_id: basketId,
      user_id: user.id,
      product_name: productName.trim(),
      quantity: qty,
      unit,
      price_rohlik: null,
      price_kosik: null,
    });

    if (error) setMsg(error.message);
    else {
      setProductName("");
      setQuantity("1");
      setUnit("pcs");
      await load(basketId);
    }
  }

  // ✅ C: paste list -> add many items
  async function addBulkItems() {
    setMsg(null);
    if (!basketId) return;

    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setMsg("Paste at least one item (one per line).");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    const rows = lines.map((name) => ({
      basket_id: basketId,
      user_id: user.id,
      product_name: name,
      quantity: 1,
      unit: "pcs",
      price_rohlik: null,
      price_kosik: null,
    }));

    const { error } = await supabase.from("basket_items").insert(rows);

    if (error) setMsg(error.message);
    else {
      setBulkText("");
      await load(basketId);
    }
  }

  async function deleteItem(itemId: string) {
    setMsg(null);
    const { error } = await supabase.from("basket_items").delete().eq("id", itemId);
    if (error) setMsg(error.message);
    else if (basketId) await load(basketId);
  }

  async function updatePrice(
    itemId: string,
    field: "price_rohlik" | "price_kosik",
    value: string
  ) {
    setMsg(null);

    const trimmed = value.trim();
    const num = trimmed === "" ? null : Number(trimmed);

    if (trimmed !== "" && (!Number.isFinite(num) || (num as number) < 0)) {
      setMsg("Price must be a number ≥ 0 (or empty).");
      return;
    }

    const { error } = await supabase
      .from("basket_items")
      .update({ [field]: num } as any)
      .eq("id", itemId);

    if (error) setMsg(error.message);
    else {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? ({ ...it, [field]: num } as Item) : it))
      );
    }
  }

  const totals = useMemo(() => {
    const rohlik = items.reduce((sum, it) => {
      const p = it.price_rohlik ?? 0;
      return sum + p * (it.quantity ?? 0);
    }, 0);

    const kosik = items.reduce((sum, it) => {
      const p = it.price_kosik ?? 0;
      return sum + p * (it.quantity ?? 0);
    }, 0);

    return { rohlik, kosik };
  }, [items]);

  const cheaper =
    totals.rohlik === 0 && totals.kosik === 0
      ? null
      : totals.rohlik < totals.kosik
      ? "Rohlík"
      : totals.kosik < totals.rohlik
      ? "Košík"
      : "Same";

  if (!basketId) return <p style={{ padding: 24 }}>Loading basket id...</p>;
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  if (!basket) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <p>Basket not found (or you don’t have access).</p>
        <p>
          <Link href="/dashboard">← Back to dashboard</Link>
        </p>
        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980 }}>
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>

      <h1>{basket.name}</h1>
      <p style={{ opacity: 0.7 }}>
        Created: {new Date(basket.created_at).toLocaleString()}
      </p>

      <hr style={{ margin: "16px 0" }} />

      <h2>Totals</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Rohlík</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{money(totals.rohlik)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Košík</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{money(totals.kosik)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Cheaper</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {cheaper === null ? "—" : cheaper === "Same" ? "Same price" : cheaper}
          </div>
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2>Add item</h2>
      <form onSubmit={addItem} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="e.g. Milk"
          style={{ padding: 10, width: 280 }}
        />

        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="decimal"
          style={{ padding: 10, width: 90 }}
        />

        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ padding: 10 }}>
          <option value="pcs">pcs</option>
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="l">l</option>
          <option value="ml">ml</option>
        </select>

        <button type="submit" style={{ padding: "10px 14px" }}>
          Add
        </button>
      </form>

      {/* ✅ C: paste list */}
      <h3 style={{ marginTop: 16 }}>Paste shopping list (one item per line)</h3>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        placeholder={"Milk\nBread\nButter"}
        style={{ width: 420, height: 120, padding: 10, display: "block" }}
      />
      <button onClick={addBulkItems} style={{ marginTop: 8, padding: "10px 14px" }}>
        Add all items
      </button>

      {msg && <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p>}

      <h2 style={{ marginTop: 20 }}>Items & prices</h2>
      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Product</th>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Rohlík (CZK / unit)</th>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Košík (CZK / unit)</th>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}>Line totals</th>
              <th style={{ borderBottom: "1px solid #ddd", padding: 8 }}></th>
            </tr>
          </thead>

          <tbody>
            {items.map((it) => {
              const lineR = (it.price_rohlik ?? 0) * (it.quantity ?? 0);
              const lineK = (it.price_kosik ?? 0) * (it.quantity ?? 0);

              const both = it.price_rohlik != null && it.price_kosik != null;
              const rohlikCheaper = both && (it.price_rohlik as number) < (it.price_kosik as number);
              const kosikCheaper = both && (it.price_kosik as number) < (it.price_rohlik as number);

              return (
                <tr key={it.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {it.product_name}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {it.quantity} {it.unit}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <input
                      defaultValue={it.price_rohlik ?? ""}
                      placeholder="e.g. 24.90"
                      inputMode="decimal"
                      style={{
                        padding: 8,
                        width: 140,
                        background: rohlikCheaper ? "#e8f5e9" : "white",
                      }}
                      onBlur={(e) => updatePrice(it.id, "price_rohlik", e.target.value)}
                    />
                    {rohlikCheaper && (
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>cheaper</div>
                    )}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <input
                      defaultValue={it.price_kosik ?? ""}
                      placeholder="e.g. 22.50"
                      inputMode="decimal"
                      style={{
                        padding: 8,
                        width: 140,
                        background: kosikCheaper ? "#e8f5e9" : "white",
                      }}
                      onBlur={(e) => updatePrice(it.id, "price_kosik", e.target.value)}
                    />
                    {kosikCheaper && (
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>cheaper</div>
                    )}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8, opacity: 0.9 }}>
                    <div>R: {money(lineR)}</div>
                    <div>K: {money(lineK)}</div>
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button onClick={() => deleteItem(it.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Tip: prices save when you click out of the input (onBlur).
      </p>
    </main>
  );
}
