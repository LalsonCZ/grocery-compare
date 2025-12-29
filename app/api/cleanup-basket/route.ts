import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

type Item = {
  id: string;
  basket_id: string;
  name: string | null;
  product_key: string | null;
  qty: number | null;
  price: number | null;
};

export async function POST(req: Request) {
  const supabase = getSupabaseRouteHandlerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { basketId } = await req.json();
  if (!basketId) {
    return NextResponse.json({ error: "Missing basketId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("basket_items")
    .select("id,basket_id,name,product_key,qty,price")
    .eq("basket_id", basketId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []) as Item[];
  const groups = new Map<string, Item[]>();

  for (const it of items) {
    const key = it.product_key ?? it.name?.toLowerCase() ?? "";
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  let mergedGroups = 0;
  let deletedRows = 0;

  for (const [, arr] of groups) {
    if (arr.length <= 1) continue;

    const keeper = arr[0];
    let qtySum = 0;
    let totalSum = 0;
    let bestName = "";

    for (const it of arr) {
      const q = Number(it.qty ?? 0);
      const p = Number(it.price ?? 0);
      qtySum += q;
      totalSum += q * p;
      if ((it.name ?? "").length > bestName.length) {
        bestName = it.name ?? "";
      }
    }

    const newPrice = qtySum > 0 ? totalSum / qtySum : 0;

    const { error: upErr } = await supabase
      .from("basket_items")
      .update({
        name: bestName,
        qty: qtySum,
        price: newPrice,
      })
      .eq("id", keeper.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const idsToDelete = arr.slice(1).map((x) => x.id);
    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("basket_items")
        .delete()
        .in("id", idsToDelete);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      deletedRows += idsToDelete.length;
    }

    mergedGroups += 1;
  }

  return NextResponse.json({
    mergedGroups,
    deletedRows,
  });
}
