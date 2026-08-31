import { RoleCard } from "@/components/role-card";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { countOpenRoles, listRecentRoles } from "@/lib/roles";
import { countSubmissions } from "@/lib/submissions";

// Counts and listings come from the database on every request, so this page is
// never prerendered — a deploy build does not need a reachable database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [roles, openRoles, submissions] = await Promise.all([
    listRecentRoles(4),
    countOpenRoles(),
    countSubmissions(),
  ]);

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <Eyebrow>Open casting calls</Eyebrow>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            The role is posted. The tape goes straight to the person casting it.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            No agent required, no fee to submit. Casting directors put the brief up in full —
            rate, dates, union status, who they are actually looking for — and every submission
            lands in one place instead of six inboxes.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/roles">Browse open roles</ButtonLink>
            <ButtonLink href="/roles/new" variant="secondary">
              Post a role
            </ButtonLink>
          </div>

          <dl className="mt-14 flex flex-wrap gap-x-12 gap-y-6">
            <Stat value={openRoles} label={openRoles === 1 ? "role open now" : "roles open now"} />
            <Stat value={submissions} label="submissions received" />
            <Stat value="£0" label="cost to submit" />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Closing soonest</Eyebrow>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Open right now</h2>
          </div>
          <ButtonLink href="/roles" variant="secondary" size="sm">
            See all roles
          </ButtonLink>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid gap-5 md:grid-cols-2">
          <HowItWorks
            eyebrow="For performers"
            title="Read the whole brief before you spend an evening on a tape"
            steps={[
              "Filter by production type, union status, pay and whether self-tape is accepted.",
              "Every listing shows the rate, the shoot dates and the closing date up front.",
              "Submit once with your details, links and a short cover note.",
            ]}
            action={{ href: "/roles", label: "Browse open roles" }}
          />
          <HowItWorks
            eyebrow="For casting directors"
            title="One list, sorted, instead of an inbox you are afraid of"
            steps={[
              "Post the role with the brief and requirements spelled out.",
              "Submissions arrive in a single table with links and cover notes.",
              "Move people through New, Shortlisted, Callback and Declined as you go.",
            ]}
            action={{ href: "/roles/new", label: "Post a role" }}
          />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block text-3xl font-semibold tracking-tight">{value}</span>
        <span className="mt-1 block text-sm text-muted">{label}</span>
      </dd>
    </div>
  );
}

function HowItWorks({
  eyebrow,
  title,
  steps,
  action,
}: {
  eyebrow: string;
  title: string;
  steps: string[];
  action: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-7">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance">{title}</h3>
      <ol className="mt-6 flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-accent">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-7">
        <ButtonLink href={action.href} variant="secondary" size="sm">
          {action.label}
        </ButtonLink>
      </div>
    </div>
  );
}
