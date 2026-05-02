"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Scene } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";

type Props = {
  slug: string;
  scenes: Scene[];
};

export default function ArchivedScenesDisclosure({ slug, scenes }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (scenes.length === 0) return null;

  async function handleRestore(sceneId: string) {
    setBusyId(sceneId);
    try {
      const res = await fetch(
        `/api/projects/${slug}/entity/scenes/${sceneId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "archived", value: false }),
        },
      );
      if (!res.ok) throw new Error(`restore failed (${res.status})`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <details className="mt-4">
      <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300 select-none">
        Archived ({scenes.length})
      </summary>
      <div className="mt-2 flex flex-wrap gap-3 opacity-60">
        {scenes.map((scene) => {
          const sel = scene.takes.find((t) => t.jobId === scene.selectedTakeId);
          const videoSrc = sel?.videoPath
            ? `${mediaUrl(slug, sel.videoPath)}#t=0.5`
            : null;
          return (
            <div key={scene.id} className="w-24">
              <div className="w-24 aspect-[9/16] rounded overflow-hidden bg-neutral-900 ring-1 ring-neutral-800">
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
              <div
                className="mt-1 text-[10px] text-neutral-400 truncate"
                title={scene.title}
              >
                {scene.title}
              </div>
              <button
                type="button"
                disabled={busyId === scene.id}
                onClick={() => handleRestore(scene.id)}
                className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
              >
                {busyId === scene.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          );
        })}
      </div>
    </details>
  );
}
