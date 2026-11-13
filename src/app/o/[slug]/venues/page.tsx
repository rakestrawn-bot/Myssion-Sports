import Link from "next/link";
import { getOrg } from "@/lib/org";
import { Banner, Breadcrumbs, Button, Card, Input, Label, PageTitle, Section } from "@/components/ui";
import { createVenue } from "./actions";

export default async function VenuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { supabase, org } = await getOrg(slug);

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, fields(count)")
    .eq("org_id", org.id)
    .order("name")
    .returns<{ id: string; name: string; address: string | null; fields: { count: number }[] }[]>();

  return (
    <main className="flex flex-col gap-8">
      <Breadcrumbs items={[{ href: `/o/${slug}`, label: "Setup" }, { label: "Venues" }]} />
      <PageTitle subtitle="Step 1 of setup: the parks and complexes where games are played.">Venues</PageTitle>
      {error && <Banner kind="error">{error}</Banner>}

      <Section title="Your venues">
        {venues && venues.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {venues.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/o/${slug}/venues/${v.id}`}
                  className="block rounded-md border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950"
                >
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {v.address ? `${v.address} · ` : ""}
                    {v.fields[0]?.count ?? 0} field{v.fields[0]?.count === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No venues yet. Add your first one below.</p>
        )}
      </Section>

      <Section title="Add a venue">
        <Card>
          <form action={createVenue} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="org_id" value={org.id} />
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Sample Park" />
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" placeholder="e.g. 123 Sample Blvd" />
            <div>
              <Button>Add venue</Button>
            </div>
          </form>
        </Card>
      </Section>
    </main>
  );
}
