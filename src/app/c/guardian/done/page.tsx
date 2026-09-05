import type { Metadata } from "next";

import { Eyebrow } from "@/components/ui";
import { CONFIRM_DAYS } from "@/lib/guardian";
import { reportAddress } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Where a guardian lands after deciding — and where a spent, swept or invented
 * link lands too. The second case says as little as it can: whether a
 * particular link ever existed is not something to tell whoever is holding it.
 */
export default async function GuardianDonePage({ searchParams }: PageProps<"/c/guardian/done">) {
  const query = await searchParams;
  const confirmed = query.state === "confirmed";
  const company = typeof query.company === "string" ? query.company : "the casting team";
  const reportTo = reportAddress();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <Eyebrow>{confirmed ? "Confirmed" : "Nothing to do"}</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {confirmed ? "Thank you." : "This link has already been used."}
      </h1>

      {confirmed ? (
        <>
          <p className="mt-4 max-w-prose leading-relaxed text-text">
            The submission is now with {company}. They will be in touch through the address on the
            form if there is anything else to do.
          </p>
          <p className="mt-3 max-w-prose leading-relaxed text-muted">
            You can change your mind at any time. Everything sent is destroyed automatically after
            the production finishes; to have it go sooner, ask {company}
            {reportTo ? (
              <>
                {" "}
                or write to{" "}
                <a
                  href={`mailto:${reportTo}`}
                  className="text-brand underline underline-offset-4 hover:text-brand-hover"
                >
                  {reportTo}
                </a>
              </>
            ) : null}
            .
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 max-w-prose leading-relaxed text-text">
            It was either confirmed already, or it ran out. A submission nobody confirms is
            deleted {CONFIRM_DAYS} days after it arrives, and is never shown to anyone in the
            meantime.
          </p>
          {reportTo ? (
            <p className="mt-3 max-w-prose leading-relaxed text-muted">
              If you think something is wrong, write to{" "}
              <a
                href={`mailto:${reportTo}`}
                className="text-brand underline underline-offset-4 hover:text-brand-hover"
              >
                {reportTo}
              </a>
              .
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
