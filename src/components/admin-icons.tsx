import type { AdminIconName } from "@/lib/admin-nav";

/**
 * One icon per page in the administrator's section, drawn on one grid at one
 * stroke weight so the set reads as a set rather than as nine borrowed marks.
 *
 * They lead the tiles on the summary, which is how somebody finds the page
 * they want without reading nine names. Always `aria-hidden`: the name is
 * beside every one of them, and an icon that has to be described is an icon
 * that is not doing its job.
 */
const PATHS: Record<AdminIconName, string> = {
  // A building: who is paying.
  clients: "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2M3 21h18",
  // People: who signs in.
  accounts: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  // A folder: the casting calls themselves.
  projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  // An inbox: what has come in.
  submissions: "M4 13h4l2 3h4l2-3h4M4 13 6.5 5A2 2 0 0 1 8.4 3.6h7.2A2 2 0 0 1 17.5 5L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
  // A disk: what is held, and for how long.
  storage: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  // A shield: somebody's rights over their own data.
  privacy: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  // A bell: what the app sends.
  notifications: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  // A pulse: what happened, as the people doing it saw it.
  activity: "M3 12h4l3-8 4 16 3-8h4",
  // A page with lines: the same record, with the address and the target.
  audit: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
};

export function AdminIcon({ name, className = "size-5" }: { name: AdminIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
