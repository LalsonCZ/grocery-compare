import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

type Body = {
  basketId: string;
  name: string;
  price: number;
  qty: number;
};

// normalizace pro porovnání (mleko/MLEKO/ Mléko -> mleko)
function normalizeName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // odstraní diakritiku
    .replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<Body>;
    const basketId = String(body.basketId || "").trim();
    const rawName = String(body.name || "").trim();

    if (!basketId) return NextResponse.json({ error: "Missing basketId" }, { status: 400 });
    if (!rawName) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const price = Number(body.price ?? 0);
    const qty = Number(body.qty ?? 1);

    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

    // 1) načti všechny items pro basket (RLS zajistí přístup jen k vlastním)
    const { data: existingItems, error: selErr } = await supabase
      .from("basket_items")
      .select("id,name,qty,price,basket_id")
      .eq("basket_id", basketId);

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }

    const targetKey = normalizeName(rawName);

    const match = (existingItems ?? []).find((it: any) => normalizeName(it.name ?? "") === targetKey);

    // 2) když existuje stejné jméno (case-insensitive, bez diakritiky)
    if (match) {
      const oldQty = Number(match.qty ?? 0);
      const oldPrice = Number(match.price ?? 0);

      // 2a) když qty i price stejné -> nic neměň, jen info
      if (oldQty === safeQty && oldPrice === safePrice) {
        return NextResponse.json({
          action: "noop",
          message: `⚠️ Položka "${match.name}" už existuje se stejnou cenou i množstvím – nic neměním.`,
        });
      }

      // 2b) jinak: slouč (zvýší qty) a případně update price, pokud se liší
      const newQty = oldQty + safeQty;
      const newPrice = safePrice; // držíme poslední zadanou cenu

      const { error: updErr } = await supabase
        .from("basket_items")
        .update({ qty: newQty, price: newPrice })
        .eq("id", match.id);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        action: "merged",
        message: `✅ Položka "${match.name}" už existovala – sloučeno. Qty: ${oldQty} + ${safeQty} = ${newQty}.`,
      });
    }

    // 3) neexistuje -> insert nového řádku
    const { error: insErr } = await supabase.from("basket_items").insert({
      basket_id: basketId,
      name: rawName,
      qty: safeQty,
      price: safePrice,
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      action: "inserted",
      message: `✅ Přidáno: "${rawName}"`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
