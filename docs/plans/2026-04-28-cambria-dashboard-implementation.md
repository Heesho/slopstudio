# Cambria Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first Next.js viewer dashboard that renders filesystem-JSON state for a Planet-Earth-style Cambrian docuseries, with multi-take support and Claude-driven generation through the Higgsfield MCP.

**Architecture:** pnpm + Turborepo monorepo. `apps/dashboard` is a Next.js 15 App Router app whose server components read JSON files in `content/` and serve generated assets from `media/`. Claude (via Higgsfield MCP) is the only writer for creative state; the dashboard exposes two thin API routes solely for take selection/deletion. Live dev refresh via chokidar → revalidatePath.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v4, Zod, chokidar, lucide-react, Geist fonts, Vitest, pnpm, Turborepo, Biome.

**Reference design:** [docs/plans/2026-04-28-cambria-dashboard-design.md](./2026-04-28-cambria-dashboard-design.md) — read this first.

**Working location:** Repo root (`cambria-monorepo/`). The repo is empty besides `docs/` and `.gitignore`; no worktree needed.

---

## Phase 1: Monorepo Scaffolding

### Task 1: Workspace root setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `biome.json`

**Step 1: Create root `package.json`**

```json
{
  "name": "cambria-monorepo",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "biome format --write ."
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.6.3"
  }
}
```

**Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
```

**Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "lint": {},
    "typecheck": {},
    "test": {}
  }
}
```

**Step 4: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

**Step 5: Install root deps**

Run: `pnpm install`
Expected: lockfile created, no errors.

**Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json biome.json pnpm-lock.yaml
git commit -m "chore: scaffold monorepo (pnpm + turbo + biome)"
```

---

### Task 2: Next.js dashboard app scaffold

**Files:**
- Create: `apps/dashboard/` (entire Next.js app)

**Step 1: Initialize Next.js app**

Run from repo root:
```bash
pnpm create next-app@latest apps/dashboard \
  --typescript --tailwind --app --turbopack --eslint=false \
  --src-dir=false --import-alias="@/*" --use-pnpm --no-git
```

Expected: `apps/dashboard/` created with App Router, Tailwind v4, TypeScript.

**Step 2: Add `apps/dashboard/package.json` workspace deps**

Add inside `apps/dashboard/package.json`:
```json
"scripts": {
  "dev": "next dev --port 3000",
  "build": "next build",
  "start": "next start",
  "lint": "biome lint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
},
"dependencies": {
  "next": "^15.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "zod": "^3.23.8",
  "chokidar": "^4.0.1",
  "lucide-react": "^0.460.0"
},
"devDependencies": {
  "@types/node": "^22.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "typescript": "^5.6.3",
  "vitest": "^2.1.4",
  "tailwindcss": "^4.0.0"
}
```

Run: `pnpm install` from repo root.

**Step 3: Replace `apps/dashboard/app/page.tsx`** with redirect to `/dna`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dna");
}
```

**Step 4: Verify dev server boots**

Run: `pnpm dev --filter=dashboard`
Expected: `localhost:3000` redirects to `/dna` (will 404 since page doesn't exist yet — that's OK).
Stop the dev server.

**Step 5: Commit**

```bash
git add apps/dashboard pnpm-lock.yaml
git commit -m "chore: scaffold Next.js dashboard app"
```

---

## Phase 2: Schemas & Filesystem Utilities

### Task 3: Zod schemas for all entities

**Files:**
- Create: `apps/dashboard/lib/schemas.ts`
- Create: `apps/dashboard/lib/schemas.test.ts`

**Step 1: Write failing tests**

```ts
// apps/dashboard/lib/schemas.test.ts
import { describe, expect, it } from "vitest";
import { CharacterSchema, DnaSchema, EpisodeSchema, LocationSchema, SceneSchema, StateSchema } from "./schemas";

describe("schemas", () => {
  it("validates a minimal DNA file", () => {
    const valid = {
      title: "Cambria",
      concept: "test",
      stylePrompt: "style",
      narratorVoice: "voice",
      aspectRatio: "9:16",
      videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2",
      characterRefAspectRatio: "16:9",
      characterRefTemplate: "ref {imagePrompt}",
      locationImageModel: "nano_banana_2",
      locationRefAspectRatio: "16:9",
      locationRefTemplate: "loc {imagePrompt}",
    };
    expect(DnaSchema.parse(valid)).toEqual(valid);
  });

  it("validates a character with takes", () => {
    const valid = {
      id: "anomalocaris",
      name: "Anomalocaris",
      imagePrompt: "p",
      description: "d",
      imageModel: "nano_banana_2",
      takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", imagePath: "media/x.png", status: "done", generatedAt: "2026-04-28T12:00:00Z" }],
      selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(CharacterSchema.parse(valid)).toBeTruthy();
  });

  it("rejects an invalid status", () => {
    expect(() => CharacterSchema.parse({ id: "x", name: "X", imagePrompt: "", description: "", imageModel: "m", takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "weird" }], selectedTakeId: null })).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter=dashboard test`
Expected: FAIL — schemas don't exist.

**Step 3: Create schemas**

```ts
// apps/dashboard/lib/schemas.ts
import { z } from "zod";

export const TakeStatus = z.enum(["pending", "generating", "done", "failed"]);
export type TakeStatus = z.infer<typeof TakeStatus>;

const ImageTake = z.object({
  jobId: z.string().uuid(),
  imagePath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

const VideoTake = z.object({
  jobId: z.string().uuid(),
  videoPath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

export const DnaSchema = z.object({
  title: z.string(),
  concept: z.string(),
  stylePrompt: z.string(),
  narratorVoice: z.string(),
  aspectRatio: z.string(),
  videoModel: z.string(),
  characterImageModel: z.string(),
  characterRefAspectRatio: z.string(),
  characterRefTemplate: z.string(),
  locationImageModel: z.string(),
  locationRefAspectRatio: z.string(),
  locationRefTemplate: z.string(),
});
export type Dna = z.infer<typeof DnaSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  imagePrompt: z.string(),
  description: z.string(),
  imageModel: z.string(),
  takes: z.array(ImageTake),
  selectedTakeId: z.string().uuid().nullable(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  imagePrompt: z.string(),
  imageModel: z.string(),
  takes: z.array(ImageTake),
  selectedTakeId: z.string().uuid().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  prompt: z.string(),
  narration: z.string(),
  characters: z.array(z.string()),
  locations: z.array(z.string()),
  duration: z.number().int().positive(),
  videoModel: z.string(),
  takes: z.array(VideoTake),
  selectedTakeId: z.string().uuid().nullable(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const EpisodeSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  hook: z.string(),
  scenes: z.array(z.string()),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const StateSchema = z.object({
  lastBalance: z.number().nullable(),
  lastSyncAt: z.string().nullable(),
  recentJobs: z.array(z.object({
    jobId: z.string(),
    entity: z.string(),
    status: z.string(),
    completedAt: z.string(),
  })).default([]),
});
export type State = z.infer<typeof StateSchema>;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter=dashboard test`
Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): add Zod schemas for DNA, characters, locations, scenes, episodes, state"
```

---

### Task 4: Filesystem read utilities

**Files:**
- Create: `apps/dashboard/lib/content.ts`
- Create: `apps/dashboard/lib/content.test.ts`
- Create: `apps/dashboard/lib/paths.ts`

**Step 1: Create path resolver**

```ts
// apps/dashboard/lib/paths.ts
import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd(), "../..");

export const paths = {
  contentDir: path.join(REPO_ROOT, "content"),
  mediaDir: path.join(REPO_ROOT, "media"),
  dna: path.join(REPO_ROOT, "content/dna.json"),
  state: path.join(REPO_ROOT, "content/_state.json"),
  charactersDir: path.join(REPO_ROOT, "content/characters"),
  locationsDir: path.join(REPO_ROOT, "content/locations"),
  scenesDir: path.join(REPO_ROOT, "content/scenes"),
  episodesDir: path.join(REPO_ROOT, "content/episodes"),
};
```

**Step 2: Write failing test**

```ts
// apps/dashboard/lib/content.test.ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDna, readAllCharacters } from "./content";
import { paths } from "./paths";

describe("content readers", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-test-"));
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    vi.spyOn(paths, "dna", "get").mockReturnValue(path.join(tmpRoot, "dna.json"));
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("readDna parses dna.json", async () => {
    const dna = {
      title: "Test", concept: "c", stylePrompt: "s", narratorVoice: "n",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2", characterRefAspectRatio: "16:9", characterRefTemplate: "{imagePrompt}",
      locationImageModel: "nano_banana_2", locationRefAspectRatio: "16:9", locationRefTemplate: "{imagePrompt}",
    };
    await fs.writeFile(path.join(tmpRoot, "dna.json"), JSON.stringify(dna));
    expect(await readDna()).toEqual(dna);
  });

  it("readAllCharacters returns [] when dir is empty", async () => {
    expect(await readAllCharacters()).toEqual([]);
  });
});
```

> Note: the test mocks `paths` exports. Convert `paths` to a getter object so it's mockable, or alternatively pass a base dir into reader functions. Use whichever is cleaner.

**Step 3: Run test, expect FAIL**

Run: `pnpm --filter=dashboard test content.test.ts`
Expected: FAIL.

**Step 4: Implement readers**

```ts
// apps/dashboard/lib/content.ts
import fs from "node:fs/promises";
import path from "node:path";
import { CharacterSchema, DnaSchema, EpisodeSchema, LocationSchema, SceneSchema, StateSchema, type Character, type Dna, type Episode, type Location, type Scene, type State } from "./schemas";
import { paths } from "./paths";

async function readJson<T>(filepath: string): Promise<unknown> {
  const raw = await fs.readFile(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

async function readJsonDir<T>(dir: string, schema: { parse: (x: unknown) => T }): Promise<T[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const jsons = entries.filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const items = await Promise.all(jsons.map(async (f) => {
    const data = await readJson(path.join(dir, f));
    return schema.parse(data);
  }));
  return items;
}

export async function readDna(): Promise<Dna> {
  return DnaSchema.parse(await readJson(paths.dna));
}

export async function readState(): Promise<State> {
  try {
    return StateSchema.parse(await readJson(paths.state));
  } catch {
    return { lastBalance: null, lastSyncAt: null, recentJobs: [] };
  }
}

export const readAllCharacters = () => readJsonDir<Character>(paths.charactersDir, CharacterSchema);
export const readAllLocations = () => readJsonDir<Location>(paths.locationsDir, LocationSchema);
export const readAllScenes = () => readJsonDir<Scene>(paths.scenesDir, SceneSchema);
export const readAllEpisodes = () => readJsonDir<Episode>(paths.episodesDir, EpisodeSchema);
```

**Step 5: Run tests, expect PASS**

Run: `pnpm --filter=dashboard test`
Expected: PASS for all schema + content tests.

**Step 6: Commit**

```bash
git add apps/dashboard/lib/
git commit -m "feat(content): add filesystem readers for DNA, characters, locations, scenes, episodes, state"
```

---

## Phase 3: Dashboard UI

### Task 5: App shell, layout, navigation

**Files:**
- Modify: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/components/Header.tsx`
- Create: `apps/dashboard/app/components/StatusChip.tsx`
- Modify: `apps/dashboard/app/globals.css`

**Step 1: Replace `app/layout.tsx`** with a layout that loads DNA + state and renders Header.

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Header from "./components/Header";
import { readDna, readState } from "@/lib/content";

export const metadata: Metadata = { title: "Cambria" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dna = await readDna().catch(() => null);
  const state = await readState();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen">
        <Header title={dna?.title ?? "Cambria"} state={state} />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

> Run `pnpm --filter=dashboard add geist` to install Geist fonts.

**Step 2: Create `Header.tsx`** with tab nav + balance widget.

```tsx
import Link from "next/link";
import type { State } from "@/lib/schemas";

const TABS = [
  { href: "/dna", label: "DNA" },
  { href: "/characters", label: "Characters" },
  { href: "/locations", label: "Locations" },
  { href: "/scenes", label: "Scenes" },
  { href: "/episodes", label: "Episodes" },
];

export default function Header({ title, state }: { title: string; state: State }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <h1 className="font-mono text-sm tracking-wide text-neutral-300">{title}</h1>
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="text-sm text-neutral-300 hover:text-white">
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-neutral-400 font-mono">
          {state.lastBalance !== null ? `${state.lastBalance.toFixed(0)} credits` : "no balance yet"}
        </div>
      </div>
    </header>
  );
}
```

**Step 3: Create `StatusChip.tsx`** (reusable across pages).

```tsx
import type { TakeStatus } from "@/lib/schemas";

const COLORS: Record<TakeStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  generating: "bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function StatusChip({ status }: { status: TakeStatus }) {
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${COLORS[status]}`}>{status}</span>;
}
```

**Step 4: Verify**

Run dev server, ensure header renders without errors at `/dna` (will 404 still — fine).

**Step 5: Commit**

```bash
git add apps/dashboard/app/
git commit -m "feat(dashboard): add layout, header, status chip"
```

---

### Task 6: DNA page

**Files:**
- Create: `apps/dashboard/app/dna/page.tsx`

**Step 1: Implement page**

Server component that reads DNA and renders all fields in a clean card. Use `<dl>` for label/value pairs; `<pre>` for the prompts/templates. Empty state when DNA file missing.

**Step 2: Visual verify** at `localhost:3000/dna`. Should render even with no `content/dna.json` (empty state).

**Step 3: Commit**

```bash
git add apps/dashboard/app/dna/
git commit -m "feat(dashboard): add DNA page"
```

---

### Task 7: Characters page (with take strip + select/delete buttons)

**Files:**
- Create: `apps/dashboard/app/characters/page.tsx`
- Create: `apps/dashboard/app/components/EntityCard.tsx`
- Create: `apps/dashboard/app/components/TakeStrip.tsx`
- Create: `apps/dashboard/app/components/MediaServer.tsx` (route handler to serve `media/`)

**Step 1: Add `media/` static-serving route**

Next.js public dir doesn't reach outside the app. Add a route handler:

```ts
// apps/dashboard/app/media/[...path]/route.ts
import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/paths";

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const fullPath = path.join(paths.mediaDir, ...parts);
  const rel = path.relative(paths.mediaDir, fullPath);
  if (rel.startsWith("..")) return new Response("forbidden", { status: 403 });
  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
      ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm",
    };
    return new Response(new Uint8Array(data), { headers: { "Content-Type": types[ext] ?? "application/octet-stream" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
```

URLs become `/media/characters/anomalocaris/{jobId}.png`.

**Step 2: Build `EntityCard.tsx`** (generic, reused for characters and locations) — shows selected take's image, takes strip, name, prompt, description (optional), cross-ref count.

**Step 3: Build `TakeStrip.tsx`** — renders thumbnail per take with `Select` and `Delete` buttons (client component; calls API routes).

**Step 4: Build `app/characters/page.tsx`** — server component, reads characters and scenes (for cross-ref counts), renders grid of EntityCards.

**Step 5: Visual verify** at `localhost:3000/characters` (empty state when no data).

**Step 6: Commit**

```bash
git add apps/dashboard/app/characters/ apps/dashboard/app/components/ apps/dashboard/app/media/
git commit -m "feat(dashboard): add characters page with take strip and media route"
```

---

### Task 8: Locations page

**Files:**
- Create: `apps/dashboard/app/locations/page.tsx`

Identical pattern to characters (no `description` field). Reuse `EntityCard` and `TakeStrip`.

**Commit:** `feat(dashboard): add locations page`

---

### Task 9: Scenes page

**Files:**
- Create: `apps/dashboard/app/scenes/page.tsx`
- Create: `apps/dashboard/app/components/SceneCard.tsx`
- Create: `apps/dashboard/app/components/VideoTakeStrip.tsx`

**Step 1: SceneCard** — header (title, status, "Ep N · Scene M"), 9:16 video player for selected take, video take strip with select/delete, prompt block (collapsible `<details>`), narration block (italic), character chips linking to character page, location chips, footer with duration + model + generatedAt.

**Step 2: Filter UI** — top bar with `<select>` for episode, `<select>` for status. Use URL search params (`?episode=ep-1&status=done`); read in server component for SSR filtering.

**Step 3: Visual verify**

**Step 4: Commit:** `feat(dashboard): add scenes page with video player and filters`

---

### Task 10: Episodes page

**Files:**
- Create: `apps/dashboard/app/episodes/page.tsx`
- Create: `apps/dashboard/app/components/StoryboardStrip.tsx`

**Step 1: StoryboardStrip** — for an episode, takes ordered scene list and renders horizontal strip of poster frames (use `<video>` with `preload="metadata"` for poster, or first-frame extraction at gen time later). Status chip below each thumbnail. Click a thumbnail → scrolls to scene on `/scenes?episode=...`.

**Step 2: Episodes page** — list episodes; each renders title, hook, status summary (`X / Y scenes done · ~Zs total`), then StoryboardStrip.

**Step 3: Commit:** `feat(dashboard): add episodes page with storyboard strips`

---

## Phase 4: Take Management API

### Task 11: PATCH select-take API route

**Files:**
- Create: `apps/dashboard/app/api/entity/[type]/[id]/select-take/route.ts`
- Create: `apps/dashboard/lib/mutations.ts`
- Create: `apps/dashboard/lib/mutations.test.ts`

**Step 1: Write failing test**

```ts
// apps/dashboard/lib/mutations.test.ts
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectTake } from "./mutations";
import { paths } from "./paths";

describe("selectTake", () => {
  let tmpRoot: string;
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-mut-"));
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
  });
  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("updates selectedTakeId in the JSON file", async () => {
    const id = "char1";
    const file = path.join(tmpRoot, "characters", `${id}.json`);
    const data = {
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [
        { jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" as const },
        { jobId: "660e8400-e29b-41d4-a716-446655440000", status: "done" as const },
      ],
      selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    };
    await fs.writeFile(file, JSON.stringify(data));
    await selectTake("characters", id, "660e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("660e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects a jobId that doesn't exist in takes", async () => {
    const id = "char2";
    const file = path.join(tmpRoot, "characters", `${id}.json`);
    await fs.writeFile(file, JSON.stringify({
      id, name: "C", imagePrompt: "", description: "", imageModel: "m",
      takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" as const }],
      selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    }));
    await expect(selectTake("characters", id, "999e8400-e29b-41d4-a716-446655440000")).rejects.toThrow();
  });
});
```

**Step 2: Run, expect FAIL**

**Step 3: Implement `selectTake`**

```ts
// apps/dashboard/lib/mutations.ts
import fs from "node:fs/promises";
import path from "node:path";
import { CharacterSchema, LocationSchema, SceneSchema } from "./schemas";
import { paths } from "./paths";

export type EntityType = "characters" | "locations" | "scenes";

const SCHEMAS = {
  characters: CharacterSchema,
  locations: LocationSchema,
  scenes: SceneSchema,
};

const DIRS: Record<EntityType, () => string> = {
  characters: () => paths.charactersDir,
  locations: () => paths.locationsDir,
  scenes: () => paths.scenesDir,
};

async function readEntity<K extends EntityType>(type: K, id: string) {
  const file = path.join(DIRS[type](), `${id}.json`);
  const raw = JSON.parse(await fs.readFile(file, "utf-8"));
  return { file, data: SCHEMAS[type].parse(raw) };
}

async function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await fs.rename(tmp, file);
}

export async function selectTake(type: EntityType, id: string, jobId: string) {
  const { file, data } = await readEntity(type, id);
  if (!data.takes.some((t) => t.jobId === jobId)) {
    throw new Error(`take ${jobId} not found on ${type}/${id}`);
  }
  await writeAtomic(file, { ...data, selectedTakeId: jobId });
}
```

**Step 4: Run, expect PASS**

**Step 5: Implement API route**

```ts
// apps/dashboard/app/api/entity/[type]/[id]/select-take/route.ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { selectTake } from "@/lib/mutations";

const Body = z.object({ jobId: z.string().uuid() });
const TypeSchema = z.enum(["characters", "locations", "scenes"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await ctx.params;
  const { jobId } = Body.parse(await req.json());
  const t = TypeSchema.parse(type);
  await selectTake(t, id, jobId);
  revalidatePath(`/${t}`);
  return NextResponse.json({ ok: true });
}
```

**Step 6: Commit:** `feat(api): PATCH select-take`

---

### Task 12: DELETE take API route

**Files:**
- Modify: `apps/dashboard/lib/mutations.ts` — add `deleteTake`
- Modify: `apps/dashboard/lib/mutations.test.ts` — add tests
- Create: `apps/dashboard/app/api/entity/[type]/[id]/take/[jobId]/route.ts`

**Step 1: Write tests** for `deleteTake`:
- removes the take from the array
- unlinks the file from `media/` (use a fake media dir for the test)
- if the deleted take was selected, falls back to most recent `done` take or `null`

**Step 2: Implement `deleteTake`:**

```ts
export async function deleteTake(type: EntityType, id: string, jobId: string) {
  const { file, data } = await readEntity(type, id);
  const take = data.takes.find((t) => t.jobId === jobId);
  if (!take) throw new Error(`take ${jobId} not found`);
  const filePath = (take as { imagePath?: string; videoPath?: string }).imagePath ?? (take as { videoPath?: string }).videoPath;
  if (filePath) {
    await fs.unlink(path.join(paths.mediaDir, "..", filePath)).catch(() => {});
  }
  const remaining = data.takes.filter((t) => t.jobId !== jobId);
  let nextSelected = data.selectedTakeId;
  if (data.selectedTakeId === jobId) {
    const newest = [...remaining].filter((t) => t.status === "done").sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""))[0];
    nextSelected = newest?.jobId ?? null;
  }
  await writeAtomic(file, { ...data, takes: remaining, selectedTakeId: nextSelected });
}
```

**Step 3: Implement DELETE route**

```ts
// apps/dashboard/app/api/entity/[type]/[id]/take/[jobId]/route.ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteTake } from "@/lib/mutations";

const TypeSchema = z.enum(["characters", "locations", "scenes"]);

export async function DELETE(req: Request, ctx: { params: Promise<{ type: string; id: string; jobId: string }> }) {
  const { type, id, jobId } = await ctx.params;
  const t = TypeSchema.parse(type);
  z.string().uuid().parse(jobId);
  await deleteTake(t, id, jobId);
  revalidatePath(`/${t}`);
  return NextResponse.json({ ok: true });
}
```

**Step 4: Wire UI buttons** — `TakeStrip.tsx` (already drafted in Task 7) calls these endpoints. Confirm the fetch calls + `router.refresh()` in click handlers.

**Step 5: Commit:** `feat(api): DELETE take with file unlink and select fallback`

---

## Phase 5: Live Refresh

### Task 13: Chokidar dev watcher

**Files:**
- Create: `apps/dashboard/instrumentation.ts`
- Modify: `apps/dashboard/next.config.ts` (enable instrumentation hook if needed)

**Step 1: Implement watcher**

```ts
// apps/dashboard/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "development") return;
  const chokidar = await import("chokidar");
  const { revalidatePath } = await import("next/cache");
  const { paths } = await import("./lib/paths");

  const map: Record<string, string> = {
    "dna.json": "/dna",
    "_state.json": "/",
    "characters": "/characters",
    "locations": "/locations",
    "scenes": "/scenes",
    "episodes": "/episodes",
  };

  chokidar.watch(paths.contentDir, { ignoreInitial: true }).on("all", (_event, filepath) => {
    for (const [key, route] of Object.entries(map)) {
      if (filepath.includes(`/content/${key}`)) {
        revalidatePath(route);
        return;
      }
    }
  });
}
```

**Step 2: Manual verify**

Run dev server, edit a JSON file in `content/`, verify the page revalidates without manual refresh.

**Step 3: Commit:** `feat(dashboard): chokidar watcher for live revalidation`

---

## Phase 6: Seed Content & Polish

### Task 14: Seed content

**Files:**
- Create: `content/dna.json`
- Create: `content/_state.json`
- Create: `content/characters/anomalocaris.json`
- Create: `content/characters/trilobite.json`
- Create: `content/locations/burgess-shallow-sea.json`
- Create: `content/episodes/ep-1-birth-of-the-predator.json`
- Create: `content/scenes/000-cold-open.json`
- Create: `content/scenes/001-anomalocaris-hunt.json`

All entities start with `takes: []` and `selectedTakeId: null` (status `pending`) so the user has something to ask Claude to generate.

`_state.json` starts with `{ "lastBalance": null, "lastSyncAt": null, "recentJobs": [] }`.

**Commit:** `chore(seed): add Cambrian seed content (DNA + 2 characters + 1 location + 1 episode + 2 scenes)`

---

### Task 15: README

**Files:**
- Create: `README.md`

Cover:
- What it is (one paragraph)
- Prereqs (Node 20+, pnpm, Claude Code with Higgsfield MCP authenticated)
- Setup: `pnpm install`, `pnpm dev`
- Architecture diagram (the folder layout)
- How to use: ask Claude to generate seed content, watch dashboard update
- "Adapt this for your own series" — wipe `content/`, write your own DNA, ask Claude to populate

**Commit:** `docs: add README`

---

### Task 16: Smoke test end-to-end

**Step 1:** Run `pnpm dev`. Verify all 5 tabs load with seed content.

**Step 2:** Manually edit `content/characters/anomalocaris.json` to add a fake take entry — verify the page updates live via chokidar.

**Step 3:** Click "Select" on a fake alternate take — verify the JSON file updates and the card re-renders.

**Step 4:** Click "Delete" on a take — verify the JSON updates and the file (if it existed) is removed from `media/`.

**Step 5:** Final commit if any tweaks needed.

---

## Open Implementation Notes

- **Geist font:** install via `pnpm --filter=dashboard add geist`. Import as `import { GeistSans } from "geist/font/sans"`.
- **Tailwind v4:** check that `globals.css` uses `@import "tailwindcss"` (the v4 way), not the v3 `@tailwind` directives.
- **Atomic JSON writes:** use tmp + rename so chokidar doesn't pick up a half-written file.
- **Cross-references:** computed in server components by reading scenes/episodes alongside characters/locations. Keep a small helper `countSceneAppearances(characterId, scenes)`.
- **Filter URL params on `/scenes`:** read via `searchParams` in the server component, not `useSearchParams`.
- **Don't add a video poster step** in v1; rely on `<video preload="metadata">`. Future work could pre-extract poster frames at gen time.
- **No tests for components** in v1. Tests cover schemas, content readers, and mutations only.

## Definition of Done

- All 5 tabs render with seed content
- Take strip shows select + delete buttons that work
- Chokidar live-refreshes the dashboard when JSON changes
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm lint` passes
- README covers setup
