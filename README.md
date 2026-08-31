# Open Casting

A prototype casting-call board. Casting directors post a role with the brief spelled out;
performers browse and submit against it; every submission lands in one dashboard where it can be
moved through New → Shortlisted → Callback → Declined.

Performers need no account: browsing and submitting are open to anyone. The
casting side signs in.

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
| `/roles/new` | Post a role — sign-in required |
| `/dashboard` | The roles you may see, with submission counts — sign-in required |
| `/dashboard/roles/[id]` | The submissions for one role, and their status |
| `/login`, `/signup` | Password or Google sign-in for the casting side |
| `/faq/performers` | What the listing fields mean and what submitting commits you to |
| `/faq/casting-directors` | What each posting field commits you to, and writing terms |

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

Set `DATABASE_URL` in the environment. If a hosted integration provisions
`POSTGRES_URL`, `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING` instead —
Vercel's Postgres and Neon integrations set `POSTGRES_URL` — the app reads those
too, in that order, so a one-click database works without renaming anything.

On a serverless host use the provider's **pooled** connection string; each
instance opens its own pool. Keep `DATABASE_POOL_MAX` small.

TLS is verified whenever the connection string asks for it. A provider using its
own certificate authority can set `DATABASE_SSL_NO_VERIFY=1`, which keeps the
connection encrypted but stops checking who is on the other end.

## Accounts and roles

Three roles, and one rule that decides everything:

| Role | Sees on the dashboard |
| --- | --- |
| `director` | Only the roles they posted |
| `producer` | Every role posted under their company, across productions |
| `admin` | Everything |

`src/lib/roles.ts` exports a single `visibility()` function returning a SQL
fragment. The role listing, a single role, the submission counts and the status
update all scope through it, so the rule cannot drift apart between the page
that reads and the query that writes. A role an account may not see returns a
404 rather than a 403, so guessing ids reveals nothing.

**Admin is never chosen at sign-up.** It comes only from `ADMIN_EMAILS`, and is
re-checked on every sign-in: add an address and that account is promoted, remove
it and the account drops back to director.

Passwords are hashed with scrypt (`node:crypto`, no dependency). Sessions are
opaque random tokens in an httpOnly, SameSite=Lax cookie, with only a SHA-256
hash of the token stored — reading the database does not yield a usable cookie.
A failed sign-in is hashed against a decoy so response time does not reveal
which addresses have accounts, and repeated failures are throttled per address.

### Role terms

A casting director can set optional terms on a role. Where they exist, the
listing shows them and the performer must tick to accept before submitting —
enforced against the role in the action, not by trusting the posted form.

The wording is **copied onto the submission** as it read at that moment, with a
timestamp, so editing the role later cannot change what somebody agreed to. The
dashboard shows each submission's accepted wording alongside it.

### Google sign-in

Optional. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` the buttons are
not rendered and password sign-in carries on. The flow is authorization code
with PKCE (S256): `state` and the code verifier live in short-lived httpOnly
cookies that are consumed on the callback, so a forged or replayed callback
fails. A Google account whose email is **not verified** is refused, because
accounts are matched to existing ones by email.

Register the callback URL — `https://your-domain/api/auth/google/callback` — on
the Google client for every origin you use, production and preview alike.

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
