import type { Metadata } from "next";

import { LegalText } from "@/components/legal-document";
import { Eyebrow } from "@/components/ui";
import { SUBMISSION_TERMS } from "@/content/legal";

export const metadata: Metadata = {
  title: "Terms of Submission",
  description: "What submitting to a casting call on opencasting.app commits you to.",
  robots: { index: false, follow: false },
};

export default function SubmissionTermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Eyebrow>For applicants and guardians</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Terms of Submission
      </h1>
      <div className="mt-10">
        <LegalText document={SUBMISSION_TERMS} />
      </div>
    </div>
  );
}
