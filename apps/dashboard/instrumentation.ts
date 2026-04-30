export async function register() {
  // Only run in Node.js runtime (not edge), and only in dev mode.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  // Lazy-import so production / edge bundles never see chokidar.
  const chokidar = await import("chokidar");
  const { revalidatePath } = await import("next/cache");
  const { studioPaths } = await import("./lib/paths");

  // Map filesystem subpaths under <project>/content/ to dashboard route paths to revalidate.
  // Each entry returns the routes that should revalidate when that segment changes.
  const ROUTE_FOR_SEGMENT: Record<string, (slug: string) => string[]> = {
    "dna.json":    (s) => [`/projects/${s}/dna`],
    "_state.json": (s) => [
      `/`,
      `/projects/${s}/dna`,
      `/projects/${s}/characters`,
      `/projects/${s}/locations`,
      `/projects/${s}/scenes`,
      `/projects/${s}/episodes`,
    ],
    characters: (s) => [`/`, `/projects/${s}/characters`, `/projects/${s}/scenes`, `/projects/${s}/episodes`],
    locations:  (s) => [`/projects/${s}/locations`, `/projects/${s}/scenes`, `/projects/${s}/episodes`],
    scenes:     (s) => [`/`, `/projects/${s}/scenes`, `/projects/${s}/episodes`],
    episodes:   (s) => [`/projects/${s}/episodes`],
  };

  const routesFor = (filepath: string): string[] => {
    // Match: ".../projects/<slug>/content/<segment>/...".
    const idx = filepath.indexOf("/projects/");
    if (idx < 0) return [];
    const rest = filepath.slice(idx + "/projects/".length);
    const segments = rest.split("/");
    if (segments.length < 3 || segments[1] !== "content") return [];
    const slug = segments[0];
    const segment = segments[2];
    const builder = ROUTE_FOR_SEGMENT[segment];
    return builder ? builder(slug) : [];
  };

  const watcher = chokidar.default.watch(studioPaths.projectsDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignored: (p) => p.includes("/media/"),
  });

  watcher.on("all", (_event, filepath) => {
    for (const route of routesFor(filepath)) {
      try {
        revalidatePath(route);
      } catch {
        // revalidatePath outside a request can throw on edge or before app boot;
        // ignore so the watcher doesn't crash the dev server.
      }
    }
  });

  watcher.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[content-watcher] error:", err);
  });
}
