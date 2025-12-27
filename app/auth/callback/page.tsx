"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  useEffect(() => {
    async function finishLogin() {
      // If the magic link contains a ?code=... we exchange it for a session
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      // Now we should have a session (if login succeeded)
      window.location.href = "/dashboard";
    }

    finishLogin();
  }, []);

  return <p style={{ padding: 24 }}>Finishing login...</p>;
}
