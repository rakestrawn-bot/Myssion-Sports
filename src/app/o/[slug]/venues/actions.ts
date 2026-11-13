"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyError, optionalText, text } from "@/lib/forms";

// Every action below runs with the signed-in person's own permissions, so
// row-level security in the database decides what they may change.

export async function createVenue(form: FormData) {
  const slug = text(form, "slug");
  const back = `/o/${slug}/venues`;
  const name = text(form, "name");
  if (!name) fail(back, "Please give the venue a name.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({ org_id: text(form, "org_id"), name, address: optionalText(form, "address") })
    .select("id")
    .single();
  if (error) fail(back, friendlyError(error, "You already have a venue with that name."));
  redirect(`${back}/${data.id}`);
}

export async function updateVenue(form: FormData) {
  const slug = text(form, "slug");
  const id = text(form, "id");
  const back = `/o/${slug}/venues/${id}`;
  const name = text(form, "name");
  if (!name) fail(back, "The venue needs a name.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ name, address: optionalText(form, "address") })
    .eq("id", id);
  if (error) fail(back, friendlyError(error, "You already have a venue with that name."));
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function deleteVenue(form: FormData) {
  const slug = text(form, "slug");
  const supabase = await createClient();
  const { error } = await supabase.from("venues").delete().eq("id", text(form, "id"));
  if (error) fail(`/o/${slug}/venues/${text(form, "id")}`, friendlyError(error));
  redirect(`/o/${slug}/venues`);
}

export async function createField(form: FormData) {
  const slug = text(form, "slug");
  const venueId = text(form, "venue_id");
  const back = `/o/${slug}/venues/${venueId}`;
  const name = text(form, "name");
  if (!name) fail(back, "Please give the field a name.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fields")
    .insert({ org_id: text(form, "org_id"), venue_id: venueId, name })
    .select("id")
    .single();
  if (error) fail(back, friendlyError(error, "This venue already has a field with that name."));
  redirect(`/o/${slug}/fields/${data.id}`);
}
