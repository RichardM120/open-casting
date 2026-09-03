"use client";

import { useActionState, useState } from "react";

import { editRole, postRole } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import { APPLICANT_ASKS, DEFAULT_HIDDEN_FIELDS, DEFAULT_REQUIRED_FIELDS, MAX_MEDIA_SLOTS, SLOT_LENGTHS } from "@/lib/types";
import type { AskKey, CastingSession, MediaSlot, Role } from "@/lib/types";

import { DateTimeField } from "./date-time-field";
import { useErrorFocus } from "./use-error-focus";
import { Button, ButtonLink, Checkbox, ErrorSummary, Field, Input, RequiredKey, Select, Textarea } from "./ui";
import { formatSeconds } from "@/lib/video";
import { SubmitButton } from "./submit-button";

const LABELS: Record<string, string> = {
  sessionId: "Casting call",
  title: "Role name",
  characterBrief: "Character brief",
  requirements: "Requirements",
  ageMin: "Playing age from",
  ageMax: "Playing age to",
  location: "Location",
  shootStartsAt: "First shoot day",
  shootEndsAt: "Last shoot day",
  disclaimer: "Terms for applicants",
};

/**
 * One form for posting and editing. In edit mode the fields fall back to the
 * role's current values, and the action rewrites in place rather than creating.
 * Nothing about the casting call is asked for here: a role takes its casting call's
 * name, type, synopsis, company and dates from the casting call it is posted into.
 */
/** The three settings a director can give each of the applicant's fields. */
const ASK_OPTIONS = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "off", label: "Not asked" },
] as const;

export function RoleForm({
  role,
  sessions,
  defaultSessionId,
  uploads,
}: {
  role?: Role;
  /** The casting calls this account may post into. Empty is handled by the page. */
  sessions: CastingSession[];
  defaultSessionId?: string;
  /** Whether a file store is configured. Without one a photo or video cannot be asked for. */
  uploads: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    role ? editRole : postRole,
    IDLE_FORM_STATE,
  );
  const { errors, values: submitted } = state;
  const formRef = useErrorFocus(state.status, errors);

  // What was just submitted wins, so a failed save does not discard the edit;
  // otherwise the role as it stands.
  const values: Record<string, string> =
    state.status === "idle" && role
      ? {
          title: role.title,
          characterBrief: role.characterBrief,
          requirements: role.requirements.join("\n"),
          ageMin: String(role.ageMin),
          ageMax: String(role.ageMax),
          location: role.location,
          shootStartsAt: role.shootStartsAt ?? "",
          shootEndsAt: role.shootEndsAt ?? "",
          sessionId: role.sessionId,
          disclaimer: role.disclaimer,
          selfTape: role.selfTape ? "on" : "",
          paid: role.paid ? "on" : "",
        }
      : submitted;

  // Which of the applicant's fields this role requires: as the role has them,
  // the default for a new one, or what was just posted after a refused save.
  const requiredNow = new Set<AskKey>(role ? role.requiredFields : DEFAULT_REQUIRED_FIELDS);
  const hiddenNow = new Set<AskKey>(role ? role.hiddenFields : DEFAULT_HIDDEN_FIELDS);
  const askValue = (key: AskKey): (typeof ASK_OPTIONS)[number]["value"] => {
    if (state.status !== "idle") {
      const sent = submitted[`ask_${key}`];
      return sent === "required" || sent === "off" ? sent : "optional";
    }
    return requiredNow.has(key) ? "required" : hiddenNow.has(key) ? "off" : "optional";
  };
  const asks = APPLICANT_ASKS;
  // The video rows follow the video ask: nothing to set out for a role that
  // does not take videos.
  const [videoAsk, setVideoAsk] = useState(askValue("video"));

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
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

      <Fieldset
        legend="Casting call"
        description={
          role
            ? "A role stays with the casting call it was posted into, because submissions are recorded against it."
            : "The role takes its casting call details and its opening and closing times from here."
        }
      >
        {role ? (
          <div className="sm:col-span-2">
            <input type="hidden" name="sessionId" value={role.sessionId} />
            <p className="text-sm text-muted">
              Part of{" "}
              <a
                href={`/dashboard/sessions/${role.sessionId}`}
                className="text-brand underline-offset-4 hover:underline"
              >
                {sessions.find((session) => session.id === role.sessionId)?.name ??
                  role.production}
              </a>
              . Change its times on the casting call, not here.
            </p>
          </div>
        ) : (
          <Field
            label="Casting call"
            htmlFor="sessionId"
            hint="Every role in a casting call opens and closes with it."
            error={errors.sessionId}
            className="sm:col-span-2"
          >
            <Select
              id="sessionId"
              name="sessionId"
              defaultValue={values.sessionId ?? defaultSessionId ?? ""}
              required
            >
              <option value="" disabled>
                Choose a casting call
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}: {formatDateTime(session.opensAt)} to{" "}
                  {formatDateTime(session.closesAt)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Fieldset>

      <Fieldset legend="The role" description="Who you are looking for, and what the part asks of them.">
        <Field
          label="Role name"
          htmlFor="title"
          hint="As it appears in the script, with the size of the part."
          error={errors.title}
          className="sm:col-span-2"
        >
          <Input
            id="title"
            name="title"
            placeholder="Nell (Lead)"
            defaultValue={values.title ?? ""}
            required
          />
        </Field>
        <Field
          label="Character brief"
          htmlFor="characterBrief"
          error={errors.characterBrief}
          className="sm:col-span-2"
        >
          <Textarea
            id="characterBrief"
            name="characterBrief"
            rows={5}
            defaultValue={values.characterBrief ?? ""}
            required
          />
        </Field>
        <Field
          label="Requirements"
          htmlFor="requirements"
          hint="One per line. Skills, availability, anything that is not negotiable."
          error={errors.requirements}
          className="sm:col-span-2"
        >
          <Textarea
            id="requirements"
            name="requirements"
            rows={4}
            defaultValue={values.requirements ?? ""}
            placeholder={"Confident in open water\nAvailable for three weeks on location"}
          />
        </Field>
        <Field label="Playing age from" htmlFor="ageMin" error={errors.ageMin}>
          <Input
            id="ageMin"
            name="ageMin"
            type="number"
            min={5}
            max={100}
            defaultValue={values.ageMin ?? 18}
            required
          />
        </Field>
        <Field label="Playing age to" htmlFor="ageMax" error={errors.ageMax}>
          <Input
            id="ageMax"
            name="ageMax"
            type="number"
            min={5}
            max={100}
            defaultValue={values.ageMax ?? 35}
            required
          />
        </Field>
      </Fieldset>

      <Fieldset legend="Practicalities" description="What applicants need to know before they tape.">
        <Field label="Location" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            name="location"
            placeholder="Essex, UK"
            defaultValue={values.location ?? ""}
            required
          />
        </Field>
        <Field
          label="First shoot day"
          htmlFor="shootStartsAt"
          hint="Leave blank if the dates are not fixed yet."
          error={errors.shootStartsAt}
        >
          <DateTimeField
            id="shootStartsAt"
            name="shootStartsAt"
            label="First shoot day"
            mode="date"
            defaultValue={values.shootStartsAt ?? ""}
          />
        </Field>
        <Field
          label="Last shoot day"
          htmlFor="shootEndsAt"
          hint="Leave blank if it shoots on one day."
          error={errors.shootEndsAt}
        >
          <DateTimeField
            id="shootEndsAt"
            name="shootEndsAt"
            label="Last shoot day"
            mode="date"
            defaultValue={values.shootEndsAt ?? ""}
            align="end"
          />
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Checkbox
            name="selfTape"
            label="Self-tapes accepted"
            defaultChecked={role ? role.selfTape : state.status === "idle" || values.selfTape === "on"}
          />
          <Checkbox
            name="paid"
            label="This role is paid"
            defaultChecked={role ? role.paid : state.status === "idle" || values.paid === "on"}
          />
        </div>
      </Fieldset>

      <Fieldset
        legend="What applicants must send"
        description="Their name, email and age are always asked for, and every submission accepts the terms. Choose what else has to be there before a submission goes through, what is offered but can be left blank, and what is not asked for at all: the less you ask for, the less you hold."
      >
        <div className="divide-y divide-line sm:col-span-2">
          {asks.map((ask) => (
            <div
              key={ask.key}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
            >
              <span id={`ask-${ask.key}`} className="text-sm font-medium text-text">
                {ask.label}
              </span>
              <span
                role="radiogroup"
                aria-labelledby={`ask-${ask.key}`}
                className="inline-flex rounded-full border border-line-strong bg-raised p-0.5"
              >
                {ASK_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-muted transition-colors has-checked:bg-accent has-checked:font-semibold has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
                  >
                    <input
                      type="radio"
                      name={`ask_${ask.key}`}
                      value={option.value}
                      defaultChecked={askValue(ask.key) === option.value}
                      onChange={
                        ask.key === "video" ? (event) => setVideoAsk(event.currentTarget.value as typeof videoAsk) : undefined
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </span>
            </div>
          ))}
        </div>
        {!uploads ? (
          <p className="text-xs leading-relaxed text-muted sm:col-span-2">
            Photos and videos are only collected once the file store is connected. What you set
            here is kept until then.
          </p>
        ) : null}
        <MediaSlotsEditor
          initial={role?.mediaSlots ?? []}
          videoAsk={videoAsk}
          errors={errors}
          submitted={state.status === "idle" ? null : submitted}
        />
      </Fieldset>

      <Fieldset
        legend="Terms for applicants"
        description={
          role
            ? "Shown on the listing, and applicants tick to accept them. Changing them does not alter what anyone has already accepted, as that was recorded with their submission."
            : "Optional. Shown on the listing, and applicants tick to accept them before they can submit."
        }
      >
        <Field
          label="Terms"
          htmlFor="disclaimer"
          hint="Usage and buyout, what submitting does and does not commit either side to, how long you keep their details. Leave blank for none."
          error={errors.disclaimer}
          className="sm:col-span-2"
        >
          <Textarea
            id="disclaimer"
            name="disclaimer"
            rows={5}
            defaultValue={values.disclaimer ?? ""}
            placeholder="Usage is UK, all media, 12 months. The day rate does not include the buyout."
          />
        </Field>
      </Fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <SubmitButton disabled={pending}>
          {pending ? (role ? "Saving" : "Posting") : role ? "Save changes" : "Post the role"}
        </SubmitButton>
        <ButtonLink
          href={role ? `/dashboard/roles/${role.id}` : `/dashboard/sessions/${defaultSessionId ?? ""}`}
          variant="ghost"
          size="sm"
        >
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

/**
 * The videos a role asks for, set out one by one: what it is, what to do in
 * it, the longest it may run and whether it must be there. With none set
 * the form asks for one general tape. Rows are posted as slot_1_label and so
 * on; a slot_n_key keeps a row's identity when a role is edited, so a video
 * an applicant has already sent still answers the same slot.
 */
function MediaSlotsEditor({
  initial,
  videoAsk,
  errors,
  submitted,
}: {
  initial: MediaSlot[];
  videoAsk: "required" | "optional" | "off";
  errors: Record<string, string>;
  /** What was just posted after a refused save, or null when showing the role as it is. */
  submitted: Record<string, string> | null;
}) {
  const [rows, setRows] = useState<MediaSlot[]>(() => {
    if (!submitted) return initial;
    const posted: MediaSlot[] = [];
    for (let n = 1; n <= MAX_MEDIA_SLOTS; n += 1) {
      if (!(`slot_${n}_label` in submitted)) continue;
      posted.push({
        key: submitted[`slot_${n}_key`] || `slot_${n}`,
        label: submitted[`slot_${n}_label`] ?? "",
        brief: submitted[`slot_${n}_brief`] ?? "",
        maxSeconds: /^\d+$/.test(submitted[`slot_${n}_max`] ?? "") ? Number(submitted[`slot_${n}_max`]) : null,
        required: submitted[`slot_${n}_required`] === "on",
      });
    }
    return posted;
  });
  if (videoAsk === "off") return null;

  return (
    <div className="mt-2 flex flex-col gap-3 sm:col-span-2">
      <div>
        <p className="text-sm font-medium text-text">The videos</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Leave this empty to ask for one video, &ldquo;Self-tape or showreel&rdquo;, with no limit
          on its length. Or set out up to three, each with its own brief and limit: a monologue
          and a piece to camera, say. A limit is checked before the upload starts, so nobody sends
          a tape that is too long.
        </p>
      </div>
      {rows.map((row, index) => {
        const n = index + 1;
        return (
          <div key={row.key} className="rounded-xl border border-line bg-raised p-4">
            <input type="hidden" name={`slot_${n}_key`} value={row.key} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`Video ${n}: what it is`}
                htmlFor={`mediaSlots.${index}.label`}
                error={errors[`mediaSlots.${index}.label`]}
                className="sm:col-span-2"
              >
                <Input
                  id={`mediaSlots.${index}.label`}
                  name={`slot_${n}_label`}
                  defaultValue={row.label}
                  placeholder="A monologue of your choosing"
                  required
                />
              </Field>
              <Field
                label="What to do in it"
                htmlFor={`mediaSlots.${index}.brief`}
                hint="Shown above the upload."
                error={errors[`mediaSlots.${index}.brief`]}
                className="sm:col-span-2"
              >
                <Textarea
                  id={`mediaSlots.${index}.brief`}
                  name={`slot_${n}_brief`}
                  rows={3}
                  defaultValue={row.brief}
                  placeholder="Nothing from the production itself, in your own accent, up to 30 seconds."
                />
              </Field>
              <Field label="Longest it may run" htmlFor={`slot_${n}_max`}>
                <Select id={`slot_${n}_max`} name={`slot_${n}_max`} defaultValue={row.maxSeconds ?? ""}>
                  <option value="">No limit</option>
                  {SLOT_LENGTHS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {formatSeconds(seconds)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex flex-col justify-end gap-3">
                <Checkbox name={`slot_${n}_required`} label="Has to be sent" defaultChecked={row.required} />
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
                  className="self-start text-sm text-danger underline-offset-4 hover:underline"
                >
                  Remove this video
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {rows.length < MAX_MEDIA_SLOTS ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: `v${Date.now().toString(36)}`, label: "", brief: "", maxSeconds: null, required: true },
            ])
          }
        >
          {rows.length === 0 ? "Set out the videos" : "Add another video"}
        </Button>
      ) : null}
    </div>
  );
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <legend className="mb-2 text-lg font-semibold tracking-tight">{legend}</legend>
      <p className="text-sm text-muted">{description}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
