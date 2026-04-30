"use client";

import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImageTake } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import StatusChip from "./StatusChip";

type Props = {
  entityType: "characters" | "locations" | "scenes";
  entityId: string;
  takes: ImageTake[];
  selectedTakeId: string | null;
  collection?: "takes" | "firstFrameTakes";
};

export default function TakeStrip({
  entityType,
  entityId,
  takes,
  selectedTakeId,
  collection = "takes",
}: Props) {
  const router = useRouter();
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [errorByJob, setErrorByJob] = useState<Record<string, string>>({});

  // URL switch: default routes hit select-take / take/[jobId]; firstFrameTakes
  // hits the parallel select-first-frame / first-frame/[jobId] routes (Task 6).
  const selectUrl =
    collection === "firstFrameTakes"
      ? `/api/entity/${entityType}/${entityId}/select-first-frame`
      : `/api/entity/${entityType}/${entityId}/select-take`;
  const deleteUrlFor = (jobId: string) =>
    collection === "firstFrameTakes"
      ? `/api/entity/${entityType}/${entityId}/first-frame/${jobId}`
      : `/api/entity/${entityType}/${entityId}/take/${jobId}`;

  if (takes.length === 0) {
    return (
      <p className="text-xs text-neutral-500 italic">No takes yet.</p>
    );
  }

  async function handleSelect(jobId: string) {
    setBusyJobId(jobId);
    setErrorByJob((e) => ({ ...e, [jobId]: "" }));
    try {
      const res = await fetch(selectUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(`select failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setErrorByJob((e) => ({
        ...e,
        [jobId]: err instanceof Error ? err.message : "select failed",
      }));
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleDelete(jobId: string) {
    setBusyJobId(jobId);
    setErrorByJob((e) => ({ ...e, [jobId]: "" }));
    try {
      const res = await fetch(deleteUrlFor(jobId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setErrorByJob((e) => ({
        ...e,
        [jobId]: err instanceof Error ? err.message : "delete failed",
      }));
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {takes.map((t) => {
        const isSelected = t.jobId === selectedTakeId;
        const isBusy = busyJobId === t.jobId;
        const thumbSrc = t.imagePath;
        const ringClass = isSelected ? "ring-2 ring-emerald-500" : "ring-1 ring-neutral-700";
        return (
          <div key={t.jobId} className="flex flex-col items-center gap-1">
            <div
              className={`w-16 h-16 rounded overflow-hidden bg-neutral-800 ${ringClass}`}
            >
              {thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(thumbSrc)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
                  {t.status}
                </div>
              )}
            </div>
            <StatusChip status={t.status} />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleSelect(t.jobId)}
                disabled={isBusy || isSelected || t.status !== "done"}
                aria-label="Select this take"
                className="p-1 rounded text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(t.jobId)}
                disabled={isBusy}
                aria-label="Delete this take"
                className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {isBusy && <span className="text-[10px] text-neutral-500">…</span>}
            {errorByJob[t.jobId] && (
              <span className="text-[10px] text-red-400 max-w-[80px] text-center break-words">
                {errorByJob[t.jobId]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
