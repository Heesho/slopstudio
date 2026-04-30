import EmptyState from "@/app/components/EmptyState";
import EditableText from "@/app/components/editable/EditableText";
import EditableTextArea from "@/app/components/editable/EditableTextArea";
import StoryboardStrip from "@/app/components/StoryboardStrip";
import { readAllEpisodes, readAllScenes } from "@/lib/content";
import type { Scene, TakeStatus } from "@/lib/schemas";

function sceneStatus(scene: Scene): TakeStatus {
  const sel = scene.takes.find((t) => t.jobId === scene.selectedTakeId);
  return sel?.status ?? "pending";
}

function buildSummary(scenes: Scene[]): string {
  const counts: Record<TakeStatus, number> = {
    pending: 0,
    generating: 0,
    done: 0,
    failed: 0,
  };
  let doneSeconds = 0;
  for (const s of scenes) {
    const status = sceneStatus(s);
    counts[status] += 1;
    if (status === "done") doneSeconds += s.duration;
  }
  const total = scenes.length;
  const parts: string[] = [];
  parts.push(`${counts.done} / ${total} scenes done`);
  if (doneSeconds > 0) parts.push(`~${Math.round(doneSeconds)}s total`);
  if (counts.generating > 0) parts.push(`${counts.generating} generating`);
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  return parts.join(" · ");
}

export default async function EpisodesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [episodes, scenes] = await Promise.all([
    readAllEpisodes(slug),
    readAllScenes(slug),
  ]);

  if (episodes.length === 0) {
    return (
      <EmptyState
        title="No episodes yet"
        body={
          <>
            Ask Claude to create your first episode in <code>content/episodes/</code>.
          </>
        }
      />
    );
  }

  const sortedEpisodes = [...episodes].sort((a, b) => a.number - b.number);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Episodes</h1>
      {sortedEpisodes.map((episode) => {
        const epScenes = scenes
          .filter((s) => s.episodeId === episode.id)
          .sort((a, b) => a.order - b.order);
        const summary = epScenes.length > 0 ? buildSummary(epScenes) : null;

        return (
          <section
            key={episode.id}
            className="mb-12 border-b border-neutral-800 pb-10 last:border-b-0 last:mb-0"
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1 min-w-0">
                <EditableText
                  slug={slug}
                  type="episodes"
                  id={episode.id}
                  field="title"
                  value={episode.title}
                  className="text-xl font-semibold"
                />
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-300 whitespace-nowrap shrink-0">
                Ep {episode.number}
              </span>
            </div>
            <div className="text-neutral-400 italic mt-1">
              <EditableTextArea
                slug={slug}
                type="episodes"
                id={episode.id}
                field="hook"
                value={episode.hook}
                rows={2}
              />
            </div>
            {summary && (
              <p className="text-xs text-neutral-500 mt-2 mb-4">{summary}</p>
            )}
            {!summary && <div className="mb-4" />}
            <StoryboardStrip slug={slug} scenes={epScenes} episodeId={episode.id} />
          </section>
        );
      })}
    </div>
  );
}
