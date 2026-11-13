import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold">Myssion Sports</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        League management for venues, divisions, scheduling, rosters and standings.
      </p>
      <p>
        <Link href="/login" className="inline-block rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          Sign in
        </Link>
      </p>
    </main>
  );
}
