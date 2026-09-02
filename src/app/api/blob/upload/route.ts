import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { MEDIA_KINDS, blobToken, mediaPrefix, uploadsEnabled, type MediaKind } from "@/lib/blob";
import { isOpen, roleWindow } from "@/lib/format";
import { getSessionRole } from "@/lib/roles";
import { getSessionByToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * Mints the short-lived token the browser needs to put a file straight into
 * the store. The file never passes through here, only the permission to send
 * it, so the size limit is the store's and not a function body's.
 *
 * An applicant has no account, so the authorisation is the same one that lets
 * them see the form: a share link for a casting call that is open now, naming
 * a role in it. The token is then scoped to a pathname under that role, one
 * kind of file, its content types and its size. Nothing else can be uploaded
 * with it.
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

type Payload = { token: string; roleId: string; kind: MediaKind };

function parsePayload(raw: string | null): Payload | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Payload>;
    if (
      typeof value.token !== "string" ||
      typeof value.roleId !== "string" ||
      (value.kind !== "photo" && value.kind !== "video")
    ) {
      return null;
    }
    return { token: value.token, roleId: value.roleId, kind: value.kind };
  } catch {
    return null;
  }
}
