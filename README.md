# Cambria

A local-first dashboard for orchestrating AI-generated docuseries with **Claude Code** + the **Higgsfield MCP**.

Built originally for a Planet-Earth-style shortform docuseries about the Cambrian period. Adapt it for any series you want to make.

## What it does

You write your show's DNA, characters, locations, and scenes as JSON files. The dashboard renders them beautifully so you can see at a glance what each prompt produced. Claude (running in your terminal with the Higgsfield MCP authed) does all the writing and the actual generation — the dashboard is your visual workspace.

```
content/         <- the truth (Claude reads + writes)
├── dna.json
├── characters/
├── locations/
├── scenes/
└── episodes/

media/           <- generated assets (Claude downloads to)
├── characters/{id}/{jobId}.png
├── locations/{id}/{jobId}.png
└── scenes/{id}/{jobId}.mp4

apps/dashboard/  <- Next.js viewer (you run, you watch)
```

5 tabs: **DNA · Characters · Locations · Scenes · Episodes**. Each entity supports multiple takes with one-click select / delete from the dashboard.

## Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **Claude Code** with the **Higgsfield MCP** installed and authenticated

## Setup

```bash
pnpm install
pnpm dev          # dashboard at http://localhost:3000
```

The dashboard ships with seed content for a Cambrian docuseries (2 characters, 1 location, 1 episode, 2 scenes — all in `pending` state). To start, ask Claude:

> "Generate the reference images for Anomalocaris and Trilobite, then the location, then the two scenes."

Claude will read the JSON files, stitch the prompts (DNA style + entity prompt), call the Higgsfield MCP, poll the jobs, download results into `media/`, and write the takes back to JSON. The dashboard auto-refreshes via a `chokidar` watcher in dev.

## How it works

- **Single source of truth** is the filesystem. Every entity is a JSON file in `content/`. The dashboard reads via Next.js server components — no API layer for reads.
- **Generation flows through Claude**, not the dashboard. The dashboard never holds a Higgsfield API key. When you click "Select" or "Delete" on a take, the dashboard hits two thin Next.js routes (`PATCH /api/entity/.../select-take`, `DELETE /api/entity/.../take/...`) that mutate the JSON atomically.
- **Style consistency** comes from `dna.json`'s `stylePrompt` — Claude prepends it to every image and video prompt, plus the `characterRefTemplate` / `locationRefTemplate` (multi-angle character sheets) gets stitched in for reference image generation.
- **Multi-take workflow**: every entity stores an array of `takes` (different generations of the same prompt). Pick the best with the green checkmark; trash the rest with the red bin.

## Adapt this for your own series

1. Wipe `content/` and `media/`:
   ```bash
   rm -rf content/* media/*
   ```
2. Tell Claude: *"Set up the DNA for a [your concept] docuseries — Planet Earth style, 9:16 vertical, [your aesthetic]."*
3. Iterate from there: characters → locations → scenes → episodes.

The dashboard chrome, schemas, and Higgsfield wiring stay untouched.

## Scripts

```bash
pnpm dev         # turbo dev (dashboard at :3000)
pnpm build       # next build
pnpm test        # vitest (schemas, content readers, mutations)
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome lint
pnpm format      # biome format --write .
```

## Architecture

See [`docs/plans/2026-04-28-cambria-dashboard-design.md`](docs/plans/2026-04-28-cambria-dashboard-design.md) for the full design rationale, and [`docs/plans/2026-04-28-cambria-dashboard-implementation.md`](docs/plans/2026-04-28-cambria-dashboard-implementation.md) for the task-by-task implementation plan.

## Stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript strict · Zod · chokidar · Geist · lucide-react · Vitest · pnpm + Turborepo · Biome

## License

MIT.
