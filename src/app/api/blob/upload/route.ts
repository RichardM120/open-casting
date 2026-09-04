import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import {
  HERO,
  MEDIA_KINDS,
  heroPrefix,
  mediaPrefix,
  storeAuth,
  uploadsEnabled,
  type MediaKind,
} from "@/lib/blob";
import { isOpen, roleWindow } from "@/lib/format";
import { getSessionRole } from "@/lib/roles";
import { getSessionByToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** How long a browser has to finish sending a file once it has been allowed to. A tape over a phone connection takes a while. */
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

/**
 * No upload here finishes with a callback from the store, so there is never a
 * callback signature to verify; the helper still wants a key to verify one
 * with, and a forged callback fails against this as it should.
 */
const NO_CALLBACKS = "no callbacks are configured";

/**
 * Signs the short-lived address the browser needs to put a file straight into
 * the store. The file never passes through here, only the permission to send
 * it, so the size limit is the store's and not a function body's.
 *
 * Two kinds of sender. An applicant has no account, so their authorisation is
 * the same one that lets them see the form: a share link for a casting call
 * that is open now, naming a role in it. A casting director sending a header
 * image is a signed-in account, and may only write under its own folder. Each
 * address is good for one pathname, the content types and the size for its
 * kind, and an hour, and nothing else can be uploaded with it. The store adds
 * a random suffix to the name, so a second file never overwrites a first.
 */
export async function POST(request: Request) {
  if (!uploadsEnabled()) {
    return NextResponse.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadPresignedBody;
  if (body.type !== "blob.generate-presigned-url") {
    return NextResponse.json({ error: "Unexpected request" }, { status: 400 });
  }

  try {
    const json = await handleUploadPresigned({
      body,
      request,
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY?.trim() || NO_CALLBACKS,
      getSignedToken: async (pathname, clientPayload) => {
        const rules = await allow(pathname, clientPayload);
        const validUntil = Date.now() + UPLOAD_WINDOW_MS;
        return {
          token: await issueSignedToken({
            ...storeAuth(),
            pathname,
            operations: ["put"],
            allowedContentTypes: [...rules.contentTypes],
            maximumSizeInBytes: rules.maxBytes,
            validUntil,
          }),
          urlOptions: {
            allowedContentTypes: [...rules.contentTypes],
            maximumSizeInBytes: rules.maxBytes,
            addRandomSuffix: true,
            allowOverwrite: false,
            validUntil,
          },
        };
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload refused";
    // The browser shows the message; this is for the deployment's logs, so a
    // refusal can be diagnosed after the event without asking the person.
    console.warn(`[blob] upload refused for ${body.payload?.pathname ?? "?"}: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type Rules = { contentTypes: readonly string[]; maxBytes: number };

/** What may be sent to this pathname by this sender, or an error saying why nothing may. */
async function allow(pathname: string, clientPayload: string | null): Promise<Rules> {
  const payload = parsePayload(clientPayload);
  if (!payload) throw new Error("Missing upload details");

  if (payload.kind === "hero") {
    const user = await currentUser();
    if (!user) throw new Error("Sign in to add a header image");
    if (!pathname.startsWith(heroPrefix(user.id))) {
      throw new Error("That file is not going where it should");
    }
    return HERO;
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

  return MEDIA_KINDS[kind];
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
