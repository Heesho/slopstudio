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

Same as before the multi-project change — only the on-disk paths moved:

1. Stitch `dna.json.stylePrompt` (and `characterRefTemplate` / `locationRefTemplate` for refs) onto the entity's prompt. For scene videos, see **Scene prompt assembly** below.
2. Call `mcp__higgsfield__generate_image` or `mcp__higgsfield__generate_video`.
3. Poll with `mcp__higgsfield__job_status` until status is `completed`.
4. Download the resulting URL to `projects/<slug>/media/<type>/<id>/<jobId>.<ext>`.
5. Append a `take` to the entity JSON with `jobId`, `imagePath`/`videoPath`, `status: "done"`, `generatedAt`.
6. The dashboard auto-revalidates. The user left-clicks a take thumbnail to select it (the selected take fills the hero); right-click opens a menu with **Delete take**.

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
