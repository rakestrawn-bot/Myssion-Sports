"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sends the sign-in email. Supabase emails a link that comes back to
// /auth/confirm on this site, which signs the person in.
export async function sendSignInLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=invalid-email");
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = h.get("origin") ?? `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    console.error("Sign-in email failed:", error.status, error.code, error.message);
    const reason = error.status === 429 ? "too-many" : "send-failed";
    redirect(`/login?error=${reason}`);
  }

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}
