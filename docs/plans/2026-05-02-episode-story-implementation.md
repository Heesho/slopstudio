# Episode story → scenes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add episode-level `logline` + `synopsis` fields and a per-scene `archived` flag, surface them on the Episodes page, and document the new "story → scenes" workflow rule for Claude.

**Architecture:** Two schema additions, two `EDITABLE_FIELDS` whitelist additions, three small UI changes (logline + synopsis editors on Episodes page, archived filter on Scenes page and StoryboardStrip, archived disclosure on Episodes page), and a CLAUDE.md addendum. No new API routes, no new mutation primitives, no migrations — schema defaults handle backfill on next read.

**Tech Stack:** Next.js 16 (Turbopack), React 19, Zod, Vitest, Tailwind v4. Tests run via `pnpm --filter=dashboard test`. Dev server runs on port 3000 (or autoPort) via `preview_start`.

---

## Pre-flight

Read these before starting:
- `apps/dashboard/lib/schemas.ts` — schema definitions
- `apps/dashboard/lib/mutations.ts:67-108` — `EDITABLE_FIELDS` allowlist
- `apps/dashboard/lib/schemas.test.ts` — test conventions for schemas
- `apps/dashboard/lib/mutations.test.ts:1-50` — test conventions for mutations (uses tmpdir + path mocking)
- `apps/dashboard/app/projects/[slug]/episodes/page.tsx` — the page being modified
- `apps/dashboard/app/components/StoryboardStrip.tsx`
- `apps/dashboard/app/projects/[slug]/scenes/page.tsx:46-72` — current filter logic
- `docs/plans/2026-05-02-episode-story-design.md` — the design that drives this plan

Verify dev environment with `pnpm --filter=dashboard test` (existing tests must pass before changing anything).

---

## Task 1: Episode schema gains `logline` and `synopsis`

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts:108-114` (EpisodeSchema)
- Test: `apps/dashboard/lib/schemas.test.ts`

**Step 1: Write failing tests**

Append to `apps/dashboard/lib/schemas.test.ts`:

```ts
describe("EpisodeSchema story fields", () => {
  const baseEp = {
    id: "ep-1",
    number: 1,
    title: "Birth",
    hook: "What if...",
    scenes: [],
  };

  it("defaults logline and synopsis to empty string", () => {
    const parsed = EpisodeSchema.parse(baseEp);
    expect(parsed.logline).toBe("");
    expect(parsed.synopsis).toBe("");
  });

  it("accepts populated logline and synopsis", () => {
    const parsed = EpisodeSchema.parse({
      ...baseEp,
      logline: "Apex predators emerge.",
      synopsis: "Trilobites graze in peace until Anomalocaris arrives.",
    });
    expect(parsed.logline).toBe("Apex predators emerge.");
    expect(parsed.synopsis.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: 2 new tests fail with "Expected '' to be undefined" (or similar — the fields don't exist yet).

**Step 3: Add fields to EpisodeSchema**

In `apps/dashboard/lib/schemas.ts`, modify `EpisodeSchema`:

```ts
export const EpisodeSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  hook: z.string(),
  logline: z.string().default(""),
  synopsis: z.string().default(""),
  scenes: z.array(z.string()),
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: all tests pass (including the two new ones and all pre-existing).

**Step 5: Commit**

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): add logline and synopsis to Episode"
```

---

## Task 2: Scene schema gains `archived`

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts:92-106` (SceneSchema)
- Test: `apps/dashboard/lib/schemas.test.ts`

**Step 1: Write failing tests**

Append to `apps/dashboard/lib/schemas.test.ts`:

```ts
describe("SceneSchema archived flag", () => {
  const baseScene = {
    id: "s1", episodeId: "ep-1", order: 0, title: "x", prompt: "p",
    characters: [], locations: [], duration: 6, videoModel: "v",
    takes: [], selectedTakeId: null,
  };

  it("defaults archived to false", () => {
    const parsed = SceneSchema.parse(baseScene);
    expect(parsed.archived).toBe(false);
  });

  it("accepts archived: true", () => {
    const parsed = SceneSchema.parse({ ...baseScene, archived: true });
    expect(parsed.archived).toBe(true);
  });

  it("rejects non-boolean archived", () => {
    expect(() =>
      SceneSchema.parse({ ...baseScene, archived: "yes" }),
    ).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: the 3 new tests fail (`archived` is undefined).

**Step 3: Add field to SceneSchema**

In `apps/dashboard/lib/schemas.ts`, add `archived` to `SceneSchema`:

```ts
export const SceneSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  prompt: z.string(),
  characters: z.array(z.string()),
  locations: z.array(z.string()),
  duration: z.number().int().min(4).max(15),
  videoModel: z.string(),
  takes: z.array(VideoTake),
  selectedTakeId: z.string().uuid().nullable(),
  archived: z.boolean().default(false),
  ...cinematicOverrides,
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: all tests pass.

**Step 5: Commit**

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): add archived flag to Scene"
```

---

## Task 3: Whitelist new fields in `EDITABLE_FIELDS`

**Files:**
- Modify: `apps/dashboard/lib/mutations.ts:107` (`EDITABLE_FIELDS.episodes` and `.scenes`)
- Test: `apps/dashboard/lib/mutations.test.ts`

**Step 1: Write failing tests**

Append a new `describe` block to `apps/dashboard/lib/mutations.test.ts` (mirror the tmpdir setup pattern at the top of the file):

```ts
describe("updateEntityField — story and archive fields", () => {
  let tmpRoot: string;
  let projectDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-story-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    await fs.mkdir(path.join(projectDir, "episodes"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("accepts logline on an episode", async () => {
    const file = path.join(projectDir, "episodes", "ep-1.json");
    await fs.writeFile(
      file,
      JSON.stringify({ id: "ep-1", number: 1, title: "T", hook: "H", scenes: [] }),
    );
    await updateEntityField(slug, "episodes", "ep-1", "logline", "Apex predators emerge.");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.logline).toBe("Apex predators emerge.");
  });

  it("accepts synopsis on an episode", async () => {
    const file = path.join(projectDir, "episodes", "ep-1.json");
    await fs.writeFile(
      file,
      JSON.stringify({ id: "ep-1", number: 1, title: "T", hook: "H", scenes: [] }),
    );
    await updateEntityField(slug, "episodes", "ep-1", "synopsis", "Multi-line\narc text.");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.synopsis).toBe("Multi-line\narc text.");
  });

  it("accepts archived on a scene", async () => {
    const file = path.join(projectDir, "scenes", "s1.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        id: "s1", episodeId: "ep-1", order: 0, title: "t", prompt: "p",
        characters: [], locations: [], duration: 6, videoModel: "v",
        takes: [], selectedTakeId: null,
      }),
    );
    await updateEntityField(slug, "scenes", "s1", "archived", true);
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.archived).toBe(true);
  });

  it("rejects unknown fields on episodes", async () => {
    const file = path.join(projectDir, "episodes", "ep-1.json");
    await fs.writeFile(
      file,
      JSON.stringify({ id: "ep-1", number: 1, title: "T", hook: "H", scenes: [] }),
    );
    await expect(
      updateEntityField(slug, "episodes", "ep-1", "secret", "x"),
    ).rejects.toBeInstanceOf(FieldNotEditableError);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter=dashboard test mutations.test.ts`
Expected: the 3 success-case tests fail with `FieldNotEditableError`. The "rejects unknown fields" test passes (already enforced).

**Step 3: Add fields to `EDITABLE_FIELDS`**

In `apps/dashboard/lib/mutations.ts`, edit the `EDITABLE_FIELDS` constant:

```ts
scenes: [
  "title",
  "prompt",
  "duration",
  "videoModel",
  "characters",
  "locations",
  "archived",
  "genre",
  "colorPalette",
  "lighting",
  "cameraMoveset",
  "camera",
  "lens",
  "focalLength",
  "aperture",
],
episodes: ["title", "hook", "logline", "synopsis"],
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter=dashboard test mutations.test.ts`
Expected: all tests pass.

**Step 5: Commit**

```bash
git add apps/dashboard/lib/mutations.ts apps/dashboard/lib/mutations.test.ts
git commit -m "feat(mutations): allow editing logline, synopsis, archived"
```

---

## Task 4: Surface `logline` + `synopsis` on the Episodes page

**Files:**
- Modify: `apps/dashboard/app/projects/[slug]/episodes/page.tsx`

**Step 1: Add inline-editable fields below the hook**

In `apps/dashboard/app/projects/[slug]/episodes/page.tsx`, between the `<div className="text-neutral-400 italic mt-1">` block (which holds the `hook` textarea, ending at line 103) and the summary block (line 104), insert:

```tsx
<div className="mt-3 space-y-2">
  <div className="text-[10px] uppercase tracking-wider text-neutral-500">
    Logline
  </div>
  <EditableText
    slug={slug}
    type="episodes"
    id={episode.id}
    field="logline"
    value={episode.logline}
    placeholder="One-sentence pitch."
    className="text-sm"
  />
  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-2">
    Synopsis
  </div>
  <EditableTextArea
    slug={slug}
    type="episodes"
    id={episode.id}
    field="synopsis"
    value={episode.synopsis}
    rows={6}
    placeholder="Write the arc, then ask Claude to propose scenes from it."
  />
</div>
```

Verify `EditableText` accepts a `placeholder` prop. If it doesn't, either add the prop (small change to `apps/dashboard/app/components/editable/EditableText.tsx`) or fall back to displaying empty value naturally — placeholders are a nice-to-have, not load-bearing for the design.

**Step 2: Verify in browser**

If a server is already running, reload. Otherwise: `preview_start name="dashboard"`. Navigate to `/projects/cambrian-docuseries/episodes` and confirm:
- Logline and Synopsis labels appear below the hook
- Both fields are inline-editable (click → input)
- Saving a value persists across reload
- Empty value shows the placeholder text

If `EditableText`/`EditableTextArea` don't already accept `placeholder`, do the smallest change required to surface placeholder text and re-test.

**Step 3: Commit**

```bash
git add apps/dashboard/app/projects/[slug]/episodes/page.tsx
# include EditableText changes if you added placeholder support
git add apps/dashboard/app/components/editable/EditableText.tsx 2>/dev/null || true
git commit -m "feat(episodes): inline-edit logline and synopsis on episodes page"
```

---

## Task 5: Filter archived scenes from main views

**Files:**
- Modify: `apps/dashboard/app/projects/[slug]/scenes/page.tsx`
- Modify: `apps/dashboard/app/components/StoryboardStrip.tsx`

**Step 1: Filter archived in the Scenes page**

In `apps/dashboard/app/projects/[slug]/scenes/page.tsx`, after the existing `let filtered = scenes;` (around line 47), prepend an archive filter:

```tsx
let filtered = scenes.filter((s) => !s.archived);
```

That's the entire change in this file — keep all subsequent filter chains as-is.

**Step 2: Filter archived in StoryboardStrip**

In `apps/dashboard/app/components/StoryboardStrip.tsx`, modify the `sortedScenes` derivation at line 19:

```ts
const sortedScenes = [...scenes]
  .filter((s) => !s.archived)
  .sort((a, b) => a.order - b.order);
```

**Step 3: Verify in browser**

Reload the dev server. Pick one scene in the dashboard and PATCH it manually to test (curl or via UI once Task 6 is done). For now, edit `projects/cambrian-docuseries/content/scenes/004-the-defensive-roll.json` and add `"archived": true` at the top level. Reload `/projects/cambrian-docuseries/scenes` and confirm the scene disappears from the grid; reload `/projects/cambrian-docuseries/episodes` and confirm it disappears from the storyboard strip.

Then revert the change (set `"archived": false` or remove the field).

**Step 4: Commit**

```bash
git add apps/dashboard/app/projects/[slug]/scenes/page.tsx \
        apps/dashboard/app/components/StoryboardStrip.tsx
git commit -m "feat(scenes): hide archived scenes from main grid and storyboard"
```

---

## Task 6: Archived disclosure on the Episodes page

**Files:**
- Create: `apps/dashboard/app/components/ArchivedScenesDisclosure.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/episodes/page.tsx`

**Step 1: Create the disclosure component**

Create `apps/dashboard/app/components/ArchivedScenesDisclosure.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Scene } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";

type Props = {
  slug: string;
  scenes: Scene[];
};

export default function ArchivedScenesDisclosure({ slug, scenes }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (scenes.length === 0) return null;

  async function handleRestore(sceneId: string) {
    setBusyId(sceneId);
    try {
      const res = await fetch(
        `/api/projects/${slug}/entity/scenes/${sceneId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "archived", value: false }),
        },
      );
      if (!res.ok) throw new Error(`restore failed (${res.status})`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <details className="mt-4">
      <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">
        Archived ({scenes.length})
      </summary>
      <div className="mt-2 flex flex-wrap gap-3 opacity-60">
        {scenes.map((scene) => {
          const sel = scene.takes.find((t) => t.jobId === scene.selectedTakeId);
          const videoSrc = sel?.videoPath
            ? `${mediaUrl(slug, sel.videoPath)}#t=0.5`
            : null;
          return (
            <div key={scene.id} className="w-24">
              <div className="w-24 aspect-[9/16] rounded overflow-hidden bg-neutral-900 ring-1 ring-neutral-800">
                {videoSrc ? (
                  <video src={videoSrc} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
                    no video
                  </div>
                )}
              </div>
              <div className="mt-1 text-[10px] text-neutral-400 truncate" title={scene.title}>
                {scene.title}
              </div>
              <button
                type="button"
                disabled={busyId === scene.id}
                onClick={() => handleRestore(scene.id)}
                className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
              >
                {busyId === scene.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          );
        })}
      </div>
    </details>
  );
}
```

**Step 2: Wire it into the Episodes page**

In `apps/dashboard/app/projects/[slug]/episodes/page.tsx`:

1. Import the new component at the top:
   ```ts
   import ArchivedScenesDisclosure from "@/app/components/ArchivedScenesDisclosure";
   ```

2. Inside the episode `.map((episode) =>` callback, derive archived scenes alongside `epScenes`:
   ```ts
   const epScenes = scenes
     .filter((s) => s.episodeId === episode.id && !s.archived)
     .sort((a, b) => a.order - b.order);
   const archivedEpScenes = scenes
     .filter((s) => s.episodeId === episode.id && s.archived)
     .sort((a, b) => a.order - b.order);
   ```

3. Render the disclosure after the `<StoryboardStrip … />` line:
   ```tsx
   <StoryboardStrip slug={slug} scenes={epScenes} episodeId={episode.id} />
   <ArchivedScenesDisclosure slug={slug} scenes={archivedEpScenes} />
   ```

**Step 3: Verify in browser**

Manually set `"archived": true` on `projects/cambrian-docuseries/content/scenes/004-the-defensive-roll.json`. Reload `/projects/cambrian-docuseries/episodes`. Confirm:
- "Archived (1)" disclosure appears under Ep 1's storyboard strip
- Click to expand → archived scene shows greyed-out
- Click "Restore" → scene returns to the main strip
- The disclosure disappears (count = 0)

Re-archive manually before commit if you want a clean state.

**Step 4: Commit**

```bash
git add apps/dashboard/app/components/ArchivedScenesDisclosure.tsx \
        apps/dashboard/app/projects/[slug]/episodes/page.tsx
git commit -m "feat(episodes): archived scenes disclosure with restore action"
```

---

## Task 7: Document the workflow rule in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add the new section**

In `CLAUDE.md`, insert a new section between **"Scene prompt assembly"** and **"Read before editing"**:

```markdown
## Episode story → scenes

Each episode has a `logline` (one-sentence pitch) and `synopsis` (multi-line prose) that describe the arc. The user shapes them on the Episodes page; you read them before scaffolding scenes.

1. **Before scaffolding scenes** for an episode, read `episode.logline` and `episode.synopsis`. If both are empty, ask the user to draft the story first — or offer to draft a synopsis from the hook + DNA, which the user can then edit on the Episodes page before scenes get proposed.
2. **When proposing scenes** from a synopsis: aim for 4–8 scenes, each scene's prompt should hit a beat the synopsis implies, use existing characters/locations where the synopsis names them, and flag any reference to an entity that doesn't exist yet (so the user can decide whether to create it or rephrase).
3. **When the user asks to replace existing scenes**, set the old scenes' `archived: true` (don't delete files or media) — they stay on disk with their takes intact, hidden from main views, restorable via the "Archived (N)" disclosure on the Episodes page. New scenes get fresh slugs derived from the new synopsis (e.g., `002-the-impact.json` replacing `002-strike-aftermath.json`); they can share the same `order` value as archived scenes because archived ones are filtered out everywhere.
4. **Mid-iteration replacement** (replace a single scene at a particular order) follows the same archive-and-replace pattern.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: episode story-to-scenes workflow rule"
```

---

## Final verification

Run the full test suite and typecheck:

```bash
pnpm --filter=dashboard test
pnpm --filter=dashboard typecheck
```

Expected: all green.

Manually verify the full flow on the dashboard:
1. Open Episodes page → Logline + Synopsis fields render under hook, are inline-editable.
2. Type something in synopsis, reload → value persists.
3. Manually set `archived: true` on a scene file → it disappears from Scenes grid and Storyboard strip; appears in "Archived (N)" disclosure on the Episodes page.
4. Click Restore → scene returns to the main views.

If anything is off, go back to the relevant task and fix.

---

## Out of scope (defer to a later plan)

- Archive bulk operation ("archive all of episode 1's scenes")
- "Show archived" toggle on the Scenes page
- Synopsis versioning / draft history
- Beat-structured outline (`{ title, summary, sceneIds }[]` on Episode)
- Server-side LLM call for "Propose scenes" — chat-driven only

These are all noted in the design doc and intentionally excluded.
