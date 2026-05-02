import Link from "next/link";
import type { Scene, TakeStatus, VideoTake } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import StatusChip from "./StatusChip";

type Props = {
  slug: string;
  scenes: Scene[];
  episodeId: string;
};

export default function StoryboardStrip({ slug, scenes, episodeId }: Props) {
  if (scenes.length === 0) {
    return <p className="text-sm text-neutral-500 italic">No scenes yet.</p>;
  }

  // Contract: shows scenes in `order` ascending. Sort defensively so callers
  // don't need to pre-sort. Archived scenes are filtered out.
  const sortedScenes = [...scenes]
    .filter((s) => !s.archived)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {sortedScenes.map((scene) => {
        const selectedTake: VideoTake | null =
          scene.takes.find((t) => t.jobId === scene.selectedTakeId) ?? null;
        const status: TakeStatus = selectedTake?.status ?? "pending";
        const videoSrc = selectedTake?.videoPath
          ? `${mediaUrl(slug, selectedTake.videoPath)}#t=0.5`
          : null;

        return (
          <Link
            key={scene.id}
            href={`/projects/${slug}/scenes?episode=${episodeId}#scene-${scene.id}`}
            className="flex-shrink-0 w-32 group"
          >
            <div className="w-32 aspect-[9/16] rounded overflow-hidden bg-neutral-900 ring-1 ring-neutral-800 group-hover:ring-neutral-600 transition-colors">
              {videoSrc ? (
                <video
                  src={videoSrc}
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
                  no video
                </div>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs text-neutral-400 font-mono">
                #{scene.order}
              </span>
              <StatusChip status={status} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
