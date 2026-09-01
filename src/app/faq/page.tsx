import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "What the fields on a casting call mean, what submitting commits you to, and how the board works.",
};

const GUIDES = [
  {
    href: "/faq/performers",
    eyebrow: "For performers",
    title: "Submitting for a role",
    description:
      "What the words on a listing mean — rate, buyout, usage, union status, playing age — when the form is open, what you are agreeing to when you submit, and what happens to your details.",
  },
  {
    href: "/faq/casting-directors",
    eyebrow: "For casting directors",
    title: "Posting a role",
    description:
      "How casting sessions hold a production's dates, what each field commits you to, who else at your company can see what comes in, how to write terms worth having, and your obligations for the data you collect.",
  },
] as const;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Eyebrow>Help</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Questions, answered
      </h1>
      <p className="mt-3 max-w-prose text-muted">
        Two guides, because the two sides of a casting call need different things explained.
      </p>

      <div className="mt-10 grid gap-5">
        {GUIDES.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="group rounded-2xl border border-line bg-surface p-7 transition-colors hover:border-line-strong"
          >
            <Eyebrow>{guide.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-xl font-semibold tracking-tight transition-colors group-hover:text-accent">
              {guide.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{guide.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
