# Cambria Dashboard — Design Doc

**Date:** 2026-04-28
**Status:** Approved (v1 design)

## Overview

A local-first viewer dashboard for orchestrating a Planet-Earth-style TikTok shortform docuseries about the Cambrian period. The dashboard is a companion to Claude Code + the Higgsfield MCP — Claude does all the writing and generation; the dashboard renders the resulting state so the user can see "this prompt → this output" at a glance instead of digging through folders.

The dashboard will be open-sourced as a reusable tool for anyone using Claude Code with the Higgsfield MCP to produce structured AI video content.

## Goals

- Visualize show DNA, characters, locations, scenes, and episodes in a single dashboard
- Render prompt-to-output mapping clearly so the user always knows what generated what
- Support multiple takes per generation with a select/delete workflow
- Stay decoupled from Higgsfield API auth — generation always flows through Claude + MCP
- Be cloneable and runnable by other Claude Code users with their own Higgsfield MCP

## Non-Goals (v1)

- Editing UI inside the dashboard (Claude does the editing via files)
- TTS / narration audio generation
- Final video assembly (CapCut / ffmpeg stitching)
- Authentication or multi-user collaboration
- Cost analytics, per-episode budgeting
- Layered/per-entity system prompts (single global only)
- Custom uploaded reference images (auto-generation only for v1)
- Workspaces (Higgsfield concept; default private workspace is fine)

## Users & Workflow

Single local user. The user works in two surfaces simultaneously:

1. **Claude Code (terminal)** — for all creative and generative work: writing prompts, generating images and videos, regenerating, refining.
2. **Dashboard (browser, `localhost:3000`)** — for viewing the current state of the show.

Typical flow:
- User: *"Add a character called Hallucigenia."* → Claude writes `content/characters/hallucigenia.json` with `status: "pending"`. Dashboard auto-refreshes, shows it as a pending card.
- User: *"Generate it."* → Claude calls `mcp__higgsfield__generate_image`, polls `mcp__higgsfield__job_status`, downloads the result to `media/characters/hallucigenia/{jobId}.png`, updates JSON. Dashboard auto-refreshes, shows the image.
- User: *"Generate two more variations."* → Claude generates two more takes. Dashboard now shows three thumbnails; user clicks "✓ Select" on the best one in the dashboard.

## Architecture

### Monorepo layout

```
cambria-monorepo/
├── apps/
│   └── dashboard/              # Next.js 15 App Router
├── content/                    # JSON state — single source of truth
│   ├── dna.json
│   ├── _state.json             # Balance + recent jobs (Claude updates)
│   ├── characters/
│   ├── locations/
│   ├── scenes/
│   └── episodes/
├── media/                      # Generated assets (images + videos)
│   ├── characters/{id}/{jobId}.png
│   ├── locations/{id}/{jobId}.png
│   └── scenes/{id}/{jobId}.mp4
├── docs/plans/                 # Design docs and implementation plans
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── .gitignore                  # Ignores media/ (large); keeps content/
```

`content/` and `media/` live at the repo root, not inside the dashboard app. They are the user's project; the dashboard is just a viewer pointed at them. When someone clones this for their own series, they wipe `content/` and `media/` and start fresh.

### State & generation split

- **State** lives in JSON files in `content/`. Claude reads and writes them via the standard Edit/Write tools.
- **Generation** flows through the Higgsfield MCP, invoked by Claude in the user's Claude Code session. The dashboard never calls Higgsfield directly and holds no API keys.
- **Asset download:** after each successful generation, Claude downloads the result file to `media/` so the dashboard renders local files. Higgsfield URLs may expire; local copies persist.
- **Dashboard reads** `content/` via Next.js server components using `fs/promises`. No API layer for reads.
- **Dashboard writes** are restricted to two thin API routes that handle the take-selection UX (see "Take Management" below).

### Live refresh

In dev, a `chokidar` watcher on `content/` triggers `revalidatePath` so changes Claude makes in another terminal appear in the browser without manual refresh.

## Data Model

### `content/dna.json` — show DNA (single file)

```json
{
  "title": "Cambrian: Earth's First Predators",
  "concept": "Planet Earth-style shortform docuseries about life 540M years ago",
  "stylePrompt": "Photorealistic BBC Planet Earth aesthetic, cinematic 9:16 vertical, dramatic god-rays through ancient ocean water, scientifically accurate Cambrian fauna, shallow depth of field, slow deliberate camera movement",
  "narratorVoice": "Calm, authoritative, sense of wonder (Attenborough-style)",
  "aspectRatio": "9:16",
  "videoModel": "seedance_2_0",
  "characterImageModel": "nano_banana_2",
  "characterRefAspectRatio": "16:9",
  "characterRefTemplate": "Character reference sheet, three panels in one image: full-body front view on the left, full-body back view in the middle, close-up face portrait on the right. Consistent lighting and pose energy across all three. {imagePrompt}",
  "locationImageModel": "nano_banana_2",
  "locationRefAspectRatio": "16:9",
  "locationRefTemplate": "Location reference sheet, three views composed in one image: wide establishing shot on the left, mid-range angle in the middle, close-up textural detail on the right. {imagePrompt}"
}
```

### `content/characters/{id}.json`

```json
{
  "id": "anomalocaris",
  "name": "Anomalocaris",
  "imagePrompt": "Anomalocaris canadensis, 1m segmented body, lateral fins, large compound eyes, two grasping appendages near mouth, mottled red-orange",
  "description": "Apex predator. Glides with slow, deliberate undulation; accelerates with sudden bursts. Carries the bearing of a creature that fears nothing.",
  "imageModel": "nano_banana_2",
  "takes": [
    {
      "jobId": "550e8400-e29b-41d4-a716-446655440000",
      "imagePath": "media/characters/anomalocaris/550e8400-e29b-41d4-a716-446655440000.png",
      "status": "done",
      "generatedAt": "2026-04-28T12:00:00Z"
    }
  ],
  "selectedTakeId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`imagePrompt` produces the visual reference. `description` captures behavior/voice/attitude and is stitched into scene prompts. This split matters most for future series featuring people, where attitude/voice can't be inferred from a still image.

### `content/locations/{id}.json`

```json
{
  "id": "burgess-shallow-sea",
  "name": "Burgess Shallow Sea",
  "imagePrompt": "Shallow Cambrian sea floor, soft sediment, scattered sponges, dim god-rays, cool teal water, 540 million years ago",
  "imageModel": "nano_banana_2",
  "takes": [
    {
      "jobId": "...",
      "imagePath": "media/locations/burgess-shallow-sea/{jobId}.png",
      "status": "done",
      "generatedAt": "2026-04-28T12:10:00Z"
    }
  ],
  "selectedTakeId": "..."
}
```

### `content/scenes/{id}.json`

```json
{
  "id": "001-anomalocaris-hunt",
  "episodeId": "ep-1-birth-of-the-predator",
  "order": 3,
  "title": "First Hunt",
  "prompt": "Anomalocaris glides through shallow water, large eyes scanning. Suddenly accelerates toward unseen prey, grasping appendages flaring forward.",
  "narration": "In waters that have never known a true predator, the rules are about to change.",
  "characters": ["anomalocaris"],
  "locations": ["burgess-shallow-sea"],
  "duration": 6,
  "videoModel": "seedance_2_0",
  "takes": [
    {
      "jobId": "...",
      "videoPath": "media/scenes/001-anomalocaris-hunt/{jobId}.mp4",
      "status": "done",
      "generatedAt": "2026-04-28T13:00:00Z"
    }
  ],
  "selectedTakeId": "..."
}
```

### `content/episodes/{id}.json`

```json
{
  "id": "ep-1-birth-of-the-predator",
  "number": 1,
  "title": "Birth of the Predator",
  "hook": "What if I told you the world's first apex predator was the size of a housecat?",
  "scenes": ["000-cold-open", "001-anomalocaris-hunt", "002-trilobite-flee"]
}
```

### `content/_state.json` — runtime state

```json
{
  "lastBalance": 1234.5,
  "lastSyncAt": "2026-04-28T13:30:00Z",
  "recentJobs": [
    { "jobId": "hf_abc", "entity": "scenes/001-anomalocaris-hunt", "status": "done", "completedAt": "2026-04-28T13:00:00Z" }
  ]
}
```

Updated by Claude after each generation. Dashboard reads this for the header balance widget and recent-jobs indicator. Slightly stale (only as fresh as the last generation), but zero infra.

## Take Status

Each take has a `status` field: `pending | generating | done | failed`. The card-level chip in the dashboard reflects the **selected take's** status (or aggregates if no take is done yet).

Lifecycle of a single take:
1. **Create:** Claude appends a take to the entity's `takes` array with `status: "pending"`.
2. **Generate:** Claude flips status to `"generating"`, calls Higgsfield, captures `jobId`, polls.
3. **Complete:** Claude downloads asset to `media/`, sets `imagePath`/`videoPath`, status `"done"`, `generatedAt`.
4. **Fail:** Claude sets status `"failed"` and adds an `error` field.

## Generation Flow (Claude-side)

### Reference image generation (character or location)

```
final_prompt = DNA.stylePrompt + " " + DNA.<entity>RefTemplate.replace("{imagePrompt}", entity.imagePrompt)

mcp__higgsfield__generate_image({
  model: DNA.<entity>ImageModel,
  prompt: final_prompt,
  aspect_ratio: DNA.<entity>RefAspectRatio,
  count: <user-specified, default 1>
})

→ poll job_status with sync: true (images terminal in ~10-20s)
→ download each result URL to media/<type>/{id}/{jobId}.png
→ append takes to entity JSON
```

### Scene video generation

```
character_descriptions = scene.characters.map(c => characters[c].description).join(" ")
final_prompt = DNA.stylePrompt + " " + scene.prompt + " " + character_descriptions

medias = [
  ...scene.characters.map(c => ({ value: characters[c].selectedTake.jobId, role: "image" })),
  ...scene.locations.map(l => ({ value: locations[l].selectedTake.jobId, role: "image" })),
]

mcp__higgsfield__generate_video({
  model: DNA.videoModel,
  prompt: final_prompt,
  aspect_ratio: DNA.aspectRatio,
  duration: scene.duration,
  medias
})

→ poll job_status (no sync; videos take 60-180s)
→ download MP4 to media/scenes/{id}/{jobId}.mp4
→ append take to scene JSON
```

### Reference resolution rule

When a scene generation needs a character or location, the **selected take's** `jobId` is used. So changing `selectedTakeId` on a character changes which reference future scene generations use; existing scenes are unaffected.

## Dashboard Pages

### Header (global)

- Show title (from DNA)
- Tab nav: `DNA | Characters | Locations | Scenes | Episodes`
- Right side: balance widget (`{lastBalance} credits · synced {timeAgo}`), live job indicator if any entity has a `generating` take

### `/` → redirects to `/dna`

### `/dna`

Single full-width card showing all DNA fields cleanly:
- Title, Concept
- Style Prompt (large readable block, copy button)
- Aspect Ratio, Video Model
- Character Image Model + Aspect + Reference Template
- Location Image Model + Aspect + Reference Template
- Read-only with a "Edit via Claude" hint

### `/characters`

Responsive grid of cards (2-3 cols). Per card:
- **Selected take's image** at top (wide multi-angle reference, click → lightbox)
- **Take strip** below: thumbnails of all takes, with `✓ Select` and `🗑 Delete` buttons
- Name + status chip (reflects selected take's status)
- Image prompt (truncated, expand)
- Description block
- Footer: "Appears in N scenes →" (jumps to filtered Scenes)

### `/locations`

Same card layout as `/characters` with location-specific copy.

### `/scenes`

Top filter bar (by episode, by status). List of larger scene cards:
- 9:16 video player at top (selected take's video)
- Take strip below with select/delete buttons
- Header: title, status chip, "Ep 1 · Scene 3"
- Scene prompt block (collapsible)
- Narration block (italic, distinct styling)
- Character chips (clickable → character page) and location chips
- Footer: duration, model, generated timestamp
- Failed takes show `error` message in red

### `/episodes`

Vertical list. Each episode is a section:
- Title + hook line
- Status summary: "8 / 12 scenes done · ~62s total"
- Horizontal storyboard strip of scene poster frames in order, with status chips below each
- Click a thumbnail → scene detail view

## Take Management (Dashboard API)

The dashboard is otherwise a pure viewer, but two thin API routes exist for take management because asking Claude to "select take 2" or "delete take 3" in chat is unergonomic for what is essentially a click-to-select interaction:

- `PATCH /api/entity/[type]/[id]/select-take` — body: `{ jobId }` — sets `selectedTakeId` in the entity's JSON.
- `DELETE /api/entity/[type]/[id]/take/[jobId]` — removes the take from the JSON `takes` array and unlinks the file from `media/`. If the deleted take was the selected one, sets `selectedTakeId` to the most recent remaining `done` take (or `null` if none).

Both routes validate input via Zod and write the JSON file atomically (tmp file + rename).

## Stack

- **Next.js 15** App Router, React 19, TypeScript strict
- **Tailwind v4** for styling, dark theme by default
- **Zod** for JSON schema validation at read-time
- **`fs/promises`** for filesystem reads in server components
- **`chokidar`** dev-only file watcher → `revalidatePath`
- **`lucide-react`** for icons
- **Geist Sans + Geist Mono** for typography
- **pnpm** + **Turborepo** for workspaces and pipelines
- **Biome** for linting/formatting

## Initial Scaffold

The first deliverable will include:
- Working monorepo with all 5 tabs functional
- Zod schemas + TypeScript types for all entities
- A seed `dna.json` describing the Cambrian show concept
- 2 sample characters, 1 sample location, 1 sample episode, 2 sample scenes (in `pending` state — so the dashboard isn't empty on first run, and the user has something concrete to ask Claude to generate)
- README explaining: clone → install → auth Higgsfield MCP → run dashboard → ask Claude to "generate the seed content"

## Open Questions / Future Work

- **TTS narration:** Each scene has a `narration` field. Future work: integrate ElevenLabs or similar to generate VO audio, attach to scene as `narrationAudioPath`.
- **Final assembly:** Stitch selected scene takes into one episode video with narration mixed in. Could be an ffmpeg script triggered by Claude.
- **Layered system prompts:** If style consistency degrades across scene types (action vs ambient), revisit per-scene system overrides.
- **Custom reference uploads:** Add `uploadedImagePath` alternative to `imagePrompt` for entities where a user wants to bring their own reference.
- **Cost tracking:** Per-episode credit usage, surfaced in the Episodes view.
- **Workspaces:** If the user joins a team workspace, surface the workspace selector.
