"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  useEffect(() => {
    const finishLogin = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anon) {
        console.error("Missing Supabase env vars");
        return;
      }

      const supabase = createClient(url, anon);

      // ✅ THIS is the missing piece
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        console.error("No session found", error);
        window.location.replace("/login");
        return;
      }

      // ✅ Session exists → redirect
      window.location.replace("/dashboard");
    };

    finishLogin();
  }, []);

  return <p style={{ padding: 24 }}>Signing you in…</p>;
}
