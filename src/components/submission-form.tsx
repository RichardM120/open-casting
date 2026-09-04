"use client";

import Link from "next/link";
import { uploadPresigned } from "@vercel/blob/client";
import { useActionState, useState } from "react";

import { submitApplication } from "@/lib/actions";
import { SUBMISSION_TERMS } from "@/content/legal";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { ADULT_AGE, RESIDENCIES, type AskKey, type MediaSlot, type SpecialKind } from "@/lib/types";
import { formatSeconds, videoDuration } from "@/lib/video";

import { useErrorFocus } from "./use-error-focus";
import { cx, Button, ButtonLink, ErrorSummary, Field, Input, RequiredKey, RequiredMark, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

type Uploaded = { url: string; name: string };

/**
 * How to tape, beside the upload rather than in a caption nobody reads twice,
 * with a drawing of the framing: landscape, head and shoulders, eyes a third
 * of the way down.
 */
function TapeGuidance({ text }: { text: string }) {
  const points = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <details className="group mt-5 rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold tracking-tight">
        How to tape
        <span className="ml-2 text-xs font-normal text-muted group-open:hidden">Show</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <svg
          aria-label="Framing: landscape, head and shoulders, eyes a third of the way down"
          role="img"
          viewBox="0 0 96 64"
          className="w-40 shrink-0 rounded-lg border border-line bg-raised stroke-text"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="48" cy="27" r="11" className="fill-surface" />
          <path d="M22 64c3-14 12-20 26-20s23 6 26 20" className="fill-surface" />
          <path d="M8 22h10M78 22h10" strokeDasharray="2 3" className="stroke-brand" />
          <path d="M4 4h10M4 4v10M82 4h10M92 4v10M4 60v-10M4 60h10M92 60v-10M92 60H82" className="stroke-brand" />
        </svg>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Says a file is already with the store, so the applicant need not pick it again. */
function UploadedNote({ file }: { file: Uploaded | undefined }) {
  if (!file) return null;
  return (
    <p className="mt-1.5 text-xs text-muted" aria-live="polite">
      Uploaded: {file.name}. Choose another file to replace it.
    </p>
  );
}

const LABELS: Record<string, string> = {
  name: "Full name",
  email: "Email",
  phone: "Phone",
  location: "Based in",
  age: "Age",
  height: "Height",
  residency: "Where you are resident",
  available: "Availability",
  specialAnswer: "The question about you",
  specialConsent: "Consent to that answer being processed",
  reelUrl: "Showreel link",
  profileUrl: "Profile link",
  photoUrl: "Profile photo",
  videoUrl: "Video",
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
  uploads,
  token,
  sessionId,
  required,
  hidden,
  agentRoute,
  availability,
  slots,
  tapeGuidance,
  special,
}: {
  roleId: string;
  roleTitle: string;
  /** The casting call's name, and when it closes, as a formatted date and time. */
  session: string;
  closesOn: string;
  disclaimer: string;
  /** The casting call's own page. There is nowhere else for an applicant to go. */
  backTo: string;
  /** Whether a file store is configured. Without one, no upload fields. */
  uploads: boolean;
  token: string;
  sessionId: string;
  /** The fields this role's director made mandatory. Name, email, age and the terms always are. */
  required: AskKey[];
  /** The fields this role does not ask for at all. */
  hidden: AskKey[];
  /** What a represented applicant is told instead of the form. Empty for no gate. */
  agentRoute: string;
  /** The shoot dates to confirm availability for, in words, or null when the role has none. */
  availability: string | null;
  /** The videos this role asks for, each with its brief and cap. */
  slots: MediaSlot[];
  /** How to tape, one point per line. Empty for none. */
  tapeGuidance: string;
  /** The role's question about a protected characteristic, with the consent sentence to tick, or null. */
  special: { kind: SpecialKind; about: string; question: string; consentText: string } | null;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, IDLE_FORM_STATE);
  const must = new Set(required);
  const asked = (key: AskKey) => !hidden.includes(key);
  // Whether they have an agent, asked before anything else is: a represented
  // actor is sent where the director says, and no detail of theirs is taken.
  const [represented, setRepresented] = useState<"yes" | "no" | null>(null);
  const [progress, setProgress] = useState<{ kind: string; percent: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // What has already gone to the store. Kept across a refused submission, and
  // posted again as the hidden fields below, so a corrected form does not send
  // a two-hundred-megabyte tape a second time.
  const [uploaded, setUploaded] = useState<Partial<Record<string, Uploaded>>>({});
  // A video over its slot's limit is refused the moment it is chosen, by its
  // own metadata, so nothing that long is ever sent.
  const [tooLong, setTooLong] = useState<Partial<Record<string, string>>>({});

  // Files go straight to the store first, from the browser, and only their
  // URLs travel with the rest of the form: a video is far larger than a
  // server action may carry. The store checks the share link, the window and
  // the size before it accepts anything.
  async function withUploads(formData: FormData) {
    setUploadError(null);
    const files: { field: string; kind: "photo" | "video"; what: string; path: string; slot?: MediaSlot }[] = [
      { field: "photo", kind: "photo", what: "The photo", path: `submissions/${sessionId}/${roleId}/photo` },
      ...slots.map((slot) => ({
        field: `video_${slot.key}`,
        kind: "video" as const,
        what: slot.label,
        path: `submissions/${sessionId}/${roleId}/video/${slot.key}`,
        slot,
      })),
    ];
    for (const { field, kind, what, path, slot } of files) {
      const file = formData.get(field);
      formData.delete(field);
      if (!(file instanceof File) || file.size === 0) continue;
      if (slot?.maxSeconds) {
        const seconds = await videoDuration(file);
        if (seconds !== null && seconds > slot.maxSeconds + 1) {
          setUploadError(
            `${what} runs ${formatSeconds(seconds)}; the limit is ${formatSeconds(slot.maxSeconds)}. Trim it and choose it again.`,
          );
          return;
        }
      }
      try {
        const result = await uploadPresigned(`${path}/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ token, roleId, kind }),
          onUploadProgress: ({ percentage }) => setProgress({ kind: what, percent: percentage }),
        });
        formData.set(kind === "photo" ? "photoUrl" : field, result.url);
        setUploaded((current) => ({ ...current, [field]: { url: result.url, name: file.name } }));
      } catch (error) {
        setProgress(null);
        setUploadError(
          error instanceof Error && error.message
            ? `${what} did not upload: ${error.message}`
            : `${what} did not upload. Check its size and type, then try again.`,
        );
        return;
      }
    }
    setProgress(null);
    formAction(formData);
  }

  // Read as soon as a file is chosen, so the applicant hears about a tape
  // that is too long before they have filled in anything else.
  async function checkLength(slot: MediaSlot, file: File | undefined) {
    if (!file || !slot.maxSeconds) return setTooLong((current) => ({ ...current, [slot.key]: undefined }));
    const seconds = await videoDuration(file);
    setTooLong((current) => ({
      ...current,
      [slot.key]:
        seconds !== null && seconds > slot.maxSeconds! + 1
          ? `This one runs ${formatSeconds(seconds)}; the limit is ${formatSeconds(slot.maxSeconds!)}.`
          : undefined,
    }));
  }
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
  const labels = {
    ...LABELS,
    ...Object.fromEntries(slots.map((slot) => [`video_${slot.key}`, slot.label])),
  };

  if (agentRoute && represented !== "no") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-7">
        <h2 className="text-xl font-semibold tracking-tight">Before you start</h2>
        {represented === "yes" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-text">{agentRoute}</p>
            <button
              type="button"
              onClick={() => setRepresented("no")}
              className="mt-4 text-sm text-brand underline-offset-4 hover:underline"
            >
              I am not represented after all
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              This casting call asks one thing first. Do you have an agent?
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => setRepresented("yes")}>
                Yes, I have an agent
              </Button>
              <Button type="button" onClick={() => setRepresented("no")}>
                No, I am not represented
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={withUploads}
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
          className="text-sm text-brand underline-offset-4 hover:underline"
        >
          What each field means
        </Link>
      </p>

      <RequiredKey className="mt-4" />

      <input type="hidden" name="roleId" value={roleId} />

      {state.status === "error" ? (
        <div className="mt-6 flex flex-col gap-3">
          {state.message ? (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
              {state.message}
            </p>
          ) : null}
          <ErrorSummary errors={errors} labels={labels} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft p-4 sm:p-6">
          <h3 className="text-sm font-semibold tracking-tight">
            This applicant is under {ADULT_AGE}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A submission for a child must be made by a parent or someone with legal parental
            responsibility. Fill this in yourself rather than passing it to them.
          </p>

          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <Field
              label="Parent or guardian's name"
              htmlFor="guardianName"
              error={errors.guardianName}
              required
            >
              <Input
                id="guardianName"
                name="guardianName"
                autoComplete="name"
                defaultValue={values.guardianName ?? ""}
                data-must=""
                aria-required="true"
              />
            </Field>
            <Field
              label="Parent or guardian's email"
              htmlFor="guardianEmail"
              hint="Where the casting director will reply."
              error={errors.guardianEmail}
              required
            >
              <Input
                id="guardianEmail"
                name="guardianEmail"
                type="email"
                autoComplete="email"
                defaultValue={values.guardianEmail ?? ""}
                data-must=""
                aria-required="true"
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
              data-must=""
              aria-required="true"
              name="guardianConsent"
              defaultChecked={values.guardianConsent === "on"}
              aria-invalid={errors.guardianConsent ? true : undefined}
              aria-describedby={errors.guardianConsent ? "guardianConsent-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span>
              I am the parent or legal guardian of this applicant, and I consent to their name, age,
              contact details and any material submitted being processed solely for casting
              consideration on this project.
              <RequiredMark />
            </span>
          </label>
          {errors.guardianConsent ? (
            <p id="guardianConsent-error" className="mt-1.5 text-xs text-danger">
              {errors.guardianConsent}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
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
        {asked("phone") ? (
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={values.phone ?? ""}
              required={must.has("phone")}
            />
          </Field>
        ) : null}
        {asked("location") ? (
          <Field label="Based in" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              name="location"
              placeholder="City, country"
              defaultValue={values.location ?? ""}
              required={must.has("location")}
            />
          </Field>
        ) : null}
        {asked("residency") ? (
          <Field
            label="Where you are resident"
            htmlFor="residency"
            hint="The country you live in. Some roles are open to residents of one country only."
            error={errors.residency}
          >
            <Select
              key={`residency-${attempt}`}
              id="residency"
              name="residency"
              defaultValue={values.residency ?? ""}
              required={must.has("residency")}
            >
              <option value="">Choose</option>
              {RESIDENCIES.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {asked("height") ? (
          <Field
            label="Height"
            htmlFor="height"
            hint="In centimetres or in feet and inches: 172 cm, or 5ft 8."
            error={errors.height}
          >
            <Input
              id="height"
              name="height"
              inputMode="text"
              placeholder="172 cm"
              defaultValue={values.height ?? ""}
              required={must.has("height")}
            />
          </Field>
        ) : null}
        {asked("reelUrl") ? (
        <Field
          label="Showreel link"
          htmlFor="reelUrl"
          hint="Vimeo, YouTube or anywhere else."
          error={errors.reelUrl}
          className="sm:col-span-2"
        >
          <Input
            id="reelUrl"
            name="reelUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.reelUrl ?? ""}
            required={must.has("reelUrl")}
          />
        </Field>
        ) : null}
        {asked("profileUrl") ? (
        <Field
          label="Profile link"
          htmlFor="profileUrl"
          hint="Spotlight, Backstage, your own site."
          error={errors.profileUrl}
          className="sm:col-span-2"
        >
          <Input
            id="profileUrl"
            name="profileUrl"
            type="url"
            placeholder="https://"
            defaultValue={values.profileUrl ?? ""}
            required={must.has("profileUrl")}
          />
        </Field>
        ) : null}
        {asked("coverNote") ? (
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
            required={must.has("coverNote")}
          />
        </Field>
        ) : null}
      </div>

      {availability ? (
        <div className="mt-6">
          <label
            className={cx(
              "flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed",
              errors.available ? "text-danger" : "text-text",
            )}
          >
            <input
              id="available"
              type="checkbox"
              name="available"
              data-must=""
              aria-required="true"
              defaultChecked={values.available === "on"}
              aria-invalid={errors.available ? true : undefined}
              aria-describedby={errors.available ? "available-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span>
              I am available for the shoot dates, {availability}, and will not take on work that
              clashes with them.
              <RequiredMark />
            </span>
          </label>
          {errors.available ? (
            <p id="available-error" className="mt-1.5 text-xs text-danger">
              {errors.available}
            </p>
          ) : null}
        </div>
      ) : null}

      {special ? (
        <div className="mt-6 rounded-xl border border-line-strong bg-raised p-4 sm:p-6">
          <h3 className="text-sm font-semibold">One more question</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This role is cast to a recorded occupational requirement, which is why it may ask about{" "}
            {special.about}. Your answer is kept apart from the rest of your submission, read only by
            the casting director who posted the role and the site administrator, and deleted 30 days
            after casting closes.
          </p>
          <Field label={special.question} htmlFor="specialAnswer" error={errors.specialAnswer} className="mt-4">
            <Input
              id="specialAnswer"
              name="specialAnswer"
              defaultValue={values.specialAnswer ?? ""}
              required
            />
          </Field>
          <label
            className={cx(
              "mt-4 flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed",
              errors.specialConsent ? "text-danger" : "text-text",
            )}
          >
            <input
              id="specialConsent"
              type="checkbox"
              name="specialConsent"
              data-must=""
              aria-required="true"
              defaultChecked={values.specialConsent === "on"}
              aria-invalid={errors.specialConsent ? true : undefined}
              aria-describedby={errors.specialConsent ? "specialConsent-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span>
              {special.consentText}
              <RequiredMark />
            </span>
          </label>
          {errors.specialConsent ? (
            <p id="specialConsent-error" className="mt-1.5 text-xs text-danger">
              {errors.specialConsent}
            </p>
          ) : null}
        </div>
      ) : null}

      {disclaimer ? (
        <div className="mt-6 rounded-xl border border-line-strong bg-raised p-4 sm:p-6">
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
              data-must=""
              aria-required="true"
              name="acceptTerms"
              defaultChecked={values.acceptTerms === "on"}
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span>
              I have read these terms and accept them.
              <RequiredMark />
            </span>
          </label>
          {errors.acceptTerms ? (
            <p id="acceptTerms-error" className="mt-1.5 text-xs text-danger">
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>
      ) : null}

      {uploads && (asked("photo") || asked("video")) ? (
        <div className="mt-6 rounded-xl border border-line bg-raised p-4 sm:p-6">
          <h3 className="text-sm font-semibold tracking-tight">
            {asked("photo") && asked("video") ? "Photo and video" : asked("photo") ? "Photo" : "Video"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {asked("video") && slots.length > 1
              ? `A recent photo of you, and the ${slots.length} videos set out below. Each is seen only by the casting team and is deleted with your submission.`
              : "A recent photo of you, and a self-tape or showreel. Both are seen only by the casting team and are deleted with your submission."}
          </p>
          <input type="hidden" name="photoUrl" value={uploaded.photo?.url ?? ""} />
          {slots.map((slot) => (
            <input
              key={slot.key}
              type="hidden"
              name={`video_${slot.key}`}
              value={uploaded[`video_${slot.key}`]?.url ?? ""}
            />
          ))}
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {asked("photo") ? (
              <div>
                <Field label="Profile photo" htmlFor="photo" hint="JPEG, PNG or WebP, up to 5 MB." error={errors.photoUrl}>
                  <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required={must.has("photo") && !uploaded.photo} />
                </Field>
                <UploadedNote file={uploaded.photo} />
              </div>
            ) : null}
            {asked("video")
              ? slots.map((slot) => (
                  <div key={slot.key} className={slots.length > 1 ? "sm:col-span-2" : undefined}>
                    <Field
                      label={slot.label}
                      htmlFor={`video_${slot.key}`}
                      hint={[
                        slot.maxSeconds ? `Up to ${formatSeconds(slot.maxSeconds)}.` : "",
                        "MP4, MOV or WebM, up to 200 MB.",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      error={errors[`video_${slot.key}`] ?? tooLong[slot.key]}
                    >
                      <>
                        {slot.brief ? (
                          <p className="text-sm leading-relaxed whitespace-pre-line text-text">{slot.brief}</p>
                        ) : null}
                        <Input
                          id={`video_${slot.key}`}
                          name={`video_${slot.key}`}
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                          required={slot.required && !uploaded[`video_${slot.key}`]}
                          onChange={(event) => void checkLength(slot, event.currentTarget.files?.[0])}
                        />
                      </>
                    </Field>
                    <UploadedNote file={uploaded[`video_${slot.key}`]} />
                  </div>
                ))
              : null}
          </div>
          {asked("video") && tapeGuidance ? <TapeGuidance text={tapeGuidance} /> : null}
          {progress ? (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              Uploading the {progress.kind}: {progress.percent}%
            </p>
          ) : null}
          {uploadError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-line bg-raised p-4 sm:p-6">
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
            className="text-brand underline-offset-4 hover:underline"
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
            data-must=""
            aria-required="true"
            name="acceptSubmissionTerms"
            defaultChecked={values.acceptSubmissionTerms === "on"}
            aria-invalid={errors.acceptSubmissionTerms ? true : undefined}
            aria-describedby={
              errors.acceptSubmissionTerms ? "acceptSubmissionTerms-error" : undefined
            }
            className="mt-0.5 size-4 shrink-0 accent-accent"
          />
          <span>
            I have read and accept the Terms of Submission and Acceptable Use Policy.
            <RequiredMark />
          </span>
        </label>
        {errors.acceptSubmissionTerms ? (
          <p id="acceptSubmissionTerms-error" className="mt-1.5 text-xs text-danger">
            {errors.acceptSubmissionTerms}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-faint">Version {SUBMISSION_TERMS.version}</p>
      </div>

      <div className="sticky bottom-0 -mx-7 -mb-7 mt-6 border-t border-line bg-surface/95 px-7 py-4 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0">
        <SubmitButton disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending" : "Send submission"}
        </SubmitButton>
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
      <div className="mt-6">
        <ButtonLink href={backTo} variant="secondary" size="sm">
          The other roles for {session}
        </ButtonLink>
      </div>
    </div>
  );
}
