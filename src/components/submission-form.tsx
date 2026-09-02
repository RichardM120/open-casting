"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { submitApplication } from "@/lib/actions";
import { SUBMISSION_TERMS } from "@/content/legal";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { ADULT_AGE } from "@/lib/types";

import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, Select, Textarea, cx } from "./ui";

const LABELS: Record<string, string> = {
  name: "Full name",
  email: "Email",
  phone: "Phone",
  location: "Based in",
  age: "Age",
  reelUrl: "Showreel link",
  profileUrl: "Profile link",
  coverNote: "Cover note",
  acceptTerms: "Terms for this role",
  acceptSubmissionTerms: "Terms of Submission",
  guardianName: "Parent or guardian's name",
  guardianEmail: "Parent or guardian's email",
  guardianConsent: "Parental consent",
};

/** The ages the picker offers, matching what the form accepts. */
const AGES = Array.from({ length: 96 }, (_, index) => index + 5);

export function SubmissionForm({
  roleId,
  roleTitle,
  session,
  closesOn,
  disclaimer,
  backTo,
}: {
  roleId: string;
  roleTitle: string;
  /** The casting call's name, and when it closes, as a formatted date and time. */
  session: string;
  closesOn: string;
  disclaimer: string;
  /** The casting call's own page. There is nowhere else for an applicant to go. */
  backTo: string;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, IDLE_FORM_STATE);
  const formRef = useErrorFocus(state.status, state.errors);

  // Watched rather than read on submit, so the guardian section appears as soon
  // as an age under 18 is chosen. Asking for it only after a refusal is a worse
  // way to find out, and this is the one part of the form a child cannot fill in.
  //
  // React resets the form once the action returns. A text input picks its value
  // back up from defaultValue, but a select does not: it takes one at mount and
  // then holds whatever the reset left, which emptied this field after a refusal
  // about some other part of the form. Remounting it per attempt is what makes
  // it behave like the rest of the fields.
  const submittedAge = state.values.age ?? "";
  const [age, setAge] = useState(submittedAge);
  const [seen, setSeen] = useState(state);
  const [attempt, setAttempt] = useState(0);
  if (seen !== state) {
    setSeen(state);
    setAttempt(attempt + 1);
    setAge(submittedAge);
  }
  const minor = age !== "" && Number(age) > 0 && Number(age) < ADULT_AGE;

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-7">
        <p className="text-xs font-semibold tracking-[0.18em] text-positive uppercase">
          Submission sent
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{state.message}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You will hear back through the email address you gave. That is your one submission to{" "}
          {session}, so nothing else is needed for {roleTitle} or any other role in it.
        </p>
        <div className="mt-6">
          <ButtonLink href={backTo} variant="secondary" size="sm">
            Back to {session}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { errors, values } = state;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-line bg-surface p-7"
    >
      <h2 className="text-xl font-semibold tracking-tight">Submit for this role</h2>
      <p className="mt-2 text-sm text-muted">
        Free to submit, and no agent needed. Everything here goes straight to the casting
        director.
      </p>
      <p className="mt-2 text-sm text-muted">
        This is one submission to <strong className="text-text">{session}</strong>, open until{" "}
        <strong className="text-text">{closesOn}</strong>. It is one per person per casting call,
        so pick the role that fits you best rather than submitting for several.
      </p>
      <p className="mt-2">
        <Link
          href="/faq/applicants"
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          What each field means
        </Link>
      </p>

      <input type="hidden" name="roleId" value={roleId} />

      {state.status === "error" ? (
        <div className="mt-5 flex flex-col gap-3">
          {state.message ? (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
              {state.message}
            </p>
          ) : null}
          <ErrorSummary errors={errors} labels={LABELS} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Age" htmlFor="age" error={errors.age}>
          <Select
            key={attempt}
            id="age"
            name="age"
            defaultValue={age}
            onChange={(event) => setAge(event.target.value)}
            required
          >
            <option value="">Choose your age</option>
            {AGES.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {minor ? (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft p-5">
          <h3 className="text-sm font-semibold tracking-tight">
            This applicant is under {ADULT_AGE}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A submission for a child has to be made by a parent or someone with legal parental
            responsibility. Please fill this in yourself rather than passing it to them.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Parent or guardian's name"
              htmlFor="guardianName"
              error={errors.guardianName}
            >
              <Input
                id="guardianName"
                name="guardianName"
                autoComplete="name"
                defaultValue={values.guardianName ?? ""}
              />
            </Field>
            <Field
              label="Parent or guardian's email"
              htmlFor="guardianEmail"
              hint="Where the casting director will reply."
              error={errors.guardianEmail}
            >
              <Input
                id="guardianEmail"
                name="guardianEmail"
                type="email"
                autoComplete="email"
                defaultValue={values.guardianEmail ?? ""}
              />
            </Field>
          </div>

          <label
            className={cx(
              "mt-4 flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed",
              errors.guardianConsent ? "text-danger" : "text-text",
            )}
          >
            <input
              id="guardianConsent"
              type="checkbox"
              name="guardianConsent"
              defaultChecked={values.guardianConsent === "on"}
              aria-invalid={errors.guardianConsent ? true : undefined}
              aria-describedby={errors.guardianConsent ? "guardianConsent-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            I am the parent or legal guardian of this applicant, and I consent to their name, age,
            contact details and any material submitted being processed solely for casting
            consideration on this project.
          </label>
          {errors.guardianConsent ? (
            <p id="guardianConsent-error" className="mt-1.5 text-xs text-danger">
              {errors.guardianConsent}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={minor ? "Applicant's full name" : "Full name"} htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={values.name ?? ""} required />
        </Field>
        {minor ? null : (
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={values.email ?? ""}
              required
            />
          </Field>
        )}
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={values.phone ?? ""}
            required
          />
        </Field>
        <Field label="Based in" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            placeholder="City, country"
            defaultValue={values.location ?? ""}
            required
          />
        </Field>
        <Field
          label="Showreel link"
          htmlFor="reelUrl"
          hint="Optional. Vimeo, YouTube or anywhere else."
          error={errors.reelUrl}
          className="sm:col-span-2"
        >
          <Input
            id="reelUrl"
            name="reelUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.reelUrl ?? ""}
          />
        </Field>
        <Field
          label="Profile link"
          htmlFor="profileUrl"
          hint="Optional. Spotlight, Backstage, your own site."
          error={errors.profileUrl}
          className="sm:col-span-2"
        >
          <Input
            id="profileUrl"
            name="profileUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.profileUrl ?? ""}
          />
        </Field>
        <Field
          label="Cover note"
          htmlFor="coverNote"
          hint="A short paragraph. Why you, for this part."
          error={errors.coverNote}
          className="sm:col-span-2"
        >
          <Textarea
            id="coverNote"
            name="coverNote"
            rows={5}
            defaultValue={values.coverNote ?? ""}
            required
          />
        </Field>
      </div>

      {disclaimer ? (
        <div className="mt-6 rounded-xl border border-line-strong bg-raised p-5">
          <h3 className="text-sm font-semibold">Terms for this role</h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted">
            {disclaimer}
          </p>
          <label
            className={cx(
              "mt-4 flex cursor-pointer items-start gap-2.5 text-sm",
              errors.acceptTerms ? "text-danger" : "text-text",
            )}
          >
            <input
              id="acceptTerms"
              type="checkbox"
              name="acceptTerms"
              defaultChecked={values.acceptTerms === "on"}
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            I have read these terms and accept them.
          </label>
          {errors.acceptTerms ? (
            <p id="acceptTerms-error" className="mt-1.5 text-xs text-danger">
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-line bg-raised p-5">
        <h3 className="text-sm font-semibold tracking-tight">Terms of Submission</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You keep ownership of everything you send. Nothing is sold, and nothing is used to
          train AI. Your details are destroyed 30 days after the production finishes. Nudity,
          abuse, hate speech and copyrighted material are not allowed and are removed and
          reported.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/legal/submission-terms"
            target="_blank"
            rel="noopener"
            className="text-accent underline-offset-4 hover:underline"
          >
            Read the full Terms of Submission and Acceptable Use Policy ↗
          </Link>
        </p>

        <label
          className={cx(
            "mt-4 flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed",
            errors.acceptSubmissionTerms ? "text-danger" : "text-text",
          )}
        >
          <input
            id="acceptSubmissionTerms"
            type="checkbox"
            name="acceptSubmissionTerms"
            defaultChecked={values.acceptSubmissionTerms === "on"}
            aria-invalid={errors.acceptSubmissionTerms ? true : undefined}
            aria-describedby={
              errors.acceptSubmissionTerms ? "acceptSubmissionTerms-error" : undefined
            }
            className="mt-0.5 size-4 shrink-0 accent-accent"
          />
          I have read and accept the Terms of Submission and Acceptable Use Policy.
        </label>
        {errors.acceptSubmissionTerms ? (
          <p id="acceptSubmissionTerms-error" className="mt-1.5 text-xs text-danger">
            {errors.acceptSubmissionTerms}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-faint">Version {SUBMISSION_TERMS.version}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending" : "Send submission"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Shown in place of the form outside the casting call's casting window. Not yet
 * open and closed are different situations for an applicant, so they read
 * differently: one is worth coming back for.
 */
export function SubmissionsClosed({
  session,
  opensOn,
  backTo,
}: {
  session: string;
  /** Set when the casting call has not opened yet, as a formatted date and time. */
  opensOn?: string;
  backTo: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-7">
      <h2 className="text-lg font-semibold tracking-tight">
        {opensOn ? "Submissions have not opened yet" : "Submissions have closed"}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        {opensOn ? (
          <>
            {session} takes submissions from <strong className="text-text">{opensOn}</strong>. The
            role is up now so you can prepare. Come back then and the form will be here.
          </>
        ) : (
          <>
            Casting for {session} is closed. The call is kept up so you can see what was asked
            for.
          </>
        )}
      </p>
      <div className="mt-5">
        <ButtonLink href={backTo} variant="secondary" size="sm">
          The other roles for {session}
        </ButtonLink>
      </div>
    </div>
  );
}
