import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The sign-in email's link lands here. It arrives in one of two forms,
// depending on Supabase's email template:
//   ?token_hash=...&type=magiclink   works on any device or browser
//   ?code=...                        works only in the browser that asked for the link
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.error("Sign-in link check failed:", error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("Sign-in code exchange failed:", error.code, error.message);
  }

  return NextResponse.redirect(new URL(ok ? "/dashboard" : "/login?error=link-invalid", origin));
}
