# slopstudio v0.2 — controls, audio model, denser layout — design

**Date:** 2026-05-01

**Goal:** Tighten the dashboard's data model and surfaces:

1. Replace free-text fields that have a constrained valid set with dropdowns.
2. Rethink the audio model so a scene can be narrated, spoken (dialogue), or silent.
3. Move first-frame UX out of its hidden details element and into a visible "refs row" that shows the actual conditioning images for each scene.
4. Make entity grids denser so more work fits on screen.
5. Clean up burned-in image labels by rewriting the ref templates and regenerating the 3 selected refs.

Audience: visitors orienting and the operator (the user) producing video. Voice stays terse, dev-tool flavored.

## Schema changes

All under `apps/dashboard/lib/schemas.ts`. Each change has a migration note for the one existing project (`projects/cambrian-docuseries/content/`).

### DNA

- `narratorVoice: z.string()` → **`narratorVoice: z.string().nullable()`**. `null` = no global narrator. UI is `EditableTextArea` (matches today). Migration: existing free-text stays verbatim. Free text rather than an enum because actual voice selection isn't an available knob in current video gen — the description gets stuffed into the prompt and the model approximates it.
- `aspectRatio`, `videoModel`, `characterImageModel`, `locationImageModel`, `characterRefAspectRatio`, `locationRefAspectRatio` — schema stays `z.string()` (Higgsfield evolves; we don't want zod rejecting future model IDs). UI uses `EditableSelect` with curated option lists; selecting `custom` falls back to free text. No migration needed.
- Cinematics fields `camera`, `lens`, `focalLength`, `aperture` — same pattern. Stay `z.string().default("auto")`, UI constrains.

### Character

- New field: **`voice: z.string().nullable()`**. `null` = character can't speak (or hasn't been cast yet). Free-text description ("gruff, gravelly, slow cadence") same as DNA narrator voice — same reason, same UI (`EditableTextArea`). Migration: existing characters get `null`.

### Scene

Replace `narration: z.string()` with three fields:

```ts
audioMode: z.enum(["narration", "dialogue", "none"]).default("none"),
audioText: z.string().nullable(),
speakerCharacterId: z.string().nullable(),
```

Validation rules (Zod refinement):
- `audioMode === "narration"` → `audioText` required, `speakerCharacterId` must be null.
- `audioMode === "dialogue"` → `audioText` required, `speakerCharacterId` required (must reference an existing character with a voice).
- `audioMode === "none"` → both null.

Migration: existing scenes with `narration: "<text>"` → `audioMode: "narration"`, `audioText: "<text>"`, `speakerCharacterId: null`. Existing scenes with empty narration → `audioMode: "none"`, both null.

`duration: z.number().int().positive()` → **`z.number().int().min(4).max(15)`**. Migration: `cambrian-docuseries` scenes both have `duration: 8`, in range — no change.

## Template + regeneration

### Template rewrite

Current `characterRefTemplate` ends with "Character reference sheet, three panels in one image: full-body side view on the left, full-body alternate angle in the middle, close-up anatomical detail on the right." The model interprets "reference sheet" as a labeled diagram and burns in annotations.

Rewrite (in `dna.json`, no schema change):

```
Three composed views of the same subject in one image: full-body side view on the left, full-body alternate angle in the middle, close-up detail on the right. Cohesive lighting and pose energy. Photographic, no text, no labels, no captions, no annotation overlays, no diagram-style call-outs. {imagePrompt}
```

Same shape for `locationRefTemplate` with location-appropriate verbs.

### Regeneration

After templates change, the 3 currently-selected refs are stale. Plan:

1. Generate 1 new take per entity (Anomalocaris, Trilobite, Burgess Shallow Sea) using the new template.
2. Operator (the user) reviews and selects the new clean take in the UI; old labeled takes can be deleted.

Cost estimate: 3 image gen jobs at ~30 credits each ≈ 90 credits. Current balance 1240, fine.

## UI changes

### Denser grids

- `characters/page.tsx`: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` → **`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`**.
- `locations/page.tsx`: same.
- `scenes/page.tsx`: `grid-cols-1 md:grid-cols-2` → **`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`**.
- Reduce `gap-6` → `gap-4` on all three.

### Slim entity cards

`EntityCard.tsx`:
- Image prompt: collapsed by default behind a `<details>` summary `Image prompt`.
- Description: collapsed by default behind `<details>` summary `Description`.
- Take strip thumbs: keep current size (16x16 already minimal).
- Title row stays visible; status chip stays.

This makes the visible card height roughly half what it is today.

### SceneCard restructure

New top-to-bottom layout:

1. Header (title, episode chip, status).
2. Hero video (constrained `max-w-xs`, unchanged).
3. Video takes strip.
4. Scene prompt (collapsed `<details>`).
5. **Audio block** (new) — `audioMode` dropdown; conditionally shows `speakerCharacterId` picker (when `dialogue`) and `audioText` field (when `narration` or `dialogue`).
6. Cinematics (collapsed `<details>`, existing).
7. **Refs row** (new) — horizontal strip showing each linked character's selected ref image (small thumb + name), each linked location's ref image, and the first-frame thumb. The first-frame slot is a click target that expands an inline editor for `firstFramePrompt` + a take strip for `firstFrameTakes`. Empty first-frame prompt shows hint text `Ask Claude to draft this`.
8. Duration row — number input clamped 4–15, with hint `Higgsfield supports 4–15s`.

Removes: the old standalone `<FirstFrameSection>` `<details>` block above the hero. The component itself can become the inline editor used by the refs row's first-frame slot.

### Hint copy

- First-frame empty state: `Ask Claude to draft this`.
- Duration: `4–15s` (small label next to the input).

## Out of scope (deferred)

Flagged so they're traceable:

- Server-side LLM call from a `✨ Draft prompt` button. Operator drafts via terminal Claude.
- Voice preview / playback in the dropdown.
- Per-scene cinematics overrides (already exist as a section, not part of this change).
- Auto-regeneration of stale refs after template changes — operator triggers manually.
- Replacing `EditableSelect` with a fancier combobox for `custom` write-in mode — a basic `<input>` fallback is fine for v0.2.

## Sequencing

The work has a partial dependency graph. Land in this order:

1. Schema changes (additive: add new fields, keep `narration` temporarily as deprecated).
2. UI dropdowns on DNA fields and Cinematics.
3. SceneCard refactor + audio block + refs row + duration input.
4. Migration script: convert existing `narration` → audio fields in `cambrian-docuseries`, add `voice: null` on characters. DNA `narratorVoice` stays as-is (already free text).
5. Drop the deprecated `narration` field from schema after migration.
6. Denser grid + EntityCard slimming.
7. Template rewrite in `dna.json`.
8. Regenerate 3 ref images (operator-triggered Higgsfield jobs).

Steps 1–6 are code; 7 is a JSON edit; 8 is a generation run. Land 1–6 as one PR-shaped change so schema and UI never disagree on `main`.

## Testing

- Unit: zod schemas for `Scene` (each `audioMode` branch), `Character.voice` (nullable string), DNA `narratorVoice` (nullable string), scene `duration` clamp.
- Unit: migration helper (input old shape → output new shape) on a fixture of the existing scene JSON.
- UI verification (preview tools): dropdowns render with options; SceneCard refs row shows actual ref images for the Cold Open scene; duration input rejects 3 and 16.
- Manual: regenerate one ref using the new template, confirm no labels burned in.
