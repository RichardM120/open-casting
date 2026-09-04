import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { HelpNote } from "@/components/help-note";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { Badge, Button, CARD, cx, Eyebrow, Field, Input, SectionHead, Select } from "@/components/ui";
import { adminSetCallLimits, adminSetCallState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { formatDateTime, toLocalInput } from "@/lib/format";
import { countAllCalls, listAllCalls, type CallState } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description: "Every casting call on the site, and what state it is in.",
};

/** The states a call can be in, in the order they happen. */
const STATES: { key: CallState; label: string; tone: "neutral" | "accent" | "positive" | "amber" | "danger" | "outline" }[] = [
  { key: "draft", label: "Draft", tone: "outline" },
  { key: "scheduled", label: "Not open yet", tone: "accent" },
  { key: "open", label: "Open", tone: "positive" },
  { key: "full", label: "Full", tone: "amber" },
  { key: "closed", label: "Closed", tone: "neutral" },
  { key: "purged", label: "Details destroyed", tone: "danger" },
];

const STATE_KEYS = STATES.map((state) => state.key);
const isState = (value: unknown): value is CallState =>
  typeof value === "string" && (STATE_KEYS as string[]).includes(value);
const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Every casting call on the site, whoever opened it: what it is, who it is
 * for, how many submissions it has taken against whatever cap it has, when it
 * closes, and what state it is in. Filtered by client, by state and by closing
 * date, and paged like every other long list.
 *
 * The point of it is the row's own controls. A call taking more than the team
 * can read is paused from here without having to be the account that opened
 * it, and the cap and the closing time are set in the same place, so the
 * answer to "this is running away" is one screen rather than a phone call.
 */
export default async function ProjectsPage({ searchParams }: PageProps<"/admin/projects">) {
  const user = await requireUser("/admin/projects");
  if (user.role !== "admin") notFound();

  const [query, clients] = await Promise.all([searchParams, listClients()]);

  const clientId = typeof query.client === "string" && query.client ? query.client : null;
  const state = isState(query.state) ? query.state : null;
  const from = isDate(query.from) ? query.from : null;
  const to = isDate(query.to) ? query.to : null;
  const filter = { clientId, state, from, to };

  const { total, byState } = await countAllCalls(filter);
  const matching = state ? byState[state] : total;
  const pages = Math.max(1, Math.ceil(matching / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const calls = await listAllCalls({
    ...filter,
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  /** This page's URL with one thing changed, so a filter keeps the others. */
  const href = (changes: Record<string, string | null>) => {
    const search = new URLSearchParams();
    const current: Record<string, string | null> = {
      client: clientId,
      state,
      from,
      to,
      ...changes,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) search.set(key, value);
    }
    const tail = search.toString();
    return `/admin/projects${tail ? `?${tail}` : ""}`;
  };
  const pageHref = (n: number) => {
    const base = href({});
    if (n <= 1) return base;
    return `${base}${base.includes("?") ? "&" : "?"}page=${n}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Breadcrumb trail={[{ href: "/admin", label: "Admin" }, { label: "Projects" }]} />
      <HelpNote title="What this screen is for">
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Every casting call on the site, whoever opened it, with what it has taken against its cap and when it closes.',
          }}
        />
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Pause one that is taking more than its team can read, or set a cap so it stops on its own. Both are recorded in the activity trail against you.',
          }}
        />
      </HelpNote>

      {query.changed === "1" ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          Saved. The casting call is on its new footing straight away.
        </p>
      ) : null}
      {query.bad ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {query.bad === "cap"
            ? "A cap has to be a whole number, or left blank for no cap."
            : "That closing time could not be read."}
        </p>
      ) : null}

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Projects</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {total} {total === 1 ? "casting call" : "casting calls"} across every client.{" "}
          {byState.open} open, {byState.full} full, {byState.draft} still a draft.
        </p>
      </div>

      <section className={cx(CARD, "mt-8")} aria-labelledby="filter-heading">
        <SectionHead
          id="filter-heading"
          title="Narrow it down"
          line="By client, by where the call is in its life, and by when it closes."
          aside={
            clientId || state || from || to ? (
              <Link href="/admin/projects" className="text-sm text-brand underline-offset-4 hover:underline">
                Clear the filters
              </Link>
            ) : null
          }
        />
        <nav aria-label="By state" className="mt-5 flex flex-wrap gap-2 text-sm">
          <Link
            href={href({ state: null })}
            aria-current={state === null ? "page" : undefined}
            className={cx(
              "inline-flex min-h-10 items-center rounded-full border px-4 py-2 whitespace-nowrap transition-colors",
              state === null
                ? "border-accent bg-accent-soft font-medium text-text"
                : "border-line text-muted hover:border-accent hover:text-text",
            )}
          >
            All · {total}
          </Link>
          {STATES.map((entry) => (
            <Link
              key={entry.key}
              href={href({ state: entry.key })}
              aria-current={state === entry.key ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center rounded-full border px-4 py-2 whitespace-nowrap transition-colors",
                state === entry.key
                  ? "border-accent bg-accent-soft font-medium text-text"
                  : "border-line text-muted hover:border-accent hover:text-text",
              )}
            >
              {entry.label} · {byState[entry.key]}
            </Link>
          ))}
        </nav>

        {/* A plain GET form: the filters are in the URL, so a filtered list can
            be linked to and comes back the same on a reload. */}
        <form method="get" action="/admin/projects" className="mt-5 grid gap-4 sm:grid-cols-4">
          {state ? <input type="hidden" name="state" value={state} /> : null}
          <Field label="Client" htmlFor="client" required={false}>
            <Select id="client" name="client" defaultValue={clientId ?? ""}>
              <option value="">Every client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Closes from" htmlFor="from" required={false}>
            <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
          </Field>
          <Field label="Closes to" htmlFor="to" required={false}>
            <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </div>
        </form>
      </section>

      <section className={cx(CARD, "mt-8")} aria-labelledby="calls-heading">
        <SectionHead
          id="calls-heading"
          title="Casting calls"
          line={
            matching === 0
              ? "Nothing matches those filters."
              : `${matching} ${matching === 1 ? "call" : "calls"}, the ones closing soonest last.`
          }
        />

        {calls.length > 0 ? (
          <>
            <div className="relative mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">Casting call</th>
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Submissions</th>
                    <th scope="col" className="px-4 py-3 font-medium">Closes</th>
                    <th scope="col" className="px-4 py-3 font-medium">State</th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const badge = STATES.find((entry) => entry.key === call.state)!;
                    const share =
                      call.submissionCap === null
                        ? null
                        : Math.min(100, Math.round((call.submissions / call.submissionCap) * 100));
                    return (
                      <tr key={call.id} className="border-b border-line align-top last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/sessions/${call.id}`}
                            className="block max-w-64 truncate font-medium text-brand underline-offset-4 hover:underline"
                            title={call.name}
                          >
                            {call.name}
                          </Link>
                          <span className="block text-xs text-muted">
                            {call.roles} {call.roles === 1 ? "role" : "roles"}
                            {call.ownerName ? ` · ${call.ownerName}` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {call.clientId ? (
                            <Link
                              href={`/admin/clients/${call.clientId}`}
                              className="block max-w-40 truncate underline-offset-4 hover:text-brand hover:underline"
                              title={call.clientName ?? call.company}
                            >
                              {call.clientName ?? call.company}
                            </Link>
                          ) : (
                            <span className="text-muted">{call.company}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          <Link
                            href={`/dashboard/sessions/${call.id}`}
                            className="underline-offset-4 hover:text-brand hover:underline"
                          >
                            {call.submissions}
                            {call.submissionCap === null ? "" : ` / ${call.submissionCap}`}
                          </Link>
                          {share !== null ? (
                            <span
                              className={cx(
                                "ml-2 text-xs",
                                share >= 100 ? "text-danger" : share >= 90 ? "text-amber" : "text-faint",
                              )}
                            >
                              {share}%
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {formatDateTime(call.closesAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {call.state === "draft" ? (
                              <form action={adminSetCallState}>
                                <input type="hidden" name="sessionId" value={call.id} />
                                <input type="hidden" name="to" value="publish" />
                                <Button type="submit" size="sm" disabled={call.roles === 0}>
                                  Publish
                                </Button>
                              </form>
                            ) : null}
                            {call.state === "open" || call.state === "full" || call.state === "scheduled" ? (
                              <form action={adminSetCallState}>
                                <input type="hidden" name="sessionId" value={call.id} />
                                <input type="hidden" name="to" value="pause" />
                                <Button type="submit" variant="danger" size="sm">
                                  Pause
                                </Button>
                              </form>
                            ) : null}
                            {call.state === "closed" && call.closedAt ? (
                              <form action={adminSetCallState}>
                                <input type="hidden" name="sessionId" value={call.id} />
                                <input type="hidden" name="to" value="reopen" />
                                <Button type="submit" variant="secondary" size="sm">
                                  Reopen
                                </Button>
                              </form>
                            ) : null}
                          </div>
                          {call.state === "purged" ? null : (
                            <details className="mt-2 text-xs" data-more={`edit-${call.id}`}>
                              <summary className="cursor-pointer text-right text-muted underline-offset-4 hover:text-text hover:underline">
                                Cap and closing time
                              </summary>
                              <form
                                action={adminSetCallLimits}
                                className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-raised p-3 text-left"
                              >
                                <input type="hidden" name="sessionId" value={call.id} />
                                <Field
                                  label="Submission cap"
                                  htmlFor={`cap-${call.id}`}
                                  hint="Blank for no cap."
                                  required={false}
                                >
                                  <Input
                                    id={`cap-${call.id}`}
                                    name="submissionCap"
                                    type="number"
                                    min="0"
                                    defaultValue={call.submissionCap === null ? "" : String(call.submissionCap)}
                                  />
                                </Field>
                                <Field label="Closes" htmlFor={`closes-${call.id}`} required={false}>
                                  <Input
                                    id={`closes-${call.id}`}
                                    name="closesAt"
                                    type="datetime-local"
                                    defaultValue={toLocalInput(call.closesAt)}
                                  />
                                </Field>
                                <Button type="submit" variant="secondary" size="sm">
                                  Save
                                </Button>
                              </form>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={matching} pageSize={LIST_PAGE_SIZE} href={pageHref} />
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {total === 0
              ? "No casting call has been opened yet."
              : "Nothing matches those filters. Clear them to see everything."}
          </p>
        )}
      </section>
    </div>
  );
}
