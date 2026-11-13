import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sendSignInLink } from "./actions";

const ERRORS: Record<string, string> = {
  "invalid-email": "That doesn't look like an email address. Please check it and try again.",
  "too-many": "Too many sign-in emails were sent recently. Please wait a few minutes and try again.",
  "send-failed": "We couldn't send the sign-in email. Please try again in a moment.",
  "link-invalid": "That sign-in link has expired or was already used. Please request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Sign-in isn&apos;t set up yet</h1>
        <p className="text-gray-600 dark:text-gray-400">
          The site isn&apos;t connected to its Supabase project. Add the project&apos;s publishable
          key and try again.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { sent, error } = await searchParams;
  const errorMessage = error ? (ERRORS[error] ?? ERRORS["send-failed"]) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Sign in to Myssion Sports</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Enter your email and we&apos;ll send you a link to sign in. No password needed.
        </p>
      </div>

      {sent ? (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          <p className="font-medium">Check your email.</p>
          <p className="mt-1">
            We sent a sign-in link to <strong>{sent}</strong>. Open it in this same browser. The
            link works once and expires after an hour.
          </p>
          <a href="/login" className="mt-3 inline-block underline">
            Use a different email
          </a>
        </div>
      ) : (
        <form action={sendSignInLink} className="flex flex-col gap-3">
          {errorMessage && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
              {errorMessage}
            </p>
          )}
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base dark:border-gray-700"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Email me a sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
