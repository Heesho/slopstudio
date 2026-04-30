import EmptyState from "../components/EmptyState";
import EditableSelect from "@/app/components/editable/EditableSelect";
import EditableText from "@/app/components/editable/EditableText";
import EditableTextArea from "@/app/components/editable/EditableTextArea";
import { readDna } from "@/lib/content";
import type { Dna } from "@/lib/schemas";

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

const CINEMATIC_TEXT_FIELDS: Array<readonly [string, string]> = [
  ["colorPalette", "Color Palette"],
  ["lighting", "Lighting"],
  ["cameraMoveset", "Camera Moveset"],
  ["camera", "Camera"],
  ["lens", "Lens"],
  ["focalLength", "Focal Length"],
  ["aperture", "Aperture"],
];

export default async function DnaPage() {
  let dna: Dna;
  try {
    dna = await readDna();
  } catch {
    return (
      <EmptyState
        title="No DNA yet"
        body={
          <>
            No DNA defined yet. Ask Claude to create{" "}
            <code className="font-mono text-neutral-200">content/dna.json</code> with your
            show&apos;s style and concept.
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <EditableText
          type="dna"
          id="_"
          field="title"
          value={dna.title}
          className="text-2xl font-semibold"
        />
        <div className="mt-2 text-sm text-neutral-400">
          <EditableTextArea type="dna" id="_" field="concept" value={dna.concept} />
        </div>
      </header>

      <section className="rounded-lg border border-neutral-700 bg-neutral-900 p-6">
        <h2 className="text-xs uppercase tracking-wider text-neutral-400">Style prompt</h2>
        <div className="mt-3 font-mono text-sm leading-relaxed text-neutral-100">
          <EditableTextArea
            type="dna"
            id="_"
            field="stylePrompt"
            value={dna.stylePrompt}
            rows={4}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-xs uppercase tracking-wider text-neutral-400">Settings</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">Aspect Ratio</dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="aspectRatio"
                value={dna.aspectRatio}
                className="font-mono text-sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">Video Model</dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="videoModel"
                value={dna.videoModel}
                className="font-mono text-sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">Narrator Voice</dt>
            <dd className="mt-1 text-sm text-neutral-100">
              <EditableTextArea
                type="dna"
                id="_"
                field="narratorVoice"
                value={dna.narratorVoice}
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">
              Character Image Model
            </dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="characterImageModel"
                value={dna.characterImageModel}
                className="font-mono text-sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">
              Character Ref Aspect Ratio
            </dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="characterRefAspectRatio"
                value={dna.characterRefAspectRatio}
                className="font-mono text-sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">
              Location Image Model
            </dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="locationImageModel"
                value={dna.locationImageModel}
                className="font-mono text-sm"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-400">
              Location Ref Aspect Ratio
            </dt>
            <dd className="mt-1">
              <EditableText
                type="dna"
                id="_"
                field="locationRefAspectRatio"
                value={dna.locationRefAspectRatio}
                className="font-mono text-sm"
              />
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-xs uppercase tracking-wider text-neutral-400">
            Character Ref Template
          </h2>
          <div className="mt-3 font-mono text-sm text-neutral-200">
            <EditableTextArea
              type="dna"
              id="_"
              field="characterRefTemplate"
              value={dna.characterRefTemplate}
              rows={3}
            />
          </div>
        </section>
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
          <h2 className="text-xs uppercase tracking-wider text-neutral-400">
            Location Ref Template
          </h2>
          <div className="mt-3 font-mono text-sm text-neutral-200">
            <EditableTextArea
              type="dna"
              id="_"
              field="locationRefTemplate"
              value={dna.locationRefTemplate}
              rows={3}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-xs uppercase tracking-wider text-neutral-400 mb-4">Cinematics</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-neutral-500 mb-1">Genre</dt>
            <dd>
              <EditableSelect
                type="dna"
                id="_"
                field="genre"
                value={dna.genre}
                options={GENRE_OPTIONS}
              />
            </dd>
          </div>
          {CINEMATIC_TEXT_FIELDS.map(([field, label]) => (
            <div key={field}>
              <dt className="text-neutral-500 mb-1">{label}</dt>
              <dd>
                <EditableText
                  type="dna"
                  id="_"
                  field={field}
                  value={dna[field as keyof typeof dna] as string}
                  className="font-mono text-sm"
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs text-neutral-500">
        Edit fields directly, or ask Claude — both write to content/dna.json.
      </p>
    </div>
  );
}
