# Cambria v1.5 — Design Doc

**Date:** 2026-04-29
**Status:** Approved
**Predecessor:** [v1 design](./2026-04-28-cambria-dashboard-design.md)

## Overview

Three feature additions to the Cambria dashboard, motivated by gaps surfaced after the v1 dogfood:

1. **First-frame image generation per scene** — generate a still image to lock composition / character placement / lighting before committing to video gen. Reduces wasted video credits (~50/clip) by burning ~2-credit images first.
2. **Structured cinematic vocabulary** — encode the cinematographic decisions (genre, color palette, lighting, camera moveset, camera, lens, focal length, aperture) as first-class fields, rather than burying them in a single `stylePrompt` blob. Mirrors the structure Higgsfield's Cinema Studio surfaces.
3. **Editable fields throughout the dashboard** — every existing field becomes inline-editable in the UI, auto-save on blur. The original "viewer + take buttons" architecture expands so the user can tweak a prompt without context-switching to Claude.

**Out of scope (deferred):**
- Moodboard on DNA — text + reference templates produce strong results today; revisit if style consistency degrades.
- Creating new entities in the UI (Claude does this in seconds).
- Deleting entire entities in the UI.
- Reordering scenes within an episode.

## Goals

- Locked composition before video gen, with a take-strip workflow for first-frame images.
- Per-scene cinematic overrides on top of show-wide DNA defaults.
- Inline editing on every existing field, no save buttons.
- Backward compatible with v1 content; existing scenes/characters/locations/episodes work without migration.

## Non-Goals (v1.5)

- Drag-reorder of any kind.
- Modal forms for entity creation.
- Bulk edits.
- Server-side rendering optimisation beyond what v1 already does.
- Conflict resolution UI (last-write-wins is fine; field-level patches keep collisions extremely rare).

## Schema additions

### `content/dna.json` — gains 8 cinematic defaults

```json
{
  "...existing fields...": "...",
  "genre":          "auto",
  "colorPalette":   "auto",
  "lighting":       "auto",
  "cameraMoveset":  "auto",
  "camera":         "auto",
  "lens":           "auto",
  "focalLength":    "auto",
  "aperture":       "auto"
}
```

`genre` is `z.enum(["auto", "general", "action", "horror", "comedy", "noir", "drama", "epic"])` — matches Seedance's allowed values plus `"general"`. Each other field is `z.string()` defaulting to `"auto"` — free text, but `"auto"` is the sentinel meaning "skip in prompt, let model decide."

### `content/scenes/{id}.json` — gains optional cinematic overrides + first-frame fields

```json
{
  "...existing fields...": "...",

  "genre":          "drama",
  "colorPalette":   "Bleached Warm",
  "lighting":       "auto",
  "cameraMoveset":  "auto",
  "camera":         "Vintage Haze",
  "lens":           "auto",
  "focalLength":    "85mm",
  "aperture":       "f/2.8",

  "firstFramePrompt": "Anomalocaris emerges from a reef shadow, eyes catching god-rays, character left of center, deep blue water column behind",
  "firstFrameTakes": [
    {
      "jobId": "uuid-here",
      "imagePath": "media/scenes/001-anomalocaris-hunt/firstframe-uuid-here.png",
      "status": "done",
      "generatedAt": "2026-04-29T10:00:00Z"
    }
  ],
  "firstFrameSelectedTakeId": "uuid-here"
}
```

All cinematic fields on Scene are **optional**. Resolution rule:

- If Scene field is set (including `"auto"`) → it overrides DNA.
- If Scene field is missing → inherit DNA default.
- If resolved value is `"auto"` → skip in prompt, omit `genre` model param.

`firstFrameTakes`/`firstFrameSelectedTakeId` are optional. Empty array + null selectedId → "skip first-frame, generate the video directly from references." This is the v1 behavior — backward compatible.

### Backward compatibility

The existing v1 seed (and any v1 content users have already created) lacks the new fields. Read-time strategy: Zod schemas mark all new fields as optional with sensible defaults (`"auto"` for cinematics, `[]`/`null` for first-frame). No migration script needed — old content reads cleanly.

## Generation flow changes

### Reference image generation (characters / locations) — unchanged

Same as v1. Cinematic fields don't apply — these are reference sheets, not narrative shots.

### First-frame generation per scene — new

```
final_prompt = DNA.stylePrompt
             + " " + scene.firstFramePrompt
             + cinematic_suffix(scene)

medias = [
  ...characters.map(c => ({ value: c.selectedTake.jobId, role: "image" })),
  ...locations.map(l => ({ value: l.selectedTake.jobId, role: "image" })),
]

generate_image({
  model: DNA.characterImageModel,         // typically nano_banana_2
  prompt: final_prompt,
  aspect_ratio: DNA.aspectRatio,          // 9:16 for the actual final aspect
  medias,
})
```

Two-phase write: append a `firstFrameTakes` entry with `status: "generating"` immediately so the dashboard's blue pulsing chip shows during the wait → poll → flip to `done` with `imagePath`.

Multiple takes via the existing strip pattern. User picks one; that becomes `firstFrameSelectedTakeId`.

### Scene video generation — modified

```
final_prompt = DNA.stylePrompt
             + " " + scene.prompt
             + " " + character.description for each scene.characters
             + cinematic_suffix(scene)

medias = [
  ...(scene.firstFrameSelectedTakeId
     ? [{ value: <selected first-frame jobId>, role: "start_image" }]
     : []),
  ...characters.map(c => ({ value: c.selectedTake.jobId, role: "image" })),
  ...locations.map(l => ({ value: l.selectedTake.jobId, role: "image" })),
]

params = {
  model: DNA.videoModel,
  prompt: final_prompt,
  aspect_ratio: DNA.aspectRatio,
  duration: scene.duration,
  medias,
  ...(effectiveGenre !== "auto" && { genre: effectiveGenre }),
}
```

If `firstFrameSelectedTakeId` is set, its jobId is passed as `start_image`. Otherwise, video generates from references only.

### `cinematic_suffix(entity)` helper

```
For each cinematic field (colorPalette, lighting, cameraMoveset, camera, lens, focalLength, aperture):
  resolved = scene.field ?? dna.field ?? "auto"
  if resolved !== "auto":
    parts.push(`${labelFor(field)}: ${resolved}`)

return parts.length ? " " + parts.join(", ") + "." : ""
```

E.g., for a scene with `colorPalette: "Bleached Warm"`, `focalLength: "85mm"`, `aperture: "f/2.8"`, all others `"auto"`:

`" Color: Bleached Warm, Focal length: 85mm, Aperture: f/2.8."`

`genre` is the only field that is *not* in the suffix — it's a Seedance native model param.

### Two-phase write applies to all generations

Take entries are written with `status: "generating"` before the API call so the dashboard reflects in-flight state for the duration of the job. On completion, the take is updated to `status: "done"` with `imagePath`/`videoPath`. On failure, `status: "failed"` with `error`.

## Editable UI primitives

A small set of inline-edit components, all auto-save on blur, ESC to cancel.

```
<EditableText      value field={...} onSave={...}>     // single-line strings
<EditableTextArea  value field={...} onSave={...}>     // multi-line prompts/descriptions
<EditableSelect    options={...} field={...} onSave>   // enums (genre)
<EditableChips     items={...} options={...} onSave>   // multi-select (characters, locations on scenes)
<EditableNumber    value field={...} onSave>           // duration, episode number
```

### Behavior (shared)

- **Display state**: rendered exactly like v1 read-only views (mono text, chip pills, etc.).
- **Click-to-edit**: clicking the value swaps to an input/textarea/select inline.
- **Auto-save on blur**: `onBlur` fires `onSave(newValue)` which calls the API.
- **ESC cancels**: discards the edit, reverts to last saved value.
- **Optimistic UI**: shows new value immediately, reverts only on server 4xx with a small inline error.
- **In-flight indicator**: subtle right-side spinner during the fetch.
- **Field-level patches**: each component sends only its one field, never the whole entity.

### What's editable

| Page | Editable fields |
|------|-----------------|
| `/dna` | title, concept, stylePrompt, narratorVoice, aspectRatio, videoModel, characterImageModel, characterRefAspectRatio, characterRefTemplate, locationImageModel, locationRefAspectRatio, locationRefTemplate, **all 8 cinematic fields** |
| `/characters` | name, imagePrompt, description, imageModel |
| `/locations` | name, imagePrompt, imageModel |
| `/scenes` | title, prompt, narration, duration, videoModel, characters[], locations[], **all 8 cinematic overrides**, firstFramePrompt |
| `/episodes` | title, hook |

### What stays read-only

- Entity `id` (changing breaks references).
- `episodeId` on a scene (re-parenting requires UX we don't have).
- `takes[]`, `selectedTakeId`, `firstFrameTakes[]`, `firstFrameSelectedTakeId` (already managed by take-strip select/delete UI).
- `scenes[]` array on Episode (reorder is out of scope).
- `number` on Episode (it's the sort key; renumbering is fragile).

## API additions

### `PATCH /api/entity/[type]/[id]` — generic field update

Single endpoint handles every editable field across DNA, Characters, Locations, Scenes, Episodes.

**Request:**
```http
PATCH /api/entity/characters/anomalocaris
Content-Type: application/json

{ "field": "description", "value": "Apex predator with cold, calculating motion." }
```

**Server flow** (`updateEntityField` mutation in `lib/mutations.ts`):
1. Validate `type` against `ENTITY_TYPES` (also accept `"dna"` as a single-file entity).
2. Validate `field` is in an allow-list per entity type.
3. `readEntity(type, id)` — typed via Zod.
4. Construct `updated = { ...data, [field]: value }`.
5. Re-validate with the entity's Zod schema (catches type errors).
6. `writeAtomic(file, updated)`.
7. `revalidatePath` for the entity's page + cross-references.

**Status codes:**
- `200` ok
- `400` invalid type/field/value (Zod errors as `detail`)
- `404` entity not found
- `500` corrupt entity file

**DNA special case:** route accepts `type = "dna"` with `id = "_"` (placeholder). Reads/writes `paths.dna`. The `lib/mutations.ts` helpers grow a `dna` branch in `SCHEMAS` and `DIRS` (the DIR returns a sentinel that resolves to the file path, since DNA isn't a directory).

**Allow-list per type** — codified in `lib/mutations.ts`:

```ts
const EDITABLE_FIELDS = {
  dna: ["title", "concept", "stylePrompt", "narratorVoice", "aspectRatio",
        "videoModel", "characterImageModel", "characterRefAspectRatio",
        "characterRefTemplate", "locationImageModel", "locationRefAspectRatio",
        "locationRefTemplate", "genre", "colorPalette", "lighting",
        "cameraMoveset", "camera", "lens", "focalLength", "aperture"],
  characters: ["name", "imagePrompt", "description", "imageModel"],
  locations: ["name", "imagePrompt", "imageModel"],
  scenes: ["title", "prompt", "narration", "duration", "videoModel",
           "characters", "locations", "genre", "colorPalette", "lighting",
           "cameraMoveset", "camera", "lens", "focalLength", "aperture",
           "firstFramePrompt"],
  episodes: ["title", "hook"],
};
```

### `PATCH /api/entity/scenes/[id]/select-first-frame` — first-frame selection

Direct analog of the existing `select-take` route, but operates on `firstFrameTakes` instead of `takes`. Same body shape (`{ jobId }`), same error model.

Internally calls `selectTake(type, id, jobId, "firstFrameTakes")` with the new optional `collection` parameter (see DRY-ing note below).

### `DELETE /api/entity/scenes/[id]/first-frame/[jobId]` — first-frame deletion

Direct analog of the existing `take/[jobId]` DELETE route. Removes from `firstFrameTakes`, unlinks `media/scenes/[id]/firstframe-{jobId}.png`, falls back `firstFrameSelectedTakeId`.

Internally calls `deleteTake(type, id, jobId, "firstFrameTakes")`.

### DRY-ing the take helpers

`selectTake` and `deleteTake` gain an optional `collection` parameter (default `"takes"`). They internally read/write `entity[collection]` and `entity[collectionSelectedKey]` where `collectionSelectedKey` is computed from collection name (e.g. `firstFrameTakes` → `firstFrameSelectedTakeId`). Single helper handles both flows; routes are thin wrappers.

### Generation stays through the MCP

The dashboard does not gain image/video generation routes. All generation continues to flow through Claude Code + the Higgsfield MCP. The new mutation routes only manage state.

## Scene card layout (v1.5)

Top to bottom:

1. **Header** — title (editable), status chip, "Ep N · Scene M" pill (read-only).
2. **First Frame** (collapsible, default-closed if `firstFrameTakes.length === 0`):
   - First-frame prompt (editable textarea, placeholder when empty)
   - Image take strip (reuses `TakeStrip`, but with new API URLs for select / delete)
3. **Hero video** — selected video take with controls; placeholder div when no video.
4. **Video take strip** — existing `VideoTakeStrip`.
5. **Scene prompt** — editable textarea (existing collapsible).
6. **Narration** — editable textarea.
7. **Characters / Locations** — `<EditableChips>` with available IDs as options.
8. **Cinematics** (collapsible, default-closed):
   - 8 fields rendered as label + `<EditableSelect>` (for genre) or `<EditableText>` (rest).
   - "(from DNA)" hint shown next to inherited values.
9. **Footer** — duration, model, generated timestamp.

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ User                                                              │
└────────┬───────────────────────────────────┬─────────────────────┘
         │                                   │
         │  Edits inline                     │  Asks for generation
         │  (auto-save on blur)              │  ("generate the scene")
         ▼                                   ▼
┌─────────────────────────┐         ┌────────────────────────────┐
│ Dashboard               │         │ Claude Code (terminal)      │
│  - reads content/       │         │  - reads content/           │
│  - PATCH /api/entity/.. │         │  - calls Higgsfield MCP     │
│  - PATCH select-first.. │         │  - downloads to media/      │
│  - DELETE first-frame.. │         │  - writes content/          │
└────────┬────────────────┘         └────────────┬───────────────┘
         │                                       │
         │ atomic JSON writes                    │ atomic JSON writes
         ▼                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ content/  (single source of truth)                                │
│  └─ dna.json, characters/, locations/, scenes/, episodes/         │
└──────────┬───────────────────────────────────────────────────────┘
           │ chokidar watcher (dev only)
           │ → revalidatePath
           ▼
       Live UI refresh
```

## Open questions / future work

- **Conflict UI**: if user edits a prompt at the exact moment Claude is also rewriting it, last-write-wins. Cheap to add an "outdated" toast later by comparing JSON timestamp at PATCH time.
- **Cinematic preset library**: a future "Drop in a preset" feature could bundle named cinematic configs (e.g., "BBC nature doc", "Indie A24") that populate all 8 fields at once. Not needed v1.5.
- **Moodboard**: deferred per scoping. Revisit if/when style fidelity falls short.
- **Per-character cinematic notes**: not in v1.5; characters borrow from DNA + scene.
- **Take ratings**: marking takes as "favorite" without selecting them. Not v1.5.
