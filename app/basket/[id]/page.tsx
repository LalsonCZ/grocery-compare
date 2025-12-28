"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type BasketRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string | null;
};

type BasketItemRow = {
  id: string;
  basket_id: string;
  user_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  created_at: string | null;
};

export default function BasketIdPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const basketId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [basket, setBasket] = useState<BasketRow | null>(null);
  const [items, setItems] = useState<BasketItemRow[]>([]);

  const TABLE_BASKETS = "baskets";
  const TABLE_ITEMS = "basket_items";

  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + Number(it.quantity ?? 0), 0);
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
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        if (!userData?.user) {
          window.location.replace("/login");
          return;
        }

        // Load basket
        const basketRes = await supabase
          .from(TABLE_BASKETS)
          .select("id,user_id,name,created_at")
          .eq("id", basketId)
          .maybeSingle();

        if (basketRes.error) throw basketRes.error;
        setBasket((basketRes.data as BasketRow) ?? null);

        // Load items
        const itemsRes = await supabase
          .from(TABLE_ITEMS)
          .select("id,basket_id,user_id,product_name,quantity,unit,created_at")
          .eq("basket_id", basketId)
          .order("created_at", { ascending: true });

        if (itemsRes.error) throw itemsRes.error;
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
        <div style={{ padding: 12, border: "1px solid #f3b4b4", borderRadius: 8 }}>
          <p style={{ margin: 0, color: "crimson" }}>
            <b>Error:</b> {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Details</h2>

            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <b>Name:</b> {basket?.name ?? "(not found)"}
              </div>
              <div>
                <b>Created:</b> {basket?.created_at ?? "(unknown)"}
              </div>
              <div>
                <b>Items:</b> {items.length}
              </div>
              <div>
                <b>Total quantity:</b> {totalQty}
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
                      <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        item id: <code>{it.id}</code>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div>
                        Qty: <b>{it.quantity}</b> {it.unit}
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
