import EmptyState from "@/app/components/EmptyState";
import SceneCard from "@/app/components/SceneCard";
import { readAllEpisodes, readAllScenes } from "@/lib/content";
import type { Episode } from "@/lib/schemas";

type SearchParams = Promise<{
  episode?: string;
  status?: string;
  character?: string;
  location?: string;
}>;

export default async function ScenesPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const [scenes, episodes] = await Promise.all([readAllScenes(), readAllEpisodes()]);

  if (scenes.length === 0) {
    return (
      <EmptyState
        title="No scenes yet"
        body={
          <>
            Ask Claude to create your first scene in <code>content/scenes/</code>.
          </>
        }
      />
    );
  }

  const episodeMap = new Map(episodes.map((e) => [e.id, e]));

  // Apply filters
  let filtered = scenes;
  if (params.episode) {
    filtered = filtered.filter((s) => s.episodeId === params.episode);
  }
  if (params.character) {
    filtered = filtered.filter((s) => s.characters.includes(params.character!));
  }
  if (params.location) {
    filtered = filtered.filter((s) => s.locations.includes(params.location!));
  }
  if (params.status) {
    filtered = filtered.filter((s) => {
      const sel = s.takes.find((t) => t.jobId === s.selectedTakeId);
      const status = sel?.status ?? "pending";
      return status === params.status;
    });
  }

  // Sort by episodeId, then order
  filtered = [...filtered].sort((a, b) =>
    a.episodeId === b.episodeId ? a.order - b.order : a.episodeId.localeCompare(b.episodeId),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Scenes</h1>
      <FilterBar episodes={episodes} current={params} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((s) => {
          const ep = episodeMap.get(s.episodeId);
          return (
            <SceneCard
              key={s.id}
              scene={s}
              episodeNumber={ep?.number}
              episodeTitle={ep?.title}
            />
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-neutral-400 mt-8 text-center">
          No scenes match the current filters.
        </p>
      )}
    </div>
  );
}

function FilterBar({
  episodes,
  current,
}: {
  episodes: Episode[];
  current: { episode?: string; status?: string };
}) {
  // Form-based filter: server-side via URL params, no JS needed.
  // defaultValue (not value) keeps this uncontrolled — URL is the source of truth.
  return (
    <form method="get" className="flex flex-wrap items-center gap-3 mb-6 text-sm">
      <select
        name="episode"
        defaultValue={current.episode ?? ""}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200"
      >
        <option value="">All episodes</option>
        {episodes.map((e) => (
          <option key={e.id} value={e.id}>
            Ep {e.number} · {e.title}
          </option>
        ))}
      </select>
      <select
        name="status"
        defaultValue={current.status ?? ""}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200"
      >
        <option value="">Any status</option>
        <option value="pending">Pending</option>
        <option value="generating">Generating</option>
        <option value="done">Done</option>
        <option value="failed">Failed</option>
      </select>
      <button
        type="submit"
        className="rounded border border-neutral-700 px-3 py-1 hover:bg-neutral-800"
      >
        Apply
      </button>
      <a href="/scenes" className="text-neutral-400 hover:text-neutral-200">
        Clear
      </a>
    </form>
  );
}
