import EditableSelect from "./editable/EditableSelect";
import EditableText from "./editable/EditableText";
import type { Scene } from "@/lib/schemas";

const GENRE_OPTIONS = [
  { value: "auto", label: "auto" },
  { value: "general", label: "general" },
  { value: "action", label: "action" },
  { value: "horror", label: "horror" },
  { value: "comedy", label: "comedy" },
  { value: "noir", label: "noir" },
  { value: "drama", label: "drama" },
  { value: "epic", label: "epic" },
];

const CINEMATIC_TEXT_FIELDS: Array<readonly [keyof Scene, string]> = [
  ["colorPalette", "Color Palette"],
  ["lighting", "Lighting"],
  ["cameraMoveset", "Camera Moveset"],
  ["camera", "Camera"],
  ["lens", "Lens"],
  ["focalLength", "Focal Length"],
  ["aperture", "Aperture"],
];

export default function SceneCinematics({
  slug,
  scene,
}: {
  slug: string;
  scene: Scene;
}) {
  return (
    <details className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-neutral-400 select-none">
        Cinematics
      </summary>
      <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-neutral-500 mb-1">
            Genre {scene.genre === undefined && <span className="text-neutral-600">(from DNA)</span>}
          </dt>
          <dd>
            <EditableSelect
              slug={slug}
              type="scenes"
              id={scene.id}
              field="genre"
              value={scene.genre ?? "auto"}
              options={GENRE_OPTIONS}
            />
          </dd>
        </div>
        {CINEMATIC_TEXT_FIELDS.map(([field, label]) => {
          const sceneVal = scene[field];
          const isInherited = sceneVal === undefined;
          return (
            <div key={String(field)}>
              <dt className="text-neutral-500 mb-1">
                {label} {isInherited && <span className="text-neutral-600">(from DNA)</span>}
              </dt>
              <dd>
                <EditableText
                  slug={slug}
                  type="scenes"
                  id={scene.id}
                  field={String(field)}
                  value={(sceneVal as string | undefined) ?? "auto"}
                  className="font-mono text-sm"
                />
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}
