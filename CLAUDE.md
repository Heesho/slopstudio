# slopstudio

This is **slopstudio** — a multi-project local-first AI video studio. Every project lives under `projects/<slug>/` with `content/` (JSON source of truth) and `media/` (generated images and video).

## Layout

```
slopstudio/
├── slopstudio.json                   # { name, activeProjectSlug }
├── projects/<slug>/
│   ├── content/{dna.json, _state.json, characters/, locations/, scenes/, episodes/}
│   └── media/{characters,locations,scenes}/<id>/<jobId>.{png,mp4}
├── apps/dashboard/                   # Next.js viewer at localhost:3000
└── README.md
```

## When the user asks you to work on a video

1. Read `slopstudio.json` to find `activeProjectSlug`. If the user named a specific project, set `activeProjectSlug` to that slug — use the atomic-write pattern in `apps/dashboard/lib/mutations.ts` (`writeAtomic`), or `writeActiveProjectSlug` from `apps/dashboard/lib/studio.ts`.
2. Read and write JSON only inside `projects/<activeProjectSlug>/content/`. Never touch other projects' folders.
3. Download generated media into `projects/<activeProjectSlug>/media/...`. Store the file path in JSON as **project-relative** — e.g. `"imagePath": "media/characters/anomalocaris/abc.png"`. The dashboard prefixes the slug when building URLs.
4. Schemas live in `apps/dashboard/lib/schemas.ts`. Don't add fields without updating the schema and tests.

## When the user asks for a new project

Scaffold these on disk:

```
projects/<new-slug>/content/dna.json        # write the DNA
projects/<new-slug>/content/characters/     # mkdir
projects/<new-slug>/content/locations/      # mkdir
projects/<new-slug>/content/scenes/         # mkdir
projects/<new-slug>/content/episodes/       # mkdir
```

Then update `slopstudio.json.activeProjectSlug` to the new slug.

Slug rules: `^[a-z0-9-]+$`, length 1-64. The dashboard rejects anything else.

The dashboard's `chokidar` watcher picks up new files automatically; refresh the gallery at `/` to see the new project card. Slug `dna.json.title` is used as the card label, with a fallback to the slug if `dna.json` is missing.

## Generation flow (Higgsfield MCP)

The dashboard renders a loading thumbnail for any take whose `status` is not `done`. To make that loading box visible while a job is running, you MUST append the take to the entity JSON **before** you start polling — not after the download. This applies to characters, locations, and scenes (videos).

1. Stitch `dna.json.stylePrompt` (and `characterRefTemplate` / `locationRefTemplate` for refs) onto the entity's prompt. For scene videos, see **Scene prompt assembly** below.
2. Call `mcp__higgsfield__generate_image` or `mcp__higgsfield__generate_video`. Capture the `jobId` from the response.
3. **Immediately append a placeholder take to the entity JSON** — `{ "jobId", "status": "generating" }` (no `imagePath`/`videoPath` yet). This is what makes the loading box appear in the strip. Do this in the same turn, before any `job_status` polling.
4. Poll with `mcp__higgsfield__job_status` until status is `completed`. (You may leave the take's `status` as `generating` throughout polling.)
5. Download the resulting URL to `projects/<slug>/media/<type>/<id>/<jobId>.<ext>`.
6. **For scene videos with `audio: false`**, strip the audio track after download with ffmpeg before recording the path:

   ```bash
   ffmpeg -y -i <jobId>.mp4 -an -c:v copy <jobId>.muted.mp4
   mv <jobId>.muted.mp4 <jobId>.mp4
   ```

   seedance always renders an audio track; the scene's `audio` flag is enforced at download time, not at generation time. `audio: true` (default) → keep the file as-is.
7. **Update the existing take in place** (match by `jobId`): set `imagePath`/`videoPath`, `status: "done"`, `generatedAt`. Do not append a second entry — the placeholder from step 3 becomes the final take.
8. On failure, update the same take to `status: "failed"` with an `error` string. Do not delete it; the user can right-click → Delete take.
9. The dashboard auto-revalidates. The user left-clicks a take thumbnail to select it (the selected take fills the hero); right-click opens a menu with **Delete take**.

## Scene prompt assembly

Scenes don't have a separate audio mode — `scene.prompt` is the only prompt that gets sent to the video model. Character voice and personality are stored on each character but **not** auto-substituted; you (the assistant) are responsible for weaving them into the prompt before generation, when relevant.

Before calling `mcp__higgsfield__generate_video` for a scene:

1. Read the scene JSON. Start from `scene.prompt` as the base.
2. For each id in `scene.characters`, read `characters/<id>.json`. For each you load:
   - **If the prompt contains dialogue cues** (quoted text, "says", "whispers", "asks", "shouts", "muttered", etc.) **AND** `character.voice` is non-null, weave the voice into the prompt naturally. Example:
     - Raw: `Allie picks up the kettle and says hello`
     - Assembled: `Allie (a 24-year-old with a soft Ohio accent) picks up the kettle and says hello`
   - **If the character's `description` adds context** (personality, behavior, gait, etc.) that the visual ref alone wouldn't carry, you may weave that in too. Use judgment — don't pad the prompt with information the model can already see.
3. Stitch `dna.stylePrompt` onto the result (it conditions visual style across all scenes).
4. Pass the assembled prompt to `mcp__higgsfield__generate_video` along with the scene's `videoModel`, `duration`, and the selected reference images for each linked character + location (image-to-video conditioning).

Don't substitute character details that aren't relevant — if the scene is silent or doesn't reference a character's personality, leave them out. The visual ref already establishes appearance.

## Episode story → scenes

Each episode has a `logline` (one-sentence pitch) and `synopsis` (multi-line prose) that describe the arc. The user shapes them on the Episodes page; you read them before scaffolding scenes.

1. **Before scaffolding scenes** for an episode, read `episode.logline` and `episode.synopsis`. If both are empty, ask the user to draft the story first — or offer to draft a synopsis from the hook + DNA, which the user can then edit on the Episodes page before scenes get proposed.
2. **When proposing scenes** from a synopsis: aim for 4–8 scenes, each scene's prompt should hit a beat the synopsis implies, use existing characters/locations where the synopsis names them, and flag any reference to an entity that doesn't exist yet (so the user can decide whether to create it or rephrase).
3. **When the user asks to replace existing scenes**, set the old scenes' `archived: true` (don't delete files or media) — they stay on disk with their takes intact, hidden from main views, restorable via the "Archived (N)" disclosure on the Episodes page. New scenes get fresh slugs derived from the new synopsis (e.g., `002-the-impact.json` replacing `002-strike-aftermath.json`); they can share the same `order` value as archived scenes because archived ones are filtered out everywhere.
4. **Mid-iteration replacement** (replace a single scene at a particular order) follows the same archive-and-replace pattern.

## Read before editing

- Schemas: `apps/dashboard/lib/schemas.ts`
- Path helpers (`projectPaths`, `studioPaths`, `repoRoot`): `apps/dashboard/lib/paths.ts`
- Studio config helpers (`readStudioConfig`, `writeActiveProjectSlug`, `assertSafeSlug`): `apps/dashboard/lib/studio.ts`
- Project listing: `apps/dashboard/lib/projects.ts`
- Mutation primitives (`writeAtomic`, `selectTake`, `deleteTake`, `updateEntityField`): `apps/dashboard/lib/mutations.ts`

## Don't

- Don't create root-level `content/` or `media/` directories — those existed in the pre-pivot Cambria layout and are gone.
- Don't store absolute or repo-relative media paths in JSON. Project-relative only (`media/...`, no leading `projects/<slug>/`).
- Don't generate media for projects other than `activeProjectSlug` without confirming with the user.
