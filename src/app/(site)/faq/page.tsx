import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "What the fields on a casting call mean, what submitting commits you to, and how the site works.",
};

const GUIDES = [
  {
    href: "/faq/applicants",
    eyebrow: "For applicants",
    title: "Submitting for a role",
    description:
      "What the words on a casting call mean, when the form is open, what you agree to when you submit, and what happens to your details.",
  },
  {
    href: "/faq/casting-directors",
    eyebrow: "For casting directors",
    title: "Running a casting call",
    description:
      "How a casting call holds its roles and its times, what each field commits you to, who else at your company can see what comes in, how to write terms worth having, and your duties for the data you collect.",
  },
] as const;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Eyebrow>Help</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Questions, answered
      </h1>
      <p className="mt-3 max-w-prose text-muted">
        Two guides, because the two sides of a casting call need different things explained.
      </p>

      <div className="mt-10 grid gap-6">
        {GUIDES.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="group rounded-2xl border border-line-strong bg-raised p-5 transition-colors hover:border-accent sm:p-7"
          >
            <Eyebrow>{guide.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-xl font-semibold tracking-tight transition-colors group-hover:text-brand">
              {guide.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{guide.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
