import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function norm(s: string) {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const basketId = body?.basketId as string | undefined;
    const name = (body?.name as string | undefined) ?? "";
    const qty = Number(body?.qty ?? 1);
    const price = Number(body?.price ?? 0);

    if (!basketId) {
      return NextResponse.json({ error: "Missing basketId" }, { status: 400 });
    }
    if (!name.trim()) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // load items in this basket, we’ll match in JS (case-insensitive + diacritics)
    const { data: items, error: loadErr } = await supabase
      .from("basket_items")
      .select("id,name,qty,price")
      .eq("basket_id", basketId);

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }

    const key = norm(name);
    const existing = (items ?? []).find((it) => norm(it.name ?? "") === key);

    if (!existing) {
      // insert new
      const { error: insErr } = await supabase.from("basket_items").insert({
        basket_id: basketId,
        name: name.trim(),
        qty,
        price,
      });

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        action: "inserted",
        message: "Added as a new item.",
      });
    }

    const exQty = Number(existing.qty ?? 1);
    const exPrice = Number(existing.price ?? 0);

    // ✅ same qty and same price -> do nothing + warn
    if (exQty === qty && exPrice === price) {
      return NextResponse.json({
        ok: true,
        action: "skipped",
        message: `Item already exists (${existing.name}). Nothing added.`,
      });
    }

    // otherwise: merge into existing
    const newQty = exQty + qty;
    const newPrice = Math.min(exPrice, price); // keep cheaper unit price

    const { error: upErr } = await supabase
      .from("basket_items")
      .update({ qty: newQty, price: newPrice })
      .eq("id", existing.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: "merged",
      message: `Item already exists (${existing.name}). Merged quantities (qty ${exQty} + ${qty} = ${newQty}).`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Upsert failed" },
      { status: 500 }
    );
  }
}
