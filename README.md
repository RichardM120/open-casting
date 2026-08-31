# Open Casting

A prototype casting-call board. Casting directors post a role with the brief spelled out;
performers browse and submit against it; every submission lands in one dashboard where it can be
moved through New → Shortlisted → Callback → Declined.

Built as a test app, so it is deliberately small: no auth, no uploads, no email.

## Running it

You need a Postgres database. The quickest local one:

```bash
docker run -d --name opencasting-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=opencasting postgres:16

cp .env.example .env.local   # then set DATABASE_URL to the line above
```

```bash
npm install
npm run dev          # http://localhost:3000
```

The app creates its own tables on the first request and loads the demo roles if
the database is empty, so there is no migration step to run.

```bash
npm run build && npm run start   # production build
npm run lint                     # eslint
npx tsc --noEmit                 # typecheck
```

## What is here

| Route | What it does |
| --- | --- |
| `/` | Landing page with live counts and the roles closing soonest |
| `/roles` | Browse and filter every open call |
| `/roles/[id]` | The full brief, plus the submission form |
| `/roles/new` | Post a role |
| `/dashboard` | Every role posted, with submission counts |
| `/dashboard/roles/[id]` | The submissions for one role, and their status |

## How it is put together

Next.js 16 App Router, TypeScript, Tailwind v4. Pages are server components; only the three
pieces that need browser state are client components — the filter bar, and the two forms.

```
src/
  app/                     routes
  components/              ui primitives, cards, forms
  lib/
    types.ts               the domain: Role, Submission
    seed-data.ts           demo content
    db.ts                  pool, schema bootstrap, seeding
    roles.ts               role queries and filtering
    submissions.ts         submission queries and counts
    validation.ts          zod schemas, shared by both forms
    actions.ts             server actions
    form-state.ts          the shape useActionState forms pass around
```

Mutations are Server Actions. Both forms validate with the same zod schema on the server and
render errors per field; the browser's own required/type checks run first, so the server rules
are the backstop rather than the only line. A failed submit re-seeds the form from the values it
sent, because React resets an uncontrolled form once its action resolves.

## Data

Postgres, through `pg`. `src/lib/db.ts` owns the pool, creates the schema with
`CREATE TABLE IF NOT EXISTS` on the first query of each process, and seeds the
demo content if the `roles` table is empty. Seeding is keyed on fixed ids with
`ON CONFLICT DO NOTHING`, so several instances starting at once cannot double up.
**Reset demo data** on the dashboard truncates and re-seeds.

Two rules the database enforces rather than the application:

- `submissions (role_id, lower(email))` is unique, so one person cannot submit
  twice for the same role. The insert decides it, not a check beforehand — two
  requests arriving together would both pass a check-then-insert. Verified: of
  ten identical inserts fired at once, one is accepted and nine are rejected.
- `submissions.role_id` references `roles(id)` with `ON DELETE CASCADE`.

Set `DATABASE_URL` in the environment. On a serverless host use the provider's
**pooled** connection string — each instance opens its own pool — and keep
`DATABASE_POOL_MAX` small.

## Deploying

The app needs a Node runtime; it will not work on static hosting such as GitHub
Pages, because submitting, posting a role and changing a status are all server
actions.

Vercel is the path of least resistance: import the repo, add `DATABASE_URL` as
an environment variable, deploy. Every page that reads data is `force-dynamic`,
so the build itself does not need a reachable database.

## Known limits

Anyone can post a role or read the dashboard — there is no sign-in, and the dashboard shows every
role rather than yours. Headshots and tapes are links, not uploads. Nobody is emailed when a
submission arrives or a status changes.
