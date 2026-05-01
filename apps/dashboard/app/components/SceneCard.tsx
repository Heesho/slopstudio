import type { Character, Location, Scene, TakeStatus, VideoTake } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import EditableChips from "./editable/EditableChips";
import EditableNumber from "./editable/EditableNumber";
import EditableText from "./editable/EditableText";
import EditableTextArea from "./editable/EditableTextArea";
import SceneCinematics from "./SceneCinematics";
import StatusChip from "./StatusChip";
import VideoTakeStrip from "./VideoTakeStrip";

type Props = {
  slug: string;
  scene: Scene;
  episodeNumber?: number;
  episodeTitle?: string;
  characters: Character[];
  locations: Location[];
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

export default function SceneCard({
  slug,
  scene,
  episodeNumber,
  episodeTitle,
  characters,
  locations,
}: Props) {
  const selectedTake: VideoTake | null =
    scene.takes.find((t) => t.jobId === scene.selectedTakeId) ?? null;
  const status: TakeStatus = selectedTake?.status ?? "pending";
  const heroSrc = selectedTake?.videoPath ? mediaUrl(slug, selectedTake.videoPath) : null;

  const episodeLabel =
    typeof episodeNumber === "number"
      ? `Ep ${episodeNumber} · Scene ${scene.order}`
      : `Scene ${scene.order}`;

  return (
    <div
      id={`scene-${scene.id}`}
      className="scroll-mt-24 rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden"
    >
      {/* Hero video — first, constrained so 9:16 doesn't dominate */}
      <div className="bg-black">
        <div className="max-w-[180px] mx-auto">
          {heroSrc ? (
            <video
              controls
              preload="metadata"
              className="w-full aspect-[9/16] bg-black"
              src={heroSrc}
            />
          ) : (
            <div className="w-full aspect-[9/16] bg-neutral-900 flex items-center justify-center">
              <span className="text-xs text-neutral-500">
                {selectedTake
                  ? selectedTake.status === "failed"
                    ? "Failed"
                    : selectedTake.status === "generating"
                      ? "Generating…"
                      : selectedTake.status === "pending"
                        ? "Pending"
                        : "No video"
                  : "No video"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Header — title under the clip */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <EditableText
              slug={slug}
              type="scenes"
              id={scene.id}
              field="title"
              value={scene.title}
              className="text-base font-semibold"
            />
            {episodeTitle && (
              <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{episodeTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusChip status={status} />
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-300 whitespace-nowrap">
              {episodeLabel}
            </span>
          </div>
        </div>

        {/* Takes */}
        <VideoTakeStrip
          slug={slug}
          entityId={scene.id}
          takes={scene.takes}
          selectedTakeId={scene.selectedTakeId}
        />

        {/* Scene prompt — collapsed by default */}
        <details className="group">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 hover:text-neutral-200 select-none">
            Prompt
          </summary>
          <div className="mt-2 text-sm text-neutral-300">
            <EditableTextArea
              slug={slug}
              type="scenes"
              id={scene.id}
              field="prompt"
              value={scene.prompt}
              rows={3}
            />
          </div>
        </details>

        {/* Duration */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span>Duration</span>
          <EditableNumber
            slug={slug}
            type="scenes"
            id={scene.id}
            field="duration"
            value={scene.duration}
            min={4}
            max={15}
          />
          <span>s</span>
        </div>

        {/* Characters chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 mr-0.5">
            Cast
          </span>
          <EditableChips
            slug={slug}
            type="scenes"
            id={scene.id}
            field="characters"
            value={scene.characters}
            options={characters.map((c) => {
              const sel = c.takes.find((t) => t.jobId === c.selectedTakeId);
              return { id: c.id, label: c.name, imagePath: sel?.imagePath };
            })}
            chipHref={`/projects/${slug}/characters`}
          />
        </div>

        {/* Locations chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 mr-0.5">
            Set
          </span>
          <EditableChips
            slug={slug}
            type="scenes"
            id={scene.id}
            field="locations"
            value={scene.locations}
            options={locations.map((l) => {
              const sel = l.takes.find((t) => t.jobId === l.selectedTakeId);
              return { id: l.id, label: l.name, imagePath: sel?.imagePath };
            })}
            chipHref={`/projects/${slug}/locations`}
          />
        </div>

        {/* Cinematics — collapsed */}
        <SceneCinematics slug={slug} scene={scene} />

        {/* Footer */}
        {selectedTake?.status === "failed" && selectedTake.error ? (
          <p className="text-xs text-red-400 break-words">{selectedTake.error}</p>
        ) : (
          <p className="text-[11px] text-neutral-500 inline-flex items-center flex-wrap gap-1">
            <EditableText
              slug={slug}
              type="scenes"
              id={scene.id}
              field="videoModel"
              value={scene.videoModel}
              className="font-mono text-[11px]"
            />
            {selectedTake?.generatedAt
              ? ` · ${formatDate(selectedTake.generatedAt)}`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
