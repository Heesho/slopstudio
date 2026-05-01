import EditableSelect from "./editable/EditableSelect";
import EditableTextArea from "./editable/EditableTextArea";
import type { Scene } from "@/lib/schemas";

const AUDIO_MODE_OPTIONS = [
  { value: "none", label: "Silent" },
  { value: "narration", label: "Narration" },
  { value: "dialogue", label: "Dialogue" },
];

type Props = {
  slug: string;
  scene: Scene;
  characters: { id: string; label: string }[];
};

export default function SceneAudioBlock({ slug, scene, characters }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-neutral-400">Audio</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-neutral-500">Mode</span>
        <EditableSelect
          slug={slug}
          type="scenes"
          id={scene.id}
          field="audioMode"
          value={scene.audioMode}
          options={AUDIO_MODE_OPTIONS}
        />
        {scene.audioMode === "dialogue" && (
          <>
            <span className="text-xs text-neutral-500">Speaker</span>
            <EditableSelect
              slug={slug}
              type="scenes"
              id={scene.id}
              field="speakerCharacterId"
              value={scene.speakerCharacterId ?? ""}
              options={[{ value: "", label: "—" }, ...characters.map((c) => ({ value: c.id, label: c.label }))]}
            />
          </>
        )}
      </div>
      {(scene.audioMode === "narration" || scene.audioMode === "dialogue") && (
        <EditableTextArea
          slug={slug}
          type="scenes"
          id={scene.id}
          field="audioText"
          value={scene.audioText ?? ""}
          placeholder={scene.audioMode === "narration" ? "Narrator script…" : "Dialogue line…"}
          rows={3}
        />
      )}
    </div>
  );
}
