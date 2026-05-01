import type { Scene, Character, Location } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import FirstFrameSection from "./FirstFrameSection";

type Props = {
  slug: string;
  scene: Scene;
  characters: Character[];
  locations: Location[];
};

function refThumb(slug: string, name: string, imagePath?: string) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 rounded overflow-hidden bg-neutral-800 ring-1 ring-neutral-700">
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(slug, imagePath)} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">no ref</div>
        )}
      </div>
      <span className="text-[10px] text-neutral-400 max-w-[80px] text-center truncate">{name}</span>
    </div>
  );
}

export default function SceneRefsRow({ slug, scene, characters, locations }: Props) {
  const linkedChars = characters.filter((c) => scene.characters.includes(c.id));
  const linkedLocs = locations.filter((l) => scene.locations.includes(l.id));

  return (
    <div className="space-y-3">
      {(linkedChars.length > 0 || linkedLocs.length > 0) && (
        <>
          <p className="text-xs uppercase tracking-wider text-neutral-400">Refs</p>
          <div className="flex flex-wrap gap-3">
            {linkedChars.map((c) => {
              const sel = c.takes.find((t) => t.jobId === c.selectedTakeId);
              return <div key={c.id}>{refThumb(slug, c.name, sel?.imagePath)}</div>;
            })}
            {linkedLocs.map((l) => {
              const sel = l.takes.find((t) => t.jobId === l.selectedTakeId);
              return <div key={l.id}>{refThumb(slug, l.name, sel?.imagePath)}</div>;
            })}
          </div>
        </>
      )}
      <FirstFrameSection slug={slug} scene={scene} />
    </div>
  );
}
