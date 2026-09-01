import { siteClosed } from "@/lib/gate";

/**
 * Unmissable while the site is closed, because the way this becomes a bad day
 * is somebody forgetting it is. Rendered in the root layout, so it is on every
 * page including the casting share links a performer would see.
 */
export function PrelaunchBanner() {
  if (!siteClosed()) return null;

  return (
    <p
      role="status"
      className="border-b border-accent/40 bg-accent-soft px-5 py-2.5 text-center text-sm text-text"
    >
      <strong className="font-semibold">Not launched.</strong> The whole site is behind one
      shared password, and any email address will do. Unset{" "}
      <code className="font-mono">SITE_PASSWORD</code> to open it properly.
    </p>
  );
}
