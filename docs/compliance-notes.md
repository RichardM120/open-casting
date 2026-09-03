# Compliance notes from the market requirements cross-check

These are the amendments the cross-check calls for in documents that are
not kept in this repository: the DPIA, the safeguarding evidence pack, the
decision log and the compliance model. Each is written so it can be carried
into the document it belongs to. The register items are MR-26 to MR-31.

## MR-26. DPIA section 2.2: special category data

Remove: "The platform does not request special category data."

Replace with:

> The platform handles special category data in two ways.
>
> Incidentally: a photograph or a video of an applicant may reveal ethnic
> origin, religious dress, a disability or a health condition. Nothing in
> the form asks for these, the platform does not extract or index them, and
> they are held as part of the file under the same controls as the rest of
> the submission.
>
> Deliberately, where a role carries a genuine occupational requirement: a
> casting director may add one question to a role about ethnic or racial
> origin, religion or belief, health or disability, or another protected
> characteristic. The question can be saved only with the director's
> written statement of the occupational requirement (Equality Act 2010,
> Schedule 9), which is kept with the role as the record of the decision.
> The answer is collected under a separate, explicit consent whose wording
> is stored with it and hashed; it is held in its own table, apart from the
> submission; it is readable only by the account that posted the role and
> a site administrator, never by other accounts under the same client, and
> never included in an export; and it is deleted 30 days after casting
> closes, ahead of the rest of the submission.

## MR-27. Risk R7, split

R7a, incidental special category data in photographs and video. Likelihood
medium, severity medium, residual medium. Irreducible without refusing
media altogether. Accepted, with the file-level controls: private storage,
authenticated read-back, deletion with the submission and by the retention
purge, and the orphan sweep.

R7b, deliberate collection under an occupational requirement. Likelihood
low (few roles), severity high. Controls: the justification gate (MR-01,
MR-02, MR-20), the separate consent with stored wording (MR-16), the
narrowed readership and the exclusion from export (MR-10), and the
shorter retention (MR-11). Residual low. Open question for counsel: whether
explicit consent is the right Article 9 condition for an eligibility
criterion, or whether the employment condition in Schedule 1 of the Data
Protection Act 2018 applies (question 3 below).

## MR-28. Finding F4, for the R8 evidence pack

Current industry practice, in a studio-scale call on the incumbent
platform, asks a child of ten to twelve to state on camera their date of
birth, their height, where they live, and to describe a family member,
friend or pet they are close to. The first three duplicate fields the form
collects in structured form, where they can be withheld, corrected, partly
disclosed and deleted one at a time; spoken on video they cannot. The
fourth has no structured equivalent and no evident casting purpose, and
together with the child's face, name, approximate location and age it is a
package of identifying and relationship information about a named minor.

The platform reduces this measurably. For a role whose playing age starts
under 18, every brief is read as it is written and warned where it asks
for any of those things on tape, naming the structured field instead. The
warning is advisory; a role posted over it is recorded as posted with the
warnings acknowledged, so the decision is auditable. This is the concrete
evidence that normal practice has not been examined, and that a platform
can examine it without blocking anyone.

## MR-29. Equality Act 2010, Schedule 9, in the compliance model

The compliance model covers data protection and not discrimination law,
and casting sits on the boundary: a criterion such as "must be Jewish or
have Jewish heritage" is lawful only as an occupational requirement. The
model should say:

1. A protected-characteristic criterion may be applied to a role only
   where the characteristic is a genuine and determining requirement of
   the part, applying it is proportionate, and the director records why.
2. The platform captures that record at the point the question is added
   and refuses the question without it. It does not assess the record's
   merits; that is the controller's, and counsel's question 1 asks whether
   the processor carries any independent obligation.
3. The record is kept with the role for as long as the role is, is shown
   to applicants only as the fact that a recorded requirement exists, and
   is available to the controller as an audit artefact.

## MR-30. A single reference date, or a range, for child licensing

The Children (Performances and Activities) (England) Regulations 2014
apply across the whole period of an engagement, and a shoot can run for
months: an applicant who is seventeen at submission may be eighteen at the
first shoot day and was a child for part of the engagement either way. The
platform records the applicant's actual age at submission (the consent
route turns on it), and the role's first and last shoot day. That is
enough to compute the age at any date in the range. No reference-date
column is added; whether the licensing position is governed by the first
day, the last day or every day is counsel's question 5, and the schema
should follow the answer rather than guess it.

## MR-31. Decision log entry

Date: 3 September 2026. The date-of-birth and reference-date design
(actual age drives eligibility and the consent route; playing age is role
metadata; the applicant's actual age is recorded at submission) was
checked against a live brief seeking 17 to 20 year olds for a shoot running
January to March 2027, where applicants cross the boundary during the
engagement. No change was required. See MR-30 for the open question about
a range.

## Questions for counsel

Carried from the cross-check, unchanged, for the same session as the
safeguarding policy:

1. Where a casting applies a protected-characteristic criterion under an
   occupational requirement, does the processor carry any independent
   obligation to assess its validity, or does it rest wholly with the
   controller?
2. Is capturing and storing the controller's justification sufficient, or
   should the platform decline to publish criteria it cannot substantiate?
3. For Article 9 data collected as an eligibility criterion, is explicit
   consent the correct basis, or does the employment and occupation
   condition in Schedule 1 of the Data Protection Act 2018 apply?
4. Does asking a minor to disclose their home locality and personal
   relationships on camera create any obligation on the processor to
   object, or is advisory linting the appropriate limit of the role?
5. For a shoot spanning several months, what reference date governs the
   child performance licensing position?
