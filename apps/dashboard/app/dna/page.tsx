import { readDna } from "@/lib/content";
import type { Dna } from "@/lib/schemas";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-neutral-100 break-words">{value}</dd>
    </div>
  );
}

function PromptBlock({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <section
      className={
        emphasized
          ? "rounded-lg border border-neutral-700 bg-neutral-900 p-6"
          : "rounded-lg border border-neutral-800 bg-neutral-900/50 p-6"
      }
    >
      <h2 className="text-xs uppercase tracking-wider text-neutral-400">{label}</h2>
      <pre
        className={
          emphasized
            ? "mt-3 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-neutral-100"
            : "mt-3 whitespace-pre-wrap break-words font-mono text-sm text-neutral-200"
        }
      >
        {value}
      </pre>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex justify-center py-16">
      <div className="max-w-xl rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-center">
        <h1 className="text-2xl font-semibold">No DNA yet</h1>
        <p className="mt-3 text-sm text-neutral-400">
          No DNA defined yet. Ask Claude to create{" "}
          <code className="font-mono text-neutral-200">content/dna.json</code> with your
          show&apos;s style and concept.
        </p>
      </div>
    </div>
  );
}

export default async function DnaPage() {
  let dna: Dna;
  try {
    dna = await readDna();
  } catch {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">{dna.title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{dna.concept}</p>
      </header>

      <PromptBlock label="Style prompt" value={dna.stylePrompt} emphasized />

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-xs uppercase tracking-wider text-neutral-400">Settings</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Field label="Aspect Ratio" value={dna.aspectRatio} />
          <Field label="Video Model" value={dna.videoModel} />
          <Field label="Narrator Voice" value={dna.narratorVoice} />
          <Field label="Character Image Model" value={dna.characterImageModel} />
          <Field label="Character Ref Aspect Ratio" value={dna.characterRefAspectRatio} />
          <Field label="Location Image Model" value={dna.locationImageModel} />
          <Field label="Location Ref Aspect Ratio" value={dna.locationRefAspectRatio} />
        </dl>
      </section>

      <div className="flex flex-col gap-6">
        <PromptBlock label="Character Ref Template" value={dna.characterRefTemplate} />
        <PromptBlock label="Location Ref Template" value={dna.locationRefTemplate} />
      </div>

      <p className="text-xs text-neutral-500">
        Edit DNA via Claude — the dashboard is read-only.
      </p>
    </div>
  );
}
