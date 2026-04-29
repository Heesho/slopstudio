import Link from "next/link";
import type { TakeStatus } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import StatusChip from "./StatusChip";
import TakeStrip from "./TakeStrip";

type Take = {
  jobId: string;
  imagePath?: string;
  videoPath?: string;
  status: TakeStatus;
  error?: string;
};

type Entity = {
  id: string;
  name: string;
  takes: Take[];
  selectedTakeId: string | null;
};

type Props = {
  entity: Entity;
  entityType: "characters" | "locations";
  prompt: string;
  description?: string;
  appearsInScenes?: number;
  kind: "image";
};

export default function EntityCard({
  entity,
  entityType,
  prompt,
  description,
  appearsInScenes,
  kind,
}: Props) {
  const selectedTake = entity.takes.find((t) => t.jobId === entity.selectedTakeId) ?? null;
  const status: TakeStatus = selectedTake?.status ?? "pending";
  const heroSrc = selectedTake?.imagePath ? mediaUrl(selectedTake.imagePath) : null;

  const sceneQueryKey = entityType === "characters" ? "character" : "location";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      <div className="aspect-video bg-neutral-900 flex items-center justify-center">
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroSrc}
            alt={entity.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm text-neutral-500">No image yet</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold truncate">{entity.name}</h3>
          <StatusChip status={status} />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400">Image prompt</p>
          <p className="mt-1 text-sm text-neutral-300 line-clamp-3">{prompt}</p>
        </div>

        {description && (
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400">Description</p>
            <p className="mt-1 text-sm text-neutral-300 line-clamp-3">{description}</p>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Takes</p>
          <TakeStrip
            entityType={entityType}
            entityId={entity.id}
            takes={entity.takes}
            selectedTakeId={entity.selectedTakeId}
            kind={kind}
          />
        </div>

        {typeof appearsInScenes === "number" && appearsInScenes > 0 && (
          <Link
            href={`/scenes?${sceneQueryKey}=${entity.id}`}
            className="block text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Appears in {appearsInScenes} {appearsInScenes === 1 ? "scene" : "scenes"} →
          </Link>
        )}
      </div>
    </div>
  );
}
