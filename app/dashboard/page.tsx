"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Basket = {
  id: string;
  name: string;
  created_at: string;
};

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setEmail(user.email ?? null);

    const { data, error } = await supabase
      .from("baskets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    else setBaskets((data as Basket[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createBasket(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    if (!name.trim()) return;

    const { error } = await supabase.from("baskets").insert({
      user_id: user.id,
      name: name.trim(),
    });

    if (error) setMsg(error.message);
    else {
      setName("");
      await load();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 800 }}>
      <h1>Dashboard</h1>
      <p>
        Logged in as: <strong>{email}</strong>
      </p>

      <button onClick={logout} style={{ margin: "12px 0" }}>
        Logout
      </button>

      <hr style={{ margin: "16px 0" }} />

      <h2>Create basket</h2>
      <form onSubmit={createBasket} style={{ display: "flex", gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend shopping"
          style={{ padding: 10, width: 280 }}
        />
        <button type="submit" style={{ padding: "10px 14px" }}>
          Create
        </button>
      </form>

      {msg && <p style={{ marginTop: 12, color: "crimson" }}>{msg}</p>}

      <h2 style={{ marginTop: 20 }}>Your baskets</h2>
      {baskets.length === 0 ? (
        <p>No baskets yet.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {baskets.map((b) => (
            <li key={b.id} style={{ marginBottom: 8 }}>
              <Link href={`/basket/${b.id}`}>{b.name}</Link>{" "}
              <small style={{ opacity: 0.7 }}>
                ({new Date(b.created_at).toLocaleString()})
              </small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
