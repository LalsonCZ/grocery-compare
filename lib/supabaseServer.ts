import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const getSupabaseRouteHandlerClient = () => {
  // ✅ TS fix: cookies() is typed too strictly in some Next/TS versions
  const cookieStore = cookies() as any;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
};
