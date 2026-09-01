import "server-only";

import { headers } from "next/headers";

/**
 * The origin this request arrived on, so a share link can be shown in full and
 * copied. Read from the request rather than configured, because the same
 * deployment answers on a preview URL, the vercel.app domain and the real one,
 * and a link pointing at the wrong one of those is useless to whoever is sent it.
 */
export async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return host ? `${protocol}://${host}` : "";
}
