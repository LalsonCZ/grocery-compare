"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function getHashParams() {
  const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash);
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    async function finish() {
      try {
        const supabase = getSupabaseBrowserClient();

        // 1) handle ?code=...
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg(`❌ Login failed: ${error.message}`);
            return;
          }
          window.location.replace("/dashboard");
          return;
        }

        // 2) handle #access_token=...&refresh_token=...
        const hashParams = getHashParams();
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            setMsg(`❌ Login failed: ${error.message}`);
            return;
          }
          window.location.replace("/dashboard");
          return;
        }

        // 3) if nothing in URL, maybe session is already stored
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          window.location.replace("/dashboard");
          return;
        }

        setMsg("No session found. Please try logging in again.");
      } catch (e: any) {
        setMsg(`Unexpected error: ${e?.message ?? String(e)}`);
      }
    }

    finish();
  }, []);

  return <p style={{ padding: 24 }}>{msg}</p>;
}
