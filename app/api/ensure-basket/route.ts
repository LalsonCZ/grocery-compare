import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseRouteClient(req, res);

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: existing, error: selErr } = await supabase
    .from("baskets")
    .select("id,name,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ basket: existing }, { status: 200 });
  }

  const { data: created, error: insErr } = await supabase
    .from("baskets")
    .insert({ user_id: user.id, name: "Nakup" })
    .select("id,name,created_at")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ basket: created }, { status: 200 });
}
