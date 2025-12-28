"use client";

export const dynamic = "force-dynamic";

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

export default function BasketIdPage() {
  const params = useParams<{ id: string }>();
  const basketId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [basket, setBasket] = useState<BasketRow | null>(null);
  const [items, setItems] = useState<BasketItemRow[]>([]);

  // 🔧 If your Supabase tables are named differently, change only these 2 values:
  const TABLE_BASKETS = "baskets";
  const TABLE_ITEMS = "basket_items";

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = Number(it.price ?? 0);
      const qty = Number(it.qty ?? 1);
      return sum + price * qty;
    }, 0);
  }, [items]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!basketId) {
          setError("Missing basket id in URL.");
          return;
        }

        const supabase = getSupabaseBrowserClient();

        // Require login
        const userRes = await supabase.auth.getUser();
        if (!userRes.data.user) {
          window.location.replace("/login");
          return;
        }

        // Load basket (optional)
        const basketRes = await supabase
          .from(TABLE_BASKETS)
          .select("*")
          .eq("id", basketId)
          .maybeSingle();

        if (basketRes.error) {
          // Not fatal — we can still load items
          console.warn("Basket load error:", basketRes.error.message);
        } else {
          setBasket((basketRes.data as BasketRow) ?? null);
        }

        // Load items
        const itemsRes = await supabase
          .from(TABLE_ITEMS)
          .select("*")
          .eq("basket_id", basketId);

        if (itemsRes.error) {
          throw new Error(
            `Cannot load items from table "${TABLE_ITEMS}". ` +
              `Update TABLE_ITEMS/TABLE_BASKETS in this file to match your DB. ` +
              `Supabase says: ${itemsRes.error.message}`
          );
        }

        setItems((itemsRes.data as BasketItemRow[]) ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [basketId]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>

      <h1 style={{ marginBottom: 6 }}>Basket</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        ID: <code>{basketId}</code>
      </p>

      {loading && <p>Loading…</p>}

      {!loading && error && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f3b4b4",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: 0, color: "crimson" }}>
            <b>Error:</b> {error}
          </p>
          <p style={{ marginTop: 10, opacity: 0.8 }}>
            If your table names are not <code>baskets</code> /{" "}
            <code>basket_items</code>, edit <code>TABLE_BASKETS</code> and{" "}
            <code>TABLE_ITEMS</code> near the top of this file.
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            style={{
              marginTop: 18,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>
              Details
            </h2>

            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <b>Name:</b> {basket?.name ?? "(no name)"}
              </div>
              <div>
                <b>Created:</b> {basket?.created_at ?? "(unknown)"}
              </div>
              <div>
                <b>Items:</b> {items.length}
              </div>
              <div>
                <b>Total:</b> {total.toFixed(2)}
              </div>
            </div>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10, fontSize: 18 }}>Items</h2>

            {items.length === 0 ? (
              <p>No items in this basket.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      padding: 12,
                      border: "1px solid #eee",
                      borderRadius: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {it.name ?? "(unnamed item)"}
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        item id: <code>{it.id}</code>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div>
                        Qty: <b>{it.qty ?? 1}</b>
                      </div>
                      <div>
                        Price: <b>{Number(it.price ?? 0).toFixed(2)}</b>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        Subtotal:{" "}
                        <b>
                          {(Number(it.price ?? 0) * Number(it.qty ?? 1)).toFixed(
                            2
                          )}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
