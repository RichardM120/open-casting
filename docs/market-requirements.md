# Market requirements: the change register, as built

The cross-check of two live UK open casting calls against this platform
produced a change register of thirty-three items. This is what each became
in the code, and where. The register's task IDs are kept so the two documents
read together. The documents the register names alongside it (a DPIA, a
safeguarding policy, a decision log, a `db/schema.sql`) are not in this
repository; what they need to say is in `docs/compliance-notes.md`.

A few of the register's names do not match the code's. The register's
"casting" is a casting call (`sessions_casting`); a "field type" is an ask a
role makes of an applicant (`APPLICANT_ASKS` in `src/lib/types.ts`), which a
director turns on for a role and flips between optional and mandatory with one switch; the "form builder" is the
role form. Every schema change is an idempotent statement in
`src/lib/db.ts`, applied at boot.

## 4.1 Schema

| Item | Status | What was built |
|---|---|---|
| MR-01 special category field type | Done | A role may carry one question about a protected characteristic: `roles.special_question` holds the kind (ethnic or racial origin, religion or belief, health or disability, other), the question as the applicant reads it, and the justification. Answers go in their own table, `special_answers`, with the consent sentence as it read and its SHA-256 hash. |
| MR-02 occupational requirements | Done, as a field | The justification lives with the question rather than in a table of its own: one per role, written by the account that posts the role, and a role cannot be saved with a question and without it (`roleSchema` in `src/lib/validation.ts`). Since a casting call publishes only its roles, nothing with a question and no justification can be published. |
| MR-03 media slots | Done | `roles.media_slots`: up to three videos, each with a key, a label, a brief, a longest run in seconds and a required flag. With none set a role asks for one general tape. Every video sent is stored against its slot in `submissions.videos`; `video_url` keeps the first for older rows and code. |
| MR-04 height | Done | An ask, off unless the director turns it on. Typed either way round ("172 cm", "5ft 8", "1.72 m") and kept in centimetres (`src/lib/height.ts`); shown both ways. |
| MR-05 attestation | Done, for availability | A role with shoot dates asks the applicant to confirm they are free for them before it takes a submission; stored as `submissions.available`. Checked by the server against the role, not the form. |
| MR-06 residency | Done | An ask, off by default: United Kingdom, Ireland, elsewhere in Europe, outside Europe. Kept apart from where the applicant is based. |
| MR-07 representation status | Done, as a gate | A casting call may say where represented actors go instead. The form then opens with one question; a represented applicant reads the director's wording and nothing of theirs is taken. Not stored: everyone who reaches the form has said they are unrepresented. |
| MR-08 casting metadata | Done | Playing age, production type, production company, shoot dates and shoot location already existed. `roles.paid` is new, shown as Paid or Unpaid on every listing. |
| MR-09 timezone-aware close | Done, documented | Closing times are entered in UK time and stored as instants (`closes_at timestamptz`). The rule for uploads in flight: a submission counts when it arrives; a form or an upload still going at the closing time is refused, because the upload token is minted only while the call is open and the form is checked again on arrival. Written into the applicant FAQ under "Opens and closes". |
| MR-10 access to special category answers | Done | Not row-level security (there is no Postgres RLS here; the app is the only client) but the same effect: `specialAnswersFor()` in `src/lib/special.ts` returns answers only to the account that posted the role and to an administrator. A producer under the same client sees that an answer exists and not the answer. Answers are left out of the spreadsheet export. |
| MR-11 shorter retention per field group | Done | Answers are deleted 30 days after casting closes (`purgeSpecialAnswers()`, run by the daily retention job), while the rest of a submission survives until 30 days after the production finishes. |

## 4.2 Applicant flow

| Item | Status | What was built |
|---|---|---|
| MR-12 representation gate | Done | See MR-07. The gate comes before any field. |
| MR-13 multi-slot media step | Done | Each slot has its own brief, cap, file input, upload progress, error and retry. |
| MR-14 duration checked before upload | Done | The file's own metadata is read in the browser when it is chosen (`src/lib/video.ts`); a tape over the slot's limit is refused with the length it runs and the limit, and again before the upload starts. |
| MR-15 self-tape guidance | Done | Shown beside the upload as "How to tape", with a drawing of the framing (landscape, head and shoulders, eyes a third of the way down). Editable per casting call, with a default. |
| MR-16 separate consent for special category data | Done | Its own checkbox, apart from the terms, with the sentence stored alongside the answer and hashed. The browser holds the submit button quiet until it is ticked; the server refuses without it. |
| MR-17 availability attestation | Done | See MR-05. |
| MR-18 free to apply | Done | In the footer of every casting page: free to apply, and this page is the only place to apply. |
| MR-19 Article 13 notice | Done | A "Your data" section on every casting page, in the call's own words: the controller by name, the purpose, the basis, the day the data is destroyed, the rights, and where to ask or complain, with the ICO named. |

## 4.3 Director console and operator tooling

| Item | Status | What was built |
|---|---|---|
| MR-20 occupational requirement capture | Done | In the role form, the moment a characteristic is chosen. A role cannot be saved without it. |
| MR-21 brief linting for castings involving minors | Done | For a playing age starting under 18, the character brief, the requirements and every video brief are read as they are typed (`src/lib/brief-lint.ts`). Asking for where they live, their school, their date of birth, family, friends or pets, or contact details on tape draws a warning that names the structured field instead. Advisory: the role posts, and the activity record says it was posted with the warnings acknowledged. |
| MR-22 short shareable URL | Already so | A casting call's link is `/c/<slug>-<10 characters>`, short enough for a bio. |
| MR-23 verification statement and reporting route | Done | The same footer says any other route or any fee is not approved, and gives an address to report to: `REPORT_EMAIL`, or the first administrator's address until one is set. |
| MR-24 inclusive casting statement | Done | Every casting call starts with a default statement, editable or clearable, shown on both applicant pages. |
| MR-25 self-tape guidance library | Done, as a default | One default text the director edits per casting call rather than writes. A library of several is not built. |

## 4.4 Compliance documentation

The documents named are not in this repository. What each needs to say is
written out in `docs/compliance-notes.md` (MR-26 to MR-31).

## 4.5 Commercial and positioning

`docs/positioning.md` carries the F7 argument written up (MR-32) and the
benchmark note (MR-33).

## Not built, and why

- A library of reusable guidance texts (the second half of MR-25): one
  default per site, edited per call, covers the two calls studied.
- Storing representation status (MR-07 as a field): the gate means only
  unrepresented applicants reach the form, so the status is implied.
- Postgres row-level security (MR-10 as written): the application is the
  only database client, so the rule lives in the one function that reads
  the answers. If a second client is ever added, RLS should follow.
- A reference range for child licensing (MR-30): assessed in the
  compliance notes; no schema change until counsel says which date governs.
