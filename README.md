# Myssion Sports

A web app for running athletic leagues: venues and split fields, divisions,
automatic scheduling, clubs, teams, rosters, results and standings. It is
built first for City of Sunny Isles Beach Recreation and designed so any
league can sign up and run its own separate workspace.

The full product spec is in [`docs/SPEC.md`](docs/SPEC.md).

## How it's built

- **Website:** [Next.js](https://nextjs.org) (in `src/`), to be hosted on Vercel.
- **Database and logins:** [Supabase](https://supabase.com) (Postgres). The
  database structure lives in `supabase/migrations/`, one file per change,
  applied in date order.
- **Data separation:** every record belongs to an organization, and the
  database itself (row-level security) stops one organization from seeing
  or changing another's data.

## Common commands

Install dependencies (once, or after pulling changes):

```bash
npm install
```

Run the website on your computer at http://localhost:3000:

```bash
npm run dev
```

Run the database tests (needs PostgreSQL installed locally):

```bash
npm run test:db
```

Check the code for mistakes and make a production build:

```bash
npm run lint && npm run build
```
