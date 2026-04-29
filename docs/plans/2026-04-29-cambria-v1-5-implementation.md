# Cambria v1.5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-frame image generation per scene, structured cinematic vocabulary (genre + 7 cinematic dimensions with `"auto"` sentinel), and inline-editable fields with auto-save throughout the dashboard.

**Architecture:** Extends v1's filesystem-as-state model. New optional fields on DNA + Scene schemas; backward-compatible reads. Single new generic `PATCH /api/entity/[type]/[id]` route handles all field edits via Zod-validated atomic writes. New `select-first-frame` and `delete-first-frame` routes mirror existing take APIs by parameterizing the existing `selectTake` / `deleteTake` helpers with a `collection` arg. UI primitives (`<EditableText>`, `<EditableTextArea>`, `<EditableSelect>`, `<EditableChips>`, `<EditableNumber>`) layer click-to-edit + auto-save-on-blur on top of the existing read views. Generation continues to flow through Claude Code + Higgsfield MCP — the dashboard never gains an API key.

**Tech Stack:** Same as v1 — Next.js 16 App Router, React 19, Tailwind v4, Zod, Vitest, lucide-react. No new dependencies.

**Reference design:** [docs/plans/2026-04-29-cambria-v1-5-design.md](./2026-04-29-cambria-v1-5-design.md) — read this first.

**Working location:** Repo root. v1 is on `main`; this work continues on `main` per user preference.

---

## Phase 1: Schema additions (cinematics + first-frame)

### Task 1: Cinematic + first-frame fields on schemas

**Files:**
- Modify: `apps/dashboard/lib/schemas.ts`
- Modify: `apps/dashboard/lib/schemas.test.ts`

**Step 1: Add the cinematic enum + helper schema**

Insert near the top of `apps/dashboard/lib/schemas.ts` (after `TakeStatus`):

```ts
export const GenreSchema = z.enum([
  "auto", "general", "action", "horror", "comedy", "noir", "drama", "epic",
]);
export type Genre = z.infer<typeof GenreSchema>;

// Each cinematic field is a free string; "auto" is the sentinel meaning
// "skip in prompt / let model decide". Defaults make migration painless.
const cinematicDefaults = {
  genre: GenreSchema.default("auto"),
  colorPalette: z.string().default("auto"),
  lighting: z.string().default("auto"),
  cameraMoveset: z.string().default("auto"),
  camera: z.string().default("auto"),
  lens: z.string().default("auto"),
  focalLength: z.string().default("auto"),
  aperture: z.string().default("auto"),
};

const cinematicOverrides = {
  genre: GenreSchema.optional(),
  colorPalette: z.string().optional(),
  lighting: z.string().optional(),
  cameraMoveset: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  focalLength: z.string().optional(),
  aperture: z.string().optional(),
};
```

**Step 2: Extend DnaSchema with `cinematicDefaults`**

Modify the existing `DnaSchema = z.object({...})` to spread the defaults at the end:

```ts
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
  ...cinematicDefaults,
});
```

**Step 3: Extend SceneSchema with `cinematicOverrides` + first-frame fields**

```ts
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
  ...cinematicOverrides,
  firstFramePrompt: z.string().optional().default(""),
  firstFrameTakes: z.array(ImageTake).default([]),
  firstFrameSelectedTakeId: z.string().uuid().nullable().default(null),
});
```

**Step 4: Write failing tests**

Add to `apps/dashboard/lib/schemas.test.ts`:

```ts
describe("cinematic + first-frame additions", () => {
  it("DNA defaults all cinematic fields to 'auto' when missing", () => {
    const minimal = {
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2", characterRefAspectRatio: "16:9",
      characterRefTemplate: "{imagePrompt}",
      locationImageModel: "nano_banana_2", locationRefAspectRatio: "16:9",
      locationRefTemplate: "{imagePrompt}",
    };
    const parsed = DnaSchema.parse(minimal);
    expect(parsed.genre).toBe("auto");
    expect(parsed.colorPalette).toBe("auto");
    expect(parsed.aperture).toBe("auto");
  });

  it("DNA accepts a non-auto cinematic value", () => {
    const minimal = {
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "drama", focalLength: "85mm",
    };
    const parsed = DnaSchema.parse(minimal);
    expect(parsed.genre).toBe("drama");
    expect(parsed.focalLength).toBe("85mm");
    expect(parsed.aperture).toBe("auto"); // default still applies
  });

  it("DNA rejects an invalid genre", () => {
    const bad = {
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "v",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "musical",
    };
    expect(() => DnaSchema.parse(bad)).toThrow();
  });

  it("Scene cinematic fields are all optional", () => {
    const minimal = {
      id: "s1", episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    };
    const parsed = SceneSchema.parse(minimal);
    expect(parsed.genre).toBeUndefined();
    expect(parsed.colorPalette).toBeUndefined();
    expect(parsed.firstFramePrompt).toBe("");
    expect(parsed.firstFrameTakes).toEqual([]);
    expect(parsed.firstFrameSelectedTakeId).toBeNull();
  });

  it("Scene accepts cinematic overrides", () => {
    const valid = {
      id: "s1", episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      genre: "noir", focalLength: "35mm",
    };
    const parsed = SceneSchema.parse(valid);
    expect(parsed.genre).toBe("noir");
    expect(parsed.focalLength).toBe("35mm");
  });

  it("Scene accepts a first-frame take", () => {
    const valid = {
      id: "s1", episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      firstFramePrompt: "wide opening shot",
      firstFrameTakes: [{
        jobId: "550e8400-e29b-41d4-a716-446655440000",
        imagePath: "media/scenes/s1/firstframe-x.png",
        status: "done",
        generatedAt: "2026-04-29T10:00:00Z",
      }],
      firstFrameSelectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const parsed = SceneSchema.parse(valid);
    expect(parsed.firstFrameTakes).toHaveLength(1);
    expect(parsed.firstFrameSelectedTakeId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
```

**Step 5: Run tests, expect FAIL → implement → expect PASS**

Run: `pnpm --filter=dashboard test`
Expected: 6 new tests fail (schemas don't have the new fields). Implement Steps 1-3 to make them pass.

After implementation, run again: `pnpm --filter=dashboard test`
Expected: 40 tests passing (34 existing + 6 new).

**Step 6: Verify backward compatibility on seed content**

Run: `pnpm --filter=dashboard build`
Expected: clean. Existing seed (which lacks the new cinematic + first-frame fields) parses cleanly because all new fields have defaults or are optional.

**Step 7: Commit**

```bash
git add apps/dashboard/lib/schemas.ts apps/dashboard/lib/schemas.test.ts
git commit -m "feat(schemas): add cinematic vocabulary + first-frame fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Update seed content with cinematic defaults

**Files:**
- Modify: `content/dna.json` — add cinematic defaults appropriate for a Cambrian docuseries.

**Step 1: Modify DNA to add cinematic defaults**

Add at the end of `content/dna.json` (before the closing `}`):

```json
,
"genre": "drama",
"colorPalette": "deep teals with warm amber highlights",
"lighting": "dramatic god-rays from above, soft volumetric particulate",
"cameraMoveset": "slow deliberate dolly, patient observation",
"camera": "auto",
"lens": "auto",
"focalLength": "auto",
"aperture": "auto"
```

(Existing seed scenes need no changes — they inherit DNA defaults via Scene fallback rules.)

**Step 2: Verify**

Run: `pnpm --filter=dashboard build`
Expected: clean.

**Step 3: Commit**

```bash
git add content/dna.json
git commit -m "chore(seed): add cinematic defaults for Cambrian DNA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Mutation layer additions

### Task 3: `updateEntityField` mutation + DNA support in helpers

**Files:**
- Modify: `apps/dashboard/lib/mutations.ts`
- Modify: `apps/dashboard/lib/mutations.test.ts`
- Modify: `apps/dashboard/lib/paths.ts` (no change needed — `paths.dna` already exists from Task 4 of v1).

**Step 1: Extend ENTITY_TYPES + helpers to include "dna"**

In `mutations.ts`:

```ts
export const ENTITY_TYPES = ["dna", "characters", "locations", "scenes", "episodes"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
```

(Note: `episodes` was missing from v1 because no entity-mutation existed for them. Both `dna` and `episodes` need to be reachable via `updateEntityField`.)

Update `SCHEMAS` and `DIRS`:

```ts
import {
  CharacterSchema, DnaSchema, EpisodeSchema, LocationSchema, SceneSchema,
} from "./schemas";

const SCHEMAS = {
  dna: DnaSchema,
  characters: CharacterSchema,
  locations: LocationSchema,
  scenes: SceneSchema,
  episodes: EpisodeSchema,
} as const;

const DIRS: Record<Exclude<EntityType, "dna">, () => string> = {
  characters: () => paths.charactersDir,
  locations: () => paths.locationsDir,
  scenes: () => paths.scenesDir,
  episodes: () => paths.episodesDir,
};
```

**Step 2: Generalize `readEntity` to handle the DNA single-file case**

```ts
export async function readEntity<T extends EntityType>(type: T, id: string) {
  // DNA is a single file; id is ignored (route uses "_").
  if (type === "dna") {
    let raw: string;
    try {
      raw = await fs.readFile(paths.dna, "utf-8");
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new EntityNotFoundError("dna not found");
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new EntityCorruptError(
        `dna has invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      return { file: paths.dna, data: DnaSchema.parse(parsed) };
    } catch (err) {
      throw new EntityCorruptError(
        `dna fails schema: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  // Existing path-traversal-safe directory entity flow:
  assertSafeId(type, id);
  const file = path.join(DIRS[type](), `${id}.json`);
  // ... existing read body unchanged ...
}
```

(`assertSafeId` is only called for directory entities, not DNA. Adapt the existing implementation.)

**Step 3: Add `EDITABLE_FIELDS` allow-list**

```ts
export const EDITABLE_FIELDS: Record<EntityType, readonly string[]> = {
  dna: [
    "title", "concept", "stylePrompt", "narratorVoice", "aspectRatio",
    "videoModel", "characterImageModel", "characterRefAspectRatio",
    "characterRefTemplate", "locationImageModel", "locationRefAspectRatio",
    "locationRefTemplate",
    "genre", "colorPalette", "lighting", "cameraMoveset",
    "camera", "lens", "focalLength", "aperture",
  ],
  characters: ["name", "imagePrompt", "description", "imageModel"],
  locations: ["name", "imagePrompt", "imageModel"],
  scenes: [
    "title", "prompt", "narration", "duration", "videoModel",
    "characters", "locations",
    "genre", "colorPalette", "lighting", "cameraMoveset",
    "camera", "lens", "focalLength", "aperture",
    "firstFramePrompt",
  ],
  episodes: ["title", "hook"],
} as const;
```

**Step 4: Add `updateEntityField` mutation**

```ts
export class FieldNotEditableError extends Error {
  constructor(message: string) { super(message); this.name = "FieldNotEditableError"; }
}

export async function updateEntityField(
  type: EntityType,
  id: string,
  field: string,
  value: unknown,
): Promise<void> {
  if (!EDITABLE_FIELDS[type].includes(field)) {
    throw new FieldNotEditableError(`field "${field}" is not editable on ${type}`);
  }
  const { file, data } = await readEntity(type, id);
  const updated = { ...data, [field]: value };
  // Re-validate the merged entity via its Zod schema:
  let validated: unknown;
  try {
    validated = SCHEMAS[type].parse(updated);
  } catch (err) {
    throw new EntityValidationError(
      `value rejected by schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await writeAtomic(file, validated);
}
```

**Step 5: Write failing tests**

Add to `apps/dashboard/lib/mutations.test.ts`:

```ts
describe("updateEntityField", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-uef-"));
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "scenes"), { recursive: true });
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
    vi.spyOn(paths, "scenesDir", "get").mockReturnValue(path.join(tmpRoot, "scenes"));
    vi.spyOn(paths, "dna", "get").mockReturnValue(path.join(tmpRoot, "dna.json"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("updates a free-text field on a character", async () => {
    const id = "c1";
    await fs.writeFile(path.join(tmpRoot, "characters", `${id}.json`), JSON.stringify({
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [], selectedTakeId: null,
    }));
    await updateEntityField("characters", id, "description", "new behavioral description");
    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "characters", `${id}.json`), "utf-8"));
    expect(updated.description).toBe("new behavioral description");
  });

  it("updates a cinematic field on DNA (single-file)", async () => {
    await fs.writeFile(paths.dna, JSON.stringify({
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "auto", colorPalette: "auto", lighting: "auto", cameraMoveset: "auto",
      camera: "auto", lens: "auto", focalLength: "auto", aperture: "auto",
    }));
    await updateEntityField("dna", "_", "genre", "drama");
    const updated = JSON.parse(await fs.readFile(paths.dna, "utf-8"));
    expect(updated.genre).toBe("drama");
  });

  it("updates an array field on a scene", async () => {
    const id = "s1";
    await fs.writeFile(path.join(tmpRoot, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: ["anomalocaris"], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    }));
    await updateEntityField("scenes", id, "characters", ["anomalocaris", "trilobite"]);
    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "scenes", `${id}.json`), "utf-8"));
    expect(updated.characters).toEqual(["anomalocaris", "trilobite"]);
  });

  it("rejects an unknown field with FieldNotEditableError", async () => {
    const id = "c1";
    await fs.writeFile(path.join(tmpRoot, "characters", `${id}.json`), JSON.stringify({
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [], selectedTakeId: null,
    }));
    await expect(
      updateEntityField("characters", id, "id", "renamed"),
    ).rejects.toBeInstanceOf(FieldNotEditableError);
  });

  it("rejects an invalid value via Zod (negative duration)", async () => {
    const id = "s1";
    await fs.writeFile(path.join(tmpRoot, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    }));
    await expect(
      updateEntityField("scenes", id, "duration", -3),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an invalid genre enum value", async () => {
    await fs.writeFile(paths.dna, JSON.stringify({
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "v",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "auto", colorPalette: "auto", lighting: "auto", cameraMoveset: "auto",
      camera: "auto", lens: "auto", focalLength: "auto", aperture: "auto",
    }));
    await expect(
      updateEntityField("dna", "_", "genre", "musical"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });
});
```

**Step 6: Run tests → FAIL → implement → PASS**

Run: `pnpm --filter=dashboard test`
Expected: tests fail until Steps 1-4 are complete. Then 46 tests passing.

**Step 7: Commit**

```bash
git add apps/dashboard/lib/mutations.ts apps/dashboard/lib/mutations.test.ts
git commit -m "feat(mutations): add updateEntityField with field allow-list and DNA support

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Generalize selectTake / deleteTake to support firstFrameTakes collection

**Files:**
- Modify: `apps/dashboard/lib/mutations.ts`
- Modify: `apps/dashboard/lib/mutations.test.ts`

**Step 1: Add a `collection` parameter (default "takes")**

```ts
type TakeCollection = "takes" | "firstFrameTakes";

const SELECTED_KEY: Record<TakeCollection, string> = {
  takes: "selectedTakeId",
  firstFrameTakes: "firstFrameSelectedTakeId",
};

export async function selectTake(
  type: EntityType,
  id: string,
  jobId: string,
  collection: TakeCollection = "takes",
) {
  if (type === "dna" || type === "episodes") {
    throw new EntityValidationError(`takes are not supported on ${type}`);
  }
  if (collection === "firstFrameTakes" && type !== "scenes") {
    throw new EntityValidationError(`firstFrameTakes only exist on scenes`);
  }
  const { file, data } = await readEntity(type, id);
  const list = (data as Record<string, unknown>)[collection] as Array<{ jobId: string }> | undefined;
  if (!list || !list.some((t) => t.jobId === jobId)) {
    throw new TakeNotFoundError(`take ${jobId} not found in ${collection} on ${type}/${id}`);
  }
  await writeAtomic(file, { ...data, [SELECTED_KEY[collection]]: jobId });
}
```

**Step 2: Adapt `deleteTake` similarly**

Same `collection` parameter. The unlink path resolution reads the take's `imagePath` (for image takes) or `videoPath` (for video takes) — for `firstFrameTakes`, takes are images so we read `imagePath`. The fallback rule for `firstFrameSelectedTakeId` mirrors the existing logic for `selectedTakeId`.

**Step 3: Add tests**

```ts
describe("selectTake / deleteTake on firstFrameTakes", () => {
  // (similar setup as the existing deleteTake describe block)

  it("selects a first-frame take on a scene", async () => {
    const id = "s1";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    await fs.writeFile(path.join(tmpRoot, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p", narration: "n",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      firstFrameTakes: [{ jobId, imagePath: "media/x.png", status: "done", generatedAt: "..." }],
      firstFrameSelectedTakeId: null,
    }));
    await selectTake("scenes", id, jobId, "firstFrameTakes");
    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "scenes", `${id}.json`), "utf-8"));
    expect(updated.firstFrameSelectedTakeId).toBe(jobId);
    expect(updated.selectedTakeId).toBeNull(); // unchanged
  });

  it("deletes a first-frame take and unlinks the file", async () => {
    // ... mirrors the existing deleteTake test structure with imagePath
  });

  it("rejects firstFrameTakes on a non-scene entity", async () => {
    // call selectTake("characters", ..., "firstFrameTakes") and expect EntityValidationError
  });
});
```

**Step 4: Run tests → PASS, commit**

```bash
git add apps/dashboard/lib/mutations.ts apps/dashboard/lib/mutations.test.ts
git commit -m "feat(mutations): selectTake/deleteTake support firstFrameTakes collection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: API routes

### Task 5: `PATCH /api/entity/[type]/[id]` route

**Files:**
- Create: `apps/dashboard/app/api/entity/[type]/[id]/route.ts`

**Step 1: Implement**

```ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ENTITY_TYPES, EntityCorruptError, EntityNotFoundError, EntityValidationError,
  FieldNotEditableError, updateEntityField,
} from "@/lib/mutations";

const TypeSchema = z.enum(ENTITY_TYPES);
const Body = z.object({ field: z.string().min(1), value: z.unknown() });

function errMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await ctx.params;

  let parsedType;
  try {
    parsedType = TypeSchema.parse(type);
  } catch {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid body", detail: errMessage(err) }, { status: 400 });
  }

  try {
    await updateEntityField(parsedType, id, body.field, body.value);
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      return NextResponse.json({ error: "entity not found" }, { status: 404 });
    }
    if (err instanceof EntityCorruptError) {
      return NextResponse.json({ error: "entity corrupt", detail: err.message }, { status: 500 });
    }
    if (
      err instanceof EntityValidationError ||
      err instanceof FieldNotEditableError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "update failed", detail: errMessage(err) }, { status: 500 });
  }

  // Cross-page revalidation (matches the select-take pattern)
  revalidatePath(`/${parsedType === "dna" ? "dna" : parsedType}`);
  if (parsedType === "characters" || parsedType === "locations") {
    revalidatePath("/scenes");
    revalidatePath("/episodes");
  }
  if (parsedType === "scenes") {
    revalidatePath("/episodes");
  }
  if (parsedType === "dna") {
    revalidatePath("/scenes"); // cinematic defaults bleed into scenes
    revalidatePath("/episodes");
  }
  return NextResponse.json({ ok: true });
}
```

**Step 2: Verify build**

Run: `pnpm --filter=dashboard build`
Expected: route table includes `ƒ /api/entity/[type]/[id]`. Build clean.

**Step 3: Commit**

```bash
git add apps/dashboard/app/api/entity/
git commit -m "feat(api): generic PATCH /api/entity/[type]/[id] for field edits

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: First-frame select + delete API routes

**Files:**
- Create: `apps/dashboard/app/api/entity/scenes/[id]/select-first-frame/route.ts`
- Create: `apps/dashboard/app/api/entity/scenes/[id]/first-frame/[jobId]/route.ts`

**Step 1: Implement select-first-frame**

```ts
// app/api/entity/scenes/[id]/select-first-frame/route.ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EntityCorruptError, EntityNotFoundError, EntityValidationError,
  TakeNotFoundError, selectTake,
} from "@/lib/mutations";

const Body = z.object({ jobId: z.string().uuid() });
function errMessage(err: unknown) { return err instanceof Error ? err.message : String(err); }

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body;
  try { body = Body.parse(await req.json()); }
  catch (err) { return NextResponse.json({ error: "invalid body", detail: errMessage(err) }, { status: 400 }); }

  try {
    await selectTake("scenes", id, body.jobId, "firstFrameTakes");
  } catch (err) {
    if (err instanceof EntityNotFoundError) return NextResponse.json({ error: "entity not found" }, { status: 404 });
    if (err instanceof EntityCorruptError) return NextResponse.json({ error: "entity corrupt", detail: err.message }, { status: 500 });
    if (err instanceof TakeNotFoundError || err instanceof EntityValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "select-first-frame failed", detail: errMessage(err) }, { status: 500 });
  }

  revalidatePath("/scenes");
  revalidatePath("/episodes");
  return NextResponse.json({ ok: true });
}
```

**Step 2: Implement first-frame DELETE**

```ts
// app/api/entity/scenes/[id]/first-frame/[jobId]/route.ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EntityCorruptError, EntityNotFoundError, EntityValidationError,
  TakeNotFoundError, deleteTake,
} from "@/lib/mutations";

function errMessage(err: unknown) { return err instanceof Error ? err.message : String(err); }

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await ctx.params;
  try { z.string().uuid().parse(jobId); }
  catch { return NextResponse.json({ error: "invalid jobId" }, { status: 400 }); }

  try {
    await deleteTake("scenes", id, jobId, "firstFrameTakes");
  } catch (err) {
    if (err instanceof EntityNotFoundError) return NextResponse.json({ error: "entity not found" }, { status: 404 });
    if (err instanceof EntityCorruptError) return NextResponse.json({ error: "entity corrupt", detail: err.message }, { status: 500 });
    if (err instanceof TakeNotFoundError || err instanceof EntityValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "delete-first-frame failed", detail: errMessage(err) }, { status: 500 });
  }

  revalidatePath("/scenes");
  revalidatePath("/episodes");
  return NextResponse.json({ ok: true });
}
```

**Step 3: Verify, commit**

```bash
git add apps/dashboard/app/api/entity/scenes/
git commit -m "feat(api): select-first-frame and delete-first-frame routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Editable UI primitives

### Task 7: Build the 5 Editable* components

**Files:**
- Create: `apps/dashboard/app/components/editable/EditableText.tsx`
- Create: `apps/dashboard/app/components/editable/EditableTextArea.tsx`
- Create: `apps/dashboard/app/components/editable/EditableSelect.tsx`
- Create: `apps/dashboard/app/components/editable/EditableChips.tsx`
- Create: `apps/dashboard/app/components/editable/EditableNumber.tsx`
- Create: `apps/dashboard/app/components/editable/useFieldUpdate.ts` — shared hook

**Step 1: Shared hook (`useFieldUpdate.ts`)**

```ts
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type EntityType = "dna" | "characters" | "locations" | "scenes" | "episodes";

export function useFieldUpdate(type: EntityType, id: string, field: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save(value: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entity/${type}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return { save, busy, error, clearError: () => setError(null) };
}
```

**Step 2: `EditableText.tsx`**

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useFieldUpdate } from "./useFieldUpdate";

type EntityType = "dna" | "characters" | "locations" | "scenes" | "episodes";

export default function EditableText({
  type, id, field, value, placeholder, className = "",
}: {
  type: EntityType;
  id: string;
  field: string;
  value: string;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { save, busy, error } = useFieldUpdate(type, id, field);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    try { await save(draft); setEditing(false); }
    catch { /* error shown inline; stay in edit mode */ }
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors cursor-text ${className}`}
        title="Click to edit"
      >
        {value || <span className="text-neutral-500 italic">{placeholder ?? "(empty)"}</span>}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 w-full">
      <input
        ref={ref}
        type="text"
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm flex-1 ${className}`}
      />
      {busy && <span className="text-xs text-neutral-400">...</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
```

**Step 3: `EditableTextArea.tsx`** — same shape but `<textarea>`. Keys: Enter inserts newline (no commit on Enter); Cmd/Ctrl+Enter commits; Esc cancels; blur commits.

**Step 4: `EditableSelect.tsx`** — accepts `options: { value: string; label: string }[]`. Renders as a `<select>` always (no separate display state — selects already look like editable controls). `onChange` calls `save` immediately (no blur needed).

**Step 5: `EditableNumber.tsx`** — wraps `EditableText` with parsed value: `Number(draft)`, validates non-NaN before save, shows inline "must be a number" error otherwise.

**Step 6: `EditableChips.tsx`** — props: `value: string[]`, `options: { id: string; label: string }[]`. Renders existing chips with `✕` to remove, plus a `+` button that opens a small dropdown of remaining options. Each add/remove fires `save(newArray)`.

**Step 7: Verify build (no tests for components in v1.5)**

Run: `pnpm --filter=dashboard build`
Expected: clean.

**Step 8: Commit**

```bash
git add apps/dashboard/app/components/editable/
git commit -m "feat(dashboard): add Editable* primitives with auto-save on blur

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Apply editable primitives to existing pages

### Task 8: Make DNA page editable

**Files:**
- Modify: `apps/dashboard/app/dna/page.tsx`

**Step 1: Replace each read-only field with the matching `Editable*` component**

- `title`, `concept`, `narratorVoice`, `aspectRatio`, `videoModel`, `characterImageModel`, `characterRefAspectRatio`, `locationImageModel`, `locationRefAspectRatio` → `<EditableText type="dna" id="_" field="..." value={dna.X} />`
- `stylePrompt`, `characterRefTemplate`, `locationRefTemplate` → `<EditableTextArea ... />`
- `genre` → `<EditableSelect options={GENRE_OPTIONS} ... />` where `GENRE_OPTIONS` derives from `GenreSchema` enum.
- The 7 other cinematic fields → `<EditableText ... />` (free text; "auto" is just the literal string).

**Step 2: Add a new "Cinematics" section to the DNA layout**

Below the existing Reference Templates section, add:

```tsx
<section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
  <h2 className="text-xs uppercase tracking-wider text-neutral-400 mb-4">Cinematics</h2>
  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
    <div><dt className="text-neutral-500 mb-1">Genre</dt><dd><EditableSelect type="dna" id="_" field="genre" value={dna.genre} options={GENRE_OPTIONS} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Color Palette</dt><dd><EditableText type="dna" id="_" field="colorPalette" value={dna.colorPalette} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Lighting</dt><dd><EditableText type="dna" id="_" field="lighting" value={dna.lighting} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Camera Moveset</dt><dd><EditableText type="dna" id="_" field="cameraMoveset" value={dna.cameraMoveset} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Camera</dt><dd><EditableText type="dna" id="_" field="camera" value={dna.camera} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Lens</dt><dd><EditableText type="dna" id="_" field="lens" value={dna.lens} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Focal Length</dt><dd><EditableText type="dna" id="_" field="focalLength" value={dna.focalLength} /></dd></div>
    <div><dt className="text-neutral-500 mb-1">Aperture</dt><dd><EditableText type="dna" id="_" field="aperture" value={dna.aperture} /></dd></div>
  </dl>
</section>
```

**Step 3: Update the read-only footer hint**

Change `"Edit DNA via Claude — the dashboard is read-only."` to:

`"Edit fields directly, or ask Claude — both write to content/dna.json."`

**Step 4: Verify, commit**

```bash
git add apps/dashboard/app/dna/page.tsx
git commit -m "feat(dashboard): make DNA fields inline-editable + add Cinematics section

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Make Characters page editable

**Files:**
- Modify: `apps/dashboard/app/components/EntityCard.tsx`

**Step 1: Replace name, prompt, description with editable variants**

Pass an `entityType` prop down so the card knows which entity type to PATCH. The existing prop is already `entityType: "characters" | "locations"`, so use that.

```tsx
<h3>
  <EditableText type={entityType} id={entity.id} field="name" value={entity.name} className="text-lg font-semibold" />
</h3>
// ...
<EditableTextArea type={entityType} id={entity.id} field="imagePrompt" value={prompt} />
{description !== undefined && (
  <EditableTextArea type="characters" id={entity.id} field="description" value={description} />
)}
```

(Locations don't have `description`, so the `description !== undefined` check stays.)

Also `imageModel` becomes `<EditableText type={entityType} id={entity.id} field="imageModel" />`.

**Step 2: Verify, commit**

```bash
git add apps/dashboard/app/components/EntityCard.tsx
git commit -m "feat(dashboard): make Characters/Locations fields inline-editable

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Make Episodes page editable

**Files:**
- Modify: `apps/dashboard/app/episodes/page.tsx`

**Step 1: Replace title and hook with editable variants**

```tsx
<h2><EditableText type="episodes" id={episode.id} field="title" value={episode.title} /></h2>
<EditableTextArea type="episodes" id={episode.id} field="hook" value={episode.hook} />
```

**Step 2: Verify, commit**

```bash
git add apps/dashboard/app/episodes/page.tsx
git commit -m "feat(dashboard): make Episode title and hook inline-editable

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Make Scenes page editable + add Cinematics section + add First Frame section

**Files:**
- Modify: `apps/dashboard/app/components/SceneCard.tsx`
- Create: `apps/dashboard/app/components/FirstFrameSection.tsx`
- Create: `apps/dashboard/app/components/SceneCinematics.tsx`

**Step 1: SceneCard text fields → editable**

- `title` → `<EditableText type="scenes" id={scene.id} field="title" ... />`
- `prompt` → `<EditableTextArea ...>`
- `narration` → `<EditableTextArea ...>`
- `duration` → `<EditableNumber ...>`
- `videoModel` → `<EditableText ...>`
- `characters` → `<EditableChips type="scenes" id={scene.id} field="characters" value={scene.characters} options={availableCharacters} />`
- `locations` → `<EditableChips type="scenes" id={scene.id} field="locations" value={scene.locations} options={availableLocations} />`

The Scenes page already reads `readAllScenes` + `readAllEpisodes`. Extend it to also read `readAllCharacters` and `readAllLocations` so it can pass `availableCharacters` / `availableLocations` to each SceneCard's chip editor.

**Step 2: `FirstFrameSection.tsx` (server component)**

```tsx
import StatusChip from "./StatusChip";
import TakeStrip from "./TakeStrip"; // image-take strip from v1
import EditableTextArea from "./editable/EditableTextArea";
import type { Scene } from "@/lib/schemas";

export default function FirstFrameSection({ scene }: { scene: Scene }) {
  const isOpenByDefault = scene.firstFrameTakes.length > 0;
  return (
    <details className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4" {...(isOpenByDefault ? { open: true } : {})}>
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
        First Frame {scene.firstFrameTakes.length > 0 && `· ${scene.firstFrameTakes.length} take${scene.firstFrameTakes.length === 1 ? "" : "s"}`}
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Prompt (optional — locks composition before video gen)</p>
          <EditableTextArea
            type="scenes" id={scene.id} field="firstFramePrompt"
            value={scene.firstFramePrompt ?? ""}
            placeholder="Click to add a first-frame prompt"
          />
        </div>
        {scene.firstFrameTakes.length > 0 && (
          <TakeStrip
            entityType="scenes"
            entityId={scene.id}
            takes={scene.firstFrameTakes}
            selectedTakeId={scene.firstFrameSelectedTakeId}
            collection="firstFrameTakes"  // NEW prop — TakeStrip needs to know which API to call
          />
        )}
      </div>
    </details>
  );
}
```

**Step 3: Update `TakeStrip.tsx` to accept a `collection` prop**

Pass an optional `collection: "takes" | "firstFrameTakes"` prop (default `"takes"`). When `"firstFrameTakes"`, fetch URLs become:
- Select: `PATCH /api/entity/scenes/${entityId}/select-first-frame`
- Delete: `DELETE /api/entity/scenes/${entityId}/first-frame/${jobId}`

When `"takes"` (default), URLs stay the existing select-take / take/{jobId}.

**Step 4: `SceneCinematics.tsx` (server component)**

```tsx
import EditableSelect from "./editable/EditableSelect";
import EditableText from "./editable/EditableText";
import type { Scene } from "@/lib/schemas";

const GENRE_OPTIONS = [
  { value: "auto", label: "auto" },
  { value: "general", label: "general" },
  { value: "action", label: "action" },
  { value: "horror", label: "horror" },
  { value: "comedy", label: "comedy" },
  { value: "noir", label: "noir" },
  { value: "drama", label: "drama" },
  { value: "epic", label: "epic" },
];

const CINEMATIC_TEXT_FIELDS = [
  ["colorPalette", "Color Palette"],
  ["lighting", "Lighting"],
  ["cameraMoveset", "Camera Moveset"],
  ["camera", "Camera"],
  ["lens", "Lens"],
  ["focalLength", "Focal Length"],
  ["aperture", "Aperture"],
] as const;

export default function SceneCinematics({ scene }: { scene: Scene }) {
  return (
    <details className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">Cinematics</summary>
      <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-neutral-500 mb-1">Genre {scene.genre === undefined && <span className="text-neutral-600">(from DNA)</span>}</dt>
          <dd><EditableSelect type="scenes" id={scene.id} field="genre" value={scene.genre ?? "auto"} options={GENRE_OPTIONS} /></dd>
        </div>
        {CINEMATIC_TEXT_FIELDS.map(([field, label]) => (
          <div key={field}>
            <dt className="text-neutral-500 mb-1">{label} {scene[field] === undefined && <span className="text-neutral-600">(from DNA)</span>}</dt>
            <dd><EditableText type="scenes" id={scene.id} field={field} value={scene[field] ?? "auto"} /></dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
```

**Step 5: Wire SceneCard layout**

Insert `<FirstFrameSection scene={scene} />` near the top (above the hero video), and `<SceneCinematics scene={scene} />` near the bottom (above the footer).

**Step 6: Verify build, commit**

```bash
git add apps/dashboard/app/components/ apps/dashboard/app/scenes/
git commit -m "feat(dashboard): make Scenes editable; add First Frame and Cinematics sections

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Polish + smoke test

### Task 12: Smoke test the full v1.5 flow

**Step 1: Run all tests + build**

```bash
pnpm --filter=dashboard typecheck
pnpm --filter=dashboard test
pnpm --filter=dashboard build
```

Expected: typecheck clean, all tests passing (~46+), build clean. Route table includes:
- `ƒ /api/entity/[type]/[id]`
- `ƒ /api/entity/[type]/[id]/select-take`
- `ƒ /api/entity/[type]/[id]/take/[jobId]`
- `ƒ /api/entity/scenes/[id]/select-first-frame`
- `ƒ /api/entity/scenes/[id]/first-frame/[jobId]`
- `ƒ /media/[...path]`
- `ƒ /scenes`
- `○ /` `/_not-found` `/characters` `/dna` `/episodes` `/locations`

**Step 2: Local dogfood**

Run `pnpm --filter=dashboard dev`. Open `localhost:3000`. Verify:

1. `/dna` — click `concept`, type something, click outside → field saves, page revalidates.
2. `/dna` — change `genre` dropdown → save fires immediately.
3. `/characters` — edit `description` on Anomalocaris → saves.
4. `/scenes` — open the First Frame section, type a prompt → saves.
5. `/scenes` — open the Cinematics section, set `focalLength` to "35mm" → saves; "(from DNA)" hint disappears.
6. `/scenes?episode=ep-1-birth-of-the-predator` — filter still works.
7. Storyboard thumbnails on `/episodes` still link to scene anchors.

**Step 3: API stress (optional — quick curls)**

```bash
# Path traversal still blocked
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"field":"name","value":"hacked"}' \
  "http://localhost:3000/api/entity/characters/..%2F..%2Fetc%2Fpasswd"
# Expect: 400 invalid id

# Non-editable field rejected
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"field":"id","value":"renamed"}' \
  "http://localhost:3000/api/entity/characters/anomalocaris"
# Expect: 400 field "id" is not editable on characters

# Invalid Zod value rejected
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"field":"duration","value":-1}' \
  "http://localhost:3000/api/entity/scenes/000-cold-open"
# Expect: 400 value rejected by schema
```

**Step 4: Commit any final tweaks**

If anything needed adjusting, commit. Otherwise no commit needed.

---

## Definition of Done

- All cinematic + first-frame fields exist on schemas and validate correctly.
- All editable fields across DNA, Characters, Locations, Scenes, Episodes are click-to-edit with auto-save on blur.
- First Frame section on Scene cards works end-to-end (prompt edit, take strip with select/delete, integrates with the existing `TakeStrip` via `collection` prop).
- Cinematics section on DNA + Scene cards renders + edits.
- `PATCH /api/entity/[type]/[id]` route handles all field edits with proper Zod validation, error class mapping, and revalidation fan-out.
- First-frame select/delete routes mirror the existing take-management routes.
- All test + typecheck + build commands pass.
- Path traversal, non-editable fields, and invalid values all reject with appropriate status codes.

## Open Implementation Notes

- **TakeStrip's existing select-take / take/[jobId] URLs stay** — the `collection` prop only changes which URL is used, not whether the existing URLs work.
- **`media/scenes/[id]/firstframe-{jobId}.png`** — convention for where Claude saves first-frame images. The existing `/media/[...path]` route serves them transparently.
- **No new dependencies expected** — all primitives use the existing `lucide-react`, Tailwind, and `next/navigation`.
- **No component tests** in v1.5 (matches v1's testing scope). Tests cover schemas, content readers, mutations, and APIs.
- **Generation through Claude Code + Higgsfield MCP** stays — no dashboard generation routes added.
