import EditableTextArea from "./editable/EditableTextArea";
import TakeStrip from "./TakeStrip";
import type { Scene } from "@/lib/schemas";

export default function FirstFrameSection({ scene }: { scene: Scene }) {
  const isOpen = scene.firstFrameTakes.length > 0;
  return (
    <details
      className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
      {...(isOpen ? { open: true } : {})}
    >
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
        First Frame
        {scene.firstFrameTakes.length > 0 &&
          ` · ${scene.firstFrameTakes.length} take${scene.firstFrameTakes.length === 1 ? "" : "s"}`}
      </summary>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs text-neutral-500 mb-1">
            Prompt (optional — locks composition before video gen)
          </p>
          <EditableTextArea
            type="scenes"
            id={scene.id}
            field="firstFramePrompt"
            value={scene.firstFramePrompt ?? ""}
            placeholder="Click to add a first-frame prompt"
            rows={3}
          />
        </div>
        {scene.firstFrameTakes.length > 0 && (
          <TakeStrip
            entityType="scenes"
            entityId={scene.id}
            takes={scene.firstFrameTakes}
            selectedTakeId={scene.firstFrameSelectedTakeId}
            collection="firstFrameTakes"
          />
        )}
      </div>
    </details>
  );
}
