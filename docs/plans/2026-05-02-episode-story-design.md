# Episode story → scenes flow — design

**Date:** 2026-05-02

**Goal:** Today an episode is just a `title` + `hook` and scenes are authored ad-hoc. Add an episode-level story (logline + synopsis) so the user can shape the arc with Claude before any scenes get scaffolded, and let scrapped scenes be archived (not lost) when the user wants a different take.

Audience: the operator (the user) producing episodes. Soft coupling — the rule lives in CLAUDE.md, not in code; nothing blocks scene creation if the synopsis is empty.

## Schema changes

All under `apps/dashboard/lib/schemas.ts`. Migration applies to the one existing project (`projects/cambrian-docuseries/content/`).

### Episode

Add two fields:

```ts
logline: z.string().default(""),
synopsis: z.string().default(""),
```

Both default to empty so existing `ep-1-birth-of-the-predator.json` parses cleanly without explicit migration. They get backfilled to `""` on next read.

### Scene

Add one field:

```ts
archived: z.boolean().default(false),
```

`archived: true` = scrapped, kept on disk for recoverability, hidden from the main views, removed from `episode.scenes`. Default `false`.

## UI changes

### Episodes page (`apps/dashboard/app/projects/[slug]/episodes/page.tsx`)

For each episode, between the existing `hook` textarea and the storyboard strip, insert two inline-editable fields using the existing `EditableText` / `EditableTextArea` components and the existing PATCH route:

- **Logline** — `EditableText`, single line, placeholder *"One-sentence pitch."*
- **Synopsis** — `EditableTextArea`, `rows={6}`, placeholder *"Write the arc, then ask Claude to propose scenes from it."*

When the synopsis is empty, the placeholder text doubles as the soft prompt. No badges, no separate "draft" UI.

At the bottom of each episode card, render an **"Archived (N)"** disclosure when archived scenes exist. Expanded, it shows their thumbnails (greyed out) with a Restore action that flips `archived` back to `false` and re-adds the scene to `episode.scenes`. Delete-forever is the existing per-scene right-click menu.

### Scenes page

Filter `archived === true` from the main grid. No new toggle yet — the Episodes-page disclosure is enough surface for v1.

### StoryboardStrip

The strip on the Episodes page reads `episode.scenes` directly (already filtered, since archive removes them from the array). No code change needed beyond what schema migration delivers.

## Workflow rules (CLAUDE.md addendum)

New section **"Episode story → scenes"**:

1. **Before scaffolding scenes** for an episode, read `episode.synopsis` and `episode.logline`. If both are empty, ask the user to draft the story first — or offer to draft a synopsis from the hook + DNA, which the user can then edit on the Episodes page before scenes get proposed.
2. **When proposing scenes** from a synopsis: aim for 4–8 scenes per episode (configurable per request), each scene's prompt should hit a beat the synopsis implies, use existing characters/locations where the synopsis names them, and flag any reference to an entity that doesn't exist yet (so the user can decide whether to create it or rephrase).
3. **When the user wants to replace existing scenes**, set the old scenes' `archived: true` (don't delete files or media) and remove them from `episode.scenes`. New scenes get fresh slugs derived from the new synopsis (e.g., `002-the-impact.json` replacing `002-strike-aftermath.json`). New and archived scenes can share the same `order` value because archived scenes are filtered out of all rendered views.
4. **Mid-iteration replacement** (replace a single scene at a particular order) follows the same archive-and-replace pattern.

## Migration

- `cambrian-docuseries/content/episodes/ep-1-birth-of-the-predator.json` — gains `logline: ""`, `synopsis: ""` on next read. No file edit needed; the schema defaults handle it. Optional polish: write seed values now so the field is non-empty when the user lands on the page.
- All existing scene JSONs gain `archived: false` on read via the schema default. No file edit needed.

## What I'm explicitly NOT doing (YAGNI)

- **No structured beats** (`{ title, summary, sceneIds }`). Synopsis is freeform prose. If scaffolding-from-outline starts feeling unreliable later, beats can be layered on without breaking the synopsis-first flow.
- **No "Propose scenes" button** in the dashboard. The operator chats with Claude — same as every other authoring action in the app — and Claude writes the scene JSONs.
- **No server-side LLM call.** No new API route, no agent integration.
- **No code-level gate** preventing scene creation without a synopsis. The rule is documented in CLAUDE.md and enforced by Claude's behavior, not by a UI block. Soft coupling only.
- **No `0a` / `0b` rename scheme** for archived scenes. Archive flag avoids the rename-id-folder triple-update mess and prevents suffix sprawl across multiple iterations.
- **No automatic scene re-derivation** when the synopsis changes. The user explicitly asks Claude to re-propose; archive happens explicitly per the rule above.

## Tests

- `schemas.test.ts` — episode parses with missing `logline`/`synopsis` (defaults applied); scene parses with missing `archived` (defaults to `false`).
- `mutations.test.ts` — `updateEntityField` accepts the two new episode fields and the new scene field via the existing PATCH route (no new mutation primitives needed).
- `content.test.ts` — `readAllScenes` returns archived scenes; the Episodes page filter is the consumer's responsibility.

No new mutations are introduced — archive/restore is just a `PATCH` to `archived: true | false` through the existing route.

## Out of scope, future considerations

- A "Show archived" toggle on the Scenes page (current design only surfaces archived scenes via the per-episode disclosure).
- Bulk archive ("archive all of episode 1's scenes") — for now Claude does this scene-by-scene per the workflow rule.
- Synopsis versioning. If the user revises the synopsis several times, prior versions are not preserved. If this becomes a pain, swap synopsis for an array of versioned drafts.
