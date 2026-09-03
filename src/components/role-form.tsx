"use client";

import { useActionState, useState } from "react";

import { editRole, postRole } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { IDLE_FORM_STATE } from "@/lib/form-state";
import {
  APPLICANT_ASKS,
  DEFAULT_HIDDEN_FIELDS,
  DEFAULT_REQUIRED_FIELDS,
  MAX_MEDIA_SLOTS,
  SLOT_LENGTHS,
  SPECIAL_KINDS,
} from "@/lib/types";
import type { AskKey, CastingSession, MediaSlot, Role } from "@/lib/types";
import { formatSeconds } from "@/lib/video";

import { BriefLint } from "./brief-lint";
import { DateTimeField } from "./date-time-field";
import { SubmitButton } from "./submit-button";
import {
  Button,
  ButtonLink,
  Checkbox,
  ErrorSummary,
  Field,
  Input,
  RequiredKey,
  Select,
  Textarea,
} from "./ui";
import { useErrorFocus } from "./use-error-focus";

const LABELS: Record<string, string> = {
  specialKind: "What the question is about",
  specialQuestion: "The question",
  specialJustification: "The occupational requirement",
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

/** The three settings a director can give each of the applicant's fields. */
type AskSetting = "required" | "optional" | "off";

const ASK_OPTIONS: { value: AskSetting; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "off", label: "Not asked" },
];

/** What a role asks for unless the director says otherwise. */
function defaultAsk(key: AskKey): AskSetting {
  if (DEFAULT_REQUIRED_FIELDS.includes(key)) return "required";
  if (DEFAULT_HIDDEN_FIELDS.includes(key)) return "off";
  return "optional";
}

/** "a, b and c", for a summary line. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * One form for posting and editing. In edit mode the fields fall back to the
 * role's current values, and the action rewrites in place rather than creating.
 * Nothing about the casting call is asked for here: a role takes its casting
 * call's name, type, synopsis, company and dates from the casting call it is
 * posted into.
 *
 * The listing is the form: the casting call, a name, the brief, a playing
 * age, where it shoots and when, whether it is paid. What the applicant's
 * response asks for beyond that has a default that suits most roles and sits
 * folded under "Advanced options", each fold saying on one line what it is
 * set to, so a director who wants the defaults never opens one. A fold opens
 * itself when what it holds is not the default, or when a refused save left
 * an error inside it, so nothing chosen is ever out of sight.
 */
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
          specialKind: role.specialQuestion?.kind ?? "",
          specialQuestion: role.specialQuestion?.question ?? "",
          specialJustification: role.specialQuestion?.justification ?? "",
        }
      : submitted;

  // Each of the applicant's fields, as the role has it, the default for a new
  // one, or what was just posted after a refused save.
  const requiredNow = new Set<AskKey>(role ? role.requiredFields : DEFAULT_REQUIRED_FIELDS);
  const hiddenNow = new Set<AskKey>(role ? role.hiddenFields : DEFAULT_HIDDEN_FIELDS);
  const askAtStart = (key: AskKey): AskSetting => {
    if (state.status !== "idle") {
      const sent = submitted[`ask_${key}`];
      return sent === "required" || sent === "off" ? sent : "optional";
    }
    return requiredNow.has(key) ? "required" : hiddenNow.has(key) ? "off" : "optional";
  };
  const paidAtStart = state.status === "idle" ? (role ? role.paid : true) : values.paid === "on";
  const selfTapeAtStart =
    state.status === "idle" ? (role ? role.selfTape : true) : values.selfTape === "on";
  const slotsAtStart =
    state.status === "idle"
      ? (role?.mediaSlots.length ?? 0)
      : Object.keys(submitted).filter((key) => /^slot_\d+_label$/.test(key)).length;

  // The settings the folds summarise, kept up to date as they are changed.
  const [asks, setAsks] = useState<Record<AskKey, AskSetting>>(
    () =>
      Object.fromEntries(APPLICANT_ASKS.map((ask) => [ask.key, askAtStart(ask.key)])) as Record<
        AskKey,
        AskSetting
      >,
  );
  const [hasTerms, setHasTerms] = useState(Boolean(values.disclaimer));
  const [specialKind, setSpecialKind] = useState(values.specialKind ?? "");

  // Which folds start open: any holding a setting that is not the default. A
  // fold is only ever told to open, never to close, so the ones the director
  // opens or closes stay as they left them.
  const errorIn = (test: (key: string) => boolean) => Object.keys(errors).some(test);
  const [open, setOpen] = useState(() => ({
    asks: APPLICANT_ASKS.some((ask) => asks[ask.key] !== defaultAsk(ask.key)) || slotsAtStart > 0,
    terms: hasTerms,
    special: Boolean(values.specialKind),
  }));

  // React resets the form once the action returns. A text input takes its
  // value back from defaultValue, but a select holds whatever the reset left,
  // which is the option it mounted with. The selects are remounted per
  // attempt, so a refused save keeps the characteristic and the video limits
  // that were chosen. The same moment opens any fold with an error in it.
  const [seen, setSeen] = useState(state);
  const [attempt, setAttempt] = useState(0);
  if (seen !== state) {
    setSeen(state);
    setAttempt(attempt + 1);
    setOpen((current) => ({
      asks: current.asks || errorIn((key) => key.startsWith("mediaSlots.")),
      terms: current.terms || "disclaimer" in errors,
      special: current.special || errorIn((key) => key.startsWith("special")),
    }));
  }

  const askSummary = (setting: AskSetting) =>
    listOf(APPLICANT_ASKS.filter((ask) => asks[ask.key] === setting).map((ask) => lower(ask.label)));
  const required = askSummary("required");
  const optional = askSummary("optional");
  const notAsked = askSummary("off");

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

      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
        <legend className="mb-2 text-lg font-semibold tracking-tight">The role</legend>
        <p className="text-sm text-muted">
          What the listing says: who you are looking for, where it shoots and when.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
              hint="The role opens and closes with it."
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
            hint="The clearer the brief, the fewer wrong submissions you read."
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
              rows={3}
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
          <Field
            label="Location"
            htmlFor="location"
            error={errors.location}
            className="sm:col-span-2"
          >
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
          <div className="flex flex-wrap gap-x-8 gap-y-3 sm:col-span-2">
            <Checkbox name="paid" label="This role is paid" defaultChecked={paidAtStart} />
            <Checkbox name="selfTape" label="Self-tapes accepted" defaultChecked={selfTapeAtStart} />
          </div>
        </div>
      </fieldset>

      <section aria-labelledby="advanced-options" className="flex flex-col gap-3">
        <div>
          <h2 id="advanced-options" className="text-lg font-semibold tracking-tight">
            Advanced options
          </h2>
          <p className="mt-1 text-sm text-muted">
            What an applicant&rsquo;s response asks for, beyond their name, email and age. Each is
            set to what suits most roles; open one only to change it.
          </p>
        </div>

        <Fold
          id="asks"
          title="What applicants must send"
          summary={`Required: ${required || "nothing more"}. Optional: ${optional || "nothing"}. Not asked: ${notAsked || "nothing"}.`}
          open={open.asks}
        >
          <p className="text-sm text-muted sm:col-span-2">
            Their name, email and age are always asked for, and every submission accepts the
            terms. The less you ask for, the less you hold.
          </p>
          <div className="divide-y divide-line sm:col-span-2">
            {APPLICANT_ASKS.map((ask) => (
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
                        defaultChecked={askAtStart(ask.key) === option.value}
                        onChange={() =>
                          setAsks((current) => ({ ...current, [ask.key]: option.value }))
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
              Photos and videos are only collected once the file store is connected. What you
              set here is kept until then.
            </p>
          ) : null}
          <MediaSlotsEditor
            initial={role?.mediaSlots ?? []}
            attempt={attempt}
            videoAsk={asks.video}
            errors={errors}
            submitted={state.status === "idle" ? null : submitted}
          />
        </Fold>

        <Fold
          id="terms"
          title="Terms applicants accept"
          summary={hasTerms ? "Set. Applicants tick to accept them before they can submit." : "None. Every submission still accepts the site's terms of submission."}
          open={open.terms}
        >
          <Field
            label="Terms for applicants"
            htmlFor="disclaimer"
            hint={
              role
                ? "Shown on the listing, and applicants tick to accept them. Changing them does not alter what anyone has already accepted, as that was recorded with their submission."
                : "Shown on the listing, and applicants tick to accept them before they can submit. Usage and buyout, what submitting commits either side to, how long you keep their details."
            }
            error={errors.disclaimer}
            className="sm:col-span-2"
          >
            <Textarea
              id="disclaimer"
              name="disclaimer"
              rows={5}
              defaultValue={values.disclaimer ?? ""}
              placeholder="Usage is UK, all media, 12 months. The day rate does not include the buyout."
              onChange={(event) => setHasTerms(event.currentTarget.value.trim().length > 0)}
            />
          </Field>
        </Fold>

        <Fold
          id="special"
          title="A question about a protected characteristic"
          summary={
            specialKind
              ? `Asks about ${lower(SPECIAL_KINDS.find((option) => option.key === specialKind)?.label ?? specialKind)}.`
              : "None. Only for a part that genuinely requires it."
          }
          open={open.special}
        >
          <p className="text-sm text-muted sm:col-span-2">
            A role cast to an ethnicity, a faith or a disability, say. The law allows the
            question where there is an occupational requirement, so the requirement is recorded
            here with the question. The answer is held apart from the rest of a submission, seen
            only by you and the site administrator, and deleted 30 days after casting closes.
          </p>
          <Field
            label="What it is about"
            htmlFor="specialKind"
            hint="Leave as none to ask nothing."
            error={errors.specialKind}
          >
            <Select
              key={`kind-${attempt}`}
              id="specialKind"
              name="specialKind"
              defaultValue={values.specialKind ?? ""}
              onChange={(event) => setSpecialKind(event.currentTarget.value)}
            >
              <option value="">None</option>
              {SPECIAL_KINDS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          {specialKind ? (
            <>
              <Field
                label="The question"
                htmlFor="specialQuestion"
                hint="As the applicant will read it."
                error={errors.specialQuestion}
                className="sm:col-span-2"
              >
                <Input
                  id="specialQuestion"
                  name="specialQuestion"
                  defaultValue={values.specialQuestion ?? ""}
                  placeholder="Do you have Jewish heritage?"
                  required
                />
              </Field>
              <Field
                label="The occupational requirement"
                htmlFor="specialJustification"
                hint="Why this role may ask: the requirement of the part, under Schedule 9 of the Equality Act 2010, that makes the characteristic essential to it. Kept as the record of the decision. Applicants are told the question is asked under a recorded requirement, not this wording."
                error={errors.specialJustification}
                className="sm:col-span-2"
              >
                <Textarea
                  id="specialJustification"
                  name="specialJustification"
                  rows={4}
                  defaultValue={values.specialJustification ?? ""}
                  placeholder="The character is written as Jewish and the story turns on that heritage; the production requires the part to be played by an actor who shares it."
                  required
                />
              </Field>
            </>
          ) : null}
        </Fold>
      </section>

      <BriefLint />

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
 * One of the folded sections under "Advanced options": a title, a line saying
 * what it is set to, and the fields behind them. The fields are in the form
 * whether the fold is open or not, so the defaults are always posted.
 */
function Fold({
  id,
  title,
  summary,
  open,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      data-more={id}
      open={open}
      className="group rounded-2xl border border-line bg-surface shadow-card"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-1 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold tracking-tight text-text">{title}</span>
        <span className="text-sm text-muted group-open:hidden">{summary}</span>
        <span className="ml-auto text-xs text-faint group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-faint group-open:inline">Hide</span>
      </summary>
      <div
        role="group"
        aria-label={title}
        className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-6"
      >
        {children}
      </div>
    </details>
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
  attempt,
  videoAsk,
  errors,
  submitted,
}: {
  initial: MediaSlot[];
  /** Changes with every refused save; the selects remount on it. */
  attempt: number;
  videoAsk: AskSetting;
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
                <Select key={`max-${row.key}-${attempt}`} id={`slot_${n}_max`} name={`slot_${n}_max`} defaultValue={row.maxSeconds ?? ""}>
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
