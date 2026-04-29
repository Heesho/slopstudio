import Link from "next/link";
import type { Scene, TakeStatus, VideoTake } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import StatusChip from "./StatusChip";
import VideoTakeStrip from "./VideoTakeStrip";

type Props = {
  scene: Scene;
  episodeNumber?: number;
  episodeTitle?: string;
};

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SceneCard({ scene, episodeNumber, episodeTitle }: Props) {
  const selectedTake: VideoTake | null =
    scene.takes.find((t) => t.jobId === scene.selectedTakeId) ?? null;
  const status: TakeStatus = selectedTake?.status ?? "pending";
  const heroSrc = selectedTake?.videoPath ? mediaUrl(selectedTake.videoPath) : null;

  const episodeLabel =
    typeof episodeNumber === "number"
      ? `Ep ${episodeNumber} · Scene ${scene.order}`
      : `Scene ${scene.order}`;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      {/* Hero video — constrained to a sensible width so 9:16 doesn't dominate */}
      <div className="bg-black">
        <div className="max-w-xs mx-auto">
          {heroSrc ? (
            <video
              controls
              preload="metadata"
              className="w-full aspect-[9/16] bg-black"
              src={heroSrc}
            />

          ) : (
            <div className="w-full aspect-[9/16] bg-neutral-900 flex items-center justify-center">
              <span className="text-sm text-neutral-500">
                {selectedTake
                  ? selectedTake.status === "failed"
                    ? "Generation failed"
                    : selectedTake.status === "generating"
                      ? "Generating…"
                      : selectedTake.status === "pending"
                        ? "Pending"
                        : "No video yet"
                  : "No video yet"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{scene.title}</h2>
            {episodeTitle && (
              <p className="text-xs text-neutral-500 mt-0.5 truncate">{episodeTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusChip status={status} />
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-300 whitespace-nowrap">
              {episodeLabel}
            </span>
          </div>
        </div>

        {/* Take strip */}
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Takes</p>
          <VideoTakeStrip
            entityId={scene.id}
            takes={scene.takes}
            selectedTakeId={scene.selectedTakeId}
          />
        </div>

        {/* Scene prompt — collapsible */}
        <details className="group">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 hover:text-neutral-200 select-none">
            Scene prompt
          </summary>
          <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap">{scene.prompt}</p>
        </details>

        {/* Narration */}
        <div className="border-l-2 border-neutral-700 pl-3">
          <p className="text-xs uppercase tracking-wider text-neutral-400">Narration</p>
          <p className="mt-1 italic text-neutral-200 whitespace-pre-wrap">{scene.narration}</p>
        </div>

        {/* Characters + Locations chips */}
        {scene.characters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-neutral-400 mr-1">
              Characters:
            </span>
            {scene.characters.map((cid) => (
              <Link
                key={cid}
                href="/characters"
                className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-800 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                {cid}
              </Link>
            ))}
          </div>
        )}

        {scene.locations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-neutral-400 mr-1">
              Locations:
            </span>
            {scene.locations.map((lid) => (
              <Link
                key={lid}
                href="/locations"
                className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-800 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                {lid}
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        {selectedTake?.status === "failed" && selectedTake.error ? (
          <p className="text-xs text-red-400 break-words">{selectedTake.error}</p>
        ) : (
          <p className="text-xs text-neutral-500">
            {scene.duration}s · {scene.videoModel}
            {selectedTake?.generatedAt
              ? ` · generated ${formatDate(selectedTake.generatedAt)}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
