# Dashboard info copy — design

**Date:** 2026-04-30
**Goal:** Help two audiences orient in the dashboard with light, ambient copy:

1. Visitors who don't know what slopstudio is.
2. Tool users who need to know what the take controls do.

Approach is "light & ambient" (chosen over hero treatment or full per-project storytelling): short subtitles + native button tooltips. Voice is terse, dev-tool flavored, matching the existing mono/minimal aesthetic.

## Changes

### 1. Gallery subtitle

`apps/dashboard/app/page.tsx` — add one line under the `slopstudio` title.

> `Local-first AI video studio. One project per card.`

Style: `text-xs text-neutral-500 font-mono` to match the existing count line.

### 2. Tab subtitles

One short line under the existing `<h1 className="text-2xl font-semibold mb-6">{Name}</h1>` on each entity page. Style: `text-sm text-neutral-400 -mt-4 mb-6` so it tucks under the heading and replaces the existing `mb-6` on the `<h1>`.

| File | Copy |
|------|------|
| `app/projects/[slug]/characters/page.tsx` | `Recurring beings. Lock a reference take to use across scenes.` |
| `app/projects/[slug]/locations/page.tsx` | `Recurring places. Lock a reference take to use across scenes.` |
| `app/projects/[slug]/scenes/page.tsx` | `Shots that compose an episode. Conditioned on character + location refs.` |
| `app/projects/[slug]/episodes/page.tsx` | `Ordered scenes, stitched together.` |

### 3. DNA tab — no change

The page already has an editable concept paragraph at the top and a "Edit fields directly, or ask Claude" footer. Adding more copy would crowd the editable layout.

### 4. Take controls

`apps/dashboard/app/components/TakeStrip.tsx` — add native HTML `title` attributes to the Check and Trash2 buttons. Buttons currently have `aria-label` only (screen readers see them but mice don't get hover tooltips).

- Check button: `title="Lock as the selected take"`
- Bin button: `title="Delete this take"`

## Out of scope

Flagged so they can be added later if the user wants:

- Hero "what is slopstudio" section with the workflow diagram on the gallery
- Per-project "About" panel surfacing DNA on the project view
- Tooltip on the project card itself
- Tooltip on the Header back arrow / credits display
- Media route (no actual page — it's a dynamic file-serving route)

## Testing

Manual verification via `preview_screenshot` / `preview_snapshot`:

- Gallery shows the subtitle.
- Each entity tab shows its subtitle under the heading.
- Hovering Check / Bin in the take strip surfaces the native tooltip.

No unit tests added — this is presentational copy only, no schema or logic changes.
