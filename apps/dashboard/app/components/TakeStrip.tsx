"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ImageTake } from "@/lib/schemas";
import { mediaUrl } from "@/lib/media";
import StatusChip from "./StatusChip";

type Props = {
  slug: string;
  entityType: "characters" | "locations" | "scenes";
  entityId: string;
  takes: ImageTake[];
  selectedTakeId: string | null;
};

export default function TakeStrip({
  slug,
  entityType,
  entityId,
  takes,
  selectedTakeId,
}: Props) {
  const router = useRouter();
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [errorByJob, setErrorByJob] = useState<Record<string, string>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const selectUrl = `/api/projects/${slug}/entity/${entityType}/${entityId}/select-take`;
  const deleteUrlFor = (jobId: string) =>
    `/api/projects/${slug}/entity/${entityType}/${entityId}/take/${jobId}`;

  useEffect(() => {
    if (menuFor === null) return;
    const handler = () => {
      setMenuFor(null);
    };
    // setTimeout 0 so the right-click that opened the menu doesn't immediately
    // also trigger the dismissal.
    const id = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [menuFor]);

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
        const canSelect = t.status === "done" && !isSelected && !isBusy;
        const thumbSrc = t.imagePath;
        const ringClass = isSelected ? "ring-2 ring-emerald-500" : "ring-1 ring-neutral-700";
        return (
          <div
            key={t.jobId}
            className="relative flex flex-col items-center gap-1"
          >
            <button
              type="button"
              onClick={() => {
                if (canSelect) handleSelect(t.jobId);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuFor(t.jobId);
              }}
              disabled={isBusy}
              title={
                isSelected
                  ? "Selected take"
                  : !canSelect
                    ? "Take not ready"
                    : "Click to select · right-click for more"
              }
              className={`relative w-16 h-16 rounded overflow-hidden bg-neutral-800 ${ringClass} ${
                canSelect ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-70"
              } disabled:opacity-50`}
            >
              {thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(slug, thumbSrc)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-500">
                  {t.status}
                </div>
              )}
            </button>
            {menuFor === t.jobId && (
              <div
                className="absolute z-20 top-full mt-1 min-w-[120px] rounded border border-neutral-700 bg-neutral-900 shadow-lg py-1"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMenuFor(null);
                    handleDelete(t.jobId);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800"
                >
                  Delete take
                </button>
              </div>
            )}
            <StatusChip status={t.status} />
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
