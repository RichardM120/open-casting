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

## Site map

```
/                       Sign in, or the dashboard if you already are
/login                  The one door. Google, or email and password
/faq  /faq/*            Reference, open to anyone
/legal/*                The agreements, open so a casting link can cite them

/dashboard/sessions     Productions          ─┐
  /new                  Open one              │  the order the work happens in,
  /[id]                 One production        │  and the order the nav is in
  /[id]/edit            Its dates             │
/dashboard              Roles                 │  a role lives inside a production
  /roles/new            Post one into it      │
  /roles/[id]           Its submissions       │
  /roles/[id]/edit      Edit it              ─┘
/dashboard/activity     The trail
/dashboard/accounts     Accounts — admin only

/c/<slug>-<token>              A production, as a performer sees it
/c/<slug>-<token>/<role-slug>  One role, and the submission form
```

**Navigation follows the hierarchy, not the file layout.** A role cannot exist
without a production, so Productions comes first and Roles second — even though
`/dashboard` is the roles page and `/dashboard/sessions` sits under it in the
URL. The nav names and the back-links use the same words for the same places.

The only difference between the two roles is **Accounts**, which an admin sees
and a director does not — and the page refuses a director independently of the
nav, so hiding the link is presentation rather than protection.

## What is here

| Route | What it does |
| --- | --- |
| `/` | The way in: admin sign-in, production sign-in, and a note for performers |
| `/c/[token]` | One production's casting call — the only page a performer sees |
| `/c/[token]/[roleId]` | The full brief, plus the submission form |
| `/roles/new` | Post a role into a casting session — sign-in required |
| `/dashboard` | The roles you may see, with submission counts — sign-in required |
| `/dashboard/sessions` | Your productions, and the window each is open for |
| `/dashboard/sessions/new` | Open a casting session |
| `/dashboard/sessions/[id]` | One production: its window, its roles, close early, remove |
| `/dashboard/sessions/[id]/edit` | Move a production's dates, taking its roles with them |
| `/dashboard/roles/[id]` | The submissions for one role, and their status |
| `/login` | Password or Google sign-in. There is no `/signup` |
| `/welcome` | Three-step setup, tailored to the account's role |
| `/faq/performers` | What the listing fields mean and what submitting commits you to |
| `/faq/casting-directors` | What each posting field commits you to, and writing terms |
| `/dashboard/roles/[id]/edit` | Edit a role in place |
| `/dashboard/accounts` | Create, suspend and restore accounts — admin only |
| `/dashboard/activity` | The audit trail, scoped like everything else |
| `/api/health` | Whether the deployment can reach its database. No data, no secrets |

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

- `submissions (session_id, lower(email))` is unique, so one person cannot submit
  twice into the same casting session — whichever of its roles they go for. The
  insert decides it, not a check beforehand: two requests arriving together would
  both pass a check-then-insert.
- `submissions.role_id` references `roles(id)`, and both `roles.session_id` and
  `submissions.session_id` reference `sessions_casting(id)`, all with
  `ON DELETE CASCADE`. Removing a production takes its roles and their
  submissions with it, in one statement.

Set `DATABASE_URL` in the environment. If a hosted integration provisions
`POSTGRES_URL`, `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING` instead —
Vercel's Postgres and Neon integrations set `POSTGRES_URL` — the app reads those
too, in that order, so a one-click database works without renaming anything.

On a serverless host use the provider's **pooled** connection string; each
instance opens its own pool. Keep `DATABASE_POOL_MAX` small.

TLS is verified whenever the connection string asks for it. A provider using its
own certificate authority can set `DATABASE_SSL_NO_VERIFY=1`, which keeps the
connection encrypted but stops checking who is on the other end.

## Before launch

One variable. With `SITE_PASSCODE` set:

- every page shows an interstitial first, asking for that passcode. Nothing
  behind it is served — not the sign-in page, not a casting share link. Only the
  interstitial itself, `/api/health` and `robots.txt` answer through it;
- the application's own sign-in stops checking anything. Any email and any
  password gets a session, and an account is created on the spot for an address
  that has none. Google sign-in is withdrawn while the wall is up, because it is
  the one way in that really does authenticate;
- a banner sits above every page saying so, and `/api/health` reports it.

The two go together on purpose. Sign-in that authenticates nobody is only
defensible because the wall in front of it means nobody uncontrolled reaches it
— so they are the same switch, and it is not possible to leave the second on
while turning the first off.

It is not the application's access control and does not pretend to be: it keeps
the work in progress away from anyone who has not been shown it. Unset it to
launch, and everything reverts to real sign-in with no code change.

Both the passcode and the sign-in behind it are throttled by address, because a
shared secret with only a per-email throttle is no throttle at all — an attacker
just varies the address.

## Keeping it out of search

- **`robots.txt`** disallows everything.
- **`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`** on every response
  from the proxy, not only pages that set it in their metadata — that covers API
  routes and anything added later that forgets.
- **Page metadata** carries `noindex` as well.
- With `SITE_PASSCODE` set there is nothing for a crawler to reach in the first
  place, which is the only one of the four that is not merely advisory.

## URLs

A casting link goes on an Instagram post, into a mailout, sometimes onto paper.
So it is built to be read, typed and said out loud:

```
opencasting.app/c/saltmarsh-4f21c9ba7e
opencasting.app/c/saltmarsh-4f21c9ba7e/nell-saltmarsh
```

The slug is decoration and the ten characters after the last dash are the whole
of the authorisation. Only that suffix is looked up, so renaming a production
does not break a link that is already circulating, and a guessed slug gets
nobody anywhere. The alphabet excludes look-alikes — no `0`/`O`, no `1`/`l`/`I`
— and lookup is case-insensitive, so a link retyped in capitals still works.
Ten characters is about 49 bits: far too many to enumerate, short enough to fit
in a caption.

The role is matched by its slug **within** the production, so one production's
link cannot reach another's role — it is not a check that can be forgotten,
because there is no query that could find it.

Set **`APP_URL`** to the canonical origin and share links are built from it
rather than from whichever of the four domains the casting director happened to
be on. Every redirect a performer does not make is one fewer round trip on a
phone and one fewer chance for a truncated link.

## Signing in

One entry point, `/login`, and four layers behind it.

**1. Password.** scrypt, with a decoy hash when the address is unknown so response
time does not reveal which addresses have accounts, and a throttle on failures.

**Google sign-in.** Links to an account that already exists, and creates one
*only* for an address named in `ADMIN_EMAILS` — which whoever controls the
deployment has already authorised. Any other Google address is refused, so the
button is not a way around "no self-registration". It never runs without Google
having verified the address.

It does not then ask for an emailed link, and the reason is worth stating: that
link would go to the same mailbox that just authenticated. Whoever holds the
Google account holds the inbox, so it would add friction and no security — a
second factor only counts when it reaches somewhere the first does not. Password
sign-in still requires one, because a password and a mailbox are two different
things.

**2. A second factor, for accounts that can affect other people.** Admins always;
anyone else if `mfa_required` is set on them. The password alone starts nothing:
it issues a one-time link, emailed, good for 15 minutes and one use, spent inside
a single `UPDATE` so two clicks cannot both win. Asking for another voids the
first. Google sign-in goes through the same gate — it proves an address, not a
second factor, and skipping it there would make the button the way around it.

**3. The edge.** The proxy holds a signed cookie carrying the account id and role,
verified with HMAC-SHA256 through Web Crypto — no dependency, one implementation
for both runtimes. It gates `/dashboard/**`, and `/dashboard/accounts` for admins
only. With no `AUTH_SECRET` it fails closed.

**4. The server, which is the one that decides.** The proxy runs on the Edge
runtime and **cannot reach Postgres**, so the signed cookie is a cache and can
only be stale — it cannot know an account was suspended a minute ago, had its
access ended, or changed role. Every page and every action calls `currentUser()`,
which reads the session, the suspension and the end date from the database on
each request. The edge check exists to turn away an obviously-wrong request
before rendering it, never to admit one.

Set `AUTH_SECRET` (32+ characters) and `RESEND_API_KEY`, or nobody can sign in to
an admin account at all: a second factor that is skipped when the mail provider
is down is decorative, so a failure to send is reported as a failure.

### Verifying sign-in on a live deployment

`test/suites/10-magic-link.mjs` covers this against a stand-in mail provider on
every push. To check a real deployment end to end:

1. **`/api/health`** — `authSecret` must read `set` and `email` `configured`. If
   either is missing, an admin cannot sign in at all and there is no point going
   further. Nothing in the response leaks a connection string.
2. **Sign in at `/login`** with the admin address and password. You should land
   on “Check your email”, and **no session cookie should be set** — the password
   alone starts nothing.
3. **Open the emailed link.** It is good for 15 minutes and one use.
4. **Open it a second time.** It must refuse, saying it has already been used.
5. **Sign in again without opening the new link, then open the first one.** The
   superseded link must be dead.

`ADMIN_EMAILS` is comma-separated, so more than one address can hold admin —
`richard@seaglassdigital.co.uk,richard@cwcasting.co.uk` grants both. An address
added there is promoted on its next sign-in; removed, it drops back to director.

## Who can get in

Open Casting is not a public board. There is no listing to browse, no search, and
nothing to register for.

- **Accounts are created by the administrator**, on `/dashboard/accounts`, and by
  nobody else. The password is generated there and shown once. Google sign-in
  links an address that already has an account and will not create one.
- **The administrator's own account** is created from the environment on first
  boot — see *Deploying* — because otherwise a fresh deployment would have no
  way in at all.
- **Performers never sign in.** A casting session has a share link carrying an
  unguessable token, shown on its page in the dashboard. That link is the whole
  of the access control: whoever holds it can read that production and submit to
  it while it is open, and can reach nothing else. `robots.txt` disallows
  everything and the casting pages carry `noindex`, so a token cannot turn up in
  a search result.

The token is 24 bytes from Node's CSPRNG, url-safe, and unique. It is generated
in the application rather than in SQL: `gen_random_bytes()` is pgcrypto, which is
not guaranteed to be installed, and the alternatives available in plain SQL are
not strong enough for a value that is doing this job.

## The journey

1. **You strike an arrangement** with a casting director or production company,
   and create their account on `/dashboard/accounts`. That is where you set what
   it covers: how many productions, how many roles in each, and an end date.
   Blank means no limit. They are enforced when the account tries to post, not
   merely displayed.
2. **They open a casting session** for the production and post its roles, inside
   those limits.
3. **They check it and publish it.** A new session is a draft — its share link
   opens for them and for nobody else, so they can read it exactly as a
   performer will. Publishing is what makes the link work, and it needs at least
   one role. It cannot be undone: once a link is on a post or in a mailout it is
   out of anyone's hands, so *close early* is how a call is stopped.
4. **They circulate the link** — Instagram, a mailout, an agent circular.
   Whoever holds it can submit while the session is open.
5. **They work the submissions** through New, Shortlisted, Callback and Declined.
   The data is theirs.
6. **The call closes**, on its date or early.
7. **Six months later the performers' details are destroyed** — see below.

## Agreements

Two documents, in `src/content/legal.ts`, each with a version. An acceptance is
only worth having if you can say afterwards exactly what was accepted, so the
text for a version never changes — a wording change is a new version, which
people are asked to accept again.

- **Master Services Agreement and Data Processing Schedule.** The first thing
  setup asks a new customer, before anything else, and enforced by the dashboard
  layout rather than only by the path through setup — an agreement that can be
  navigated past is not enforced. Accepted by the customer in their own account,
  never ticked on their behalf at account creation, and recorded with the
  version, the timestamp and the IP. Readable again at `/legal/agreement`. The
  administrator operates the service rather than buying it, so there is nothing
  for them to accept.
- **Terms of Submission and Acceptable Use Policy.** On every submission form,
  summarised in four lines with the full text a click away at
  `/legal/submission-terms`, and required — separately from any terms the casting
  director sets on the role. The accepted version is stored on the submission.

**Under-18s.** Typing an age below 18 opens a parental consent section: the
guardian's name, their email, and an explicit consent statement. The action
decides that from the age given, not from whether the form troubled to send the
fields, so removing them from the request does not skip it. All three are stored
against the submission.

## Retention

Thirty days after a production **finishes**, every submission made to it is
deleted: names, emails, phone numbers, locations, ages, links, cover notes. The
production, its roles and the fact that submissions were received survive, so
the casting director keeps a record of what they ran without holding anybody's
personal data. The session is marked `purged_at` so the dashboard says what
happened rather than showing an empty list.

The clock runs from the **Production End Date**, not the casting close date: a
shoot can run for months after its call shut, and the shortlist is needed until
it wraps. The casting director sets it when opening the production and can move
it if the schedule does.

The MSA promises a warning at 14 days and again at 48 hours, and both are sent
by the same sweep. Claiming a threshold is part of the `UPDATE` that selects it,
so two overlapping sweeps cannot send the same warning twice.

It runs two ways, deliberately:

- **On a schedule.** `vercel.json` calls `/api/retention` daily at 03:00. The
  endpoint requires `CRON_SECRET` in an `Authorization: Bearer` header, and
  refuses to run at all if that variable is unset — an unguarded delete endpoint
  is worse than a sweep nobody configured.
- **On boot.** The same sweep runs once per process during schema bootstrap, so
  a deployment where nobody set the cron still honours the promise instead of
  keeping the data for ever in silence.

The date is shown on every production's page, and both FAQs state it.

## Casting sessions

A **casting session** is one production's casting window. It owns the production
name, the synopsis, the company and the two dates submissions run between. Roles
belong to a session; they do not carry dates of their own.

That buys three things:

- **One window per production.** Every role opens and closes together, so two
  roles on the same film cannot disagree about when casting closes. Moving the
  dates moves all of them at once.
- **One submission per performer per production.** A performer picks the role
  that fits and submits once, rather than once per role. The unique index
  `submissions (session_id, lower(email))` decides it, so two requests arriving
  together cannot both get through.
- **A real off switch.** *Close early* on the session stops every role in it at
  the same moment, and is reversible. Removing is the destructive one, is
  admin-only, and takes the roles and their submissions with it.

Outside the window the roles stay listed and readable — a performer can read the
brief and prepare a tape — but the submission form is not rendered, and the
action refuses the write even if the form is replayed.

`roles.deadline` mirrors the session's closing date. The session is the
authority; the column is kept in step on write so it can be used for ordering
without a join, and it never contradicts the session.

Roles do not move between sessions. Moving one would change the dates it was
posted under and separate it from the submissions already made into its session.

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
an environment variable, deploy.

Two more variables decide who the administrator is:

| Variable | What it does |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated. An account with one of these addresses is an admin, re-checked on every sign-in. Nothing else grants it. |
| `ADMIN_BOOTSTRAP_PASSWORD` | Creates the first address in `ADMIN_EMAILS` as an account, once, if it does not already exist. Ignored afterwards — change the password in the app, not here. |

Set both before the first request, sign in, and then every other account is made
from `/dashboard/accounts`. Every page that reads data is `force-dynamic`,
so the build itself does not need a reachable database.

That last point cuts both ways: a deployment with no reachable database builds
and deploys cleanly, then returns a server error on every page that reads data.
**`/api/health` is the first thing to check** when a deployed page errors. It
answers in one line whether a connection string is set, which variable it came
from, and whether the query went through — without the runtime logs, and without
printing the connection string.

## Known limits

Anyone holding a share link can submit; there is no per-performer identity, so a
link that is forwarded is a link that works. Regenerating a token is not exposed
in the UI yet — closing the session is the way to stop a leaked link today.
Headshots and tapes are links, not uploads. Nobody is emailed when a submission
arrives or a status changes — the performer's address is on every submission, and
replying is a manual step. A role cannot be moved between casting sessions.
There is no export: submissions are read in the dashboard.
