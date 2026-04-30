# slopstudio

A local-first folder for AI video making. Multi-project. Powered by **Claude Code** + the **Higgsfield MCP**.

You clone this repo and you have an AI video studio on your laptop. Each show you make is a self-contained folder under `projects/`. Claude does the writing and the actual generation. The dashboard is your visual workspace — you watch what's happening, pick the best takes, and tell Claude what to do next.

## What's in here

```
slopstudio/
├── slopstudio.json                   <- studio-level config (active project, name)
├── projects/
│   └── cambrian-docuseries/          <- a demo project ships in this clone
│       ├── content/                  <- JSON source of truth (Claude reads + writes)
│       │   ├── dna.json              <- show concept, style, models, aspect ratio
│       │   ├── characters/
│       │   ├── locations/
│       │   ├── scenes/
│       │   └── episodes/
│       └── media/                    <- generated PNGs and MP4s (gitignored)
│           ├── characters/{id}/{jobId}.png
│           ├── locations/{id}/{jobId}.png
│           └── scenes/{id}/{jobId}.mp4
├── apps/dashboard/                   <- Next.js viewer at http://localhost:3000
└── README.md
```

The dashboard has a project gallery at `/`. Click into a project and you get 5 tabs: **DNA · Characters · Locations · Scenes · Episodes**. Each entity supports multiple takes with one-click select / delete.

## Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **[Claude Code](https://claude.com/claude-code)** — the CLI you'll use to talk to Claude
- **A [Higgsfield](https://higgsfield.ai) account** with the **Higgsfield MCP** installed and authenticated in Claude Code. The MCP is what lets Claude actually generate images and video.

## Setup

```bash
git clone https://github.com/<you>/slopstudio.git
cd slopstudio
pnpm install
pnpm dev          # dashboard at http://localhost:3000
```

Open the dashboard. You'll see one project card: the Cambrian docuseries demo. Click into it to see what a populated slopstudio project looks like — all takes are `pending` (no media generated yet) so you can also use it to test your Higgsfield wiring before starting your own show.

## Make your first show

In the same terminal you ran `pnpm dev` from (or any Claude Code session pointed at this repo), say:

> "Set up a new slopstudio project called `<slug>` — a [Planet-Earth-style / sketch-comedy / dreamy-music-video / your aesthetic] series about [your concept]. 9:16 vertical."

Claude will:

1. Create `projects/<slug>/content/` with a `dna.json` matching your concept.
2. Ask you about characters and locations, then write them as JSON files.
3. Update `slopstudio.json.activeProjectSlug` to your new slug.
4. Generate reference images via the Higgsfield MCP, polling jobs until done, and downloading results into `projects/<slug>/media/`.
5. Append `takes` to each entity's JSON. The dashboard auto-revalidates.

Refresh your browser. Your new project shows up on the gallery and the active tab follows what Claude is working on. Pick the best take of each character with the green checkmark. Then ask Claude for scenes.

## Switching projects

Three ways:

- **Click a card** on the gallery at `/`.
- **Tell Claude**: *"hey switch over to `<slug>`"* — Claude updates `slopstudio.json` and the gallery follows.
- **Edit `slopstudio.json`** directly.

Claude reads `slopstudio.json.activeProjectSlug` to know where ambient operations like *"generate the next scene"* should land.

## Wiping the demo

```bash
rm -rf projects/cambrian-docuseries
```

## How it works

- **Filesystem is the source of truth.** Every entity is a JSON file under `projects/<slug>/content/`. The dashboard reads via Next.js server components — no API layer for reads.
- **Claude is the author.** Creating projects, writing DNA, calling Higgsfield, downloading media, picking models — all done by Claude in your terminal. The dashboard never holds a Higgsfield API key.
- **Mutations from the dashboard are minimal.** When you click the green checkmark / red bin on a take, the dashboard hits a thin route (`PATCH /api/projects/<slug>/entity/.../select-take`, etc.) that mutates the JSON atomically.
- **Style consistency** comes from `dna.json`'s `stylePrompt` — Claude prepends it to every image and video prompt, and `characterRefTemplate` / `locationRefTemplate` get stitched in for reference image generation.
- **Multi-take workflow**: every entity stores an array of `takes` (different generations of the same prompt). Pick the best, trash the rest.
- **Live reload in dev.** A `chokidar` watcher revalidates routes when JSON changes under `projects/**/content/**`, so the dashboard reflects Claude's writes within a second.

## Scripts

```bash
pnpm dev         # turbo dev (dashboard at :3000)
pnpm build       # next build
pnpm test        # vitest (schemas, studio, projects, content, mutations)
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome lint
pnpm format      # biome format --write .
```

## Architecture

See [`docs/plans/2026-04-29-slopstudio-design.md`](docs/plans/2026-04-29-slopstudio-design.md) for the design rationale and [`docs/plans/2026-04-29-slopstudio-implementation.md`](docs/plans/2026-04-29-slopstudio-implementation.md) for the task-by-task plan that built this.

The earlier single-tenant Cambria designs are still in `docs/plans/` for posterity.

## Stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript strict · Zod · chokidar · Geist · lucide-react · Vitest · pnpm + Turborepo · Biome

## License

MIT.
