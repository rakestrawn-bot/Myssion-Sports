import { redirect } from "next/navigation";

// Helpers shared by the server actions behind every form.

/** Reads a text field from a form, trimmed. Empty becomes "". */
export function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

/** Reads an optional text field; empty becomes null. */
export function optionalText(form: FormData, name: string): string | null {
  return text(form, name) || null;
}

/** Sends the person back to `path` with a message shown at the top of the page. */
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Turns a database error into a message a person can act on. */
export function friendlyError(
  error: { code?: string; message: string },
  duplicateMessage = "That name is already used here. Please choose a different one.",
): string {
  if (error.code === "23505") return duplicateMessage;
  if (error.code === "42501") return "You don't have permission to make that change.";
  if (error.code === "23514") return "Some of the values aren't valid. Please check them and try again.";
  console.error("Database error:", error.code, error.message);
  return "Something went wrong saving that. Please try again.";
}
