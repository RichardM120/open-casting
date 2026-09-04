/**
 * Where an applicant reports an imitation of a casting call, or a demand for
 * a fee: REPORT_EMAIL when the operator has set one, otherwise the first
 * administrator's address, which is the same person while the site is small.
 */
export function reportAddress(): string | null {
  const set = process.env.REPORT_EMAIL?.trim();
  if (set) return set;
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null;
}

/**
 * Who the operator is, in the words the Companies (Trading Disclosures)
 * Regulations 2008 want on a limited company's website: the registered name,
 * the number, where it is registered and its registered office. The name is
 * fixed; the rest is set per deployment, and each line is shown only when it
 * has been set, so a missing one is a gap in the footer rather than an
 * invented address.
 */
export function companyDetails(): {
  name: string;
  number: string | null;
  office: string | null;
} {
  return {
    name: process.env.COMPANY_NAME?.trim() || "CW Casting Limited",
    number: process.env.COMPANY_NUMBER?.trim() || null,
    office: process.env.REGISTERED_OFFICE?.trim() || null,
  };
}
