# Open Casting

The private tool a casting call uses to run its casting. The administrator creates
an account for a casting director; they open a casting call, post its roles into
it, and send one link. Applicants submit through that link without an account,
once per casting call, and every submission lands in one dashboard where it can be
moved through New, Shortlisted, Callback and Declined.

There is no public listing and no search. A casting call goes exactly as far as
its link is circulated. The casting side signs in; applicants never do.

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
npm run build && npm run start   # casting call build
npm run lint                     # eslint
npx tsc --noEmit                 # typecheck
npm run test:e2e                 # browser suites, needs DATABASE_URL; `node test/run.mjs 11` runs one
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

/dashboard              Casting calls, with the roles in each  ─┐
  /sessions/new         Open one                               │
  /sessions/[id]        One casting call: its link and its roles │  the order the
  /sessions/[id]/edit   Its times                              │  work happens in
  /roles/new            Post a role into it                    │
  /roles/[id]           Its submissions                        │
  /roles/[id]/edit      Edit it                               ─┘
/dashboard/activity     The trail, scoped to what you may see

/admin                  The service at a glance   ─┐
  /admin/clients        Who pays for Open Casting  │ owner only
  /admin/clients/new    Take one on                │
  /admin/clients/[id]   Plan, ceilings, accounts   │
  /admin/accounts       Accounts, made under a client │
  /admin/activity       Everything, across every client ─┘

/c/<slug>-<token>              A casting call, as an applicant sees it
/c/<slug>-<token>/<role-slug>  One role, and the submission form
```

**Navigation follows the hierarchy.** A casting call cannot exist without a
client and a role cannot exist without a casting call, so the dashboard is the
list of casting calls grouped by client with the roles under each, and every page
links back one level: a role to its casting call, a casting call to the list. The
nav is Casting calls, Activity and FAQ in the casting section, and Overview,
Clients, Accounts and Activity in the owner's, and the back-links use the same
words for the same places. The footer shows each reader their own way on:
signed out, **Sign in** for a casting team and **Admin** for the administrator,
which goes to the sign-in and from there to the admin overview; signed in, the
casting calls, and Admin as well for an administrator, never for a director.
Behind the pre-launch wall, Admin is one click into the admin overview for
anyone who got past the passcode, signed in or not (see Before launch).
`/dashboard/sessions` still answers, with a permanent
redirect to `/dashboard`, and `/faq/performers` redirects to `/faq/applicants`,
so an old bookmark lands in the right place.

The only difference in the nav between accounts is **Accounts**, which an admin
sees and a director does not. The page refuses a director independently of the
nav, so hiding the link is presentation rather than protection.

## What is here

| Route | What it does |
| --- | --- |
| `/` | The way in: sign-in for the casting side, and a note for applicants |
| `/c/[token]` | One casting call's casting call, the only page an applicant sees |
| `/c/[token]/[roleId]` | The full brief, plus the submission form |
| `/dashboard` | Your casting calls, each with its roles and submission counts. Sign-in required |
| `/dashboard/sessions/new` | Set up a casting call; saved as a draft on the first save |
| `/dashboard/sessions/[id]` | A casting call: its roles, every submission across them, and the way out as a spreadsheet |
| `/dashboard/sessions/[id]/export` | That list as an `.xlsx` download |
| `/dashboard/sessions/[id]` | One casting call: its link, its roles, publish, close early, remove |
| `/dashboard/sessions/[id]/edit` | Move a casting call's times, taking its roles with them |
| `/dashboard/roles/new` | Post a role into a casting call |
| `/dashboard/roles/[id]` | The submissions for one role, and their status |
| `/dashboard/roles/[id]/edit` | Edit a role in place |
| `/dashboard/activity` | The audit trail, scoped like everything else |
| `/dashboard/accounts` | Create, suspend and restore accounts. Admin only |
| `/login` | Password or Google sign-in. There is no `/signup` |
| `/welcome` | Three-step setup, tailored to the account's role |
| `/faq/applicants` | What the fields on a casting call mean and what submitting commits you to |
| `/faq/casting-directors` | What each field commits you to, and writing terms |
| `/api/health` | Whether the deployment can reach its database. No data, no secrets |

## How it is put together

Next.js 16 App Router, TypeScript, Tailwind v4. Pages are server components; the
forms and a handful of small controls that need browser state are client components.

```
src/
  app/                     routes
  components/              ui primitives, cards, forms
  lib/
    types.ts               the domain: CastingSession (a casting call), Role, Submission
    seed-data.ts           demo content
    db.ts                  pool, schema bootstrap, backfills, seeding
    sessions.ts            casting call queries, publishing, the share token
    roles.ts               role queries and the visibility rule
    submissions.ts         submission queries and counts
    format.ts              UK-time formatting and the open/closed window
    validation.ts          zod schemas, shared by the forms
    actions.ts             server actions
    form-state.ts          the shape useActionState forms pass around
```

Mutations are Server Actions. Each form validates with a zod schema on the server and
renders errors per field; the browser's own required/type checks run first, so the server rules
are the backstop rather than the only line. A failed submit re-seeds the form from the values it
sent, because React resets an uncontrolled form once its action resolves.

## Data

Postgres, through `pg`. `src/lib/db.ts` owns the pool, creates the schema with
`CREATE TABLE IF NOT EXISTS` on the first query of each process, and seeds the
demo content if the `roles` table is empty. Seeding is keyed on fixed ids with
`ON CONFLICT DO NOTHING`, so several instances starting at once cannot double up.

Two rules the database enforces rather than the application:

- `submissions (session_id, lower(email))` is unique, so one person cannot submit
  twice to the same casting call, whichever of its roles they go for. The
  insert decides it, not a check beforehand: two requests arriving together would
  both pass a check-then-insert.
- `submissions.role_id` references `roles(id)`, and both `roles.session_id` and
  `submissions.session_id` reference `sessions_casting(id)`, all with
  `ON DELETE CASCADE`. Removing a casting call takes its roles and their
  submissions with it, in one statement.

Set `DATABASE_URL` in the environment. If a hosted integration provisions
`POSTGRES_URL`, `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING` instead
(Vercel's Postgres and Neon integrations set `POSTGRES_URL`), the app reads those
too, in that order, so a one-click database works without renaming anything.

On a serverless host use the provider's **pooled** connection string; each
instance opens its own pool. Keep `DATABASE_POOL_MAX` small.

TLS is verified whenever the connection string asks for it, whichever `sslmode`
it names: the app decides that itself rather than leaving it to the driver, so
`sslmode=require`, the mode providers hand out, keeps verifying the certificate
when pg 9 stops doing so. A provider using its own certificate authority can set
`DATABASE_SSL_NO_VERIFY=1`, which keeps the connection encrypted but stops
checking who is on the other end.

## Before launch

One variable. With `SITE_PASSCODE` set:

- every page shows an interstitial first, asking for that passcode. Nothing
  behind it is served: not the sign-in page, not a casting share link. Only the
  interstitial itself, `/api/health` and `robots.txt` answer through it;
- the application's own sign-in stops checking anything. Any email and any
  password gets a session, and an account is created on the spot for an address
  that has none. Google sign-in is withdrawn while the wall is up, because it is
  the one way in that really does authenticate;
- the footer's **Admin** is one click into the admin overview, as a stand-in
  administrator called Preview Admin, made on first use with a password nobody
  holds. Sign-in checks nothing behind the wall anyway, so this is the same
  permission spelled shorter. It is bound to the same variable: with the wall
  down the link is the real sign-in, `/login/preview` sends there too, and the
  stand-in's sessions end;
- a banner sits above every page saying so, and `/api/health` reports it.

The two go together on purpose. Sign-in that authenticates nobody is only
defensible because the wall in front of it means nobody uncontrolled reaches it,
so they are the same switch, and it is not possible to leave the second on
while turning the first off.

It is not the application's access control and does not pretend to be: it keeps
the work in progress away from anyone who has not been shown it. Unset it to
launch, and everything reverts to real sign-in with no code change.

Both the passcode and the sign-in behind it are throttled by address, because a
shared secret with only a per-email throttle is no throttle at all; an attacker
just varies the address.

The wall needs `AUTH_SECRET` as well: "this browser has entered the passcode" is
a signed cookie, and the proxy turns away any it cannot verify. With the
passcode set and the key missing, the wall is up and nothing can open it. The
interstitial says so in place of the form, and `/api/health` reports
`authSecret: "missing"`. Set it and redeploy.

## Keeping it out of search

- **`robots.txt`** disallows everything.
- **`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`** on every response
  from the proxy, not only pages that set it in their metadata, which covers API
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
of the authorisation. Only that suffix is looked up, so renaming a casting call
does not break a link that is already circulating, and a guessed slug gets
nobody anywhere. The alphabet excludes look-alikes (no `0`/`O`, no `1`/`l`/`I`)
and lookup is case-insensitive, so a link retyped in capitals still works.
Ten characters is about 49 bits: far too many to enumerate, short enough to fit
in a caption.

The role is matched by its slug **within** the casting call, so one casting call's
link cannot reach another's role. It is not a check that can be forgotten,
because there is no query that could find it.

Set **`APP_URL`** to the canonical origin and share links are built from it
rather than from whichever of the four domains the casting director happened to
be on. Every redirect an applicant does not make is one fewer round trip on a
phone and one fewer chance for a truncated link.

## Signing in

One entry point, `/login`, and four layers behind it.

**1. Password.** scrypt, with a decoy hash when the address is unknown so response
time does not reveal which addresses have accounts, and a throttle on failures.

**Google sign-in.** Links to an account that already exists, and creates one
*only* for an address named in `ADMIN_EMAILS`, which whoever controls the
deployment has already authorised. Any other Google address is refused, so the
button is not a way around "no self-registration". It never runs without Google
having verified the address.

It does not then ask for an emailed link, and the reason is worth stating: that
link would go to the same mailbox that just authenticated. Whoever holds the
Google account holds the inbox, so it would add friction and no security. A
second factor only counts when it reaches somewhere the first does not. Password
sign-in still requires one, because a password and a mailbox are two different
things.

**2. A second factor, for accounts that can affect other people.** Admins always;
anyone else if `mfa_required` is set on them. The password alone starts nothing:
it issues a one-time link, emailed, good for 15 minutes and one use, spent inside
a single `UPDATE` so two clicks cannot both win. Asking for another voids the
first. Google sign-in goes through the same gate: it proves an address, not a
second factor, and skipping it there would make the button the way around it.

**3. The edge.** The proxy holds a signed cookie carrying the account id and role,
verified with HMAC-SHA256 through Web Crypto: no dependency, one implementation
for both runtimes. It gates `/dashboard/**`, and `/dashboard/accounts` for admins
only. With no `AUTH_SECRET` it fails closed.

**4. The server, which is the one that decides.** The proxy runs on the Edge
runtime and **cannot reach Postgres**, so the signed cookie is a cache and can
only be stale. It cannot know an account was suspended a minute ago, had its
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

1. **`/api/health`.** `authSecret` must read `set` and `email` `configured`. If
   either is missing, an admin cannot sign in at all and there is no point going
   further. Nothing in the response leaks a connection string.
2. **Sign in at `/login`** with the admin address and password. You should land
   on “Check your email”, and **no session cookie should be set**: the password
   alone starts nothing.
3. **Open the emailed link.** It is good for 15 minutes and one use.
4. **Open it a second time.** It must refuse, saying it has already been used.
5. **Sign in again without opening the new link, then open the first one.** The
   superseded link must be dead.

`ADMIN_EMAILS` is comma-separated, so more than one address can hold admin:
`richard@seaglassdigital.co.uk,richard@cwcasting.co.uk` grants both. An address
added there is promoted on its next sign-in; removed, it drops back to director.

## Who can get in

Open Casting is not a public board. There is no listing to browse, no search, and
nothing to register for.

- **Accounts are created by the administrator**, on `/dashboard/accounts`, and by
  nobody else. The password is generated there and shown once. Google sign-in
  links an address that already has an account and will not create one.
- **The administrator's own account** is created from the environment on first
  boot (see *Deploying*), because otherwise a fresh deployment would have no
  way in at all.
- **Applicants never sign in.** A casting call has a share link carrying an
  unguessable token, shown on its page in the dashboard. That link is the whole
  of the access control: whoever holds it can read that casting call and submit to
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
   it covers: how many casting calls, how many roles in each, and an end date.
   Blank means no limit. They are enforced when the account tries to post, not
   merely displayed.
2. **They open a casting call** and post its roles into it, inside those limits.
3. **They check it and publish it.** A new casting call is a draft: its share link
   opens for them and for nobody else, so they can read it exactly as a
   applicant will. Publishing is what makes the link work, and it needs at least
   one role. It cannot be undone: once a link is on a post or in a mailout it is
   out of anyone's hands, so *close early* is how a call is stopped.
4. **They circulate the link**: Instagram, a mailout, an agent circular.
   Whoever holds it can submit while the casting call is open.
5. **They work the submissions** through New, Shortlisted, Callback and Declined.
   The data is theirs.
6. **The call closes**, at its closing time or early.
7. **Thirty days after the casting call ends, the applicants' details are
   destroyed.** See below. Everything is saved as they go: a draft can be left with **Save and finish later** and picked up again from the Casting calls list, where it carries a **Continue setting up** link and the progress dots resume where they were.

## Agreements

Two documents, in `src/content/legal.ts`, each with a version. An acceptance is
only worth having if you can say afterwards exactly what was accepted, so the
text for a version never changes. A wording change is a new version, which
people are asked to accept again.

- **Master Services Agreement and Data Processing Schedule.** The first thing
  setup asks a new customer, before anything else, and enforced by the dashboard
  layout rather than only by the path through setup, because an agreement that can be
  navigated past is not enforced. Accepted by the customer in their own account,
  never ticked on their behalf at account creation, and recorded with the
  version, the timestamp and the IP. Readable again at `/legal/agreement`. The
  administrator operates the service rather than buying it, so there is nothing
  for them to accept.
- **Terms of Submission and Acceptable Use Policy.** On every submission form,
  summarised in four lines with the full text a click away at
  `/legal/submission-terms`, and required, separately from any terms the casting
  director sets on the role. The accepted version is stored on the submission.

**Under-18s.** Typing an age below 18 opens a parental consent section: the
guardian's name, their email, and an explicit consent statement. The action
decides that from the age given, not from whether the form troubled to send the
fields, so removing them from the request does not skip it. All three are stored
against the submission.

## Retention

Thirty days after a casting call **finishes**, every submission made to it is
deleted: names, emails, phone numbers, locations, ages, links, cover notes. The
casting call, its roles and the fact that submissions were received survive, so
the casting director keeps a record of what they ran without holding anybody's
personal data. The session is marked `purged_at` so the dashboard says what
happened rather than showing an empty list.

The clock runs from the **Casting call End Date**, not the casting close date: a
shoot can run for months after its call shut, and the shortlist is needed until
it wraps. The casting director sets it when opening the casting call and can move
it if the schedule does.

The MSA promises a warning at 14 days and again at 48 hours, and both are sent
by the same sweep. Claiming a threshold is part of the `UPDATE` that selects it,
so two overlapping sweeps cannot send the same warning twice.

It runs two ways, deliberately:

- **On a schedule.** `vercel.json` calls `/api/retention` daily at 03:00. The
  endpoint requires `CRON_SECRET` in an `Authorization: Bearer` header, and
  refuses to run at all if that variable is unset. An unguarded delete endpoint
  is worse than a sweep nobody configured.
- **On boot.** The same sweep runs once per process during schema bootstrap, so
  a deployment where nobody set the cron still honours the promise instead of
  keeping the data for ever in silence.

The date is shown on every casting call's page, and both FAQs state it.

## The look, and the applicant's own page

Charcoal, terracotta, cream and gold, from the brand board: cream ground,
copy in charcoal on warm cream containers with a crisp outline, white for the
wells inside them and for every field, a terracotta header with white on it,
and gold for the one primary action on a screen. The one panel that is the
next thing to do, publishing a draft, the link once it is live, the form on an
applicant's page, is white with a gold edge and a small gold tag naming it. Every colour used for text reaches 4.5:1
on what it sits on; gold is a fill, never a colour for words, which is why
the accent text of the old dark theme became terracotta. Focus rings are
terracotta too, controls are at least 44px tall, and the submission form's
send button stays in reach on a phone. A field is a white box until the person
fills it in, with a charcoal edge where it has to be and a grey one where it
can be left, and pale green with a tick once they have: no field shares the
ground's cream, and what is still to do stands apart from what is done. A value
that was already there when the page opened, a default or a saved one, stays
white until they change it.

The two dashboard forms, the casting call's and the role's, put what a call
cannot go out without in one card and everything else under **Advanced
options**: two folds on the casting call form (the production company and
picture, what applicants are told) and three on the role form (what
applicants must send, the terms they accept, a question about a protected
characteristic). A fold is a native `<details>` with a line on it saying what
it is set to, so a closed form still reads in full and its defaults are
posted whether or not it was opened. A fold opens itself when it holds
something other than the default, or an error after a refused save, and after
that stays as the person leaves it. What a role asks of an applicant is a list
of fields, each with one switch reading Optional or Mandatory and **Don't
ask** beside it; a field that is not asked says so, with **Ask for it**. The
switch is a button with `role="switch"`, and the value travels in a hidden
input, so what is posted is what the switch says.

The applicant's pages under `/c/` stand alone: no site navigation, no footer
of links, a parchment ground, and an optional header image across the top
that the casting director uploads on the casting call form, offered only when
a store is connected. The same URL is the director's preview and the
applicants' page.

A page is a run of sections, each one container with the same shape: cream,
a line, soft corners, and inside it white for anything you act on. Every
section opens the same way (`SectionHead` in `src/components/ui.tsx`): a
short heading, one line under it saying what the section holds, and to the
right whatever acts on the section as a whole. One button on a page is gold,
the thing to do next; the rest are outlined pills grouped with their section.
Details go in a key-and-value grid like a spec sheet, not in boxes of prose.
The casting call's page runs, in the order set on the design canvas: the link
to share (on a draft, the publish panel), About this call, Roles, then
Submissions; the applicant's page runs title, the one button, the roles, who
can apply, and their data. Every other page follows the same shape: the
casting calls list, the role page, the activity pages, the admin pages, the
FAQ, sign-in, the passcode gate, the welcome steps and the applicant's role
page. Only the submission form's own fieldsets and the legal documents keep
their own layout.

The casting calls list is a traffic light. Live and about-to-open calls are
green and come first; a call closed to submissions and being reviewed is
amber; a call whose production has finished is red, with the deletion date on
it; a call still being set up is "In progress", with no ground of its own.
The setup wizard is numbered 1 to 4, each step with what it is for.

## The casting call is where submissions are read

The dashboard list shows each casting call and its numbers only: roles,
submitted, to review, shortlisted, callback, declined. Who submitted is on the
casting call's own page, which lists every submission across its roles with
its status, a filter by status, and a status control on each row; a role's
page still has the full card for each applicant. Both lists come in pages of
25 (`?page=`), newest first, counted and fetched in the database rather than
loaded whole, so a casting call with hundreds of submissions stays quick.
Every row and card shows the applicant's photo, or a placeholder that says
"No photo submitted" when none came in, or "Photo not available" when the
file could not be fetched, so a missing file never shows as a broken image. Suite 16 loads a casting call with
200 submissions, 50 of them with photos, and walks the pages.

Suite 18 (`test/suites/18-capacity.mjs`) is the capacity test. It sets a
casting call up through the forms with every option on: a production company
and a banner, the director's own inclusion statement, an agent route and tape
guidance, then a lead role that asks for everything and makes all of it
mandatory, with three videos set out, terms to accept and a question about a
protected characteristic. One applicant sends the whole form, photo and three
tapes included, then six more send it at once. The roles are then filled to
over 1,200 submissions straight into the database, with photos that load and
photos the store no longer holds, three tapes, guardians, every status, and
names, emails, locations and cover notes far longer than anyone plans for.
Every page a director reads is then timed against a budget and checked for a
layout that broke, on a desktop and on a phone, and the spreadsheet is
downloaded and emailed with every row in it. It runs against the stand-in
store, like suite 17.

The list leaves the site as a spreadsheet. **Download spreadsheet** serves
`/dashboard/sessions/[id]/export`, an `.xlsx` built with exceljs (one row per
applicant, the role, status, contact details and cover note; a second sheet
naming the casting call and the moment of export). **Email it to me** sends
the same file as an attachment to the signed-in account's own address and to
nowhere else, and is offered only when a mail provider is configured. Both
are recorded in the activity trail as `data.exported`: a file of applicants'
details leaving the site is worth a line.

## Dates and times

Every date field in the dashboard (the casting window, when the production
finishes, shoot days, a client's access date) is a native field with the
browser's own pop-up hidden, and a calendar button beside it that opens
`DateTimeField` instead: a Monday-first calendar, hour and minute for the
casting window, and **Confirm**. Nothing reaches the field until Confirm;
Cancel, Escape and a click elsewhere leave it as it was, and Clear empties it.
The field can still be typed into, which is also how the end-to-end suite
fills it. Under the casting window fields the chosen moment is read back in
words, in UK time, which is how the server stores it.

That is for a mouse. On a phone, or anything else driven by touch, the field
keeps the device's own picker, made for a thumb and already familiar, and the
calendar button opens that one too, through `showPicker`; a browser with no
picker of its own gets the site's. The values are the same either way.

## Photos and videos

An applicant can attach a profile photo (up to 5 MB) and a video (up to
200 MB) to a submission. The file goes straight from the browser into Vercel
Blob; only its URL travels with the form. `/api/blob/upload` signs the short-lived
address for that, and it checks what the form itself would: a share link for a
casting call that is open now, naming a role in it. The address is good for one
kind of file under that role, its content types and its size, and an hour, so
nothing else can be sent with it.

The browser puts the file through `https://vercel.com/api/blob`, the SDK's
own endpoint rather than the store's host, and the page's Content Security
Policy names that address under `connect-src` (`src/proxy.ts`). Without it
the browser refuses the upload before a byte leaves it and the form says the
file did not upload, which is what the first deployment with a store did. A
header image is shrunk before it goes: `src/lib/image.ts` redraws it in the
browser to at most 1600px on its longest edge and re-encodes it as WebP
(JPEG where the browser cannot write WebP), so a photograph off a camera
arrives as a file of tens of kilobytes, and the form says by how much. SVG
goes up as it is. No plugin or server-side library is involved, and the
server never handles the bytes.

Blobs are **private**. A casting tape is personal data, sometimes of a child,
and an unguessable public URL is still a URL. The dashboard reads a file back
through `/api/media`, which checks the viewer may see the submission it belongs
to, passes a Range request through so a tape can be scrubbed, and never lets
a shared cache keep a copy. The files are deleted with the submission: on
removal, and thirty days after the production finishes.

The header image is private too, and served through `/api/hero`, which asks
only that the file is one of ours under an account's hero folder: the page it
sits on is open to anyone holding the link, and the page's Content Security
Policy lets an image come from this origin and nowhere else, so the store's
own address would never have rendered. A picture that is replaced is deleted
from the store.

A file goes to the store before the form is sent, so the form remembers what
it has uploaded: a submission refused for a missing field is corrected and
sent again without the tape going up twice. A file whose form never arrives
at all is an orphan, and the daily retention sweep (`/api/retention`) deletes
any orphan older than a day.

Without a store connected the form offers no uploads and everything else
works as before, which is how all but one of the end-to-end suites run.
`/api/health` reports `uploads` as `ready` or `off`, so a deployment can be
checked without reading its settings, and the Admin overview has a **File
store** card that says the same in words. When a store is connected the card
offers **Test the store**, which writes a small private file, reads it back
and deletes it, and says whether that worked from this deployment: it is the
check to run after connecting one.

Suite 17 (`test/suites/17-uploads.mjs`) proves the whole path without a
store, against a stand-in (`test/blob-standin.mjs`) that the harness starts
beside the app. The server is given a token and pointed at the stand-in
(`BLOB_READ_WRITE_TOKEN`, `VERCEL_BLOB_API_URL`, and `BLOB_READ_BASE`, which
sends every read of a stored file there instead of to the host in its URL).
The browser is given a proxy that tunnels `vercel.com` to the stand-in's
HTTPS listener and refuses everything else, so it does exactly what it does
on a deployment, the Content Security Policy and the CORS preflight included,
over HTTP/2, which a browser insists on before it will stream a request body.
A header image goes up from the casting call form and comes back on the
applicant's page as WebP; a photo and a tape go up with a submission and come
back to the director and to nobody else; removing the role removes the files.
`BLOB_READ_BASE` exists for that harness and has no place on a deployment.

Create the store as **private**: the app writes nothing public, and a public
store would serve a tape to anyone holding its address. Connect it to the
project in the Vercel dashboard, then redeploy: settings reach a deployment
only when it is built, so a deployment made before the store was connected
keeps reporting `uploads: off` until then. The dashboard connects a store in
one of two ways, and the app takes either. The older puts a read-write token
in the environment as `BLOB_READ_WRITE_TOKEN` (or `PREFIX_READ_WRITE_TOKEN`
when a prefix was chosen). The current one puts only the store's id there, as
`BLOB_STORE_ID`, and the deployment signs in as itself with the identity token
Vercel gives every request, which needs OIDC federation on under the project's
security settings (it is, for a new project). `/api/health` names which it
found under `store`, and the Admin overview says the same in words. Connect,
redeploy, then run the test.

## Two sections, and four words

The site is in two parts, guarded separately:

| Section | Who | What is in it |
| --- | --- | --- |
| `/admin` | the owner | Clients, the accounts under them, the site-wide trail |
| `/dashboard` | casting directors and producers | Casting calls, roles, submissions, their own trail |

Which section you are in is the path, not the role, so an owner doing their own
casting gets the casting navigation while they are in `/dashboard`.

Four words, one hierarchy:

| The word | What it means | In the code |
| --- | --- | --- |
| **Client** | A company paying for Open Casting. Managed by the owner alone. | `clients` |
| **Casting call** | One project, with however many roles. | `sessions_casting` |
| **Production company** | Who is making it. A line on the casting call, not a record. | `sessions_casting.production_company` |
| **Applicant** | Someone who submits for a role. | `submissions` |

```
Open Casting (the owner)
 └ Client                 CW Casting Ltd        plan, ceilings, billing, status
    ├ Accounts            directors, producers  inherit the client's plan
    └ Casting call          Saltmarsh             production company: Wildseed Films
       └ Role             Nell (Lead)
          └ Applicant     Aoife Brennan
```

The code keeps its older names (a casting call is a *casting session*, at
`/dashboard/sessions/…`), and the interface says casting call throughout.

**A client is the tenant.** Accounts belong to one, and what the client bought
(the tier, the ceilings, how long access runs) lives on the client rather than
being repeated on each of its accounts, so a customer is managed in one place.
Suspending a client locks out every account under it on the next request, not
at the next sign-in: `currentUser` checks the client alongside the account.

`company` on a row is the **client's name**, kept there because it is what
producer visibility matches on (`sessionVisibility` in `src/lib/sessions.ts`).
It is set from the signed-in account, never typed into a form, so one account
cannot post into another client's view of the dashboard, and renaming a client
carries to its accounts (`renameClientAccounts`) so a rename cannot split a
company in two.

A **casting call** owns the name, the production type, the synopsis, the client,
and the opening and closing times submissions run between. Roles belong to a casting call and carry no dates of their own, and a
role takes its casting call details from the casting call it is posted into, so the
role form asks only for the brief, the rate and the shoot dates. Every role is
paid; there is no pay type and no union status.

The opening and closing times are entered as UK wall-clock time
(`datetime-local` in the form, converted through `Europe/London` in
`src/lib/format.ts`) and stored as `timestamptz`, so a call that closes at
18:00 closes at 18:00 in London whichever side of a clock change it falls.

That buys three things:

- **One window per casting call.** Every role opens and closes together, so two
  roles on the same film cannot disagree about when casting closes. Moving the
  times moves all of them at once.
- **One submission per applicant per casting call.** An applicant picks the role
  that fits and submits once, rather than once per role. The unique index
  `submissions (session_id, lower(email))` decides it, so two requests arriving
  together cannot both get through.
- **A real off switch.** *Close early* on the casting call stops every role in it
  at the same moment, and is reversible. Removing is the destructive one, is
  admin-only, and takes the roles and their submissions with it.

Outside the window the roles stay listed and readable, so an applicant can read
the brief and prepare a tape, but the submission form is not rendered, and the
action refuses the write even if the form is replayed.

`roles.deadline` is legacy: roles once carried their own closing date. It is
nullable now and only read to derive casting calls for roles that predate them.

Roles do not move between casting calls. Moving one would change the times it was
posted under and separate it from the submissions already made to its casting call.

## Accounts and roles

Three roles, and one rule that decides everything:

| Role | Sees on the dashboard |
| --- | --- |
| `director` | Only the casting calls and roles they posted |
| `producer` | Every casting call and role under their company, whoever posted them |
| `admin` | Everything |

What each may **do**, on top of that:

| Action | Who |
| --- | --- |
| Edit a casting call or a role, close it early, reopen it | Anyone who can see it |
| Remove a casting call or a role, with its submissions | Admin only |
| Suspend or restore an account | Admin only |

Removal is admin-only on purpose: it destroys applicants' contact details, and a
shared company name should not be enough to authorise that. Closing early is the
non-destructive option: it stops new submissions and keeps the roles readable.
Closing is recorded in `closed_at` rather than by moving the closing time, so the
roles still show the time they advertised.

Suspending an account deletes its sessions, so somebody signed in is out at
once; `currentUser()` re-checks suspension on every request in case a session
was created in between. Their casting calls stay up. An admin cannot suspend themselves.

### Setting an account up

**New account** on `/admin/accounts` opens `/admin/accounts/new`, which asks
for the person and the money in one go: their name, email, client and what they
can see, then where the invoice goes, the purchase order or reference, the VAT
number and the payment terms, then what they pay, how often, the plan, the
ceilings and the access date. The password is generated and shown once on the
same page, so it is handed over from there and never stored anywhere readable.

Only the first block belongs to the person. Everything under **The money** is
the client's, since the client is who is invoiced: the fields fill with what
that client is already on, changing as another client is chosen, and saving
writes them back to the client, where they can be changed again on its own
page. The page says so rather than leaving it to be discovered. Money is held
as whole pence (`rate_pence`), never a float, so a rounding error cannot reach
an invoice.

### Long lists

Accounts, clients and both activity trails come in pages of fifty
(`LIST_PAGE_SIZE`, `?page=`), counted and fetched in the database rather than
loaded whole, as submissions do at twenty-five. A trail is only ever added to,
so loading all of it was a query with no ceiling on it.

### Projects

`/admin/projects` is every casting call on the site, whoever opened it: the
call and its roles, the client, what it has taken against whatever cap it has,
when it closes, and what state it is in. Narrowed by client, by state and by
closing date, all in the URL so a filtered list can be linked to, and paged at
fifty like the rest.

The row is the point of it. **Publish**, **Pause** and **Reopen** do what the
call's own owner can do, without having to be them, for the moment a call is
running away and whoever opened it is not around; each is recorded in the
activity trail against the administrator who did it. **Cap and closing time**
sets `submission_cap` and the closing moment together.

A cap is the number of submissions a call will take across all its roles.
Once it is met the call stops taking them whatever its closing time says,
checked in the action against the database rather than against anything the
form carried. The applicant's pages say the call is full instead of offering a
form that would refuse, and the casting call's own page shows the count
against the cap.

There is no public-versus-unlisted setting, because there is no public
listing: a share link is the whole of the authorisation and every applicant
page carries `noindex`. Making calls browsable would be a different product.

### Submissions and moderation

`/admin/submissions` is every submission on the site, newest first, whoever it
was sent to, narrowed by status, by held-back media, by applicants under 18 and
by whether anything was attached. Opening a row shows the photo and the tapes,
played through `/api/media` as everywhere else, with the applicant's details
and their guardian's where there is one.

**Hold the media back** sets `media_flagged_at` with a reason and who did it.
Nothing is moved or deleted: `/api/media` refuses the file to everyone but an
administrator, so the casting team stops seeing it and clearing the flag puts
it back. **Remove this submission** needs a ticked confirmation and deletes the
row and every file with it, which cannot be undone. Both are recorded in the
activity trail against the administrator who did them, as `media.flagged`,
`media.cleared` and `submission.removed`.

### Notifications

The app sends three messages on its own, which it did not before: a receipt to
the applicant when their submission goes through, an update when the casting
team moves their status to anything but New, and a warning to the team once
their call passes nine in ten of the cap they set. None of them can fail the
thing that prompted it: a message that did not send is a line in the log, not
a lost application.

`/admin/notifications` holds the wording of all three, editable without a
deployment and revertible to what ships, with the placeholders each may use
listed under it. Anything not filled is left reading as the placeholder, so a
mistake shows rather than becoming the word "undefined".

The second half is the delivery log: every message the app has tried to send,
who it went to, what prompted it and whether it got there, with the reason
when it did not. `sendEmail` writes that line itself, so nothing can send
without being recorded.

With `INBOUND_EMAIL_DOMAIN` set, each message carries a reply-to of
`role-<id>@that-domain`, which names the role and no person; routing those to
the casting team needs an inbound service listening on the domain. Until one
exists there is no reply-to and nobody's address is exposed.

### The audit log

`/admin/audit-logs` is the same trail as everywhere else, unscoped: every
action in the order it happened, with who took it, what they took it on and
the address it came from. `activity` carries `actor_ip` and `subject_id` for
that, and one search box answers all three questions, matching an email
against the account, an id against the actor, the subject or the role, and
anything else against the words.

Watching an applicant's tape is recorded as `media.viewed`, once a day per
person per file. Loading the photos on a list of two hundred submissions is
not a view and is not recorded: a trail nobody can read is not a record of
anything.

### Privacy

`/admin/privacy` is for doing what the law requires when somebody asks.

**Requests.** An applicant may ask what is held about them, and may ask for it
to go. Both arrive by email, since there is no account to ask from, so they are
logged here as they arrive with a countdown of the month there is to answer.
A request nobody wrote down is one nobody can show they answered.

**What is held about one person.** A search by email finds every submission
they made across every casting call, with what each carries. **Bundle what is
held** serves `/admin/privacy/export` as JSON: every field of every submission
plus any answer about a protected characteristic, which is held apart from the
rest and is theirs too. Files are named in it rather than packed into it, since
a link that works for anybody is a worse answer than sending them separately.

**Erasure** deletes everything held about that address, on every casting call
at once, with the files. The address has to be typed again and the confirmation
ticked. It is a real delete: the casting teams lose the submissions too, which
is what erasure means.

**What goes on its own** states the rules that delete without anybody asking,
and says what the next sweep would take before it takes it. **Run the sweep
now** does the scheduled job's work by hand, for when it has not run.

### Storage

`/admin/storage` is what to open to ask whether the site is still working. It
measures the file store by walking it, split into header images, applicants'
photos, applicants' tapes and anything under neither prefix, which should
always be nothing; the database by table, with the rows that matter counted
exactly rather than taken from Postgres's own estimate; every casting call
still holding applicants' details with the day they are destroyed and how far
away that is; and the last few runs of the nightly sweep, which is recorded in
`sweeps` when it runs. A sweep that stopped being called looks exactly like a
quiet week, so without that record there was nothing to look at.

Anything worth acting on today is gathered at the top under **Needs
attention**: no store, no mail provider, a sweep that has not run for two days
or has never run, a casting call past the day its details should have gone,
files in the store with no submission pointing at them. An empty list is the
page saying everything is in order.

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
hash of the token stored, so reading the database does not yield a usable cookie.
A failed sign-in is hashed against a decoy so response time does not reveal
which addresses have accounts, and repeated failures are throttled per address.

### Role terms

A casting director can set optional terms on a role. Where they exist, the
role page shows them and the applicant must tick to accept before submitting,
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

Register the callback URL, `https://your-domain/api/auth/google/callback`, on
the Google client for every origin you use, casting call and preview alike.

## Setup wizard

A new account lands on `/welcome`, not an empty dashboard. Three steps: confirm
name and company, read what this role can see and do, then a note on the data
duty before being sent somewhere useful: the new-casting call form for a
director, the accounts page for an admin.

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
rule as the roles, applied to an owner and company **copied onto each entry**,
so a trail outlives the role it describes, which is the moment it is worth
most. `role_id` and `actor_id` are `ON DELETE SET NULL` and the readable fields
sit alongside them; a removed role shows struck through and stops being a link.

Account events carry no owner or company, which is what keeps them to admins
without a second rule.

Writing an entry never throws into the caller. A trail that can fail a
applicant's submission would be worse than a gap in the trail.

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
| `ADMIN_BOOTSTRAP_PASSWORD` | Creates the first address in `ADMIN_EMAILS` as an account, once, if it does not already exist. Ignored afterwards; change the password in the app, not here. |

Set both before the first request, sign in, and then every other account is made
from `/dashboard/accounts`. Every page that reads data is `force-dynamic`,
so the build itself does not need a reachable database.

That last point cuts both ways: a deployment with no reachable database builds
and deploys cleanly, then returns a server error on every page that reads data.
**`/api/health` is the first thing to check** when a deployed page errors. It
answers in one line whether a connection string is set, which variable it came
from, and whether the query went through, without the runtime logs and without
printing the connection string.

## Known limits

Anyone holding a share link can submit; there is no per-applicant identity, so a
link that is forwarded is a link that works. Regenerating a token is not exposed
in the UI yet; closing the casting call early is the way to stop a leaked link
today. Nobody is emailed when a submission arrives or a status changes: the
applicant's address is on every submission, and replying is a manual step. A
role cannot be moved between casting calls. Submissions are throttled at ten
an hour from one address, which is generous for a household and useless for a
script, but a school or an agency sending many through one connection will
meet it. Replies to the automated emails need an inbound mail service before
they reach anybody.
