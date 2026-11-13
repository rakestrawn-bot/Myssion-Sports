"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyError, text } from "@/lib/forms";

// All changes on a field's page. Each form sends slug, org_id and field_id
// so the action knows where to return; row-level security still checks
// every change against the signed-in person's own permissions.

function ctx(form: FormData) {
  const slug = text(form, "slug");
  const orgId = text(form, "org_id");
  const fieldId = text(form, "field_id");
  return { slug, orgId, fieldId, back: `/o/${slug}/fields/${fieldId}` };
}

function done(back: string, anchor = ""): never {
  revalidatePath(back);
  redirect(`${back}?saved=1${anchor}`);
}

// --- The field itself ------------------------------------------------

export async function renameField(form: FormData) {
  const { fieldId, back } = ctx(form);
  const name = text(form, "name");
  if (!name) fail(back, "The field needs a name.");
  const supabase = await createClient();
  const { error } = await supabase.from("fields").update({ name }).eq("id", fieldId);
  if (error) fail(back, friendlyError(error, "This venue already has a field with that name."));
  done(back);
}

export async function deleteField(form: FormData) {
  const { slug, fieldId, back } = ctx(form);
  const supabase = await createClient();
  const { data: field } = await supabase.from("fields").select("venue_id").eq("id", fieldId).maybeSingle();
  const { error } = await supabase.from("fields").delete().eq("id", fieldId);
  if (error) fail(back, friendlyError(error));
  redirect(field ? `/o/${slug}/venues/${field.venue_id}` : `/o/${slug}/venues`);
}

// --- Zones -----------------------------------------------------------

export async function addZone(form: FormData) {
  const { orgId, fieldId, back } = ctx(form);
  const name = text(form, "name");
  if (!name) fail(back, "Please give the zone a name, such as A or North end.");
  const supabase = await createClient();
  const { error } = await supabase.from("zones").insert({ org_id: orgId, field_id: fieldId, name });
  if (error) fail(back, friendlyError(error, "This field already has a zone with that name."));
  done(back, "#zones");
}

export async function deleteZone(form: FormData) {
  const { back } = ctx(form);
  const supabase = await createClient();
  const { error } = await supabase.from("zones").delete().eq("id", text(form, "zone_id"));
  if (error) fail(back, friendlyError(error));
  done(back, "#zones");
}

// --- Layouts and the smaller fields inside them ------------------------

export async function addLayout(form: FormData) {
  const { orgId, fieldId, back } = ctx(form);
  const name = text(form, "name");
  if (!name) fail(back, "Please give the layout a name, such as Full size or Two 7v7.");
  const supabase = await createClient();
  const { error } = await supabase.from("field_layouts").insert({ org_id: orgId, field_id: fieldId, name });
  if (error) fail(back, friendlyError(error, "This field already has a layout with that name."));
  done(back, "#layouts");
}

export async function deleteLayout(form: FormData) {
  const { back } = ctx(form);
  const supabase = await createClient();
  const { error } = await supabase.from("field_layouts").delete().eq("id", text(form, "layout_id"));
  if (error) fail(back, friendlyError(error));
  done(back, "#layouts");
}

export async function addLayoutField(form: FormData) {
  const { orgId, fieldId, back } = ctx(form);
  const layoutId = text(form, "layout_id");
  const name = text(form, "name");
  const format = text(form, "format") || null;
  const zoneIds = form.getAll("zone_ids").map(String);
  if (!name) fail(back, "Please give the playing area a name, such as 7v7 North.");
  if (zoneIds.length === 0) fail(back, "Tick at least one zone that this playing area uses.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("layout_fields")
    .insert({ org_id: orgId, layout_id: layoutId, field_id: fieldId, name, format })
    .select("id")
    .single();
  if (error) fail(back, friendlyError(error, "This layout already has a playing area with that name."));

  const { error: zoneError } = await supabase
    .from("layout_field_zones")
    .insert(zoneIds.map((zoneId) => ({ org_id: orgId, layout_field_id: data.id, zone_id: zoneId, field_id: fieldId })));
  if (zoneError) {
    // Don't leave a playing area that uses no zones behind.
    await supabase.from("layout_fields").delete().eq("id", data.id);
    fail(back, friendlyError(zoneError));
  }
  done(back, "#layouts");
}

export async function updateLayoutFieldZones(form: FormData) {
  const { orgId, fieldId, back } = ctx(form);
  const layoutFieldId = text(form, "layout_field_id");
  const zoneIds = form.getAll("zone_ids").map(String);
  if (zoneIds.length === 0) fail(back, "A playing area must use at least one zone.");

  const supabase = await createClient();
  // Add the newly ticked zones first, then remove the unticked ones, so a
  // failure part-way never leaves the playing area with no zones at all.
  const { error: addError } = await supabase.from("layout_field_zones").upsert(
    zoneIds.map((zoneId) => ({ org_id: orgId, layout_field_id: layoutFieldId, zone_id: zoneId, field_id: fieldId })),
    { onConflict: "layout_field_id,zone_id", ignoreDuplicates: true },
  );
  if (addError) fail(back, friendlyError(addError));
  const { error: removeError } = await supabase
    .from("layout_field_zones")
    .delete()
    .eq("layout_field_id", layoutFieldId)
    .not("zone_id", "in", `(${zoneIds.join(",")})`);
  if (removeError) fail(back, friendlyError(removeError));
  done(back, "#layouts");
}

export async function deleteLayoutField(form: FormData) {
  const { back } = ctx(form);
  const supabase = await createClient();
  const { error } = await supabase.from("layout_fields").delete().eq("id", text(form, "layout_field_id"));
  if (error) fail(back, friendlyError(error));
  done(back, "#layouts");
}

// --- Weekly availability ---------------------------------------------

export async function addAvailability(form: FormData) {
  const { orgId, fieldId, back } = ctx(form);
  const days = form.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  const start = text(form, "start_time");
  const end = text(form, "end_time");
  if (days.length === 0) fail(back, "Tick at least one day.");
  if (!start || !end) fail(back, "Please enter a start and end time.");
  if (start >= end) fail(back, "The end time must be after the start time.");

  const supabase = await createClient();
  const { error } = await supabase.from("field_availability").insert(
    days.map((day) => ({ org_id: orgId, field_id: fieldId, day_of_week: day, start_time: start, end_time: end })),
  );
  if (error) fail(back, friendlyError(error));
  done(back, "#availability");
}

export async function deleteAvailability(form: FormData) {
  const { back } = ctx(form);
  const supabase = await createClient();
  const { error } = await supabase.from("field_availability").delete().eq("id", text(form, "availability_id"));
  if (error) fail(back, friendlyError(error));
  done(back, "#availability");
}
