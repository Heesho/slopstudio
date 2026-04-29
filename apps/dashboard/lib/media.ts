/**
 * Convert a repo-root-relative media path (as stored in JSON) to a URL
 * the browser can request via the /media route handler.
 *
 * Example: "media/characters/anomalocaris/abc.png" -> "/media/characters/anomalocaris/abc.png"
 */
export function mediaUrl(repoRelativePath: string): string {
  // Defensive: strip a leading "media/" if present (it should be), normalize slashes
  const normalized = repoRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.startsWith("media/")) {
    return `/${normalized}`;
  }
  // Fallback: assume the path is already inside media/
  return `/media/${normalized}`;
}
