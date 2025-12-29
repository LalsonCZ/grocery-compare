import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();

    const { basketId } = await req.json();

    if (!basketId) {
      return NextResponse.json(
        { error: "Missing basketId" },
        { status: 400 }
      );
    }

    // 1) Load items
    const { data: items, error: loadErr } = await supabase
      .from("basket_items")
      .select("id,name,qty,price")
      .eq("basket_id", basketId);

    if (loadErr) {
      return NextResponse.json(
        { error: loadErr.message },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ ok: true, merged: 0 });
    }

    // 2) Merge by normalized name
    const map = new Map<
      string,
      { id: string; name: string; qty: number; price: number }
    >();

    const toDelete: string[] = [];

    for (const it of items) {
      const key = (it.name ?? "").trim().toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          id: it.id,
          name: it.name ?? "",
          qty: it.qty ?? 1,
          price: it.price ?? 0,
        });
      } else {
        const base = map.get(key)!;
        base.qty += it.qty ?? 1;
        base.price = Math.min(base.price, it.price ?? base.price);
        toDelete.push(it.id);
      }
    }

    // 3) Update kept rows
    for (const v of map.values()) {
      await supabase
        .from("basket_items")
        .update({
          qty: v.qty,
          price: v.price,
        })
        .eq("id", v.id);
    }

    // 4) Delete duplicates
    if (toDelete.length > 0) {
      await supabase
        .from("basket_items")
        .delete()
        .in("id", toDelete);
    }

    // ✅ ALWAYS RETURN JSON
    return NextResponse.json({
      ok: true,
      merged: toDelete.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Cleanup failed" },
      { status: 500 }
    );
  }
}
