# slopstudio v0.2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten the dashboard's data model and surfaces — dropdowns where text fields had a constrained valid set; new scene `audioMode` (narration / dialogue / none); SceneCard restructured into a refs row showing actual conditioning images; denser entity grids; clean ref templates with no burned-in labels.

**Architecture:** Schema changes land additively first (new fields, keep `narration` deprecated), then UI consumes the new shape, then a migration helper rewrites existing JSON, then the deprecated field is dropped. Generation templates get a text-only edit. The 3 stale reference images need operator-triggered regeneration after templates change.

**Tech Stack:** Next.js 16 App Router, zod, vitest, Tailwind v4, lucide-react. Higgsfield MCP for image regeneration.

**Reference:** [docs/plans/2026-05-01-slopstudio-v0-2-design.md](./2026-05-01-slopstudio-v0-2-design.md) for the rationale, scope decisions, and out-of-scope flags.

**Heads-up:** [apps/dashboard/AGENTS.md](../../apps/dashboard/AGENTS.md) warns Next 16 has breaking changes vs. older versions. None of this plan touches Next.js APIs (no routing, no caching, no server actions) — only schema, components, and JSON. The existing test suite is `pnpm --filter=dashboard test` (vitest).

---

## Task 1: Schema — additive new audio fields on Scene

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts:92-110`
- Modify: `apps/dashboard/lib/schemas.test.ts` (add new tests)

### Step 1.1: Read existing schemas test

```
Read apps/dashboard/lib/schemas.test.ts
```

Note the existing `Scene` test pattern so the new tests match style.

### Step 1.2: Write failing tests for the new audio fields

Append to `schemas.test.ts`:

```ts
describe("SceneSchema audioMode", () => {
  const baseScene = {
    id: "s1",
    episodeId: "ep-1",
    order: 0,
    title: "x",
    prompt: "p",
    narration: "old", // still present in this task — dropped in Task 5
    characters: [],
    locations: [],
    duration: 8,
    videoModel: "seedance_2_0",
    takes: [],
    selectedTakeId: null,
  };

  it("defaults audioMode to 'none' with both audio fields null", () => {
    const parsed = SceneSchema.parse(baseScene);
    expect(parsed.audioMode).toBe("none");
    expect(parsed.audioText).toBeNull();
    expect(parsed.speakerCharacterId).toBeNull();
  });

  it("accepts audioMode='narration' with audioText", () => {
    const parsed = SceneSchema.parse({
      ...baseScene,
      audioMode: "narration",
      audioText: "for three billion years…",
      speakerCharacterId: null,
    });
    expect(parsed.audioMode).toBe("narration");
    expect(parsed.audioText).toBe("for three billion years…");
  });

  it("rejects audioMode='narration' without audioText", () => {
    expect(() =>
      SceneSchema.parse({ ...baseScene, audioMode: "narration", audioText: null, speakerCharacterId: null }),
    ).toThrow();
  });

  it("rejects audioMode='narration' with a speakerCharacterId", () => {
    expect(() =>
      SceneSchema.parse({
        ...baseScene,
        audioMode: "narration",
        audioText: "hi",
        speakerCharacterId: "trilobite",
      }),
    ).toThrow();
  });

  it("accepts audioMode='dialogue' with audioText + speakerCharacterId", () => {
    const parsed = SceneSchema.parse({
      ...baseScene,
      audioMode: "dialogue",
      audioText: "look out!",
      speakerCharacterId: "anomalocaris",
    });
    expect(parsed.audioMode).toBe("dialogue");
    expect(parsed.speakerCharacterId).toBe("anomalocaris");
  });

  it("rejects audioMode='dialogue' without speakerCharacterId", () => {
    expect(() =>
      SceneSchema.parse({
        ...baseScene,
        audioMode: "dialogue",
        audioText: "x",
        speakerCharacterId: null,
      }),
    ).toThrow();
  });

  it("rejects audioMode='none' with non-null audioText", () => {
    expect(() =>
      SceneSchema.parse({
        ...baseScene,
        audioMode: "none",
        audioText: "x",
        speakerCharacterId: null,
      }),
    ).toThrow();
  });
});
```

### Step 1.3: Run tests, verify they fail

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: at minimum the four "rejects…" tests fail (current schema accepts everything as long as `narration` is a string), and the "accepts" tests fail because new fields don't exist.

### Step 1.4: Add the audio fields + refinement to SceneSchema

Modify `apps/dashboard/lib/schemas.ts`. Replace the `SceneSchema` block (lines 92–110) with:

```ts
export const SceneSchema = z
  .object({
    id: z.string(),
    episodeId: z.string(),
    order: z.number().int().nonnegative(),
    title: z.string(),
    prompt: z.string(),
    narration: z.string(), // deprecated — dropped in Task 5
    audioMode: z.enum(["narration", "dialogue", "none"]).default("none"),
    audioText: z.string().nullable().default(null),
    speakerCharacterId: z.string().nullable().default(null),
    characters: z.array(z.string()),
    locations: z.array(z.string()),
    duration: z.number().int().positive(),
    videoModel: z.string(),
    takes: z.array(VideoTake),
    selectedTakeId: z.string().uuid().nullable(),
    ...cinematicOverrides,
    firstFramePrompt: z.string().optional().default(""),
    firstFrameTakes: z.array(ImageTake).default([]),
    firstFrameSelectedTakeId: z.string().uuid().nullable().default(null),
  })
  .superRefine((scene, ctx) => {
    if (scene.audioMode === "narration") {
      if (scene.audioText === null) {
        ctx.addIssue({ code: "custom", message: "audioText required when audioMode='narration'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId !== null) {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId must be null when audioMode='narration'", path: ["speakerCharacterId"] });
      }
    } else if (scene.audioMode === "dialogue") {
      if (scene.audioText === null) {
        ctx.addIssue({ code: "custom", message: "audioText required when audioMode='dialogue'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId === null) {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId required when audioMode='dialogue'", path: ["speakerCharacterId"] });
      }
    } else {
      // audioMode === "none"
      if (scene.audioText !== null) {
        ctx.addIssue({ code: "custom", message: "audioText must be null when audioMode='none'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId !== null) {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId must be null when audioMode='none'", path: ["speakerCharacterId"] });
      }
    }
  });
```

### Step 1.5: Run tests, verify they pass

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: all new audio tests pass. Existing tests still pass.

### Step 1.6: Verify existing scene JSON still parses

Run a one-shot vitest to confirm the existing `cambrian-docuseries` scenes still parse with the new schema (they have no audio fields yet — should default to `audioMode: "none"`):

```bash
pnpm --filter=dashboard test schemas.test.ts -t "audioMode"
```

If existing scene JSON fails to parse anywhere in the test suite, that's a sign the defaults aren't kicking in — review.

### Step 1.7: Commit

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): add Scene.audioMode (narration|dialogue|none) + audioText + speakerCharacterId"
```

---

## Task 2: Schema — Character.voice, nullable narratorVoice, duration clamp

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts` (DnaSchema line 58, CharacterSchema line 71-80, SceneSchema duration line 101)
- Modify: `apps/dashboard/lib/schemas.test.ts`

### Step 2.1: Write failing tests

Append to `schemas.test.ts`:

```ts
describe("CharacterSchema voice", () => {
  const baseChar = {
    id: "anom",
    name: "Anomalocaris",
    imagePrompt: "x",
    description: "y",
    imageModel: "nano_banana_2",
    takes: [],
    selectedTakeId: null,
  };

  it("defaults voice to null", () => {
    const parsed = CharacterSchema.parse(baseChar);
    expect(parsed.voice).toBeNull();
  });

  it("accepts free-text voice", () => {
    const parsed = CharacterSchema.parse({ ...baseChar, voice: "gruff, gravelly" });
    expect(parsed.voice).toBe("gruff, gravelly");
  });
});

describe("DnaSchema narratorVoice", () => {
  const baseDna = {
    title: "x", concept: "y", stylePrompt: "z",
    aspectRatio: "9:16", videoModel: "seedance_2_0",
    characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
    locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
  };

  it("accepts narratorVoice = null", () => {
    const parsed = DnaSchema.parse({ ...baseDna, narratorVoice: null });
    expect(parsed.narratorVoice).toBeNull();
  });

  it("accepts narratorVoice as a string", () => {
    const parsed = DnaSchema.parse({ ...baseDna, narratorVoice: "Attenborough-style" });
    expect(parsed.narratorVoice).toBe("Attenborough-style");
  });
});

describe("SceneSchema duration clamp", () => {
  const baseScene = {
    id: "s1", episodeId: "ep-1", order: 0, title: "x", prompt: "p", narration: "",
    characters: [], locations: [], videoModel: "seedance_2_0", takes: [], selectedTakeId: null,
  };

  it("accepts duration in [4, 15]", () => {
    expect(SceneSchema.parse({ ...baseScene, duration: 4 }).duration).toBe(4);
    expect(SceneSchema.parse({ ...baseScene, duration: 15 }).duration).toBe(15);
  });

  it("rejects duration < 4", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: 3 })).toThrow();
  });

  it("rejects duration > 15", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: 16 })).toThrow();
  });
});
```

### Step 2.2: Run tests, verify they fail

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: new tests fail.

### Step 2.3: Apply schema changes

In `apps/dashboard/lib/schemas.ts`:

- Line 58: `narratorVoice: z.string(),` → `narratorVoice: z.string().nullable(),`
- In `CharacterSchema` (lines 71–80), add after `selectedTakeId`: `voice: z.string().nullable().default(null),`
- In `SceneSchema`, change `duration: z.number().int().positive(),` → `duration: z.number().int().min(4).max(15),`

### Step 2.4: Run tests, verify they pass

Run: `pnpm --filter=dashboard test schemas.test.ts`
Expected: all pass, including existing.

### Step 2.5: Commit

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): nullable narratorVoice, Character.voice, scene duration clamp 4-15"
```

---

## Task 3: Migration helper

**Files:**
- Create: `apps/dashboard/lib/migrations.ts`
- Create: `apps/dashboard/lib/migrations.test.ts`

### Step 3.1: Write failing tests

Create `apps/dashboard/lib/migrations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateSceneToV02, migrateCharacterToV02 } from "./migrations";

describe("migrateSceneToV02", () => {
  it("converts non-empty narration into audioMode='narration' + audioText", () => {
    const input = {
      id: "s1", narration: "for three billion years",
      audioMode: undefined, audioText: undefined, speakerCharacterId: undefined,
    };
    const out = migrateSceneToV02(input);
    expect(out.audioMode).toBe("narration");
    expect(out.audioText).toBe("for three billion years");
    expect(out.speakerCharacterId).toBeNull();
    expect(out.narration).toBe("for three billion years"); // kept until Task 5
  });

  it("converts empty narration into audioMode='none'", () => {
    const out = migrateSceneToV02({ id: "s1", narration: "" });
    expect(out.audioMode).toBe("none");
    expect(out.audioText).toBeNull();
    expect(out.speakerCharacterId).toBeNull();
  });

  it("is idempotent — already-migrated scenes pass through unchanged", () => {
    const already = { id: "s1", narration: "x", audioMode: "narration", audioText: "x", speakerCharacterId: null };
    expect(migrateSceneToV02(already)).toEqual(already);
  });
});

describe("migrateCharacterToV02", () => {
  it("adds voice: null to characters that lack it", () => {
    const out = migrateCharacterToV02({ id: "anom", name: "Anomalocaris" });
    expect(out.voice).toBeNull();
  });

  it("preserves existing voice", () => {
    const out = migrateCharacterToV02({ id: "anom", voice: "gruff" });
    expect(out.voice).toBe("gruff");
  });
});
```

### Step 3.2: Run tests, verify they fail

Run: `pnpm --filter=dashboard test migrations.test.ts`
Expected: import error (file doesn't exist yet).

### Step 3.3: Implement migration helpers

Create `apps/dashboard/lib/migrations.ts`:

```ts
type SceneIsh = Record<string, unknown>;
type CharacterIsh = Record<string, unknown>;

export function migrateSceneToV02(scene: SceneIsh): SceneIsh {
  if (scene.audioMode !== undefined) return scene; // idempotent
  const narration = typeof scene.narration === "string" ? scene.narration : "";
  if (narration.length > 0) {
    return { ...scene, audioMode: "narration", audioText: narration, speakerCharacterId: null };
  }
  return { ...scene, audioMode: "none", audioText: null, speakerCharacterId: null };
}

export function migrateCharacterToV02(character: CharacterIsh): CharacterIsh {
  if (character.voice !== undefined) return character;
  return { ...character, voice: null };
}
```

### Step 3.4: Run tests, verify they pass

Run: `pnpm --filter=dashboard test migrations.test.ts`
Expected: all pass.

### Step 3.5: Commit

```bash
git add apps/dashboard/lib/migrations.ts apps/dashboard/lib/migrations.test.ts
git commit -m "feat(migrations): v0.2 helpers — Scene narration → audioMode, Character voice default"
```

---

## Task 4: Run migration on cambrian-docuseries content

**Files:**
- Modify: `projects/cambrian-docuseries/content/scenes/000-cold-open.json`
- Modify: `projects/cambrian-docuseries/content/scenes/001-anomalocaris-hunt.json`
- Modify: `projects/cambrian-docuseries/content/characters/anomalocaris.json`
- Modify: `projects/cambrian-docuseries/content/characters/trilobite.json`

### Step 4.1: Inspect current shape

```bash
cat projects/cambrian-docuseries/content/scenes/000-cold-open.json
cat projects/cambrian-docuseries/content/characters/anomalocaris.json
```

Note the current `narration` fields on each scene and lack of `voice` on each character.

### Step 4.2: Apply the migration in-place

Use a tiny one-shot script (preferred) or edit by hand. Script approach:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { migrateSceneToV02, migrateCharacterToV02 } from './apps/dashboard/lib/migrations.ts';
const sceneDir = 'projects/cambrian-docuseries/content/scenes';
for (const f of readdirSync(sceneDir).filter(n => n.endsWith('.json'))) {
  const path = sceneDir + '/' + f;
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const next = migrateSceneToV02(data);
  writeFileSync(path, JSON.stringify(next, null, 2) + '\\n');
  console.log('migrated', path);
}
const charDir = 'projects/cambrian-docuseries/content/characters';
for (const f of readdirSync(charDir).filter(n => n.endsWith('.json'))) {
  const path = charDir + '/' + f;
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const next = migrateCharacterToV02(data);
  writeFileSync(path, JSON.stringify(next, null, 2) + '\\n');
  console.log('migrated', path);
}
"
```

If TS imports don't work directly (bun/tsx not configured), edit the 4 files by hand following the migration helper logic.

### Step 4.3: Verify the migrated files parse against the new schema

Add a sanity test or run the existing content tests:

```bash
pnpm --filter=dashboard test content.test.ts
```

Expected: pass. If not, the migration produced something the schema rejects — re-check.

### Step 4.4: Commit

```bash
git add projects/cambrian-docuseries/content/
git commit -m "chore(cambrian-docuseries): migrate scenes + characters to v0.2 schema"
```

---

## Task 5: Drop deprecated `narration` field

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts`
- Modify: `apps/dashboard/lib/schemas.test.ts`
- Modify: `apps/dashboard/lib/migrations.ts` + `migrations.test.ts` (drop `narration` from outputs)
- Modify: `projects/cambrian-docuseries/content/scenes/*.json` (remove `narration` field)

### Step 5.1: Update tests

Remove `narration: ...` from all `baseScene` fixtures in `schemas.test.ts`. Update the migration tests to no longer expect `narration` to be preserved on the output.

### Step 5.2: Run tests, see them fail (because schema still has `narration`)

Run: `pnpm --filter=dashboard test`
Expected: existing tests pass; nothing new fails yet.

### Step 5.3: Drop the field

In `apps/dashboard/lib/schemas.ts`, remove the `narration: z.string(),` line and the `// deprecated — dropped in Task 5` comment.

In `migrations.ts`, change the helper so it strips `narration` from the output:

```ts
export function migrateSceneToV02(scene: SceneIsh): SceneIsh {
  if (scene.audioMode !== undefined) {
    const { narration: _, ...rest } = scene;
    return rest;
  }
  const narration = typeof scene.narration === "string" ? scene.narration : "";
  const { narration: _drop, ...rest } = scene;
  if (narration.length > 0) {
    return { ...rest, audioMode: "narration", audioText: narration, speakerCharacterId: null };
  }
  return { ...rest, audioMode: "none", audioText: null, speakerCharacterId: null };
}
```

Update the migration tests to assert `narration` is gone from the output.

### Step 5.4: Re-run migration on existing scene files

```bash
node --input-type=module -e "/* same script as Task 4.2, scenes only */"
```

Or hand-edit the 2 scene JSONs to remove `narration`.

### Step 5.5: Run all tests

Run: `pnpm --filter=dashboard test`
Expected: all pass.

### Step 5.6: Commit

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts \
        apps/dashboard/lib/migrations.ts apps/dashboard/lib/migrations.test.ts \
        projects/cambrian-docuseries/content/scenes/
git commit -m "refactor(schemas): drop deprecated Scene.narration; migrated content"
```

---

## Task 6: EditableSelect on DNA settings + cinematics

**Files:**
- Create: `apps/dashboard/lib/dnaOptions.ts`
- Modify: `apps/dashboard/app/projects/[slug]/dna/page.tsx`

### Step 6.1: Define option lists

Create `apps/dashboard/lib/dnaOptions.ts`:

```ts
export const ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 (vertical)" },
  { value: "16:9", label: "16:9 (horizontal)" },
  { value: "1:1", label: "1:1 (square)" },
  { value: "4:5", label: "4:5" },
  { value: "21:9", label: "21:9 (cinematic)" },
];

export const VIDEO_MODEL_OPTIONS = [
  { value: "seedance_2_0", label: "seedance_2_0" },
  { value: "kling_2_0", label: "kling_2_0" },
  { value: "veo_3", label: "veo_3" },
];

export const IMAGE_MODEL_OPTIONS = [
  { value: "nano_banana_2", label: "nano_banana_2" },
  { value: "flux_pro_1_1", label: "flux_pro_1_1" },
  { value: "ideogram_3", label: "ideogram_3" },
];

const FOCAL_LENGTHS = ["auto", "14mm", "24mm", "35mm", "50mm", "85mm", "135mm"];
export const FOCAL_LENGTH_OPTIONS = FOCAL_LENGTHS.map((v) => ({ value: v, label: v }));

const APERTURES = ["auto", "f/1.4", "f/2", "f/2.8", "f/4", "f/5.6", "f/8", "f/11"];
export const APERTURE_OPTIONS = APERTURES.map((v) => ({ value: v, label: v }));

const CAMERAS = ["auto", "ARRI Alexa 35", "RED Komodo", "Sony Venice 2", "iPhone Pro"];
export const CAMERA_OPTIONS = CAMERAS.map((v) => ({ value: v, label: v }));

const LENSES = ["auto", "wide-angle", "standard", "telephoto", "macro", "anamorphic"];
export const LENS_OPTIONS = LENSES.map((v) => ({ value: v, label: v }));
```

These are starter lists. Operator can extend by editing this file as Higgsfield exposes new models.

### Step 6.2: Replace EditableText with EditableSelect on DNA page

In `apps/dashboard/app/projects/[slug]/dna/page.tsx`:

- Import the options: `import { ASPECT_RATIO_OPTIONS, VIDEO_MODEL_OPTIONS, IMAGE_MODEL_OPTIONS, FOCAL_LENGTH_OPTIONS, APERTURE_OPTIONS, CAMERA_OPTIONS, LENS_OPTIONS } from "@/lib/dnaOptions";`
- Replace each `<EditableText ... field="aspectRatio" .../>` with `<EditableSelect ... options={ASPECT_RATIO_OPTIONS} />`. Same for `videoModel`, `characterImageModel`, `characterRefAspectRatio`, `locationImageModel`, `locationRefAspectRatio`.
- In the `CINEMATIC_TEXT_FIELDS` map (line 19–27), remove `camera`, `lens`, `focalLength`, `aperture` from the list so they don't render as text inputs. Render them explicitly as `<EditableSelect>` with their respective options. Leave `colorPalette`, `lighting`, `cameraMoveset` as text fields (they're descriptive prose).

### Step 6.3: Verify in preview

Server is running. Navigate to `/projects/cambrian-docuseries/dna`. Confirm:
- Aspect Ratio shows `9:16` selected in a dropdown.
- Video Model shows `seedance_2_0` selected.
- Camera, Lens, Focal Length, Aperture all show `auto` in dropdowns.
- Color Palette / Lighting / Camera Moveset remain text inputs.

Use `mcp__Claude_Preview__preview_screenshot` and `mcp__Claude_Preview__preview_console_logs` to verify.

**Caveat:** if a current value isn't in the options list (e.g. `narratorVoice` field model is now nullable but we're not changing it here), the existing `<select>` will render an empty/blank initial state. That's a future polish item; for v0.2 the curated lists cover the cambrian-docuseries values.

### Step 6.4: Commit

```bash
git add apps/dashboard/lib/dnaOptions.ts apps/dashboard/app/projects/\[slug\]/dna/page.tsx
git commit -m "feat(dashboard): EditableSelect dropdowns for DNA settings + cinematics"
```

---

## Task 7: SceneCard — Audio block component

**Files:**
- Create: `apps/dashboard/app/components/SceneAudioBlock.tsx`
- Modify: `apps/dashboard/app/components/SceneCard.tsx`

### Step 7.1: Build the audio block

Create `apps/dashboard/app/components/SceneAudioBlock.tsx`:

```tsx
import EditableSelect from "./editable/EditableSelect";
import EditableTextArea from "./editable/EditableTextArea";
import type { Scene } from "@/lib/schemas";

const AUDIO_MODE_OPTIONS = [
  { value: "none", label: "Silent" },
  { value: "narration", label: "Narration" },
  { value: "dialogue", label: "Dialogue" },
];

type Props = {
  slug: string;
  scene: Scene;
  characters: { id: string; label: string }[];
};

export default function SceneAudioBlock({ slug, scene, characters }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-neutral-400">Audio</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-neutral-500">Mode</span>
        <EditableSelect
          slug={slug}
          type="scenes"
          id={scene.id}
          field="audioMode"
          value={scene.audioMode}
          options={AUDIO_MODE_OPTIONS}
        />
        {scene.audioMode === "dialogue" && (
          <>
            <span className="text-xs text-neutral-500">Speaker</span>
            <EditableSelect
              slug={slug}
              type="scenes"
              id={scene.id}
              field="speakerCharacterId"
              value={scene.speakerCharacterId ?? ""}
              options={[{ value: "", label: "—" }, ...characters.map((c) => ({ value: c.id, label: c.label }))]}
            />
          </>
        )}
      </div>
      {(scene.audioMode === "narration" || scene.audioMode === "dialogue") && (
        <EditableTextArea
          slug={slug}
          type="scenes"
          id={scene.id}
          field="audioText"
          value={scene.audioText ?? ""}
          placeholder={scene.audioMode === "narration" ? "Narrator script…" : "Dialogue line…"}
          rows={3}
        />
      )}
    </div>
  );
}
```

### Step 7.2: Wire SceneAudioBlock into SceneCard

In `apps/dashboard/app/components/SceneCard.tsx`, find the place where the old `narration` field was rendered (search for `narration` or for the existing `EditableTextArea` with `field="narration"`). Replace that block with:

```tsx
<SceneAudioBlock slug={slug} scene={scene} characters={availableCharacters} />
```

Add `import SceneAudioBlock from "./SceneAudioBlock";` at the top.

### Step 7.3: Verify in preview

Navigate to `/projects/cambrian-docuseries/scenes`. Confirm:
- Cold Open scene shows `Mode: Narration` and the text "For three billion years, life on Earth was peaceful…" in the textarea.
- First Hunt scene (no narration text) shows `Mode: Silent`.
- Switching mode to `Dialogue` reveals the speaker dropdown.

Take `preview_screenshot` and check `preview_console_logs`.

### Step 7.4: Commit

```bash
git add apps/dashboard/app/components/SceneAudioBlock.tsx apps/dashboard/app/components/SceneCard.tsx
git commit -m "feat(scene-card): SceneAudioBlock — mode selector + conditional speaker + text"
```

---

## Task 8: SceneCard — Refs row replacing top FirstFrameSection

**Files:**
- Create: `apps/dashboard/app/components/SceneRefsRow.tsx`
- Modify: `apps/dashboard/app/components/SceneCard.tsx`
- Modify: `apps/dashboard/app/components/FirstFrameSection.tsx` (becomes the inline editor used by the row's first-frame slot)
- Modify: `apps/dashboard/app/projects/[slug]/scenes/page.tsx` (need to pass the actual character + location entities, not just labels, so the row can show ref images)

### Step 8.1: Pass entities (not just labels) into SceneCard

In `scenes/page.tsx`, the current `availableCharacters` is `{ id, label }[]`. The refs row needs the selected ref image. Build an additional prop with the full data:

```ts
const refLookup = {
  characters: new Map(characters.map(c => [c.id, c])),
  locations: new Map(locations.map(l => [l.id, l])),
};
```

Pass `refLookup` (or just `characters` and `locations` arrays) as a new prop to `SceneCard`.

### Step 8.2: Build SceneRefsRow

Create `apps/dashboard/app/components/SceneRefsRow.tsx`:

```tsx
import type { Scene, Character, Location } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import FirstFrameSection from "./FirstFrameSection";

type Props = {
  slug: string;
  scene: Scene;
  characters: Character[];
  locations: Location[];
};

function refThumb(slug: string, name: string, imagePath?: string) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 rounded overflow-hidden bg-neutral-800 ring-1 ring-neutral-700">
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(slug, imagePath)} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">no ref</div>
        )}
      </div>
      <span className="text-[10px] text-neutral-400 max-w-[80px] text-center truncate">{name}</span>
    </div>
  );
}

export default function SceneRefsRow({ slug, scene, characters, locations }: Props) {
  const linkedChars = characters.filter((c) => scene.characters.includes(c.id));
  const linkedLocs = locations.filter((l) => scene.locations.includes(l.id));

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-neutral-400">Refs</p>
      <div className="flex flex-wrap gap-3">
        {linkedChars.map((c) => {
          const sel = c.takes.find((t) => t.jobId === c.selectedTakeId);
          return <div key={c.id}>{refThumb(slug, c.name, sel?.imagePath)}</div>;
        })}
        {linkedLocs.map((l) => {
          const sel = l.takes.find((t) => t.jobId === l.selectedTakeId);
          return <div key={l.id}>{refThumb(slug, l.name, sel?.imagePath)}</div>;
        })}
      </div>
      <FirstFrameSection slug={slug} scene={scene} />
    </div>
  );
}
```

### Step 8.3: Update SceneCard to use SceneRefsRow

In `SceneCard.tsx`:

1. Remove the existing `<FirstFrameSection slug={slug} scene={scene} />` from above the hero video.
2. Below the audio block (Task 7) and cinematics, add: `<SceneRefsRow slug={slug} scene={scene} characters={characters} locations={locations} />`.
3. Add the new `characters: Character[]` and `locations: Location[]` props to SceneCard.

### Step 8.4: Update FirstFrameSection empty-state hint

In `FirstFrameSection.tsx`, change the prompt subtitle from `Prompt (optional — locks composition before video gen)` to `Prompt — ask Claude to draft this`.

### Step 8.5: Verify in preview

Navigate to `/projects/cambrian-docuseries/scenes`. Confirm:
- Cold Open scene shows the Trilobite ref image (selected take) and the Burgess Shallow Sea ref image in a refs row beneath the audio block.
- First Hunt shows Anomalocaris ref + Burgess Shallow Sea ref.
- The FirstFrameSection is no longer at the top of the card; it's inside the refs row block.
- Empty first-frame prompt shows the new hint copy.

### Step 8.6: Commit

```bash
git add apps/dashboard/app/components/SceneRefsRow.tsx \
        apps/dashboard/app/components/SceneCard.tsx \
        apps/dashboard/app/components/FirstFrameSection.tsx \
        apps/dashboard/app/projects/\[slug\]/scenes/page.tsx
git commit -m "feat(scene-card): refs row showing actual character/location/first-frame images"
```

---

## Task 9: SceneCard — Duration input

**Files:**
- Modify: `apps/dashboard/app/components/SceneCard.tsx`

### Step 9.1: Add duration input

In `SceneCard.tsx`, near where the audio block lives (after refs row is fine), add:

```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-neutral-500">Duration</span>
  <EditableNumber
    slug={slug}
    type="scenes"
    id={scene.id}
    field="duration"
    value={scene.duration}
    min={4}
    max={15}
  />
  <span className="text-xs text-neutral-500">seconds (4–15)</span>
</div>
```

If `EditableNumber` doesn't already accept `min` and `max` props, extend it:

- Read `apps/dashboard/app/components/editable/EditableNumber.tsx`
- Add `min?: number; max?: number;` to the props
- Forward to the underlying `<input type="number" min={min} max={max} />`

### Step 9.2: Verify in preview

Confirm Cold Open shows `Duration: 8 seconds (4-15)`. Try typing 16 — should be rejected by the input or by the API call (the schema clamp guarantees the latter).

### Step 9.3: Commit

```bash
git add apps/dashboard/app/components/SceneCard.tsx apps/dashboard/app/components/editable/EditableNumber.tsx
git commit -m "feat(scene-card): editable duration input clamped 4-15"
```

---

## Task 10: Denser grids + slim EntityCard

**Files:**
- Modify: `apps/dashboard/app/projects/[slug]/characters/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/locations/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/scenes/page.tsx`
- Modify: `apps/dashboard/app/components/EntityCard.tsx`

### Step 10.1: Bump grid columns + tighten gap

- `characters/page.tsx`: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- `locations/page.tsx`: same change.
- `scenes/page.tsx`: `grid-cols-1 md:grid-cols-2 gap-6` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`

### Step 10.2: Collapse image prompt + description on EntityCard

In `EntityCard.tsx`, find the section that renders the image prompt and description (likely near the bottom of the card). Wrap each in `<details>`:

```tsx
<details>
  <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
    Image prompt
  </summary>
  <div className="mt-2 text-sm text-neutral-200 whitespace-pre-wrap">
    <EditableTextArea slug={slug} type={entityType} id={entity.id} field="imagePrompt" value={prompt} />
  </div>
</details>

{description && (
  <details>
    <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
      Description
    </summary>
    <div className="mt-2 text-sm text-neutral-200 whitespace-pre-wrap">
      <EditableTextArea slug={slug} type={entityType} id={entity.id} field="description" value={description} />
    </div>
  </details>
)}
```

### Step 10.3: Verify in preview

Navigate to `/projects/cambrian-docuseries/characters` (and locations, and scenes). Confirm:
- More cards fit per row at wider viewport widths.
- Each character card is shorter — image prompt and description start collapsed.
- Clicking a `<summary>` expands it.

`preview_resize` to widths 800, 1200, 1600 to spot-check breakpoints.

### Step 10.4: Commit

```bash
git add apps/dashboard/app/projects/\[slug\]/characters/page.tsx \
        apps/dashboard/app/projects/\[slug\]/locations/page.tsx \
        apps/dashboard/app/projects/\[slug\]/scenes/page.tsx \
        apps/dashboard/app/components/EntityCard.tsx
git commit -m "feat(dashboard): denser entity grids + collapse EntityCard prompt/description"
```

---

## Task 11: Template rewrite in cambrian-docuseries DNA

**Files:**
- Modify: `projects/cambrian-docuseries/content/dna.json`

### Step 11.1: Read current templates

```bash
jq '.characterRefTemplate, .locationRefTemplate' projects/cambrian-docuseries/content/dna.json
```

### Step 11.2: Replace templates

Edit `projects/cambrian-docuseries/content/dna.json`:

- `characterRefTemplate` → `"Three composed views of the same subject in one image: full-body side view on the left, full-body alternate angle in the middle, close-up detail on the right. Cohesive lighting and pose energy. Photographic, no text, no labels, no captions, no annotation overlays, no diagram-style call-outs. Scientifically accurate paleontological reconstruction. {imagePrompt}"`
- `locationRefTemplate` → `"Three composed views of the same place in one image: wide establishing shot on the left, mid-range angle in the middle, close-up textural detail on the right. Cohesive atmospheric lighting. Photographic, no text, no labels, no captions, no annotation overlays. {imagePrompt}"`

### Step 11.3: Verify file still parses

```bash
pnpm --filter=dashboard test content.test.ts
```

### Step 11.4: Commit

```bash
git add projects/cambrian-docuseries/content/dna.json
git commit -m "chore(cambrian-docuseries): rewrite ref templates to forbid burned-in labels"
```

---

## Task 12 (operator step — not code): Regenerate the 3 stale refs

This is a runtime operation, not a code change. Documented for completeness so the operator knows to do it.

After Task 11 lands, the existing 3 selected ref images (Anomalocaris, Trilobite, Burgess Shallow Sea) were generated with the old labeled-diagram template. They're now stale.

The operator (you) opens a terminal Claude session and asks something like:

> "Regenerate one new take for Anomalocaris, Trilobite, and Burgess Shallow Sea using the updated DNA template. Use mcp__higgsfield__generate_image, poll mcp__higgsfield__job_status until done, download to projects/cambrian-docuseries/media/, and append a new take to each entity JSON. Do not change the currently-selected take — I'll select the new one in the dashboard after I see it."

Then in the dashboard, click the green ✓ on the new take to lock it in, and the red bin on the old labeled take.

Cost: ~3 image gen jobs ≈ 90 credits. Current balance ~1240.

---

## Done criteria

- All scene cards show audio mode, refs row, duration input.
- All DNA settings + cinematics show as dropdowns where constrained.
- Entity grids fit ≥3 cards across at desktop width; cards are visibly shorter.
- All tests pass: `pnpm --filter=dashboard test`.
- `cambrian-docuseries` JSON is migrated and validates against the new schema.
- Ref templates rewritten to forbid burned-in text.
- (Operator) 3 ref images regenerated cleanly.
