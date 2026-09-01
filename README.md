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
npm run test:e2e                 # 101 browser checks, needs DATABASE_URL
```

CI runs all four on every push. See [RELEASE.md](RELEASE.md) for what is enforced
automatically, what is a Vercel dashboard setting, and what was considered and
deliberately left alone.

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
| `/welcome` | Three-step setup, tailored to the account's role |
| `/faq/performers` | What the listing fields mean and what submitting commits you to |
| `/faq/casting-directors` | What each posting field commits you to, and writing terms |
| `/dashboard/roles/[id]/edit` | Edit a role in place |
| `/dashboard/accounts` | Suspend and restore accounts — admin only |
| `/dashboard/activity` | The audit trail, scoped like everything else |

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

What each may **do**, on top of that:

| Action | Who |
| --- | --- |
| Edit a role, close it early, reopen it | Anyone who can see it |
| Remove a role and its submissions | Admin only |
| Suspend or restore an account | Admin only |

Removal is admin-only on purpose: it destroys performers' contact details, and a
shared company name should not be enough to authorise that. Closing early is the
non-destructive option — it stops new submissions and keeps the listing readable.
Closing is recorded in `closed_at` rather than by moving the deadline, so the
listing still shows the date it advertised.

Suspending an account deletes its sessions, so somebody signed in is out at
once; `currentUser()` re-checks suspension on every request in case a session
was created in between. Their roles stay up. An admin cannot suspend themselves.

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

## Setup wizard

A new account lands on `/welcome`, not an empty dashboard. Three steps: confirm
name and company, read what this role can see and do, then a note on the data
duty before being sent somewhere useful — the posting form for a director, the
accounts page for an admin.

Step one is not decoration. A Google sign-up has no company name until it is
asked for, and company is what a producer's visibility matches on. `onboarded_at`
records completion; until then the dashboard carries a nudge.

## Navigation and accessibility

- The main nav sits in a second header row below 640px. It was `hidden sm:flex`,
  which left a phone with no route to the dashboard except the page footer.
- A skip link is the first tab stop on every page.
- Errors set `aria-invalid` and `aria-describedby` on the control itself, and an
  error summary takes focus on a failed submit.
- Buttons clear a comfortable touch target at both sizes.

Every route was crawled signed-out, as a director and as an admin: all resolve,
auth redirects carry `next=`, signed-in visitors are bounced off `/login` and
`/signup`, non-admins get a 404 rather than a message on admin-only pages, each
page has exactly one `h1`, and nothing overflows horizontally at 390px.

## Activity trail

Every posting, edit, close, reopen, removal, submission, status change and
account suspension is recorded. Entries are scoped by the same `visibility()`
rule as the roles, applied to an owner and company **copied onto each entry** —
so a trail outlives the role it describes, which is the moment it is worth
most. `role_id` and `actor_id` are `ON DELETE SET NULL` and the readable fields
sit alongside them; a removed role shows struck through and stops being a link.

Account events carry no owner or company, which is what keeps them to admins
without a second rule.

Writing an entry never throws into the caller. A trail that can fail a
performer's submission would be worse than a gap in the trail.

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
