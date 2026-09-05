import { Button, ButtonLink, Field, Input, Select } from "./ui";

/**
 * Narrowing a list of submissions by what the part needs, folded away until
 * it is wanted.
 *
 * Four fields open is four fields tall, which on a phone is the whole screen
 * and pushes the submissions — the thing the director came for — below the
 * fold. So it starts as one control the height of a chip: a funnel, the word
 * Filter, and, once something is set, what it is set to and how many match.
 * It opens itself when the list is already narrowed, because a list quietly
 * hiding people is worse than a tall page.
 *
 * A native `<details>` and a plain GET form, so it works with no script, the
 * result is a URL that can be sent to a colleague, and the back button undoes
 * it. The filtering happens in the database, so it holds at a thousand
 * submissions as well as at ten.
 */
export function SubmissionFilters({
  action,
  status,
  ageMin,
  ageMax,
  location,
  free,
  matching,
  total,
  clearHref,
}: {
  /** Where the form posts: the page it is on. */
  action: string;
  /** The status chip in force, carried through so filtering does not drop it. */
  status: string | null;
  ageMin: number | null;
  ageMax: number | null;
  location: string;
  free: "yes" | "no" | null;
  /** How many match what is set now. */
  matching: number;
  /** How many there are before narrowing, within the status in force. */
  total: number;
  /** The same list with every filter dropped. */
  clearHref: string;
}) {
  // What is set, said the way a person would say it, for the closed control.
  const applied = [
    ageMin !== null || ageMax !== null
      ? ageMin !== null && ageMax !== null
        ? `${ageMin}–${ageMax}`
        : ageMin !== null
          ? `${ageMin} and over`
          : `${ageMax} and under`
      : null,
    location ? location : null,
    free === "yes" ? "free for the shoot" : free === "no" ? "not free for the shoot" : null,
  ].filter((part): part is string => part !== null);
  const narrowed = applied.length > 0;

  return (
    <details
      data-more="filters"
      open={narrowed}
      className="group mt-4 rounded-xl border border-line bg-surface open:border-accent"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:min-h-10 ${
            narrowed
              ? "border-accent bg-accent-soft text-text"
              : "border-line text-muted group-hover:border-accent group-hover:text-text"
          }`}
        >
          <Funnel />
          Filter
          {narrowed ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
              {applied.length}
            </span>
          ) : null}
        </span>
        {narrowed ? (
          <span className="min-w-0 text-sm text-muted group-open:hidden">
            <span className="text-text">{applied.join(" · ")}</span> — {matching} of {total} match
          </span>
        ) : (
          // On a phone the control is the whole point: one row, and the
          // submissions right under it. The line saying what can be filtered
          // is for a screen with room for it.
          <span className="hidden text-sm text-muted group-open:hidden sm:inline">
            By age, where they are based, or whether they are free for the shoot.
          </span>
        )}
        <span className="ml-auto text-xs text-faint group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-faint group-open:inline">Hide</span>
      </summary>

      <form
        method="get"
        action={action}
        className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
      >
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Field label="Age from" htmlFor="ageMin" required={false}>
          <Input
            id="ageMin"
            name="ageMin"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            defaultValue={ageMin === null ? "" : String(ageMin)}
          />
        </Field>
        <Field label="Age to" htmlFor="ageMax" required={false}>
          <Input
            id="ageMax"
            name="ageMax"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            defaultValue={ageMax === null ? "" : String(ageMax)}
          />
        </Field>
        <Field
          label="Based near"
          htmlFor="where"
          hint="Part of a town or city is enough."
          required={false}
        >
          <Input id="where" name="where" defaultValue={location} maxLength={60} />
        </Field>
        <Field label="Free for the shoot" htmlFor="free" required={false}>
          <Select id="free" name="free" defaultValue={free ?? ""}>
            <option value="">Anyone</option>
            <option value="yes">Confirmed the dates</option>
            <option value="no">Did not</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm">
            Narrow the list
          </Button>
          {narrowed ? (
            <>
              <ButtonLink href={clearHref} variant="secondary" size="sm">
                Clear
              </ButtonLink>
              <p role="status" className="text-sm text-muted">
                {matching} of {total} match.
              </p>
            </>
          ) : null}
        </div>
      </form>
    </details>
  );
}

/** The funnel every list on every other tool uses, so nobody has to learn it. */
function Funnel() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  );
}
