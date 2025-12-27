"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AuthCallbackPage() {
  useEffect(() => {
    async function finishLogin() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anon) {
        console.error("Missing Supabase env vars", { url: !!url, anon: !!anon });
        return;
      }

      const supabase = createClient(url, anon);

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      window.location.href = "/dashboard";
    }

    finishLogin();
  }, []);

  return <p style={{ padding: 24 }}>Finishing login...</p>;
}
