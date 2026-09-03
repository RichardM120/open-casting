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
