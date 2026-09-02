import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductionCompanyForm } from "@/components/production-company-form";
import { Eyebrow } from "@/components/ui";
import { currentUser, requireUser } from "@/lib/auth";
import { getVisibleProductionCompany } from "@/lib/production-companies";

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/production-companies/[id]/edit">): Promise<Metadata> {
  const user = await currentUser();
  const productionCompany = user ? await getVisibleProductionCompany((await params).id, user) : null;
  return { title: productionCompany ? `Edit ${productionCompany.name}` : "ProductionCompany not found" };
}

export default async function EditProductionCompanyPage({
  params,
}: PageProps<"/dashboard/production-companies/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/production-companies/${id}/edit`);

  const productionCompany = await getVisibleProductionCompany(id, user);
  if (!productionCompany) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link
        href="/dashboard/production-companies"
        className="text-sm text-muted transition-colors hover:text-text"
      >
        &larr; Production companies
      </Link>

      <div className="mt-6">
        <Eyebrow>Production company</Eyebrow>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Edit {productionCompany.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Renaming a production company changes it everywhere it appears on your dashboard. Nothing an
          applicant has already seen changes, because none of this reaches them.
        </p>
      </div>

      <div className="mt-10">
        <ProductionCompanyForm productionCompany={productionCompany} />
      </div>
    </div>
  );
}
