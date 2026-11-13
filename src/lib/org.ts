import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Org = { id: string; name: string; slug: string; governing_body: string | null };

/**
 * Loads the organization at /o/<slug> for the signed-in user. Row-level
 * security means an organization the user doesn't belong to looks the
 * same as one that doesn't exist: both show "not found".
 */
export async function getOrg(slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, governing_body")
    .eq("slug", slug)
    .maybeSingle<Org>();
  if (!org) notFound();
  const { data: isStaff } = await supabase.rpc("is_org_staff", { p_org_id: org.id });
  return { supabase, org, isStaff: Boolean(isStaff) };
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "14:30:00" -> "2:30 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
