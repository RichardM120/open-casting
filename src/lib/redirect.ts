import { NextResponse } from "next/server";

/**
 * A redirect to a path on whatever origin the browser actually used.
 *
 * `NextResponse.redirect` wants an absolute URL, and the obvious source for one
 * (`request.url`) is the server's internal address, not the host the request
 * came in on. Behind a proxy, or simply when the browser said 127.0.0.1 and the
 * server thinks it is localhost, that sends the browser to a different origin
 * and every cookie just set is left behind. A relative Location header is legal
 * and the browser resolves it against the page it is on, so it cannot drift.
 */
export function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}
