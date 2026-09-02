import type { Metadata } from "next";
import Link from "next/link";

import { ProductionCompanyForm } from "@/components/production-company-form";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New production company",
  description: "Add a company you cast for, then open its productions.",
};

export default async function NewProductionCompanyPage() {
  await requireUser("/dashboard/production-companies/new");

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/dashboard/production-companies"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        &larr; Production companies
      </Link>

      <div className="mt-6">
        <Eyebrow>New production company</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Add a production company</h1>
        <p className="mt-3 max-w-2xl text-muted">
          The company whose work this is. Once it exists you can open productions under it, and
          the dashboard will keep them together.
        </p>
      </div>

      <div className="mt-10">
        <ProductionCompanyForm />
      </div>
    </div>
  );
}
