"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  user_id: string;
  name: string | null;
  created_at: string | null;
};

type BasketItemRow = {
  id: string;
  basket_id: string;
  name: string | null;
  price: number | null;
  qty: number | null;
  created_at: string | null;
};

export default function BasketIdPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const basketId = Array.isArray(rawId) ? rawId[0] : rawId;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [basket, setBasket] = useState<BasketRow | null>(null);
  const [items, setItems] = useState<BasketItemRow[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const load = async () => {
    setLoading(true);
    setError(null);

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

    // IMPORTANT: filter by user_id too (prevents RLS confusion + security)
    const { data: basketData, error: basketErr } = await supabase
      .from("baskets")
      .select("id,user_id,name,created_at")
      .eq("id", basketId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (basketErr) {
      setError(basketErr.message);
      setLoading(false);
      return;
    }

    if (!basketData) {
      setError("Still no basket (not found or not yours).");
      setBasket(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setBasket(basketData as BasketRow);

    // load items (requires RLS policy on basket_items)
    const { data: itemsData, error: itemsErr } = await supabase
      .from("basket_items")
      .select("id,basket_id,name,price,qty,created_at")
      .eq("basket_id", basketId)
      .order("created_at", { ascending: false });

    if (itemsErr) {
      setError(itemsErr.message);
      setLoading(false);
      return;
    }

    setItems((itemsData ?? []) as BasketItemRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!basketId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketId]);

  const addItem = async () => {
    setError(null);

    const name = newItemName.trim();
    if (!name) return;

    const price = newItemPrice.trim() ? Number(newItemPrice) : null;
    const qty = newItemQty.trim() ? Number(newItemQty) : 1;

    const { error: insErr } = await supabase.from("basket_items").insert({
      basket_id: basketId,
      name,
      price,
      qty,
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");
    await load();
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </div>

      <h2>Basket</h2>

      {error && (
        <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>
      )}

      {!basket ? (
        <div>No basket.</div>
      ) : (
        <>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {basket.name ?? "(no name)"}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              id: {basket.id}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <h3>Add item</h3>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name"
                style={{ padding: 10, width: 260 }}
              />
              <input
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Price"
                style={{ padding: 10, width: 140 }}
              />
              <input
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                placeholder="Qty"
                style={{ padding: 10, width: 100 }}
              />
              <button onClick={addItem}>Add</button>
            </div>
          </div>

          <h3>Items</h3>
          {items.length === 0 ? (
            <div>No items yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      qty: {it.qty ?? 0} | price: {it.price ?? "-"}
                    </div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {it.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
