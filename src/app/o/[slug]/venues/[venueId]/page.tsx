import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrg } from "@/lib/org";
import { ConfirmButton } from "@/components/confirm-button";
import { Banner, Breadcrumbs, Button, Card, Input, Label, PageTitle, Section } from "@/components/ui";
import { createField, deleteVenue, updateVenue } from "../actions";

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; venueId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug, venueId } = await params;
  const { error, saved } = await searchParams;
  const { supabase, org } = await getOrg(slug);

  const [{ data: venue }, { data: fields }] = await Promise.all([
    supabase.from("venues").select("id, name, address").eq("id", venueId).eq("org_id", org.id).maybeSingle(),
    supabase
      .from("fields")
      .select("id, name, zones(count), field_layouts(count)")
      .eq("venue_id", venueId)
      .order("name")
      .returns<{ id: string; name: string; zones: { count: number }[]; field_layouts: { count: number }[] }[]>(),
  ]);
  if (!venue) notFound();

  return (
    <main className="flex flex-col gap-8">
      <Breadcrumbs
        items={[
          { href: `/o/${slug}`, label: "Setup" },
          { href: `/o/${slug}/venues`, label: "Venues" },
          { label: venue.name },
        ]}
      />
      <PageTitle subtitle={venue.address ?? undefined}>{venue.name}</PageTitle>
      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Saved.</Banner>}

      <Section title="Fields" description="Each physical field at this venue. You'll split a field into zones on its own page.">
        {fields && fields.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fields.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/o/${slug}/fields/${f.id}`}
                  className="block rounded-md border border-gray-200 p-4 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950"
                >
                  <p className="font-medium">{f.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {f.zones[0]?.count ?? 0} zones · {f.field_layouts[0]?.count ?? 0} layouts
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No fields yet.</p>
        )}
        <Card>
          <form action={createField} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="org_id" value={org.id} />
            <input type="hidden" name="venue_id" value={venue.id} />
            <Label htmlFor="field-name">New field name</Label>
            <Input id="field-name" name="name" required placeholder="e.g. Field 1" />
            <div>
              <Button>Add field</Button>
            </div>
          </form>
        </Card>
      </Section>

      <Section title="Venue details">
        <Card>
          <form action={updateVenue} className="flex flex-col gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={venue.id} />
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={venue.name} />
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" defaultValue={venue.address ?? ""} />
            <div>
              <Button variant="secondary">Save changes</Button>
            </div>
          </form>
        </Card>
        <form action={deleteVenue}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={venue.id} />
          <ConfirmButton
            variant="danger"
            message={`Delete ${venue.name}? This also deletes all of its fields, zones, layouts, availability and bookings.`}
          >
            Delete venue
          </ConfirmButton>
        </form>
      </Section>
    </main>
  );
}
