# Dashboard Info Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ambient orientation copy across the dashboard — gallery subtitle, per-tab subtitles, and native hover tooltips on take controls — matching the existing terse mono aesthetic.

**Architecture:** Pure presentational changes. No schema, route, or logic changes. Two logical commits: one for all the subtitles (5 files), one for the take-control tooltips (1 file). Verification is via the dev server preview, not unit tests — this is copy.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, lucide-react icons.

**Reference:** [docs/plans/2026-04-30-info-copy-design.md](./2026-04-30-info-copy-design.md) for the rationale and audience decisions.

**Heads-up before editing:** [apps/dashboard/AGENTS.md](../../apps/dashboard/AGENTS.md) warns the dashboard runs Next 16 with breaking changes vs. older versions. None of this plan touches Next.js APIs (no routing, no server actions, no caching) — only JSX text nodes and HTML `title` attributes — so no docs lookup needed. Flagging it so future-you doesn't get blindsided by the warning.

---

## Task 1: Add subtitle copy

**Files:**
- Modify: `apps/dashboard/app/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/characters/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/locations/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/scenes/page.tsx`
- Modify: `apps/dashboard/app/projects/[slug]/episodes/page.tsx`

### Step 1.1: Gallery subtitle

In `apps/dashboard/app/page.tsx`, the current header is:

```tsx
<header className="mb-8 flex items-baseline justify-between">
  <h1 className="font-mono text-lg tracking-wide text-neutral-100">{studio.name}</h1>
  <p className="text-xs text-neutral-500 font-mono">
    {projects.length} project{projects.length === 1 ? "" : "s"}
  </p>
</header>
```

Restructure so the subtitle sits under the title on the left, with the count still on the right. The `flex items-baseline` only aligns the title row, so wrap the title + new subtitle in a `<div>`:

```tsx
<header className="mb-8 flex items-baseline justify-between">
  <div>
    <h1 className="font-mono text-lg tracking-wide text-neutral-100">{studio.name}</h1>
    <p className="mt-1 text-xs text-neutral-500 font-mono">
      Local-first AI video studio. One project per card.
    </p>
  </div>
  <p className="text-xs text-neutral-500 font-mono">
    {projects.length} project{projects.length === 1 ? "" : "s"}
  </p>
</header>
```

### Step 1.2: Characters tab subtitle

In `apps/dashboard/app/projects/[slug]/characters/page.tsx`, find:

```tsx
<h1 className="text-2xl font-semibold mb-6">Characters</h1>
```

Replace with:

```tsx
<h1 className="text-2xl font-semibold">Characters</h1>
<p className="mt-1 mb-6 text-sm text-neutral-400">
  Recurring beings. Lock a reference take to use across scenes.
</p>
```

(Note: `mb-6` moves from the `<h1>` onto the `<p>` so total spacing to content is preserved.)

### Step 1.3: Locations tab subtitle

In `apps/dashboard/app/projects/[slug]/locations/page.tsx`, apply the same h1 → h1 + p restructure with copy:

> `Recurring places. Lock a reference take to use across scenes.`

If the file uses a different heading pattern, match it. Read the file first.

### Step 1.4: Scenes tab subtitle

In `apps/dashboard/app/projects/[slug]/scenes/page.tsx`, find:

```tsx
<h1 className="text-2xl font-semibold mb-6">Scenes</h1>
```

Replace with:

```tsx
<h1 className="text-2xl font-semibold">Scenes</h1>
<p className="mt-1 mb-6 text-sm text-neutral-400">
  Shots that compose an episode. Conditioned on character + location refs.
</p>
```

### Step 1.5: Episodes tab subtitle

In `apps/dashboard/app/projects/[slug]/episodes/page.tsx`, apply the same restructure with copy:

> `Ordered scenes, stitched together.`

Read the file first to confirm the heading shape matches the others. If it differs (e.g. uses a different className or wraps in a header element), adapt without breaking layout.

### Step 1.6: Verify in the browser

Server is already running on port 3000. If it's not, run:

```
mcp__Claude_Preview__preview_start name="dashboard"
```

Then:

1. `mcp__Claude_Preview__preview_screenshot` on the gallery — confirm subtitle appears under `slopstudio` title.
2. `mcp__Claude_Preview__preview_click` the project card to enter the project view.
3. Visit each tab (Characters, Locations, Scenes, Episodes) via `mcp__Claude_Preview__preview_click` on the nav links and screenshot each one. Confirm the subtitle line appears under the heading on every tab and that spacing looks right.

Per `verification_workflow`, also check `mcp__Claude_Preview__preview_console_logs` for errors after the round trip.

### Step 1.7: Commit

```bash
git add apps/dashboard/app/page.tsx \
        apps/dashboard/app/projects/\[slug\]/characters/page.tsx \
        apps/dashboard/app/projects/\[slug\]/locations/page.tsx \
        apps/dashboard/app/projects/\[slug\]/scenes/page.tsx \
        apps/dashboard/app/projects/\[slug\]/episodes/page.tsx
git commit -m "feat(dashboard): subtitle copy on gallery + entity tabs"
```

---

## Task 2: Add hover tooltips to take controls

**Files:**
- Modify: `apps/dashboard/app/components/TakeStrip.tsx:115-132`

### Step 2.1: Add `title` attributes

In `apps/dashboard/app/components/TakeStrip.tsx`, the two buttons currently look like:

```tsx
<button
  type="button"
  onClick={() => handleSelect(t.jobId)}
  disabled={isBusy || isSelected || t.status !== "done"}
  aria-label="Select this take"
  className="..."
>
  <Check size={14} />
</button>
<button
  type="button"
  onClick={() => handleDelete(t.jobId)}
  disabled={isBusy}
  aria-label="Delete this take"
  className="..."
>
  <Trash2 size={14} />
</button>
```

Add a `title` attribute to each so a native hover tooltip renders. Keep the `aria-label` (still useful for screen readers).

- Check button: `title="Lock as the selected take"`
- Trash button: `title="Delete this take"`

### Step 2.2: Verify

The Cambrian project has selected reference takes on Anomalocaris, Trilobite, and Burgess Shallow Sea — visit one of those entity pages so the take strip is populated.

1. `mcp__Claude_Preview__preview_click` into a character entity (e.g. Anomalocaris on the Characters tab — it expands inline or routes to a detail view; follow the existing UX).
2. The native `title` tooltip is hard to capture in a screenshot (it appears after a browser-set hover delay). Instead, verify via `mcp__Claude_Preview__preview_snapshot` and grep the snapshot for the tooltip text — or use `mcp__Claude_Preview__preview_inspect` on a button to confirm the `title` attribute is set.
3. `mcp__Claude_Preview__preview_console_logs` — confirm no errors.

### Step 2.3: Commit

```bash
git add apps/dashboard/app/components/TakeStrip.tsx
git commit -m "feat(dashboard): hover tooltips on take select/delete buttons"
```

---

## Done criteria

- Gallery shows the subtitle under `slopstudio`.
- Each entity tab (Characters, Locations, Scenes, Episodes) shows its subtitle directly under the heading.
- DNA tab is unchanged.
- Hovering Check / Trash icons in the take strip surfaces the native tooltip with the locked-in copy.
- No console errors in the preview.
- Two commits land on `main`.
