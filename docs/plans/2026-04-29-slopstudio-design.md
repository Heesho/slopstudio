# slopstudio — design

Pivot the Cambria single-tenant dashboard into **slopstudio** (slopstud.io): a local-first folder for AI video making. One repo, one dashboard, many projects. Each project is a fully self-contained show — its own DNA, characters, locations, scenes, episodes, and generated media. Claude (via Claude Code + the Higgsfield MCP) authors and generates; the dashboard is the visual workspace.

This is a rename and restructure of an existing working app, not a from-scratch build.

## Goals

- Anyone can `git clone slopstudio` → `pnpm install` → `pnpm dev` and have a working AI video studio in under 5 minutes (assuming Claude Code + Higgsfield MCP are already set up).
- Multiple projects coexist in one repo. Each is an isolated, portable folder.
- The existing Cambrian content ships as a demo so first-run isn't an empty state.
- Claude is the author of every project — the dashboard never has a "New Project" form. Creation, switching, scaffolding all happen by talking to Claude.
- Zero data migration: existing Cambrian content moves wholesale into `projects/cambrian-docuseries/`.

## Non-goals

- No project create / rename / delete UI in the dashboard. Claude or `rm -rf` handles those.
- No multi-user, no cloud sync, no auth. Local-first, your laptop, your filesystem.
- No project export/zip from the UI — `cd projects/<slug>` and zip it yourself.
- No changes to the Higgsfield generation flow, the take-selection model, or the per-entity schemas. The atomic unit of change is *where* JSON lives, not *what's in it*.

## Folder layout

```
slopstudio/
├── slopstudio.json                  # studio-level config (active project, etc.)
├── projects/
│   └── cambrian-docuseries/         # ships as the demo
│       ├── content/
│       │   ├── _state.json
│       │   ├── dna.json
│       │   ├── characters/
│       │   ├── locations/
│       │   ├── scenes/
│       │   └── episodes/
│       └── media/
│           ├── characters/{id}/{jobId}.png
│           ├── locations/{id}/{jobId}.png
│           └── scenes/{id}/{jobId}.mp4
├── apps/
│   └── dashboard/                   # unchanged at the file-tree level
└── README.md
```

A project is a portable folder. Zip `projects/<slug>/` and you have the whole show. The root no longer holds `content/` or `media/` — those were artifacts of the single-tenant origin.

## `slopstudio.json`

```json
{
  "name": "My Slopstudio",
  "activeProjectSlug": "cambrian-docuseries"
}
```

- `name` — header label in the dashboard.
- `activeProjectSlug` — single source of truth for "what project am I working on right now". Both Claude and the dashboard read/write this. When the user clicks a card in the gallery, the dashboard `PATCH`es it. When the user says *"switch over to <slug>"*, Claude rewrites the file directly.

That's the entire studio config. Everything else (style prompt, aspect ratio, character ref template) lives in `projects/<slug>/content/dna.json` exactly as today.

## Routing

```
/                                           Project gallery
/projects/<slug>                            DNA tab (project home)
/projects/<slug>/characters
/projects/<slug>/locations
/projects/<slug>/scenes
/projects/<slug>/scenes/<id>                Scene detail
/projects/<slug>/episodes
/projects/<slug>/media/[...path]            Per-project media
```

- **Home (`/`) is a gallery.** One card per folder under `projects/`. Card shows project name (from `dna.json.title`), a hero thumbnail (first selected character image, fallback placeholder), and counts (chars / locs / scenes). Clicking a card navigates to `/projects/<slug>` *and* updates `slopstudio.json.activeProjectSlug`.
- **Inside a project**, the existing 5-tab nav (DNA / Characters / Locations / Scenes / Episodes) stays exactly as today, just rooted at `/projects/<slug>/...` instead of `/...`.
- **Project switcher in the header** — current project name + dropdown back to the gallery.
- **Empty studio** (no projects) shows a one-line empty state telling the user to ask Claude to scaffold one.

## API & data flow

Existing routes get project-scoped, plus one new route. No semantic changes to any of the mutation logic; the slug is just threaded through.

| Existing | New |
|---|---|
| `PATCH /api/entity/[type]/[id]/select-take` | `PATCH /api/projects/[slug]/entity/[type]/[id]/select-take` |
| `DELETE /api/entity/[type]/[id]/take/[jobId]` | `DELETE /api/projects/[slug]/entity/[type]/[id]/take/[jobId]` |
| `POST /api/entity/scenes/[id]/select-first-frame` | `POST /api/projects/[slug]/entity/scenes/[id]/select-first-frame` |
| `DELETE /api/entity/scenes/[id]/delete-first-frame` | `DELETE /api/projects/[slug]/entity/scenes/[id]/delete-first-frame` |
| `GET /media/[...path]` | `GET /projects/[slug]/media/[...path]` |
| (none) | `PATCH /api/active-project` — body `{ slug }`, writes `slopstudio.json` |

The content reader and JSON-mutation helpers in `apps/dashboard/lib/` get a `projectSlug` argument threaded through. New helper:

```ts
function projectRoot(slug: string): string {
  return path.join(repoRoot(), 'projects', slug);
}
```

All reads resolve via `projectRoot(slug)/content/...` and all media writes/serves via `projectRoot(slug)/media/...`. The `chokidar` dev watcher gets pointed at `projects/**/content/**` instead of `content/**`.

## Cold-start (README) flow

The `README.md` is rewritten to be project-agnostic. Sections:

1. **What is slopstudio** — one paragraph.
2. **Prerequisites** — Node 20+, pnpm 9+, Claude Code, Higgsfield account + Higgsfield MCP installed and authenticated.
3. **Setup** — `git clone`, `pnpm install`, `pnpm dev`.
4. **Tour the demo** — open the Cambrian project, walk through 5 tabs.
5. **Make your first show** — *"In the Claude Code terminal: 'Set up a new slopstudio project called `<slug>` — a [aesthetic] series about [concept]. 9:16 vertical.'"*
6. **Switching projects** — talk to Claude or click a gallery card.
7. **Wiping the demo** — `rm -rf projects/cambrian-docuseries`.
8. **How it works** — short architecture blurb.
9. **Scripts** + **License**.

## Migration

Mechanical, no schema changes:

```bash
mkdir -p projects/cambrian-docuseries
git mv content projects/cambrian-docuseries/content
git mv media   projects/cambrian-docuseries/media   # mostly gitignored, just folder shape
```

Then thread `projectSlug` through every code path that currently hard-codes `content/` or `media/`. The `dna.json` schema does not get a slug field — the slug *is* the folder name on disk.

## Renames

- Repo: `cambria-monorepo` → `slopstudio` (GitHub rename done by the user; this PR updates `package.json.name` and any internal `cambria` references).
- Dashboard package name: stays `dashboard`.
- Header brand text: pulled from `slopstudio.json.name`.

## Risks & open questions

- **Hard-coded path tracing.** The current dashboard has several places that resolve paths relative to `process.cwd()` plus `'content'` / `'media'`. The implementation plan has to enumerate every one of these and route them through `projectRoot(slug)`. Missing one means a route silently reads from a stale location.
- **Active-project sync race.** If the user navigates the dashboard to project A while simultaneously telling Claude to switch to project B, whoever wrote `slopstudio.json` last wins. This is fine — local-first, single user — but worth not pretending we solved.
- **Gallery thumbnails for empty projects.** A freshly scaffolded project has no generated takes yet, so no thumbnail. Fall back to a styled placeholder card; don't try to be clever.
- **`media/` is gitignored.** Moving the (empty in git) folder is a no-op for git but matters for the dev experience — `.gitignore` needs updating from `/media/` to `/projects/*/media/`.
