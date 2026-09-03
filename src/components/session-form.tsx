"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useState } from "react";

import { createCastingSession, editCastingSession } from "@/lib/actions";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { guessImageKind, shrinkImage } from "@/lib/image";
import { DEFAULT_INCLUSION_STATEMENT, PRODUCTION_TYPES, type CastingSession, type HeroKind } from "@/lib/types";

import { DateTimeField } from "./date-time-field";
import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, ErrorSummary, Field, Input, RequiredKey, Select, Textarea } from "./ui";
import { SubmitButton } from "./submit-button";

const LABELS: Record<string, string> = {
  name: "Casting call",
  productionCompany: "Production company",
  productionType: "Production type",
  synopsis: "Synopsis",
  opensAt: "Submissions open",
  closesAt: "Submissions close",
  productionEndsAt: "Production finishes",
  heroUrl: "Header image or logo",
  inclusionStatement: "Inclusive casting statement",
  agentRoute: "If they have an agent",
};

/**
 * One form for opening a casting call and for editing one. The dates and times
 * here govern every role in the casting call, which is the whole point of
 * putting them here rather than on each role, so the form says so.
 */
/** The picked moment, read back in words, or nothing until one is picked. */
function Picked({ value }: { value: string }) {
  if (!value) return null;
  const instant = fromLocalInput(value);
  if (Number.isNaN(Date.parse(instant))) return null;
  return (
    <p className="mt-1.5 text-xs text-muted" aria-live="polite">
      Set to <strong className="font-medium text-text">{formatDateTime(instant)}</strong>, UK time.
    </p>
  );
}

/** "2.4 MB" or "180 KB", for saying what the shrinking did. */
function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * The optional image on the applicant's page: a banner across the top, or a
 * logo centred under it. It is shrunk in the browser first, to 1600px and
 * WebP, so a photograph off a camera costs a fraction to store and to load,
 * then goes straight to the store like an applicant's tape; only its URL and
 * how to show it travel with the form. Offered only when a store is connected.
 */
function HeroUpload({
  userId,
  current,
  currentKind,
  error,
}: {
  userId: string;
  current: string | null;
  currentKind: HeroKind;
  error?: string;
}) {
  const [url, setUrl] = useState<string>(current ?? "");
  const [kind, setKind] = useState<HeroKind>(currentKind);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(source: File) {
    setProblem(null);
    setNote(null);
    setProgress(0);
    try {
      const shrunk = await shrinkImage(source);
      // The shape of the picture decides how it is shown, until the director says otherwise.
      if (shrunk.width && shrunk.height) setKind(guessImageKind(shrunk.width, shrunk.height));
      const result = await upload(`calls/${userId}/hero/${shrunk.file.name}`, shrunk.file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ kind: "hero" }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      setUrl(result.url);
      if (shrunk.after < shrunk.before) {
        setNote(
          `Resized to ${shrunk.width} by ${shrunk.height} pixels and ${kb(shrunk.after)}, down from ${kb(shrunk.before)}.`,
        );
      }
    } catch (caught) {
      setProblem(
        caught instanceof Error && caught.message
          ? `The image did not upload: ${caught.message}`
          : "The image did not upload. Check its size and type, then try again.",
      );
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="heroUrl" value={url} />
      <input type="hidden" name="heroKind" value={kind} />
      {url ? (
        kind === "logo" ? (
          <div className="flex justify-center rounded-xl border border-line bg-surface p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a public blob the director just chose */}
            <img src={url} alt="" className="h-auto max-h-32 w-auto max-w-full" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a public blob the director just chose
          <img src={url} alt="" className="max-h-48 w-full rounded-xl border border-line object-cover" />
        )
      ) : null}
      <Field
        label="Header image or logo"
        htmlFor="hero"
        hint="Optional. A wide picture runs across the top of the page applicants see; a squarer one, or a logo, sits centred. JPEG, PNG, WebP or SVG. Pictures are shrunk to 1600 pixels and compressed before they are sent, so they cost little to keep and load fast on a phone."
        error={error ?? problem ?? undefined}
      >
        <Input
          id="hero"
          name="hero"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void send(file);
          }}
        />
      </Field>
      {progress !== null ? (
        <p className="text-sm text-muted" aria-live="polite">
          Uploading: {progress}%
        </p>
      ) : null}
      {note ? (
        <p className="text-sm text-muted" aria-live="polite">
          {note}
        </p>
      ) : null}
      {url ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <legend className="mb-1 text-sm font-medium">Show it as</legend>
            {(["banner", "logo"] as const).map((option) => (
              <label key={option} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="heroKindChoice"
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                  className="size-4 accent-brand"
                />
                {option === "banner" ? "A banner across the top" : "A logo, centred"}
              </label>
            ))}
          </fieldset>
          <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>
            Remove the image
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SessionForm({
  session,
  uploads,
  userId,
}: {
  session?: CastingSession;
  /** Whether a file store is connected, which is what makes a header image possible. */
  uploads: boolean;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState(
    session ? editCastingSession : createCastingSession,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // The picker asks before it commits, and the chosen moment is then echoed
  // under the field in words: what was picked, read back as a date and time.
  const [opens, setOpens] = useState<string | null>(null);
  const [closes, setCloses] = useState<string | null>(null);

  // What was just submitted wins, so a failed save does not discard the edit.
  // Stored instants are shown as UK time, which is how they were typed in.
  const values: Record<string, string> =
    state.status === "idle" && session
      ? {
          name: session.name,
          productionCompany: session.productionCompany,
          inclusionStatement: session.inclusionStatement ?? DEFAULT_INCLUSION_STATEMENT,
          agentRoute: session.agentRoute,
          productionType: session.productionType,
          synopsis: session.synopsis,
          opensAt: toLocalInput(session.opensAt),
          closesAt: toLocalInput(session.closesAt),
          productionEndsAt: session.productionEndsAt,
        }
      : submitted;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      {state.status === "error" ? (
        <>
          {state.message ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
            >
              {state.message}
            </p>
          ) : null}
          <ErrorSummary errors={errors} labels={LABELS} />
        </>
      ) : null}

      <RequiredKey />
      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">The casting call</legend>
        <p className="text-sm text-muted">
          What applicants see above every role you post into it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Casting call" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              placeholder="Saltmarsh"
              defaultValue={values.name ?? ""}
              required
            />
          </Field>
          <Field label="Production type" htmlFor="productionType" error={errors.productionType}>
            <Select
              id="productionType"
              name="productionType"
              defaultValue={values.productionType ?? PRODUCTION_TYPES[0]}
              required
            >
              {PRODUCTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Production company"
            htmlFor="productionCompany"
            hint="Who is making it. Yours to see, never shown to applicants. Optional."
            error={errors.productionCompany}
          >
            <Input
              id="productionCompany"
              name="productionCompany"
              placeholder="Wildseed Films"
              defaultValue={values.productionCompany ?? ""}
            />
          </Field>
          <Field
            label="Synopsis"
            htmlFor="synopsis"
            hint="A sentence or two about the casting call. It appears on every role."
            error={errors.synopsis}
            className="sm:col-span-2"
          >
            <Textarea
              id="synopsis"
              name="synopsis"
              rows={3}
              defaultValue={values.synopsis ?? ""}
              required
            />
          </Field>
          {uploads ? (
            <div className="sm:col-span-2">
              <HeroUpload
                userId={userId}
                current={session?.heroUrl ?? null}
                currentKind={session?.heroKind ?? "banner"}
                error={errors.heroUrl}
              />
            </div>
          ) : (
            <>
              <input type="hidden" name="heroUrl" value={session?.heroUrl ?? ""} />
              <input type="hidden" name="heroKind" value={session?.heroKind ?? "banner"} />
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">The casting window</legend>
        <p className="text-sm text-muted">
          Every role in this casting call takes submissions from the opening time until the
          closing time, and at no other time. Times are UK time.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Submissions open"
            htmlFor="opensAt"
            hint="Roles can be seen before this, but the form does not appear until then."
            error={errors.opensAt}
          >
            <DateTimeField
              id="opensAt"
              name="opensAt"
              label="Submissions open"
              mode="datetime"
              defaultValue={values.opensAt ?? ""}
              defaultTime="09:00"
              onChange={setOpens}
              required
            />
            <Picked value={opens ?? values.opensAt ?? ""} />
          </Field>
          <Field
            label="Submissions close"
            htmlFor="closesAt"
            hint="You can close early once you have what you need."
            error={errors.closesAt}
          >
            <DateTimeField
              id="closesAt"
              name="closesAt"
              label="Submissions close"
              mode="datetime"
              defaultValue={values.closesAt ?? ""}
              defaultTime="23:59"
              align="end"
              onChange={setCloses}
              required
            />
            <Picked value={closes ?? values.closesAt ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">
          When the production finishes
        </legend>
        <p className="max-w-prose text-sm text-muted">
          The date the shoot or run wraps, not the date casting closes. Everything applicants
          send you is deleted 30 days after it, which is what your agreement and their terms
          both promise. You will get an email 14 days and 48 hours beforehand.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Production finishes"
            htmlFor="productionEndsAt"
            hint="If the schedule moves, change this and the deletion date follows."
            error={errors.productionEndsAt}
          >
            <DateTimeField
              id="productionEndsAt"
              name="productionEndsAt"
              label="Production finishes"
              mode="date"
              defaultValue={values.productionEndsAt ?? ""}
              required
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">What applicants are told</legend>
        <p className="text-sm text-muted">
          Two things every casting call says for itself on the applicant&apos;s page.
        </p>
        <div className="mt-6 grid gap-4">
          <Field
            label="Inclusive casting statement"
            htmlFor="inclusionStatement"
            hint="Shown on the applicant's page. Edit it to suit the production, or clear it to show none."
            error={errors.inclusionStatement}
          >
            <Textarea
              id="inclusionStatement"
              name="inclusionStatement"
              rows={3}
              defaultValue={values.inclusionStatement ?? DEFAULT_INCLUSION_STATEMENT}
            />
          </Field>
          <Field
            label="If they have an agent"
            htmlFor="agentRoute"
            hint="Shown to anyone who says they are represented, instead of the form: where they should apply instead. Leave blank to take submissions from everyone, represented or not."
            error={errors.agentRoute}
          >
            <Textarea
              id="agentRoute"
              name="agentRoute"
              rows={3}
              placeholder="Represented UK actors: please apply through your agent rather than this form."
              defaultValue={values.agentRoute ?? ""}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <SubmitButton disabled={pending}>
          {pending ? "Saving" : session ? "Save changes" : "Save and continue"}
        </SubmitButton>
        <ButtonLink
          href={session ? `/dashboard/sessions/${session.id}` : "/dashboard"}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
        {session ? null : (
          <p className="basis-full text-xs leading-relaxed text-muted">
            Saved as a draft. Nothing is shown to applicants until you publish, and you can come
            back to it from Casting calls at any time.
          </p>
        )}
      </div>
    </form>
  );
}
