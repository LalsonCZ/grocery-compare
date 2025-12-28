"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // With PKCE + detectSessionInUrl, Supabase will process the URL automatically.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setMsg(`Auth error: ${error.message}`);
          return;
        }

        if (!data.session) {
          setMsg("No session found. Please try logging in again.");
          return;
        }

        // Clean URL + go dashboard
        window.location.replace("/dashboard");
      } catch (e: any) {
        setMsg(`Unexpected error: ${e?.message ?? String(e)}`);
      }
    };

    run();
  }, []);

  return <p style={{ padding: 24, fontFamily: "system-ui" }}>{msg}</p>;
}
