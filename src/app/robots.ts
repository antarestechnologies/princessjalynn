import type { MetadataRoute } from "next";

/** Nothing on this site is indexable. The proxy also sets X-Robots-Tag on every response. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
