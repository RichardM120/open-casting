import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import {
  HERO,
  MEDIA_KINDS,
  blobToken,
  heroPrefix,
  mediaPrefix,
  uploadsEnabled,
  type MediaKind,
} from "@/lib/blob";
import { isOpen, roleWindow } from "@/lib/format";
import { getSessionRole } from "@/lib/roles";
import { getSessionByToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * Mints the short-lived token the browser needs to put a file straight into
 * the store. The file never passes through here, only the permission to send
 * it, so the size limit is the store's and not a function body's.
 *
 * Two kinds of sender. An applicant has no account, so their authorisation is
 * the same one that lets them see the form: a share link for a casting call
 * that is open now, naming a role in it. A casting director sending a header
 * image is a signed-in account, and may only write under its own folder. Each
 * token is scoped to a pathname, the content types and the size for its kind,
 * and nothing else can be uploaded with it.
 */
export async function POST(request: Request) {
  if (!uploadsEnabled()) {
    return NextResponse.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        if (!payload) throw new Error("Missing upload details");

        if (payload.kind === "hero") {
          const user = await currentUser();
          if (!user) throw new Error("Sign in to add a header image");
          if (!pathname.startsWith(heroPrefix(user.id))) {
            throw new Error("That file is not going where it should");
          }
          return {
            allowedContentTypes: [...HERO.contentTypes],
            maximumSizeInBytes: HERO.maxBytes,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ userId: user.id, kind: "hero" }),
          };
        }

        const { token, roleId, kind } = payload;
        const session = await getSessionByToken(token);
        const role = session ? await getSessionRole(session.id, roleId) : null;
        if (!session || !role) throw new Error("That casting call is not open to submissions");
        if (session.publishedAt === null || !isOpen(roleWindow(role))) {
          throw new Error("That casting call is not taking submissions right now");
        }

        const prefix = mediaPrefix(session.id, role.id, kind);
        if (!pathname.startsWith(prefix)) throw new Error("That file is not going where it should");

        const rules = MEDIA_KINDS[kind];
        return {
          allowedContentTypes: [...rules.contentTypes],
          maximumSizeInBytes: rules.maxBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sessionId: session.id, roleId: role.id, kind }),
        };
      },
      onUploadCompleted: async () => {
        // The URL is posted back with the rest of the form and checked there
        // against the prefix, so there is nothing to record at this point.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload refused";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type Payload =
  | { kind: "hero" }
  | { kind: MediaKind; token: string; roleId: string };

function parsePayload(raw: string | null): Payload | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { kind?: unknown; token?: unknown; roleId?: unknown };
    if (value.kind === "hero") return { kind: "hero" };
    if (
      typeof value.token !== "string" ||
      typeof value.roleId !== "string" ||
      (value.kind !== "photo" && value.kind !== "video")
    ) {
      return null;
    }
    return { kind: value.kind, token: value.token, roleId: value.roleId };
  } catch {
    return null;
  }
}
