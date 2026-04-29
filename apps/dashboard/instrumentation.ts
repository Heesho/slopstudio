export async function register() {
  // Only run in Node.js runtime (not edge), and only in dev mode.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development") return;

  // Lazy-import so production / edge bundles never see chokidar.
  const chokidar = await import("chokidar");
  const { revalidatePath } = await import("next/cache");
  const { paths } = await import("./lib/paths");

  // Map filesystem subpaths under content/ to dashboard route paths to revalidate.
  const ROUTE_FOR_BASENAME: Record<string, string[]> = {
    "dna.json": ["/dna"],
    "_state.json": ["/", "/dna", "/characters", "/locations", "/scenes", "/episodes"],
    characters: ["/characters", "/scenes", "/episodes"],
    locations: ["/locations", "/scenes", "/episodes"],
    scenes: ["/scenes", "/episodes"],
    episodes: ["/episodes"],
  };

  const routesFor = (filepath: string): string[] => {
    // Filepath is absolute. We care about whatever lives under content/.
    // Match: ".../content/<basename-or-dir>/...".
    const idx = filepath.indexOf("/content/");
    if (idx < 0) return [];
    const rest = filepath.slice(idx + "/content/".length);
    const segment = rest.split("/")[0]; // either a filename or a directory name
    return ROUTE_FOR_BASENAME[segment] ?? [];
  };

  const watcher = chokidar.default.watch(paths.contentDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
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
