"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function finish() {
      // Handles BOTH:
      // 1) ?code=... (PKCE)
      // 2) #access_token=... (implicit) — Supabase reads hash automatically
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else {
        // If it's hash-based, just asking for session will persist it
        await supabase.auth.getSession();
      }

      // Now go to dashboard
      window.location.replace("/dashboard");
    }

    finish();
  }, []);

  return <p style={{ padding: 24 }}>Finishing login...</p>;
}
