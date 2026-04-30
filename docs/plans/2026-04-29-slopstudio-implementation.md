# slopstudio — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pivot the existing single-tenant Cambria dashboard into **slopstudio**: a multi-project local-first folder for AI video making. The repo will hold many self-contained projects under `projects/<slug>/`, with the existing Cambrian content moving wholesale into `projects/cambrian-docuseries/` as the demo project. The dashboard gets a project gallery at `/`, project-scoped tabs at `/projects/<slug>/...`, and a thin `slopstudio.json` for tracking the active project.

**Architecture:** Thread a `slug` argument through the existing path/content/mutation helpers. Move pages to `app/projects/[slug]/...` and API routes to `app/api/projects/[slug]/...`. Keep all schemas, mutation logic, take semantics, and Higgsfield wiring **unchanged** — this is a restructure of *where* JSON lives, not *what's in it*. Add one new file (`slopstudio.json` at the repo root), one new API route (`PATCH /api/active-project`), and one new page (the project gallery at `/`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Zod, Vitest, chokidar (dev watcher), Tailwind v4, pnpm + Turborepo.

**Design doc:** [docs/plans/2026-04-29-slopstudio-design.md](./2026-04-29-slopstudio-design.md)

---

## Pre-flight

Read the design doc end-to-end before starting. Then read the following files so you have the actual code in your head — every refactor task references them by line:

- `apps/dashboard/lib/paths.ts` — single source of all on-disk path constants. Today it's an object with getters; we're turning it into a function `paths(slug)`.
- `apps/dashboard/lib/content.ts` — content readers; every function will gain a `slug` parameter.
- `apps/dashboard/lib/mutations.ts` — entity mutation logic; same.
- `apps/dashboard/lib/media.ts` — `mediaUrl` URL builder.
- `apps/dashboard/lib/schemas.ts` — Zod schemas; **no changes**.
- `apps/dashboard/instrumentation.ts` — chokidar watcher; needs to watch `projects/**/content/**`.
- `apps/dashboard/app/layout.tsx` — root layout; today reads DNA at the root, becomes project-aware.
- `apps/dashboard/app/page.tsx` — currently `redirect("/dna")`; becomes the project gallery.
- `apps/dashboard/app/components/Header.tsx` — currently has hard-coded tab links to `/dna`, `/characters`, etc.
- The five page files: `app/dna/page.tsx`, `app/characters/page.tsx`, `app/locations/page.tsx`, `app/scenes/page.tsx`, `app/scenes/[id]/page.tsx` (if exists), `app/episodes/page.tsx`.
- The five API route files: `app/api/entity/[type]/[id]/route.ts`, `app/api/entity/[type]/[id]/select-take/route.ts`, `app/api/entity/[type]/[id]/take/[jobId]/route.ts`, `app/api/entity/scenes/[id]/select-first-frame/route.ts`, `app/api/entity/scenes/[id]/first-frame/[jobId]/route.ts`.
- The media route: `app/media/[...path]/route.ts`.
- `apps/dashboard/lib/content.test.ts` and `apps/dashboard/lib/mutations.test.ts` — see the existing `vi.spyOn(paths, ...)` mocking pattern; we'll change tests too.

**Slug discipline.** A "slug" is the folder name under `projects/`. It must match `^[a-z0-9-]+$`, length 1–64. Treat it as untrusted input on every API route and on every reader call. There's already an `assertSafeId` pattern in `mutations.ts` for entity ids — write an analogous `assertSafeSlug` helper and use it everywhere a slug crosses a boundary.

**One project at a time.** The implementer should keep `pnpm dev` running and click around the Cambrian demo project after each task to verify the dashboard still works. The existing `pnpm test` suite is the second safety net. If a task breaks tests or the UI, do not move on — fix or revert.

---

## Task 1: Add `slopstudio.json` schema and reader

**Files:**
- Create: `apps/dashboard/lib/studio.ts`
- Create: `apps/dashboard/lib/studio.test.ts`
- Modify: `apps/dashboard/lib/schemas.ts` (append a new schema)

**Step 1: Write the failing test**

Create `apps/dashboard/lib/studio.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStudioConfig, writeActiveProjectSlug, StudioConfigSchema } from "./studio";
import * as pathsModule from "./paths";

describe("studio config", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-test-"));
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("StudioConfigSchema parses a minimal config", () => {
    expect(StudioConfigSchema.parse({ name: "X", activeProjectSlug: "y" }))
      .toEqual({ name: "X", activeProjectSlug: "y" });
  });

  it("readStudioConfig returns defaults when file missing", async () => {
    expect(await readStudioConfig()).toEqual({
      name: "slopstudio",
      activeProjectSlug: null,
    });
  });

  it("readStudioConfig parses an existing file", async () => {
    await fs.writeFile(
      path.join(tmpRoot, "slopstudio.json"),
      JSON.stringify({ name: "My Studio", activeProjectSlug: "demo" }),
    );
    expect(await readStudioConfig()).toEqual({
      name: "My Studio",
      activeProjectSlug: "demo",
    });
  });

  it("writeActiveProjectSlug updates only that field", async () => {
    await fs.writeFile(
      path.join(tmpRoot, "slopstudio.json"),
      JSON.stringify({ name: "S", activeProjectSlug: "a" }),
    );
    await writeActiveProjectSlug("b");
    const after = JSON.parse(
      await fs.readFile(path.join(tmpRoot, "slopstudio.json"), "utf-8"),
    );
    expect(after).toEqual({ name: "S", activeProjectSlug: "b" });
  });

  it("writeActiveProjectSlug rejects invalid slugs", async () => {
    await expect(writeActiveProjectSlug("../etc")).rejects.toThrow();
    await expect(writeActiveProjectSlug("HAS UPPER")).rejects.toThrow();
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
pnpm --filter dashboard test -- studio.test.ts
```

Expected: FAIL with module-not-found errors.

**Step 3: Add the schema**

Append to `apps/dashboard/lib/schemas.ts`:

```ts
export const StudioConfigSchema = z.object({
  name: z.string().default("slopstudio"),
  activeProjectSlug: z.string().nullable().default(null),
});
export type StudioConfig = z.infer<typeof StudioConfigSchema>;
```

**Step 4: Add `repoRoot()` to `paths.ts`**

Modify `apps/dashboard/lib/paths.ts` so `REPO_ROOT` is exposed via a function (so tests can spy on it):

```ts
import path from "node:path";

export function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export const paths = {
  // ... unchanged getters ...
};
```

Update the existing getters to call `repoRoot()` instead of the module-level constant:

```ts
get contentDir() { return path.join(repoRoot(), "content"); }
// ...etc for every getter
```

(The `paths` object stays exactly as-is functionally. We're only making `repoRoot` overridable for tests.)

**Step 5: Implement `studio.ts`**

Create `apps/dashboard/lib/studio.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { StudioConfigSchema, type StudioConfig } from "./schemas";
import { repoRoot } from "./paths";
import { writeAtomic } from "./mutations";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function assertSafeSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > 64 || slug.length < 1) {
    throw new Error(`invalid project slug: ${slug}`);
  }
}

function studioConfigPath(): string {
  return path.join(repoRoot(), "slopstudio.json");
}

export async function readStudioConfig(): Promise<StudioConfig> {
  try {
    const raw = await fs.readFile(studioConfigPath(), "utf-8");
    return StudioConfigSchema.parse(JSON.parse(raw));
  } catch {
    return { name: "slopstudio", activeProjectSlug: null };
  }
}

export async function writeActiveProjectSlug(slug: string): Promise<void> {
  assertSafeSlug(slug);
  const current = await readStudioConfig();
  await writeAtomic(studioConfigPath(), { ...current, activeProjectSlug: slug });
}
```

**Step 6: Run the test to verify pass**

```bash
pnpm --filter dashboard test -- studio.test.ts
```

Expected: all 5 tests pass.

**Step 7: Run the full test suite to verify nothing else broke**

```bash
pnpm test
```

Expected: all tests pass (existing ones still use the `paths` object as-is).

**Step 8: Commit**

```bash
git add apps/dashboard/lib/studio.ts apps/dashboard/lib/studio.test.ts apps/dashboard/lib/schemas.ts apps/dashboard/lib/paths.ts
git commit -m "feat(dashboard): add slopstudio.json studio config + assertSafeSlug helper"
```

---

## Task 2: Make path helpers project-aware

**Files:**
- Modify: `apps/dashboard/lib/paths.ts`

**Goal:** Add a `paths(slug)` function returning project-scoped paths. Keep the existing `paths` object exported so the rest of the codebase still compiles — we'll migrate callers in subsequent tasks and remove the old export at the end.

**Step 1: Add `paths(slug)` function alongside the existing object**

Modify `apps/dashboard/lib/paths.ts`:

```ts
import path from "node:path";

export function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export function projectRoot(slug: string): string {
  return path.join(repoRoot(), "projects", slug);
}

export function projectPaths(slug: string) {
  const root = projectRoot(slug);
  return {
    contentDir: path.join(root, "content"),
    mediaDir:   path.join(root, "media"),
    dna:        path.join(root, "content/dna.json"),
    state:      path.join(root, "content/_state.json"),
    charactersDir: path.join(root, "content/characters"),
    locationsDir:  path.join(root, "content/locations"),
    scenesDir:     path.join(root, "content/scenes"),
    episodesDir:   path.join(root, "content/episodes"),
  };
}

export const studioPaths = {
  get configFile()  { return path.join(repoRoot(), "slopstudio.json"); },
  get projectsDir() { return path.join(repoRoot(), "projects"); },
};

// LEGACY — to be removed in Task 11. Reads from /content and /media at repo root.
// Kept temporarily so unmigrated callers still compile.
export const paths = {
  get contentDir() { return path.join(repoRoot(), "content"); },
  get mediaDir()   { return path.join(repoRoot(), "media"); },
  get dna()        { return path.join(repoRoot(), "content/dna.json"); },
  get state()      { return path.join(repoRoot(), "content/_state.json"); },
  get charactersDir() { return path.join(repoRoot(), "content/characters"); },
  get locationsDir()  { return path.join(repoRoot(), "content/locations"); },
  get scenesDir()     { return path.join(repoRoot(), "content/scenes"); },
  get episodesDir()   { return path.join(repoRoot(), "content/episodes"); },
};
```

**Step 2: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

Expected: all pass.

**Step 3: Commit**

```bash
git add apps/dashboard/lib/paths.ts
git commit -m "feat(dashboard): add projectPaths(slug) + studioPaths; keep legacy paths for now"
```

---

## Task 3: Migrate Cambrian content into `projects/cambrian-docuseries/`

**Files:**
- Move: `content/` → `projects/cambrian-docuseries/content/`
- Move: `media/` → `projects/cambrian-docuseries/media/`
- Modify: `.gitignore`

**Step 1: Move content + media on disk**

```bash
mkdir -p projects/cambrian-docuseries
git mv content projects/cambrian-docuseries/content
# media/ is gitignored — only the empty dir might be tracked. Move it on disk too.
mv media projects/cambrian-docuseries/media 2>/dev/null || true
```

**Step 2: Update `.gitignore`**

Edit `.gitignore`. Replace the line `/media/` with:

```
# Generated media (large; reproducible from content/)
/projects/*/media/
```

**Step 3: Create `slopstudio.json` at repo root**

Write `slopstudio.json`:

```json
{
  "name": "slopstudio",
  "activeProjectSlug": "cambrian-docuseries"
}
```

**Step 4: Verify the dashboard is BROKEN at this point**

```bash
pnpm dev
```

Open http://localhost:3000 — expect 500 errors (the legacy `paths.contentDir` resolves to `<repo>/content`, which no longer exists). This is expected; we fix it in the next several tasks. Stop the dev server.

**Step 5: Commit**

```bash
git add .gitignore slopstudio.json projects/cambrian-docuseries/content
git commit -m "refactor: move content/ and media/ under projects/cambrian-docuseries/

Dashboard is intentionally broken at this commit; subsequent tasks
thread projectSlug through the readers/mutations to fix."
```

---

## Task 4: Thread `slug` through `lib/content.ts`

**Files:**
- Modify: `apps/dashboard/lib/content.ts`
- Modify: `apps/dashboard/lib/content.test.ts`

**Step 1: Update each reader to take a `slug` argument**

Replace the body of `apps/dashboard/lib/content.ts` with:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import {
  CharacterSchema,
  DnaSchema,
  EpisodeSchema,
  LocationSchema,
  SceneSchema,
  StateSchema,
  type Character,
  type Dna,
  type Episode,
  type Location,
  type Scene,
  type State,
} from "./schemas";
import { projectPaths } from "./paths";
import { assertSafeSlug } from "./studio";

async function readJson(filepath: string): Promise<unknown> {
  const raw = await fs.readFile(filepath, "utf-8");
  return JSON.parse(raw);
}

async function readJsonDir<T>(dir: string, schema: { parse: (x: unknown) => T }): Promise<T[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const jsons = entries.filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const items = await Promise.all(
    jsons.map(async (f) => schema.parse(await readJson(path.join(dir, f)))),
  );
  return items;
}

export async function readDna(slug: string): Promise<Dna> {
  assertSafeSlug(slug);
  return DnaSchema.parse(await readJson(projectPaths(slug).dna));
}

export async function readState(slug: string): Promise<State> {
  assertSafeSlug(slug);
  try {
    return StateSchema.parse(await readJson(projectPaths(slug).state));
  } catch {
    return { lastBalance: null, lastSyncAt: null, recentJobs: [] };
  }
}

export const readAllCharacters = (slug: string): Promise<Character[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).charactersDir, CharacterSchema);
};
export const readAllLocations = (slug: string): Promise<Location[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).locationsDir, LocationSchema);
};
export const readAllScenes = (slug: string): Promise<Scene[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).scenesDir, SceneSchema);
};
export const readAllEpisodes = (slug: string): Promise<Episode[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).episodesDir, EpisodeSchema);
};
```

**Step 2: Update `lib/content.test.ts`**

The test currently mocks `paths.dna`, `paths.charactersDir`, etc. via `vi.spyOn(paths, ...)`. Change the mocking strategy: spy on `repoRoot()` so `projectPaths("test-project")` resolves under the tmp dir. Set up the tmp tree as `<tmpRoot>/projects/test-project/content/...`. Update every test call to pass `"test-project"`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAllCharacters,
  readAllEpisodes,
  readAllLocations,
  readAllScenes,
  readDna,
  readState,
} from "./content";
import * as pathsModule from "./paths";

describe("content readers", () => {
  let tmpRoot: string;
  let projectDir: string;
  const slug = "test-project";

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-content-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "locations"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "episodes"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Then update every test body to pass `slug` and write under `projectDir` instead of `tmpRoot`.
  // E.g.:
  //   await fs.writeFile(path.join(projectDir, "dna.json"), JSON.stringify(dna));
  //   expect(await readDna(slug)).toMatchObject(dna);
  //
  // Translate every existing test body the same way.
});
```

Walk through each existing test in the file and apply the same translation: writes go to `projectDir/...`, calls take `slug` as the first arg.

**Step 3: Run the tests**

```bash
pnpm --filter dashboard test -- content.test.ts
```

Expected: all pass.

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: lots of TypeScript errors at every call site of `readDna()`, `readState()`, etc. — these are pages and the layout. **Don't fix them in this task.** They'll be fixed in Task 7 when we move the pages.

**Step 5: Commit**

```bash
git add apps/dashboard/lib/content.ts apps/dashboard/lib/content.test.ts
git commit -m "refactor(dashboard): thread projectSlug through content readers

Content readers now take a slug. Test mocks repoRoot() and writes
fixtures under <tmp>/projects/<slug>/content/. Page-level callers
will be updated when pages move under app/projects/[slug]/."
```

---

## Task 5: Thread `slug` through `lib/mutations.ts`

**Files:**
- Modify: `apps/dashboard/lib/mutations.ts`
- Modify: `apps/dashboard/lib/mutations.test.ts`

**Step 1: Update mutations to take a slug**

Replace `apps/dashboard/lib/mutations.ts`. Key changes:

- Import `projectPaths` from `./paths` and `assertSafeSlug` from `./studio`.
- Remove the legacy `paths` import.
- Replace `DIRS` map with a function:
  ```ts
  function dirsFor(slug: string) {
    const p = projectPaths(slug);
    return {
      characters: p.charactersDir,
      locations: p.locationsDir,
      scenes: p.scenesDir,
      episodes: p.episodesDir,
    } as const;
  }
  ```
- Update `assertSafeId` to take `(slug, type, id)` and resolve via `dirsFor(slug)`.
- `readEntity`, `updateEntityField`, `selectTake`, `deleteTake`, all gain a `slug` first parameter and call `assertSafeSlug(slug)`.
- For dna: `projectPaths(slug).dna` instead of `paths.dna`.
- In `deleteTake`, the media unlink path now resolves under `projectPaths(slug).mediaDir`. Change the strip prefix from `"media/"` to: it's still `media/` (paths stored in JSON are project-relative — see Task 9 below for why). So the existing code shape works; just point `mediaDir` at the project's media dir.
- Keep `writeAtomic` as-is — it's a generic helper that takes an absolute path.

(Use the existing function bodies as the reference; only the path resolution changes.)

**Step 2: Update `lib/mutations.test.ts`**

Same translation as Task 4: spy on `repoRoot()`, set up `<tmp>/projects/test-project/content/{characters,locations,scenes}/`, pass `"test-project"` as the first arg to every mutation call.

The first few lines of `beforeEach` become:

```ts
tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-mut-"));
const projectDir = path.join(tmpRoot, "projects", "test-project", "content");
await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
await fs.mkdir(path.join(projectDir, "locations"), { recursive: true });
await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
```

Translate every test body: writes go under `projectDir/...`, calls take `"test-project"` as the first arg.

For `deleteTake` tests that exercise media-file unlinking: write the media file under `path.join(tmpRoot, "projects", "test-project", "media", "characters", "<id>", "<jobId>.png")` (mirror the `imagePath` field in the JSON, which stays `media/characters/<id>/<jobId>.png`).

**Step 3: Run the mutation tests**

```bash
pnpm --filter dashboard test -- mutations.test.ts
```

Expected: all pass.

**Step 4: Run the full test suite**

```bash
pnpm test
```

Expected: pass. Typecheck will still fail at API-route call sites — fixed in Task 6.

**Step 5: Commit**

```bash
git add apps/dashboard/lib/mutations.ts apps/dashboard/lib/mutations.test.ts
git commit -m "refactor(dashboard): thread projectSlug through entity mutations"
```

---

## Task 6: Move API routes under `/api/projects/[slug]/...`

**Files:**
- Move: `app/api/entity/` → `app/api/projects/[slug]/entity/`
- Modify: each route handler to extract `slug` from params and pass it through

**Step 1: Move the route files**

```bash
mkdir -p apps/dashboard/app/api/projects/\[slug\]
git mv apps/dashboard/app/api/entity apps/dashboard/app/api/projects/\[slug\]/entity
```

The five route files now live at:
- `app/api/projects/[slug]/entity/[type]/[id]/route.ts`
- `app/api/projects/[slug]/entity/[type]/[id]/select-take/route.ts`
- `app/api/projects/[slug]/entity/[type]/[id]/take/[jobId]/route.ts`
- `app/api/projects/[slug]/entity/scenes/[id]/select-first-frame/route.ts`
- `app/api/projects/[slug]/entity/scenes/[id]/first-frame/[jobId]/route.ts`

**Step 2: Update each route handler**

For every route, update the params type and pass `slug` to mutation calls. Example for `app/api/projects/[slug]/entity/[type]/[id]/route.ts`:

```ts
// Before:
export async function PATCH(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await ctx.params;
  // ...
  await updateEntityField(type, id, field, value);
}

// After:
export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string; type: string; id: string }> }) {
  const { slug, type, id } = await ctx.params;
  // ...
  await updateEntityField(slug, type, id, field, value);
}
```

Apply the analogous change to all five route files. If a route catches `EntityValidationError`-shaped errors and the `assertSafeSlug` call now throws, treat it as a 400 (invalid slug).

**Step 3: Update the call sites in pages and components**

The dashboard pages and components currently fetch with URLs like `/api/entity/characters/foo/select-take`. These break now. Search and replace:

```bash
grep -rn "/api/entity/" apps/dashboard/app
```

Every match needs the slug threaded. **Defer this fix to Task 7 and Task 8** when we move the pages — easier to do it in one shot.

**Step 4: Run the test suite**

```bash
pnpm typecheck
```

Expected: still failing in pages — that's fine, fixed in Task 7. The mutation tests should pass.

```bash
pnpm test
```

Expected: pass.

**Step 5: Commit**

```bash
git add apps/dashboard/app/api
git commit -m "refactor(dashboard): scope entity API routes under /api/projects/[slug]/

Pages still link to the old paths; fixed in subsequent commits."
```

---

## Task 7: Move dashboard pages under `/projects/[slug]/...`

**Files:**
- Move: every existing page under `app/<tab>/...` to `app/projects/[slug]/<tab>/...`
- Modify: each page to read `slug` from params and pass it to readers
- Modify: `app/components/Header.tsx` to scope tab links under the slug

**Step 1: Move the page files**

```bash
mkdir -p apps/dashboard/app/projects/\[slug\]
cd apps/dashboard/app/projects/\[slug\]
mv ../../dna .
mv ../../characters .
mv ../../locations .
mv ../../scenes .
mv ../../episodes .
cd -
```

After this, `app/projects/[slug]/dna/page.tsx` etc. exist. (The `[slug]` directory becomes a Next.js route segment.)

Add a layout at `app/projects/[slug]/layout.tsx` that reads DNA + state for the slug (used by Header for the project name and credit display):

```tsx
import { readDna, readState } from "@/lib/content";
import Header from "@/app/components/Header";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dna = await readDna(slug).catch(() => null);
  const state = await readState(slug);
  return (
    <>
      <Header title={dna?.title ?? slug} state={state} slug={slug} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
```

**Step 2: Update each page to read `slug` from params**

Every moved page goes from this:

```tsx
export default async function CharactersPage() {
  const characters = await readAllCharacters();
  // ...
}
```

To this:

```tsx
export default async function CharactersPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const characters = await readAllCharacters(slug);
  // ...
}
```

Apply this pattern to every page: dna, characters, locations, scenes (list and detail), episodes.

In every page that builds links to other pages or media, prefix the slug:
- Internal route links: `/dna` → `` `/projects/${slug}/dna` ``
- Media URLs: rendered via `mediaUrl(...)` — see Task 9 for media URL changes; for now, leave the `mediaUrl` calls as-is and Task 9 will update the helper signature.

**Step 3: Update Header to take a slug**

Modify `apps/dashboard/app/components/Header.tsx` to take a `slug` prop and scope every tab link:

```tsx
export default function Header({ title, state, slug }: { title: string; state: State; slug: string }) {
  const TABS = [
    { href: `/projects/${slug}/dna`, label: "DNA" },
    { href: `/projects/${slug}/characters`, label: "Characters" },
    { href: `/projects/${slug}/locations`, label: "Locations" },
    { href: `/projects/${slug}/scenes`, label: "Scenes" },
    { href: `/projects/${slug}/episodes`, label: "Episodes" },
  ];
  // Plus a "← all projects" link or breadcrumb back to /:
  // <Link href="/" className="text-xs text-neutral-400">← all projects</Link>
  // ...rest unchanged
}
```

Also update the layout title to "slopstudio" — but wait until Task 12 to put in the rebrand.

**Step 4: Update fetch URLs in client components**

Search for `/api/entity/` in client components (TakeStrip, FirstFrameSection, EditableText, etc.). Each component that makes a fetch needs the slug. Two approaches:

1. **Pass `slug` down via props.** Cleanest, follows React data-flow. Every page that renders e.g. `<TakeStrip ...>` now passes `slug` and the component builds URLs like `` `/api/projects/${slug}/entity/characters/${id}/select-take` ``.
2. **Read `slug` from `usePathname()`.** Less prop-drilling, but feels brittle.

Use option 1. Walk every client component that fetches `/api/entity/...`, add a `slug: string` prop, and pass it from each parent page that renders it.

**Step 5: Update root `app/page.tsx`**

Currently `app/page.tsx` does `redirect("/dna")`. Replace it with a placeholder for now:

```tsx
export default function Home() {
  return <div className="p-8 text-neutral-400">Project gallery — coming in Task 10.</div>;
}
```

**Step 6: Update root `app/layout.tsx`**

The current root layout reads DNA/state at the root and renders Header. After this task the Header lives in `app/projects/[slug]/layout.tsx`. Strip Header from the root layout:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

(The home page and the project layout will each render whatever chrome they need.)

**Step 7: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

Expected: both pass.

**Step 8: Manual verification**

```bash
pnpm dev
```

Visit `http://localhost:3000/projects/cambrian-docuseries/dna` — the Cambrian DNA page should render exactly as before. Click each tab — they all work. Try editing a field — the save still hits the API and persists. (Media images may show as broken until Task 9; that's fine.)

Stop the dev server.

**Step 9: Commit**

```bash
git add apps/dashboard/app
git commit -m "refactor(dashboard): scope pages and Header under /projects/[slug]/

All five tabs (DNA, Characters, Locations, Scenes, Episodes) now live
at /projects/<slug>/<tab>. Client components receive slug as a prop
so they can build /api/projects/[slug]/... URLs. Root / shows a
placeholder for the gallery (Task 10)."
```

---

## Task 8: Move scene-detail and first-frame routes under the slug

**Files:**
- Verify all the API routes under `app/api/projects/[slug]/entity/...` are reachable
- Modify any client components still hitting `/api/entity/...`

**Step 1: Grep for stale URLs**

```bash
grep -rn "'/api/entity\|\"/api/entity\|\`/api/entity" apps/dashboard
```

Expected: zero matches. If any remain, fix them.

**Step 2: Grep for stale page URLs**

```bash
grep -rn "'/dna\|'/characters\|'/locations\|'/scenes\|'/episodes" apps/dashboard
```

Replace any internal navigation that still points at root-level tabs with `` `/projects/${slug}/...` ``.

**Step 3: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

Expected: pass.

**Step 4: Commit (skip if no changes)**

```bash
git add -A
git commit -m "fix(dashboard): replace lingering root-level URLs with /projects/[slug]/" || true
```

---

## Task 9: Move media route under the slug + update `mediaUrl`

**Files:**
- Move: `app/media/[...path]/route.ts` → `app/projects/[slug]/media/[...path]/route.ts`
- Modify: the route handler to take `slug` and resolve under `projectPaths(slug).mediaDir`
- Modify: `apps/dashboard/lib/media.ts` — `mediaUrl(slug, repoRelativePath)`

**Design note on stored paths:** Existing JSON stores `imagePath: "media/characters/foo/abc.png"`. We treat that as **project-relative** — `media/...` means `projects/<slug>/media/...`. No JSON migration. The URL helper now needs the slug to build a URL.

**Step 1: Move the route**

```bash
mkdir -p apps/dashboard/app/projects/\[slug\]/media
git mv apps/dashboard/app/media/\[...path\] apps/dashboard/app/projects/\[slug\]/media/\[...path\]
rmdir apps/dashboard/app/media
```

**Step 2: Update the route handler**

Edit `apps/dashboard/app/projects/[slug]/media/[...path]/route.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { projectPaths } from "@/lib/paths";
import { assertSafeSlug } from "@/lib/studio";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path: parts } = await ctx.params;
  try {
    assertSafeSlug(slug);
  } catch {
    return new Response("invalid slug", { status: 400 });
  }
  const mediaDir = projectPaths(slug).mediaDir;
  const fullPath = path.join(mediaDir, ...parts);

  // Path traversal guard
  const resolved = path.resolve(fullPath);
  const mediaRoot = path.resolve(mediaDir);
  if (!resolved.startsWith(mediaRoot + path.sep) && resolved !== mediaRoot) {
    return new Response("forbidden", { status: 403 });
  }

  // Symlink defense
  let realPath: string;
  try {
    realPath = await fs.realpath(resolved);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!realPath.startsWith(mediaRoot + path.sep) && realPath !== mediaRoot) {
    return new Response("forbidden", { status: 403 });
  }

  // (Rest of body — content-type map and Response — unchanged.)
}
```

**Step 3: Update `mediaUrl`**

Edit `apps/dashboard/lib/media.ts`:

```ts
export function mediaUrl(slug: string, repoRelativePath: string): string {
  const normalized = repoRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const stripped = normalized.startsWith("media/")
    ? normalized.slice("media/".length)
    : normalized;
  return `/projects/${slug}/media/${stripped}`;
}
```

**Step 4: Update every `mediaUrl(...)` call site**

```bash
grep -rn "mediaUrl(" apps/dashboard/app
```

Each call needs the slug threaded through. Example before/after in a page:

```tsx
// before
<img src={mediaUrl(take.imagePath)} ... />
// after
<img src={mediaUrl(slug, take.imagePath)} ... />
```

For client components, `slug` is already a prop after Task 7.

**Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: pass. If any `mediaUrl` call site is missed, the typechecker will fail and tell you exactly where.

**Step 6: Manual verification**

```bash
pnpm dev
```

Open `/projects/cambrian-docuseries/characters` — every character thumbnail loads. Open `/projects/cambrian-docuseries/scenes` — scene first-frames load. Open the network tab in DevTools and confirm the URLs are `/projects/cambrian-docuseries/media/...`.

Stop the dev server.

**Step 7: Commit**

```bash
git add apps/dashboard/app apps/dashboard/lib/media.ts
git commit -m "refactor(dashboard): scope media route + mediaUrl under project slug"
```

---

## Task 10: Project gallery at `/`

**Files:**
- Modify: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/lib/projects.ts`
- Create: `apps/dashboard/lib/projects.test.ts`

**Step 1: Write the failing test for `listProjects()`**

Create `apps/dashboard/lib/projects.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "./projects";
import * as pathsModule from "./paths";

describe("listProjects", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-list-"));
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("returns [] when projects/ doesn't exist", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("returns one entry per subdirectory of projects/", async () => {
    const a = path.join(tmpRoot, "projects", "alpha", "content");
    const b = path.join(tmpRoot, "projects", "beta", "content");
    await fs.mkdir(a, { recursive: true });
    await fs.mkdir(b, { recursive: true });
    await fs.writeFile(
      path.join(a, "dna.json"),
      JSON.stringify({
        title: "Alpha", concept: "c", stylePrompt: "s", narratorVoice: "n",
        aspectRatio: "9:16", videoModel: "v", characterImageModel: "c",
        characterRefAspectRatio: "16:9", characterRefTemplate: "{imagePrompt}",
        locationImageModel: "l", locationRefAspectRatio: "16:9",
        locationRefTemplate: "{imagePrompt}",
      }),
    );
    // beta has no dna.json — should still appear, with title falling back to slug.
    const result = await listProjects();
    const slugs = result.map((p) => p.slug).sort();
    expect(slugs).toEqual(["alpha", "beta"]);
    const alpha = result.find((p) => p.slug === "alpha")!;
    expect(alpha.title).toBe("Alpha");
    const beta = result.find((p) => p.slug === "beta")!;
    expect(beta.title).toBe("beta"); // fallback
  });

  it("ignores files (only directories)", async () => {
    await fs.mkdir(path.join(tmpRoot, "projects"), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, "projects", "stray.txt"), "x");
    expect(await listProjects()).toEqual([]);
  });

  it("ignores hidden directories", async () => {
    await fs.mkdir(path.join(tmpRoot, "projects", ".trash"), { recursive: true });
    expect(await listProjects()).toEqual([]);
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
pnpm --filter dashboard test -- projects.test.ts
```

Expected: FAIL.

**Step 3: Implement `listProjects()`**

Create `apps/dashboard/lib/projects.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { studioPaths, projectPaths } from "./paths";
import { DnaSchema } from "./schemas";

export type ProjectListEntry = {
  slug: string;
  title: string;
  charCount: number;
  locCount: number;
  sceneCount: number;
  thumbnailPath: string | null; // repo-relative (e.g. "media/characters/foo/x.png"); null if none
};

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function safeReadJson(filepath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filepath, "utf-8"));
  } catch {
    return null;
  }
}

async function countJsonFiles(dir: string): Promise<number> {
  return (await safeReadDir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length;
}

async function firstThumbnailFor(slug: string): Promise<string | null> {
  // Pick the first character with a selectedTakeId pointing at a .png take
  const charsDir = projectPaths(slug).charactersDir;
  const files = (await safeReadDir(charsDir)).filter((f) => f.endsWith(".json"));
  for (const f of files.sort()) {
    const data = await safeReadJson(path.join(charsDir, f));
    if (!data || typeof data !== "object") continue;
    const d = data as { selectedTakeId?: string | null; takes?: Array<{ jobId: string; imagePath?: string }> };
    if (!d.selectedTakeId || !Array.isArray(d.takes)) continue;
    const sel = d.takes.find((t) => t.jobId === d.selectedTakeId);
    if (sel?.imagePath) return sel.imagePath;
  }
  return null;
}

export async function listProjects(): Promise<ProjectListEntry[]> {
  const dirEntries = await safeReadDir(studioPaths.projectsDir);
  const projects: ProjectListEntry[] = [];

  for (const name of dirEntries) {
    if (name.startsWith(".")) continue;
    const stat = await fs.stat(path.join(studioPaths.projectsDir, name)).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const p = projectPaths(name);
    const dnaRaw = await safeReadJson(p.dna);
    const dna = dnaRaw ? DnaSchema.safeParse(dnaRaw) : null;
    const title = dna?.success ? dna.data.title : name;

    projects.push({
      slug: name,
      title,
      charCount:  await countJsonFiles(p.charactersDir),
      locCount:   await countJsonFiles(p.locationsDir),
      sceneCount: await countJsonFiles(p.scenesDir),
      thumbnailPath: await firstThumbnailFor(name),
    });
  }
  return projects.sort((a, b) => a.slug.localeCompare(b.slug));
}
```

**Step 4: Run the test to verify pass**

```bash
pnpm --filter dashboard test -- projects.test.ts
```

Expected: pass.

**Step 5: Build the gallery page**

Replace `apps/dashboard/app/page.tsx`:

```tsx
import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { readStudioConfig } from "@/lib/studio";
import { mediaUrl } from "@/lib/media";

export default async function Home() {
  const studio = await readStudioConfig();
  const projects = await listProjects();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-mono text-lg tracking-wide text-neutral-100">{studio.name}</h1>
        <p className="text-xs text-neutral-500 font-mono">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-sm text-neutral-400">
          No projects yet. In your terminal, tell Claude:<br />
          <code className="text-neutral-300 mt-2 inline-block">
            Set up a new slopstudio project called &lt;slug&gt; about &lt;concept&gt;.
          </code>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/projects/${p.slug}/dna`}
                data-slug={p.slug}
                className="block border border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-600 transition-colors"
              >
                <div className="aspect-video bg-neutral-900 flex items-center justify-center">
                  {p.thumbnailPath ? (
                    <img
                      src={mediaUrl(p.slug, p.thumbnailPath)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-neutral-600 font-mono">no thumbnail</span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-mono text-sm text-neutral-100">{p.title}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-1">
                    {p.charCount} char · {p.locCount} loc · {p.sceneCount} scene
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

(Note: the `<Link>` doesn't yet update `slopstudio.json.activeProjectSlug` — that's Task 11.)

**Step 6: Manual verification**

```bash
pnpm dev
```

Visit `http://localhost:3000/`. You should see one card for "Cambrian Cambria" (or whatever the demo's `dna.json.title` is) with a thumbnail of the Anomalocaris reference. Click → lands on `/projects/cambrian-docuseries/dna`.

Stop the dev server.

**Step 7: Commit**

```bash
git add apps/dashboard/app/page.tsx apps/dashboard/lib/projects.ts apps/dashboard/lib/projects.test.ts
git commit -m "feat(dashboard): project gallery at /"
```

---

## Task 11: Active-project sync route + click-to-switch

**Files:**
- Create: `apps/dashboard/app/api/active-project/route.ts`
- Modify: `apps/dashboard/app/page.tsx` (gallery cards POST on click)

**Step 1: Write the route**

Create `apps/dashboard/app/api/active-project/route.ts`:

```ts
import { writeActiveProjectSlug } from "@/lib/studio";

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { slug?: unknown }).slug !== "string"
  ) {
    return new Response("missing slug", { status: 400 });
  }
  try {
    await writeActiveProjectSlug((body as { slug: string }).slug);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "error", { status: 400 });
  }
  return new Response(null, { status: 204 });
}
```

**Step 2: Update gallery cards to fire-and-forget on click**

In `apps/dashboard/app/page.tsx`, replace the `<Link>` with a small client component that sends the PATCH then navigates. Create `apps/dashboard/app/components/ProjectCard.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProjectCard({
  slug,
  href,
  children,
}: { slug: string; href: string; children: React.ReactNode }) {
  const router = useRouter();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    fetch("/api/active-project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).finally(() => router.push(href));
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      data-slug={slug}
      className="block border border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-600 transition-colors"
    >
      {children}
    </Link>
  );
}
```

Then in the gallery page, use `<ProjectCard>` instead of `<Link>`.

**Step 3: Manual verification**

```bash
pnpm dev
```

Open `/`. Click the Cambrian card. Then check `slopstudio.json` on disk:

```bash
cat slopstudio.json
```

Expected: `activeProjectSlug` is `"cambrian-docuseries"`.

Stop the dev server.

**Step 4: Commit**

```bash
git add apps/dashboard/app/api/active-project apps/dashboard/app/page.tsx apps/dashboard/app/components/ProjectCard.tsx
git commit -m "feat(dashboard): PATCH /api/active-project + click-to-switch in gallery"
```

---

## Task 12: Update `instrumentation.ts` watcher

**Files:**
- Modify: `apps/dashboard/instrumentation.ts`

**Step 1: Point chokidar at the new tree**

Change the watch path from `paths.contentDir` to `<repoRoot>/projects/**/content/**` and update `routesFor` to extract the slug as well as the segment:

```ts
import { repoRoot, studioPaths } from "./lib/paths";
import path from "node:path";

// inside register():
const PROJECTS_DIR = studioPaths.projectsDir;

const ROUTE_FOR_BASENAME: Record<string, (slug: string) => string[]> = {
  "dna.json":      (s) => [`/projects/${s}/dna`],
  "_state.json":   (s) => [
    `/`,
    `/projects/${s}/dna`,
    `/projects/${s}/characters`,
    `/projects/${s}/locations`,
    `/projects/${s}/scenes`,
    `/projects/${s}/episodes`,
  ],
  characters: (s) => [`/projects/${s}/characters`, `/projects/${s}/scenes`, `/projects/${s}/episodes`, `/`],
  locations:  (s) => [`/projects/${s}/locations`, `/projects/${s}/scenes`, `/projects/${s}/episodes`],
  scenes:     (s) => [`/projects/${s}/scenes`, `/projects/${s}/episodes`, `/`],
  episodes:   (s) => [`/projects/${s}/episodes`],
};

const routesFor = (filepath: string): string[] => {
  // Match: ".../projects/<slug>/content/<basename-or-dir>/...".
  const idx = filepath.indexOf("/projects/");
  if (idx < 0) return [];
  const rest = filepath.slice(idx + "/projects/".length);
  const segments = rest.split("/");
  if (segments.length < 3 || segments[1] !== "content") return [];
  const slug = segments[0];
  const segment = segments[2];
  const builder = ROUTE_FOR_BASENAME[segment];
  return builder ? builder(slug) : [];
};

const watcher = chokidar.default.watch(PROJECTS_DIR, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  ignored: (p) => p.includes("/media/"),
});
```

**Step 2: Manual verification**

```bash
pnpm dev
```

In a second terminal, edit `projects/cambrian-docuseries/content/dna.json` (e.g. tweak the title). The dashboard at `/projects/cambrian-docuseries/dna` should auto-revalidate and show the new title within a second. Restore the file.

Stop the dev server.

**Step 3: Commit**

```bash
git add apps/dashboard/instrumentation.ts
git commit -m "refactor(dashboard): watch projects/**/content/** and revalidate scoped routes"
```

---

## Task 13: Remove the legacy `paths` export

**Files:**
- Modify: `apps/dashboard/lib/paths.ts`

**Step 1: Verify nothing imports the legacy export**

```bash
grep -rn "from \"@/lib/paths\"\|from \"./paths\"" apps/dashboard --include="*.ts" --include="*.tsx"
grep -rn "import { paths }\|import { paths," apps/dashboard --include="*.ts" --include="*.tsx"
```

If anything still imports `paths` (the legacy object), fix it now.

**Step 2: Delete the legacy export**

In `apps/dashboard/lib/paths.ts`, delete the `paths` export at the bottom of the file. Keep `repoRoot`, `projectRoot`, `projectPaths`, `studioPaths`.

**Step 3: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

Expected: pass.

**Step 4: Commit**

```bash
git add apps/dashboard/lib/paths.ts
git commit -m "refactor(dashboard): remove legacy non-scoped paths export"
```

---

## Task 14: Rebrand — package, app metadata, header text

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/app/layout.tsx` (metadata)

**Step 1: Rename root package**

In root `package.json`:

```json
{
  "name": "slopstudio",
  ...
}
```

**Step 2: Update dashboard metadata**

In `apps/dashboard/app/layout.tsx`, change the metadata:

```ts
export const metadata: Metadata = {
  title: "slopstudio",
  description: "Local-first folder for AI video making — Claude Code + Higgsfield",
};
```

**Step 3: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

**Step 4: Commit**

```bash
git add package.json apps/dashboard/app/layout.tsx
git commit -m "chore: rebrand cambria → slopstudio (package.json, page metadata)"
```

---

## Task 15: Rewrite `README.md`

**Files:**
- Modify: `README.md`

**Step 1: Replace the README content**

Overwrite `README.md` with the structure described in the design doc (section "Cold-start (README) flow"). The result should:

1. Open with one paragraph defining slopstudio as a local-first folder for AI video making — multi-project, Claude does writing/generation, dashboard is the visual workspace.
2. List prerequisites: Node 20+, pnpm 9+, Claude Code, Higgsfield account + Higgsfield MCP authenticated (link to higgsfield.ai docs).
3. Setup block: `git clone`, `pnpm install`, `pnpm dev`.
4. "Tour the demo" — open the dashboard at `http://localhost:3000`, click into Cambrian, walk through the 5 tabs.
5. "Make your first show" — *In the same Claude Code terminal*: `Set up a new slopstudio project called <slug> — a [aesthetic] series about [concept]. 9:16 vertical.`
6. "Switching projects" — talk to Claude (`switch over to <slug>`) or click a card on the gallery.
7. "Wiping the demo" — `rm -rf projects/cambrian-docuseries`.
8. "How it works" — short architecture: filesystem is the source of truth, every project is a folder under `projects/`, Claude is the author, dashboard is the viewer + thin mutation layer for select/delete, `slopstudio.json` tracks the active project.
9. Scripts section: `pnpm dev / build / test / typecheck / lint / format`.
10. License: MIT.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for slopstudio (multi-project flow)"
```

---

## Task 16: Add a top-level `CLAUDE.md` so Claude knows the layout

**Files:**
- Create: `CLAUDE.md` (at the repo root)

**Step 1: Write the file**

Create `/CLAUDE.md`:

```markdown
# slopstudio

This is **slopstudio** — a multi-project AI video studio. Every project lives under `projects/<slug>/` with `content/` (JSON source of truth) and `media/` (generated images and videos).

## Layout

```
slopstudio/
├── slopstudio.json                  # { name, activeProjectSlug }
├── projects/<slug>/
│   ├── content/{dna.json, _state.json, characters/, locations/, scenes/, episodes/}
│   └── media/{characters,locations,scenes}/<id>/<jobId>.{png,mp4}
├── apps/dashboard/                   # Next.js viewer at localhost:3000
└── README.md
```

## When the user asks you to work on a video

1. Read `slopstudio.json` to find `activeProjectSlug`. If they named a project, set `activeProjectSlug` to that slug (use the atomic-write pattern in `apps/dashboard/lib/mutations.ts`).
2. Read and write JSON only inside `projects/<activeProjectSlug>/content/`.
3. Download generated media into `projects/<activeProjectSlug>/media/...`. Store the file path in JSON as project-relative — e.g. `media/characters/anomalocaris/abc.png`.
4. Schemas live in `apps/dashboard/lib/schemas.ts`. Don't add fields without updating the schema and tests.

## When the user asks for a new project

```
projects/<new-slug>/content/dna.json        # write the DNA
projects/<new-slug>/content/characters/     # mkdir
projects/<new-slug>/content/locations/      # mkdir
projects/<new-slug>/content/scenes/         # mkdir
projects/<new-slug>/content/episodes/       # mkdir
```

Then update `slopstudio.json.activeProjectSlug` to the new slug.

The dashboard's chokidar watcher picks up new files automatically; refresh the gallery at `/` to see the new project card.

## Generation flow (Higgsfield MCP)

Same as before the multi-project change: stitch DNA's `stylePrompt` (and `characterRefTemplate` / `locationRefTemplate` for refs) onto the entity's prompt, call `mcp__higgsfield__generate_image` or `mcp__higgsfield__generate_video`, poll with `mcp__higgsfield__job_status`, download with the resulting URL, append a `take` to the entity JSON. The dashboard auto-revalidates; the user clicks the green checkmark to select.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add root CLAUDE.md describing the multi-project layout"
```

---

## Task 17: End-to-end manual smoke test

**Step 1: Fresh clone simulation**

```bash
pnpm install
pnpm dev
```

**Step 2: Walk the user flow**

1. Visit http://localhost:3000 → see Cambrian card on the gallery.
2. Click the card → land on `/projects/cambrian-docuseries/dna`.
3. Edit a field on DNA (e.g. tweak the title) → see it persist; reload to confirm.
4. Click Characters → see Anomalocaris and Trilobite. Confirm thumbnails load (network tab shows `/projects/cambrian-docuseries/media/characters/...`).
5. Click a character → make sure the take strip works; click the green checkmark on a different take → it switches selection.
6. Repeat for Locations and Scenes.
7. Episodes tab loads the storyboard view.
8. Inspect `slopstudio.json` — `activeProjectSlug` matches what was last clicked.
9. Tell Claude in a sibling terminal: `Add a placeholder character called "Hallucigenia" to the Cambrian project.` Claude writes a new file under `projects/cambrian-docuseries/content/characters/hallucigenia.json`. The Characters tab auto-revalidates and shows the new card.
10. Stop the dev server.

**Step 3: Run the full test suite + typecheck + lint**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green.

**Step 4: Final commit (none — verification only)**

If anything in steps 1–9 fails, file it as the next task; don't paper over it.

---

## Out of scope (not in this plan)

- Project creation UI, rename UI, delete UI. Claude or the user's shell handles those.
- Project gallery animations, sorting, filtering.
- Authentication, multi-user, cloud sync.
- Editing `slopstudio.json.name` from the UI (just edit the file).
- Migrating older projects with different schema versions — schemas haven't changed.
- A "switch project" dropdown in the project Header. The "← all projects" breadcrumb back to `/` (see Task 7) is sufficient for v1.
