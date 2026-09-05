import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { AdminTabs } from "@/components/admin-tabs";
import { adminTrail } from "@/lib/admin-nav";
import { AdminAlertBar } from "@/components/admin-alert-bar";
import { LIST_PAGE_SIZE, Pagination, pageNumber } from "@/components/pagination";
import { Badge, Button, CARD, cx, Eyebrow, Field, Input, SectionHead, Textarea } from "@/components/ui";
import { saveEmailTemplate } from "@/lib/actions";
import { adminAlerts, alertsFor } from "@/lib/admin-alerts";
import { requireUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import {
  PLACEHOLDERS,
  TEMPLATES,
  allTemplates,
  countMessages,
  listMessages,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications",
  description: "The automated emails, and what has been sent.",
};

/**
 * The messages the app sends on its own, and the record of what it sent.
 *
 * Two halves: the wording of each automated email, which can be changed here
 * without a deployment and put back to what ships; and every message the app
 * has tried to send, with whether it got there. The second half is what
 * answers "they say they never heard from us".
 */
export default async function NotificationsPage({
  searchParams,
}: PageProps<"/admin/notifications">) {
  const user = await requireUser("/admin/notifications");
  const alerts = await adminAlerts(user);
  if (user.role !== "admin") notFound();

  const query = await searchParams;
  const tab = query.tab === "log" ? "log" : "templates";

  const [templates, counts] = await Promise.all([allTemplates(), countMessages()]);
  const pages = Math.max(1, Math.ceil(counts.total / LIST_PAGE_SIZE));
  const page = Math.min(pageNumber(query.page), pages);
  const messages =
    tab === "log"
      ? await listMessages({ limit: LIST_PAGE_SIZE, offset: (page - 1) * LIST_PAGE_SIZE })
      : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumb trail={adminTrail("/admin/notifications")} />
      <AdminTabs pathname="/admin/notifications" alerts={alerts} />
      <AdminAlertBar alerts={alertsFor(alerts, "/admin/notifications")} scope="notifications" />

      {query.done ? (
        <p role="status" className="mt-6 rounded-2xl border border-line bg-positive-soft px-4 py-3 text-sm text-positive">
          {query.done === "reset" ? "Put back to the wording that ships with the app." : "Saved. The next message uses it."}
        </p>
      ) : null}
      {query.bad === "short" ? (
        <p role="alert" className="mt-6 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          A subject and a body are both needed. Nothing was changed.
        </p>
      ) : null}

      <div className="mt-6">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Notifications</h1>
        <p className="mt-3 max-w-2xl text-muted">
          What the app sends on its own, and what became of it.
        </p>
      </div>

      {!emailConfigured() ? (
        <p className="mt-6 rounded-2xl border-2 border-danger bg-surface p-4 text-sm leading-relaxed text-text sm:p-6">
          <strong>No mail provider is configured</strong>, so none of these are being sent.
          Everything below is still recorded, and the log shows each attempt with the reason it
          did not go.
        </p>
      ) : null}

      <nav aria-label="Notifications" className="mt-8 flex flex-wrap gap-2 text-sm">
        {[
          { key: "templates", label: "What is sent" },
          { key: "log", label: `Delivery log · ${counts.total}` },
        ].map((entry) => (
          <Link
            key={entry.key}
            href={entry.key === "templates" ? "/admin/notifications" : "/admin/notifications?tab=log"}
            aria-current={tab === entry.key ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full border px-4 py-2 whitespace-nowrap transition-colors sm:min-h-10",
              tab === entry.key
                ? "border-accent bg-accent-soft font-medium text-text"
                : "border-line text-muted hover:border-accent hover:text-text",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {tab === "templates" ? (
        <div className="mt-6 flex flex-col gap-6">
          {templates.map((template) => {
            const about = TEMPLATES[template.key];
            return (
              <section
                key={template.key}
                className={cx(CARD)}
                aria-labelledby={`t-${template.key}`}
              >
                <SectionHead
                  id={`t-${template.key}`}
                  title={about.label}
                  line={about.who}
                  aside={
                    template.updatedAt ? (
                      <Badge tone="accent">Changed {formatDateTime(template.updatedAt)}</Badge>
                    ) : (
                      <Badge tone="outline">As it ships</Badge>
                    )
                  }
                />
                <form action={saveEmailTemplate} className="mt-5 flex flex-col gap-4">
                  <input type="hidden" name="key" value={template.key} />
                  <Field label="Subject" htmlFor={`subject-${template.key}`}>
                    <Input
                      id={`subject-${template.key}`}
                      name="subject"
                      defaultValue={template.subject}
                      required
                    />
                  </Field>
                  <Field label="Body" htmlFor={`body-${template.key}`}>
                    <Textarea
                      id={`body-${template.key}`}
                      name="body"
                      rows={10}
                      defaultValue={template.body}
                      required
                    />
                  </Field>
                  <p className="text-xs leading-relaxed text-muted">
                    What you can put in it:{" "}
                    {about.placeholders.map((name, index) => (
                      <span key={name}>
                        {index > 0 ? ", " : ""}
                        <code className="rounded bg-raised px-1 py-0.5">{`{{${name}}}`}</code>{" "}
                        {PLACEHOLDERS[name].toLowerCase()}
                      </span>
                    ))}
                    . Anything else is left as it reads, so a mistake shows rather than
                    disappearing.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="sm">
                      Save the wording
                    </Button>
                    {template.updatedAt ? (
                      <Button type="submit" name="reset" value="1" variant="ghost" size="sm">
                        Put it back
                      </Button>
                    ) : null}
                  </div>
                </form>
              </section>
            );
          })}

          <section className={cx(CARD)} aria-labelledby="replies-heading">
            <SectionHead
              id="replies-heading"
              title="Where replies go"
              line="An applicant who replies should reach the casting team, not somebody's own inbox."
            />
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">
              With <code className="rounded bg-raised px-1 py-0.5">INBOUND_EMAIL_DOMAIN</code> set,
              each message carries a reply-to of{" "}
              <code className="rounded bg-raised px-1 py-0.5">role-&lt;id&gt;@that-domain</code>,
              which names the role without naming a person. Routing those to the casting team
              needs an inbound service listening on the domain. Until one is set up there is no
              reply-to at all, and nobody&rsquo;s address is exposed by the app.
            </p>
          </section>
        </div>
      ) : (
        <section className={cx(CARD, "mt-6")} aria-labelledby="log-heading">
          <SectionHead
            id="log-heading"
            title="Delivery log"
            line={
              counts.total === 0
                ? "Nothing has been sent yet."
                : `${counts.total} tried, ${counts.failed} of them did not go.`
            }
            aside={counts.failed > 0 ? <Badge tone="danger">{counts.failed} failed</Badge> : null}
          />
          {messages.length > 0 ? (
            <>
              <div className="relative mt-5 -mx-4 overflow-x-auto border-y border-line bg-surface sm:mx-0 sm:rounded-xl sm:border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="px-4 py-3 font-medium">When</th>
                      <th scope="col" className="px-4 py-3 font-medium">To</th>
                      <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                      <th scope="col" className="px-4 py-3 font-medium">Why</th>
                      <th scope="col" className="px-4 py-3 font-medium">Got there</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr key={message.id} className="border-b border-line align-top last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {formatDateTime(message.sentAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block max-w-56 truncate" title={message.recipient}>
                            {message.recipient}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block max-w-72 truncate" title={message.subject}>
                            {message.subject}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="outline">{message.trigger}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {message.delivered ? (
                            <Badge tone="positive">Sent</Badge>
                          ) : (
                            <>
                              <Badge tone="danger">Did not go</Badge>
                              {message.reason ? (
                                <span className="mt-1 block max-w-56 text-xs text-muted">
                                  {message.reason}
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                total={counts.total}
                pageSize={LIST_PAGE_SIZE}
                href={(n) => (n > 1 ? `/admin/notifications?tab=log&page=${n}` : "/admin/notifications?tab=log")}
              />
            </>
          ) : (
            <p className="mt-5 text-sm text-muted">
              Nothing has been sent yet. Every attempt lands here, including the ones that did
              not go.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
