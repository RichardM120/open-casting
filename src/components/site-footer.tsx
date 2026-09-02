import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          Open Casting is the tool a production runs its casting with. The sample productions
          on it are invented.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/faq/performers" className="transition-colors hover:text-text">
            Performer FAQ
          </Link>
          <Link href="/faq/casting-directors" className="transition-colors hover:text-text">
            Casting FAQ
          </Link>
          <Link href="/legal/submission-terms" className="transition-colors hover:text-text">
            Terms of Submission
          </Link>
          <Link href="/legal/agreement" className="transition-colors hover:text-text">
            Agreement
          </Link>
        </div>
      </div>
    </footer>
  );
}
