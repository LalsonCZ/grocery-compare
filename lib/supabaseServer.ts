import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseRouteHandlerClient() {
  const cookieStore = cookies() as any;

  const getAll = () => {
    // Next 14+ má getAll()
    if (typeof cookieStore.getAll === "function") return cookieStore.getAll();

    // některé verze getAll nemají -> vrátíme prázdné a Supabase si poradí
    return [];
  };

  const setOne = (name: string, value: string, options: any) => {
    // Next cookies() API differs by version; try both signatures
    try {
      cookieStore.set(name, value, options);
    } catch {
      cookieStore.set({ name, value, ...options });
    }
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll,
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setOne(name, value, options);
          });
        },
      },
    }
  );
}
