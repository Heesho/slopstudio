"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEFAULT_TARGET_SECONDS = 60;

export default function EpisodeTargetSetter({
  slug,
  episodeId,
}: {
  slug: string;
  episodeId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSet() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${slug}/entity/episodes/${episodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "targetSeconds",
            value: DEFAULT_TARGET_SECONDS,
          }),
        },
      );
      if (!res.ok) throw new Error(`set target failed (${res.status})`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSet}
      disabled={busy}
      className="text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {busy ? "Setting…" : "Set target"}
    </button>
  );
}
