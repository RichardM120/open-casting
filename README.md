# Open Casting

A prototype casting-call board. Casting directors post a role with the brief spelled out;
performers browse and submit against it; every submission lands in one dashboard where it can be
moved through New → Shortlisted → Callback → Declined.

Built as a test app, so it is deliberately small: no auth, no uploads, no email.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

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
    store.ts               read/write against data/db.json
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

There is no database. `src/lib/store.ts` reads and writes a single JSON file at `data/db.json`,
seeded from `src/lib/seed-data.ts` the first time it is needed, and writes are serialised through
a promise queue so two requests cannot clobber each other. The file is gitignored — the seed is
the source of truth, and **Reset demo data** on the dashboard puts it back.

On a read-only filesystem (most serverless hosts) the store falls back to an in-process cache:
the app still works, but writes are lost when the instance recycles. Everything else talks to the
`read`/`write` pair, so swapping in a real database is a one-file job.

## Known limits

Anyone can post a role or read the dashboard — there is no sign-in, and the dashboard shows every
role rather than yours. Headshots and tapes are links, not uploads. Nobody is emailed when a
submission arrives or a status changes.
