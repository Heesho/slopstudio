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

1. Stitch `dna.json.stylePrompt` (and `characterRefTemplate` / `locationRefTemplate` for refs) onto the entity's prompt.
2. Call `mcp__higgsfield__generate_image` or `mcp__higgsfield__generate_video`.
3. Poll with `mcp__higgsfield__job_status` until status is `completed`.
4. Download the resulting URL to `projects/<slug>/media/<type>/<id>/<jobId>.<ext>`.
5. Append a `take` to the entity JSON with `jobId`, `imagePath`/`videoPath`, `status: "done"`, `generatedAt`.
6. The dashboard auto-revalidates. The user clicks the green checkmark to select a take; the red bin to delete.

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
