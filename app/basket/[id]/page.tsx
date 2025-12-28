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

type EditState = {
  name: string;
  price: string;
  qty: string;
};

export default function BasketIdPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const basketId = Array.isArray(rawId) ? rawId[0] : rawId;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [basket, setBasket] = useState<BasketRow | null>(null);
  const [items, setItems] = useState<BasketItemRow[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", price: "", qty: "" });

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
      setError("Basket not found (or not yours).");
      setBasket(null);
      setItems([]);
      setLoading(false);
      return;
    }

    setBasket(basketData as BasketRow);

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

  const total = items.reduce((sum, it) => {
    const p = it.price ?? 0;
    const q = it.qty ?? 0;
    return sum + p * q;
  }, 0);

  const startEdit = (it: BasketItemRow) => {
    setError(null);
    setEditingId(it.id);
    setEdit({
      name: (it.name ?? "").toString(),
      price: it.price === null || it.price === undefined ? "" : String(it.price),
      qty: it.qty === null || it.qty === undefined ? "1" : String(it.qty),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ name: "", price: "", qty: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    setError(null);
    setBusyId(editingId);

    const name = edit.name.trim();
    if (!name) {
      setError("Name cannot be empty.");
      setBusyId(null);
      return;
    }

    const qtyNum = Number(edit.qty);
    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      setError("Qty must be a positive number.");
      setBusyId(null);
      return;
    }

    let priceNum: number | null = null;
    if (edit.price.trim() !== "") {
      priceNum = Number(edit.price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        setError("Price must be a number >= 0.");
        setBusyId(null);
        return;
      }
    } else {
      priceNum = 0;
    }

    const { error: updErr } = await supabase
      .from("basket_items")
      .update({
        name,
        qty: qtyNum,
        price: priceNum,
      })
      .eq("id", editingId)
      .eq("basket_id", basketId);

    if (updErr) {
      setError(updErr.message);
      setBusyId(null);
      return;
    }

    // optimistic local update
    setItems((prev) =>
      prev.map((x) =>
        x.id === editingId ? { ...x, name, qty: qtyNum, price: priceNum } : x
      )
    );

    setBusyId(null);
    cancelEdit();
  };

  const deleteItem = async (itemId: string) => {
    setError(null);
    setBusyId(itemId);

    const { error: delErr } = await supabase
      .from("basket_items")
      .delete()
      .eq("id", itemId)
      .eq("basket_id", basketId);

    if (delErr) {
      setError(delErr.message);
      setBusyId(null);
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== itemId));
    setBusyId(null);

    if (editingId === itemId) cancelEdit();
  };

  const addItem = async () => {
    setError(null);

    const name = newItemName.trim();
    if (!name) return;

    const price = newItemPrice.trim() ? Number(newItemPrice) : 0;
    const qty = newItemQty.trim() ? Number(newItemQty) : 1;

    if (newItemPrice.trim() && (Number.isNaN(price) || price < 0)) {
      setError("Price must be a number >= 0.");
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setError("Qty must be a positive number.");
      return;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("basket_items")
      .insert({
        basket_id: basketId,
        name,
        price,
        qty,
      })
      .select("id,basket_id,name,price,qty,created_at")
      .single();

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");

    // add on top
    setItems((prev) => [inserted as BasketItemRow, ...prev]);
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

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
              marginBottom: 12,
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
              padding: 14,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {total.toFixed(2)}
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
              {items.map((it) => {
                const isEditing = editingId === it.id;
                const isBusy = busyId === it.id;

                return (
                  <div
                    key={it.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {!isEditing ? (
                        <>
                          <div style={{ fontWeight: 800 }}>{it.name}</div>
                          <div style={{ fontSize: 13, color: "#555" }}>
                            qty: {it.qty ?? 0} | price: {it.price ?? 0} | line:{" "}
                            {((it.price ?? 0) * (it.qty ?? 0)).toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <input
                            value={edit.name}
                            onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Name"
                            style={{ padding: 10, width: 220 }}
                          />
                          <input
                            value={edit.price}
                            onChange={(e) => setEdit((p) => ({ ...p, price: e.target.value }))}
                            placeholder="Price"
                            style={{ padding: 10, width: 120 }}
                          />
                          <input
                            value={edit.qty}
                            onChange={(e) => setEdit((p) => ({ ...p, qty: e.target.value }))}
                            placeholder="Qty"
                            style={{ padding: 10, width: 90 }}
                          />
                        </div>
                      )}
                    </div>

                    {!isEditing ? (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => startEdit(it)}>Edit</button>
                        <button disabled={isBusy} onClick={() => deleteItem(it.id)}>
                          {isBusy ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button disabled={busyId === it.id} onClick={saveEdit}>
                          {busyId === it.id ? "Saving..." : "Save"}
                        </button>
                        <button onClick={cancelEdit}>Cancel</button>
                      </div>
                    )}
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
