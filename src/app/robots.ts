import type { MetadataRoute } from "next";

/**
 * Nothing here is meant to be found by searching. The dashboard is behind a
 * sign-in, and a casting call is reachable only by its share token. A token
 * that turned up in a search result would defeat the point of having one.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
