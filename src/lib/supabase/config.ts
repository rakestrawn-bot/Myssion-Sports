// Where the app finds the Supabase project.
//
// Both values are public by design: they are sent to every visitor's
// browser. What protects the data is row-level security in the database,
// not keeping these secret. They can be overridden with the environment
// variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (for example to point a test copy of the site at a different project).

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://vrjwfhufiwodnhjzoono.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// False until the publishable key is filled in above (or set as an
// environment variable). Sign-in is switched off until then.
export const isSupabaseConfigured = SUPABASE_PUBLISHABLE_KEY.length > 0;
