import { openAccess } from "@/lib/gate";

/**
 * Unmissable while open access is on, because the one way this becomes a
 * disaster is somebody forgetting it is on. Rendered in the root layout, so it
 * is on every page including the casting share links.
 */
export function OpenAccessBanner() {
  if (!openAccess()) return null;

  return (
    <p
      role="status"
      className="border-b border-danger/40 bg-danger-soft px-5 py-2.5 text-center text-sm font-medium text-danger"
    >
      Open access is on — any email and password will sign in. Turn{" "}
      <code className="font-mono">OPEN_ACCESS</code> off before this holds anyone&rsquo;s real
      details.
    </p>
  );
}
