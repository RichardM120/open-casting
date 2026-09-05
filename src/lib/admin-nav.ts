/**
 * The administrator's section, in four groups.
 *
 * There are ten pages under /admin and a phone cannot hold ten tabs. They are
 * grouped by the question each answers — who pays, what is being cast, and
 * whether the machinery is still working — so the bar holds four, and the
 * pages inside a group are a row of tabs on the group's own screens.
 *
 * One list, used by the header, by the tab row and by every breadcrumb, so
 * the three cannot drift apart. It is plain data with no server imports, so
 * the client-side header can read it too.
 */

/** The nine marks in `admin-icons.tsx`, one per page in the section. */
export type AdminIconName =
  | "clients"
  | "accounts"
  | "projects"
  | "submissions"
  | "storage"
  | "privacy"
  | "notifications"
  | "activity"
  | "audit";

export type AdminPage = {
  href: string;
  /** As it reads in the tab row and at the end of a breadcrumb. */
  label: string;
  /** One line saying what the page is for, under the group's heading. */
  line: string;
  /** Which mark leads its tile on the summary. */
  icon: AdminIconName;
};

export type AdminGroup = {
  /** The group's own landing page, and the href the nav points at. */
  href: string;
  label: string;
  /** A shorter label for the phone's tab bar. */
  short?: string;
  icon: "overview" | "clients" | "projects" | "system";
  pages: AdminPage[];
};

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: "overview",
    pages: [],
  },
  {
    href: "/admin/clients",
    label: "Clients",
    icon: "clients",
    pages: [
      { href: "/admin/clients", label: "Clients", line: "The companies paying, and what each is on.", icon: "clients" },
      { href: "/admin/accounts", label: "Accounts", line: "Who signs in, under which client.", icon: "accounts" },
    ],
  },
  {
    href: "/admin/projects",
    label: "Casting",
    icon: "projects",
    pages: [
      { href: "/admin/projects", label: "Projects", line: "Every casting call on the site, and what state it is in.", icon: "projects" },
      { href: "/admin/submissions", label: "Submissions", line: "Everything that has come in, and the media with it.", icon: "submissions" },
    ],
  },
  {
    href: "/admin/storage",
    label: "System",
    icon: "system",
    pages: [
      { href: "/admin/storage", label: "Storage", line: "What is held, and what is due to be deleted.", icon: "storage" },
      { href: "/admin/privacy", label: "Privacy", line: "Requests about somebody's own data, and erasure.", icon: "privacy" },
      { href: "/admin/notifications", label: "Notifications", line: "What the app sends, and what became of it.", icon: "notifications" },
      { href: "/admin/activity", label: "Activity", line: "What has happened, as the people doing it see it.", icon: "activity" },
      { href: "/admin/audit-logs", label: "Audit log", line: "The same record with the address and the target.", icon: "audit" },
    ],
  },
];

/** The group a path belongs to, by the longest page or group href that matches. */
export function groupFor(pathname: string): AdminGroup | undefined {
  let best: { group: AdminGroup; length: number } | undefined;
  for (const group of ADMIN_GROUPS) {
    const candidates = [group.href, ...group.pages.map((page) => page.href)];
    for (const href of candidates) {
      if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
      // /admin matches everything under it, so it only wins when nothing longer does.
      if (!best || href.length > best.length) best = { group, length: href.length };
    }
  }
  return best?.group;
}

/** The page within its group, for the tab row's current state and the breadcrumb. */
export function pageFor(pathname: string): AdminPage | undefined {
  const group = groupFor(pathname);
  if (!group) return undefined;
  return group.pages
    .filter((page) => pathname === page.href || pathname.startsWith(`${page.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * The trail to a page under /admin: Admin, the group, then the page, with
 * anything deeper appended by the page itself.
 */
export function adminTrail(
  pathname: string,
  deeper: { href?: string; label: string }[] = [],
): { href?: string; label: string }[] {
  const group = groupFor(pathname);
  if (!group || group.href === "/admin") {
    return [{ href: "/admin", label: "Admin" }, ...deeper];
  }
  const page = pageFor(pathname);
  const trail: { href?: string; label: string }[] = [{ href: "/admin", label: "Admin" }];
  // The group's own landing page is named by the page rather than the group:
  // "Admin, Projects" reads better than "Admin, Casting", and the group's name
  // is in the bar above anyway. Anything else gets both.
  if (page && page.href === group.href) {
    trail.push({ href: page.href, label: page.label });
  } else {
    trail.push({ href: group.href, label: group.label });
    if (page) trail.push({ href: page.href, label: page.label });
  }
  return [...trail, ...deeper];
}

/**
 * Whether a path is inside the administrator's section. The header and the
 * shell around it both need to know — one to swap the navigation, the other
 * to swap the palette — and a section that disagreed with itself about where
 * it starts would show one section's colours around the other's links.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
