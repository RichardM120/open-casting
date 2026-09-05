# Release checklist

Worked through against [Vercel's casting call checklist](https://vercel.com/docs/casting call-checklist).
Split into what the repository enforces on every push, what is a dashboard
setting only an account owner can change, and what has been considered and
deliberately not done.

## Enforced by CI

`.github/workflows/ci.yml` runs on every push to `main` and `claude/**`, and on
every pull request. It fails the build rather than warning.

| Check | Why it is here |
| --- | --- |
| `npm ci` | Installs from the lockfile. A drifting dependency tree is a deploy that differs from what was tested. |
| `npm run lint` | ESLint, including the React hooks rules. |
| `npm run typecheck` | `next typegen` then `tsc --noEmit`. Typegen first, because the route types are generated and a fresh checkout has no `.next`. The same script runs locally and in CI, so the two cannot disagree. |
| `npm run build` **with no `DATABASE_URL`** | Every data page is `force-dynamic`; a build that needs a live database is a deploy that breaks when the database is slow. |
| `npm run test:e2e` | Browser checks against a casting call build and a real Postgres: twenty suites, including the casting call's casting window, the one-submission-per-casting call rule, that suspending a client locks out every account under it, that the two sections carry their own navigation, the pre-launch wall, over a thousand submissions on one call, every page measured at 320px, and every page put through axe-core against WCAG 2.2 AA. |

The end-to-end suites live in `test/suites/` and run through `test/run.mjs`,
which gives each suite a dropped-and-reseeded database and its own server.
`ensureSchema()` memoises per process, so a truncate alone would not reseed.
Screenshots from a failed run are uploaded as a CI artifact.

The suites fail on an unexpected browser console error as well as on a failed
assertion, which is what would catch a Content Security Policy regression.

## In the code

- **Content Security Policy** with a per-request nonce, plus `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security`, in `src/proxy.ts`.
  `script-src` carries no `'unsafe-inline'`; the one inline style attribute in the app was
  moved to a class so `style-src` did not need loosening either.
- **Rate limiting** on the open write path (submissions, by client address) and failed
  sign-ins by email. The submission form takes no account and writes to the database, so
  it needed a ceiling. Sign-ups no longer exist to throttle.
- **A second factor on privileged accounts**: a one-time emailed link, 15 minutes,
  single use, spent in one `UPDATE`. Required for admins and for anyone flagged, and
  applied to Google sign-in too.
- **Edge role checks that fail closed**, over a signed context cookie, with the
  database still deciding on every request behind them.
- **No self-registration.** Accounts come from the administrator only, and the Google
  callback refuses an address that has no account rather than creating one.
- **`robots.txt` disallows everything**, and the pages reachable by share token are
  `noindex`. A token in a search result would defeat the point of having one.
- **Lockfile committed**, and the Node version pinned in `engines`.
- **Fonts** are self-hosted through `next/font`, so no external font request and no
  `font-src` beyond `'self'`.
- **No images or third-party scripts** to optimise yet. Revisit when headshots arrive;
  they will need `next/image` and a widened `img-src`.
- **`/api/health`** answers whether the running deployment can reach its database, which
  variable the connection string came from, and whether the schema is there. It is the
  first thing to check when a deployed page returns a server error, because a build
  succeeds with no database and only fails at request time. It returns no data and never
  the connection string.
- **A visible error boundary**, `src/app/error.tsx`. Without one, a server error shows the
  platform's own page, which says only that one happened. This one shows the digest, which
  is what matches a report to a log line.
- **WCAG 2.2 AA, checked by machine on every push.** `test/suites/21-accessibility.mjs`
  runs axe-core over twenty-five page states — signed out, casting director, administrator,
  at 1280px and at 320px, and over the applicant's form in its error state — and fails the
  build on any violation. The pass that introduced it fixed three real ones: links inside a
  sentence told apart from the text by colour alone (1.4.1), white at 75% on the terracotta
  bar at 4.23:1 where body text needs 4.5 (1.4.3), and the amber badge at 3.99:1 on its own
  ground. What a machine cannot decide — whether the words make sense, whether a keyboard
  can finish a task — still needs a person.
- **Four rules for a phone**, held to at 320px and checked on every push by
  `test/suites/20-mobile.mjs`: nothing pushes the page sideways; everything you tap on
  purpose is at least 44px, the number Apple, Material and WCAG's AAA target agree on,
  with the standard's own exceptions for a link inside a sentence and for a small target
  with clear space around it; no text in the interface is under 12px; and no card is
  drawn inside another card, because on a 320px screen the second frame costs a tenth of
  the width. The tokens that carry them are `CARD`, `CARD_GROUP` and `STACK` in
  `src/components/ui.tsx`, so the rules live in one place rather than at every call site.

## Yours: the Vercel dashboard

Nothing in the repository can set these.

| Setting | Note |
| --- | --- |
| Deployment Protection | Stops preview URLs being publicly readable. Worth it before real submissions exist. |
| Web Application Firewall | Managed rulesets and a bot rule. The app-level rate limit is a floor, not a substitute. |
| Speed Insights / Observability | Needs the `@vercel/speed-insights` package as well as the dashboard toggle. Not added, because it collects visitor data, so it is your call, not mine. |
| Spend Management | Every page is dynamic, so every view is a function invocation. Set an alert. |
| Function region | **Put it in the same region as the Neon database.** A cross-region round trip on every query is the single largest avoidable latency here. |
| Fluid compute | Reduces cold starts, which this app will feel: each cold start also re-runs the schema bootstrap. |
| Log Drains, SAML, SCIM, Audit Logs | Paid tiers. The app keeps its own activity trail regardless. |

## Considered, not done

- **`maxDuration` / memory overrides.** The defaults are appropriate for queries this
  small. Lowering `maxDuration` on a guess risks timing out a slow cold start for no gain.
- **ISR / caching headers.** There is nothing cacheable: every page is either
  per-request data or per-account. Caching would serve one casting director another's
  dashboard.
- **Tracing.** Worth it once there is traffic to explain. Today the activity trail and
  Vercel's own logs cover it.

## Before a release

1. CI green on `main`.
2. If the change touches `src/lib/db.ts`, rehearse the migration against a copy of
   casting call. Neon branching makes this cheap. Every schema change so far is written to
   run against live data: additive `ALTER ... IF NOT EXISTS` where it can be, and where a
   column is dropped or retyped (pay type and union status went; the casting window became
   `timestamptz`), guarded so it converts what is there and then no-ops.
3. Deploy, then load `/faq` and `/api/health`. The first reads no data and the second
   says whether the database answers, so the pair distinguishes a broken build from a
   broken database.
4. Check the function logs for the first request: that is when the schema bootstrap runs.
