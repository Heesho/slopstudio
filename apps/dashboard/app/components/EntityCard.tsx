import Link from "next/link";
import type { ImageTake, TakeStatus } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import EditableText from "./editable/EditableText";
import EditableTextArea from "./editable/EditableTextArea";
import StatusChip from "./StatusChip";
import TakeStrip from "./TakeStrip";

type Entity = {
  id: string;
  name: string;
  takes: ImageTake[];
  selectedTakeId: string | null;
};

type Props = {
  slug: string;
  entity: Entity;
  entityType: "characters" | "locations";
  prompt: string;
  description?: string;
  appearsInScenes?: number;
};

export default function EntityCard({
  slug,
  entity,
  entityType,
  prompt,
  description,
  appearsInScenes,
}: Props) {
  const selectedTake = entity.takes.find((t) => t.jobId === entity.selectedTakeId) ?? null;
  const status: TakeStatus = selectedTake?.status ?? "pending";
  const heroSrc = selectedTake?.imagePath ? mediaUrl(slug, selectedTake.imagePath) : null;

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
          <div className="flex-1 min-w-0">
            <EditableText
              slug={slug}
              type={entityType}
              id={entity.id}
              field="name"
              value={entity.name}
              className="text-lg font-semibold"
            />
          </div>
          <StatusChip status={status} />
        </div>

        <details>
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
            Image prompt
          </summary>
          <div className="mt-2 text-sm text-neutral-300">
            <EditableTextArea
              slug={slug}
              type={entityType}
              id={entity.id}
              field="imagePrompt"
              value={prompt}
              rows={3}
            />
          </div>
        </details>

        {description !== undefined && (
          <details>
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
              Description
            </summary>
            <div className="mt-2 text-sm text-neutral-300">
              <EditableTextArea
                slug={slug}
                type={entityType}
                id={entity.id}
                field="description"
                value={description}
                rows={3}
              />
            </div>
          </details>
        )}

        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400 mb-2">Takes</p>
          <TakeStrip
            slug={slug}
            entityType={entityType}
            entityId={entity.id}
            takes={entity.takes}
            selectedTakeId={entity.selectedTakeId}
          />
        </div>

        {typeof appearsInScenes === "number" && appearsInScenes > 0 && (
          <Link
            href={`/projects/${slug}/scenes?${sceneQueryKey}=${entity.id}`}
            className="block text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Appears in {appearsInScenes} {appearsInScenes === 1 ? "scene" : "scenes"} →
          </Link>
        )}
      </div>
    </div>
  );
}
