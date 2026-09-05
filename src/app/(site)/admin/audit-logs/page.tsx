import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";
import { HelpNote } from "@/components/help-note";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { Badge, Button, CARD, Eyebrow, Field, Input, STACK, SectionHead, Select, cx } from "@/components/ui";
import { ACTIONS, countAudit, listAudit, type Action } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit log",
  description: "Everything anyone did, with who, when and from where.",
};

const isAction = (value: unknown): value is Action =>
  typeof value === "string" && (ACTIONS as readonly string[]).includes(value);

/**
 * The whole trail, unscoped and unsorted by anything but time, with the
 * actor's address and the id of what they acted on.
 *
 * The activity pages elsewhere are for the people doing the work and are
 * scoped to what they may see. This one is the record: nothing is filtered
 * out for tidiness, nothing can be edited, and one box searches an email, an
 * id, an address or any words in what was recorded.
 */
export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const user = await requireUser("/admin/audit-logs");
  if (user.role !== "admin") notFound();

  const query = await searchParams;
  const action = isAction(query.action) ? query.action : null;
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const filter = { action, search: search || null };

  const total = await countAudit(filter);
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const entries = await listAudit({
    ...filter,
    limit: LIST_PAGE_SIZE,
    offset: (page - 1) * LIST_PAGE_SIZE,
  });

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (search) params.set("q", search);
    if (n > 1) params.set("page", String(n));
    const tail = params.toString();
    return `/admin/audit-logs${tail ? `?${tail}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/audit-logs")} />
      <AdminTabs pathname="/admin/audit-logs" />
      <HelpNote title="What this screen is for">
        <p
          dangerouslySetInnerHTML={{
            __html:
              'Everything anyone did, in the order it happened, with who did it, what they did it to, and the address it came from. Nothing here can be edited or removed.',
          }}
        />
        <p
          dangerouslySetInnerHTML={{
            __html:
              'One box searches it: an email finds that account&rsquo;s actions, an id finds everything done to that thing, and anything else is matched against the words.',
          }}
        />
      </HelpNote>

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Audit log</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Every action on the site, whoever took it, oldest at the bottom.
        </p>
      </div>

      <section className={cx(CARD, STACK)} aria-labelledby="log-heading">
        <SectionHead
          id="log-heading"
          title="The record"
          line={
            search || action
              ? `${total} ${total === 1 ? "entry matches" : "entries match"}.`
              : `${total} ${total === 1 ? "entry" : "entries"}, newest first.`
          }
          aside={
            search || action ? (
              <Link href="/admin/audit-logs" className="text-sm text-brand underline underline-offset-4 hover:text-brand-hover">
                Clear the search
              </Link>
            ) : null
          }
        />

        <form method="get" action="/admin/audit-logs" className="mt-5 flex flex-wrap items-end gap-3">
          <Field
            label="Search"
            htmlFor="q"
            hint="An email, an id, an address, or any words."
            required={false}
            className="min-w-64 flex-1"
          >
            <Input id="q" name="q" defaultValue={search} placeholder="someone@example.com" />
          </Field>
          <Field label="Action" htmlFor="action" required={false} className="min-w-56">
            <Select id="action" name="action" defaultValue={action ?? ""}>
              <option value="">Every action</option>
              {ACTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {entries.length > 0 ? (
          <>
            <div className="relative mt-5 -mx-4 overflow-x-auto border-y border-line bg-surface sm:mx-0 sm:rounded-xl sm:border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">When</th>
                    <th scope="col" className="px-4 py-3 font-medium">Who</th>
                    <th scope="col" className="px-4 py-3 font-medium">Did what</th>
                    <th scope="col" className="px-4 py-3 font-medium">To what</th>
                    <th scope="col" className="px-4 py-3 font-medium">From</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-40 truncate" title={entry.actorName}>
                          {entry.actorName}
                        </span>
                        {entry.actorEmail ? (
                          <Link
                            href={`/admin/audit-logs?q=${encodeURIComponent(entry.actorEmail)}`}
                            className="block max-w-40 truncate text-xs text-muted underline-offset-4 hover:text-brand hover:underline"
                            title={entry.actorEmail}
                          >
                            {entry.actorEmail}
                          </Link>
                        ) : (
                          <span className="text-xs text-faint">no account</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="outline">{entry.action}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-80 text-muted wrap-anywhere">
                          {entry.detail || entry.roleTitle || "—"}
                        </span>
                        {entry.subjectId || entry.roleId ? (
                          <Link
                            href={`/admin/audit-logs?q=${encodeURIComponent(entry.subjectId ?? entry.roleId ?? "")}`}
                            className="mt-0.5 block font-mono text-xs text-faint underline-offset-4 hover:text-brand hover:underline"
                          >
                            {entry.subjectId ?? entry.roleId}
                          </Link>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted">
                        {entry.actorIp ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} pageSize={LIST_PAGE_SIZE} href={pageHref} />
          </>
        ) : (
          <p className="mt-5 text-sm text-muted">
            {search || action
              ? "Nothing matches. Clear the search to see everything."
              : "Nothing has been recorded yet."}
          </p>
        )}
      </section>
    </div>
  );
}
