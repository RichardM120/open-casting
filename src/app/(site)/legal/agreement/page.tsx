import type { Metadata } from "next";
import Link from "next/link";

import { LegalText } from "@/components/legal-document";
import { Eyebrow } from "@/components/ui";
import { MSA } from "@/content/legal";
import { listAcceptances } from "@/lib/agreements";
import { currentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Master Services Agreement",
  robots: { index: false, follow: false },
};

export default async function AgreementPage() {
  const user = await currentUser();
  const accepted = user ? await listAcceptances(user.id) : [];
  const mine = accepted.filter((entry) => entry.document === "msa");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {user ? (
        <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-text">
          ← Roles
        </Link>
      ) : null}

      <Eyebrow className={user ? "mt-6 block" : undefined}>Your agreement</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        Master Services Agreement
      </h1>

      {mine.length > 0 ? (
        <div className="mt-6 rounded-xl border border-line-strong bg-raised p-4 sm:p-6">
          <p className="text-sm text-muted">
            {mine[0].current
              ? "You have accepted the current version."
              : "You accepted an earlier version. You will be asked to accept the current one."}
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-faint">
            {mine.map((entry) => (
              <li key={`${entry.version}-${entry.acceptedAt}`}>
                Version {entry.version}, accepted {formatDate(entry.acceptedAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-10">
        <LegalText document={MSA} />
      </div>
    </div>
  );
}
