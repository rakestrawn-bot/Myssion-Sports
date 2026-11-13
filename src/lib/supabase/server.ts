import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// A Supabase client for server code (pages, server actions, route handlers).
// It reads and writes the sign-in cookies of the current request.
// Create a new one for every request; never share one between requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Pages can't set cookies while rendering. That's fine: the
          // middleware refreshes the sign-in cookies on every request.
        }
      },
    },
  });
}
