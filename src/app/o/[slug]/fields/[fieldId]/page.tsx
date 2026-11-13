import { notFound } from "next/navigation";
import { DAYS, formatTime, getOrg } from "@/lib/org";
import { ConfirmButton } from "@/components/confirm-button";
import { Banner, Breadcrumbs, Button, Card, Input, Label, PageTitle, Section } from "@/components/ui";
import {
  addAvailability,
  addLayout,
  addLayoutField,
  addZone,
  deleteAvailability,
  deleteField,
  deleteLayout,
  deleteLayoutField,
  deleteZone,
  renameField,
  updateLayoutFieldZones,
} from "./actions";

type Zone = { id: string; name: string };
type LayoutField = { id: string; name: string; format: string | null; layout_field_zones: { zone_id: string }[] };
type Layout = { id: string; name: string; layout_fields: LayoutField[] };
type Window = { id: string; day_of_week: number; start_time: string; end_time: string };

const FORMATS = ["4v4", "5v5", "7v7", "9v9", "11v11"];

export default async function FieldPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; fieldId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug, fieldId } = await params;
  const { error, saved } = await searchParams;
  const { supabase, org } = await getOrg(slug);

  const [{ data: field }, { data: zones }, { data: layouts }, { data: windows }] = await Promise.all([
    supabase
      .from("fields")
      .select("id, name, venue_id, venues(name)")
      .eq("id", fieldId)
      .eq("org_id", org.id)
      .maybeSingle<{ id: string; name: string; venue_id: string; venues: { name: string } | null }>(),
    supabase.from("zones").select("id, name").eq("field_id", fieldId).order("name").returns<Zone[]>(),
    supabase
      .from("field_layouts")
      .select(
        // Named links: these tables are joined two ways (by organization and by field).
        "id, name, layout_fields!layout_fields_layout_id_field_id_fkey(id, name, format, layout_field_zones!layout_field_zones_layout_field_id_field_id_fkey(zone_id))",
      )
      .eq("field_id", fieldId)
      .order("name")
      .order("name", { referencedTable: "layout_fields" })
      .returns<Layout[]>(),
    supabase
      .from("field_availability")
      .select("id, day_of_week, start_time, end_time")
      .eq("field_id", fieldId)
      .is("layout_field_id", null)
      .order("day_of_week")
      .order("start_time")
      .returns<Window[]>(),
  ]);
  if (!field) notFound();

  const zoneList = zones ?? [];
  const zoneName = new Map(zoneList.map((z) => [z.id, z.name]));

  // Hidden inputs every form on this page sends.
  const ctx = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="org_id" value={org.id} />
      <input type="hidden" name="field_id" value={field.id} />
    </>
  );

  return (
    <main className="flex flex-col gap-10">
      <Breadcrumbs
        items={[
          { href: `/o/${slug}`, label: "Setup" },
          { href: `/o/${slug}/venues`, label: "Venues" },
          { href: `/o/${slug}/venues/${field.venue_id}`, label: field.venues?.name ?? "Venue" },
          { label: field.name },
        ]}
      />
      <PageTitle subtitle="Split this field into zones, then describe the ways it can be laid out.">
        {field.name}
      </PageTitle>
      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Saved.</Banner>}

      {/* ---------------- Zones ---------------- */}
      <div id="zones">
        <Section
          title="1. Zones"
          description="The physical pieces of this field. Two games conflict only if they use the same zone at the same time. Example: split a full-size field into A, B, C and D."
        >
          {zoneList.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {zoneList.map((z) => (
                <li key={z.id} className="flex items-center gap-2 rounded-md border border-gray-200 py-1 pl-3 pr-1 dark:border-gray-800">
                  <span className="font-medium">{z.name}</span>
                  <form action={deleteZone}>
                    {ctx}
                    <input type="hidden" name="zone_id" value={z.id} />
                    <ConfirmButton
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      aria-label={`Delete zone ${z.name}`}
                      message={`Delete zone ${z.name}? Playing areas that use it will no longer include it.`}
                    >
                      ✕
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No zones yet.</p>
          )}
          <form action={addZone} className="flex flex-wrap items-end gap-2">
            {ctx}
            <div className="flex flex-col gap-1">
              <Label htmlFor="zone-name">New zone</Label>
              <Input id="zone-name" name="name" required placeholder="e.g. A" className="w-40" />
            </div>
            <Button>Add zone</Button>
          </form>
        </Section>
      </div>

      {/* ---------------- Layouts ---------------- */}
      <div id="layouts">
        <Section
          title="2. Layouts"
          description="Each way this field can be set up, such as Full size, Two 7v7, or One 7v7 + two 4v4. A layout holds one or more playing areas, and each playing area uses some of the zones."
        >
          {zoneList.length === 0 && (
            <Banner kind="warning">Add zones first. Every playing area needs at least one zone.</Banner>
          )}

          {(layouts ?? []).map((layout) => {
            // Within one layout, two playing areas can't use the same zone.
            const seen = new Map<string, string>();
            const overlaps: string[] = [];
            for (const lf of layout.layout_fields) {
              for (const { zone_id } of lf.layout_field_zones) {
                const other = seen.get(zone_id);
                if (other) overlaps.push(`${other} and ${lf.name} both use zone ${zoneName.get(zone_id)}`);
                seen.set(zone_id, lf.name);
              }
            }

            return (
              <Card key={layout.id} className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{layout.name}</h3>
                  <form action={deleteLayout}>
                    {ctx}
                    <input type="hidden" name="layout_id" value={layout.id} />
                    <ConfirmButton
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      message={`Delete the layout "${layout.name}" and its playing areas?`}
                    >
                      Delete layout
                    </ConfirmButton>
                  </form>
                </div>

                {overlaps.length > 0 && (
                  <Banner kind="warning">
                    These playing areas overlap: {overlaps.join("; ")}. In one layout, each zone should
                    belong to only one playing area.
                  </Banner>
                )}

                {layout.layout_fields.length === 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No playing areas in this layout yet.</p>
                )}

                <ul className="flex flex-col gap-3">
                  {layout.layout_fields.map((lf) => {
                    const used = new Set(lf.layout_field_zones.map((z) => z.zone_id));
                    return (
                      <li key={lf.id} className="flex flex-col gap-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            {lf.name}
                            {lf.format && <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{lf.format}</span>}
                          </p>
                          <form action={deleteLayoutField}>
                            {ctx}
                            <input type="hidden" name="layout_field_id" value={lf.id} />
                            <ConfirmButton
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              message={`Remove the playing area "${lf.name}"?`}
                            >
                              Remove
                            </ConfirmButton>
                          </form>
                        </div>
                        <form action={updateLayoutFieldZones} className="flex flex-wrap items-center gap-3">
                          {ctx}
                          <input type="hidden" name="layout_field_id" value={lf.id} />
                          <span className="text-sm">Uses zones:</span>
                          {zoneList.map((z) => (
                            <label key={z.id} className="flex items-center gap-1 text-sm">
                              <input type="checkbox" name="zone_ids" value={z.id} defaultChecked={used.has(z.id)} />
                              {z.name}
                            </label>
                          ))}
                          <Button variant="secondary" className="px-2 py-1 text-xs">
                            Save zones
                          </Button>
                        </form>
                      </li>
                    );
                  })}
                </ul>

                {zoneList.length > 0 && (
                  <form action={addLayoutField} className="flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                    {ctx}
                    <input type="hidden" name="layout_id" value={layout.id} />
                    <p className="text-sm font-medium">Add a playing area to {layout.name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Input name="name" required placeholder="Name, e.g. 7v7 North" aria-label="Playing area name" />
                      <Input
                        name="format"
                        list="formats"
                        placeholder="Format, e.g. 7v7"
                        aria-label="Game format"
                        className="w-36"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">Uses zones:</span>
                      {zoneList.map((z) => (
                        <label key={z.id} className="flex items-center gap-1 text-sm">
                          <input type="checkbox" name="zone_ids" value={z.id} />
                          {z.name}
                        </label>
                      ))}
                    </div>
                    <div>
                      <Button className="px-2 py-1 text-xs">Add playing area</Button>
                    </div>
                  </form>
                )}
              </Card>
            );
          })}

          <form action={addLayout} className="flex flex-wrap items-end gap-2">
            {ctx}
            <div className="flex flex-col gap-1">
              <Label htmlFor="layout-name">New layout</Label>
              <Input id="layout-name" name="name" required placeholder="e.g. Two 7v7" />
            </div>
            <Button>Add layout</Button>
          </form>
          <datalist id="formats">
            {FORMATS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Section>
      </div>

      {/* ---------------- Availability ---------------- */}
      <div id="availability">
        <Section
          title="3. Weekly availability"
          description="The days and times this field can be used for games. Every layout and playing area on this field follows these times."
        >
          {windows && windows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {windows.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                  <span>
                    <span className="font-medium">{DAYS[w.day_of_week]}</span> {formatTime(w.start_time)} – {formatTime(w.end_time)}
                  </span>
                  <form action={deleteAvailability}>
                    {ctx}
                    <input type="hidden" name="availability_id" value={w.id} />
                    <Button variant="secondary" className="px-2 py-1 text-xs">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No times set yet.</p>
          )}
          <Card>
            <form action={addAvailability} className="flex flex-col gap-3">
              {ctx}
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-1 text-sm font-medium">Days</legend>
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="days" value={i} />
                    {d.slice(0, 3)}
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="start">From</Label>
                  <Input id="start" name="start_time" type="time" required defaultValue="08:00" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="end">To</Label>
                  <Input id="end" name="end_time" type="time" required defaultValue="14:00" />
                </div>
                <Button>Add times</Button>
              </div>
            </form>
          </Card>
        </Section>
      </div>

      {/* ---------------- Field details ---------------- */}
      <Section title="Field details">
        <form action={renameField} className="flex flex-wrap items-end gap-2">
          {ctx}
          <div className="flex flex-col gap-1">
            <Label htmlFor="field-name">Name</Label>
            <Input id="field-name" name="name" required defaultValue={field.name} />
          </div>
          <Button variant="secondary">Rename</Button>
        </form>
        <form action={deleteField}>
          {ctx}
          <ConfirmButton
            variant="danger"
            message={`Delete ${field.name}? This also deletes its zones, layouts, availability and bookings.`}
          >
            Delete field
          </ConfirmButton>
        </form>
      </Section>
    </main>
  );
}
