import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type Membership = {
  role: "staff" | "club_admin" | "coach";
  organizations: { name: string; slug: string } | null;
};

const ROLE_LABELS: Record<Membership["role"], string> = {
  staff: "League staff",
  club_admin: "Club administrator",
  coach: "Coach",
};

export default async function DashboardPage() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: memberships }, { data: isPlatformOwner }] = await Promise.all([
    supabase
      .from("org_members")
      .select("role, organizations(name, slug)")
      .eq("user_id", user.id)
      .returns<Membership[]>(),
    supabase.rpc("is_platform_owner"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Myssion Sports</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-1">
        <p>
          You&apos;re signed in as <strong>{user.email}</strong>.
        </p>
        {isPlatformOwner && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Platform owner: you can see every organization.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your organizations</h2>
        {memberships && memberships.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {memberships.map((m) => (
              <li key={m.organizations?.slug}>
                <Link
                  href={`/o/${m.organizations?.slug}`}
                  className="block rounded-md border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950"
                >
                  <p className="font-medium">{m.organizations?.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{ROLE_LABELS[m.role]}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">
            You aren&apos;t part of any organization yet.
          </p>
        )}
      </section>
    </main>
  );
}
