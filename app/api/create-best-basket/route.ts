import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

type BestItem = {
  name: string;
  qty: number;
  price: number; // chosen unit price
  source: "A" | "B" | "Same";
};

export async function POST(req: Request) {
  const supabase = getSupabaseRouteHandlerClient();

  const body = await req.json();
  const basketAName = String(body?.basketAName ?? "");
  const basketBName = String(body?.basketBName ?? "");
  const items = (body?.items ?? []) as BestItem[];

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  const basketName = `Best (${basketAName} vs ${basketBName})`;

  const { data: basket, error: bErr } = await supabase
    .from("baskets")
    .insert({ user_id: user.id, name: basketName })
    .select("id,name")
    .single();

  if (bErr || !basket) {
    return NextResponse.json(
      { error: bErr?.message ?? "Failed to create basket" },
      { status: 500 }
    );
  }

  const rows = items.map((it) => ({
    basket_id: basket.id,
    user_id: user.id,
    name: it.name,
    qty: it.qty,
    price: it.price,
  }));

  const { error: insErr } = await supabase.from("basket_items").insert(rows);

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { basketId: basket.id, basketName: basket.name },
    { status: 200 }
  );
}
