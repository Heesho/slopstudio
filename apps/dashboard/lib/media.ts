/**
 * Convert a project-relative media path (as stored in JSON) to a URL
 * the browser can request via the per-project /projects/<slug>/media route.
 *
 * Example: mediaUrl("cambrian-docuseries", "media/characters/foo/abc.png")
 *   -> "/projects/cambrian-docuseries/media/characters/foo/abc.png"
 */
export function mediaUrl(slug: string, repoRelativePath: string): string {
  const normalized = repoRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const stripped = normalized.startsWith("media/")
    ? normalized.slice("media/".length)
    : normalized;
  return `/projects/${slug}/media/${stripped}`;
}
