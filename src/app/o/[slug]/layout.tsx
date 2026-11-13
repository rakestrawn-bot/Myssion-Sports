import Link from "next/link";
import type { ReactNode } from "react";
import { getOrg } from "@/lib/org";

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { org, isStaff } = await getOrg(slug);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
        <div className="flex flex-col">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:underline dark:text-gray-400">
            Myssion Sports
          </Link>
          <Link href={`/o/${org.slug}`} className="text-lg font-semibold hover:underline">
            {org.name}
          </Link>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>
      {isStaff ? (
        children
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          Only league staff can manage this organization for now. Coach and club administrator
          tools are coming in a later phase.
        </p>
      )}
    </div>
  );
}
