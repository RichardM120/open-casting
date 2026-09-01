import "server-only";

import { currentUser } from "./auth";
import type { CastingSession } from "./types";

/**
 * Whether the person asking may look at an unpublished casting session.
 *
 * The same rule as the dashboard, applied to a page that is otherwise public:
 * the owner, anyone at the company for a producer, an admin. Deliberately not
 * "anyone with the link" — the link is what a draft is being kept from.
 */
export async function canPreview(session: CastingSession): Promise<boolean> {
  const viewer = await currentUser();
  if (!viewer) return false;

  switch (viewer.role) {
    case "admin":
      return true;
    case "producer":
      return viewer.company.toLowerCase() === session.company.toLowerCase();
    default:
      return viewer.id === session.ownerId;
  }
}
