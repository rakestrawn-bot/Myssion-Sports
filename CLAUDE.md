# Notes for Claude Code

## Who you're working with
The builder (Nick) has no coding background. Explain decisions plainly,
build in small testable steps, and prefer managed services (Vercel,
Supabase) over custom infrastructure.

## The spec
- The master spec is the Claude Doc "League Management App: Product Spec":
  https://claude.ai/artifact/HP2FL4ooUEXt7amNLJZswa
- `docs/SPEC.md` is a mirror of it. When a build decision changes or adds
  to the spec, update the Claude Doc (new facts and decisions directly;
  rewording of existing text as suggestions) and update `docs/SPEC.md` in
  the same commit as the related code.
- Re-read the Claude Doc before editing it; Nick may have changed it.

## Project rules
- Every table has `org_id`. Child rows reference parents by `(org_id, id)`
  so cross-organization links are impossible, and every table has
  row-level security.
- Use fake sample data only until the privacy items in spec section 12 are done.
- Database changes go in a new file in `supabase/migrations/`; never edit
  a migration that has already been applied to the real Supabase project.
- Run `npm run test:db`, `npm run lint` and `npm run build` before pushing.
