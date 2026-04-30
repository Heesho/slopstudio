"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type EntityType = "dna" | "characters" | "locations" | "scenes" | "episodes";

export function useFieldUpdate(type: EntityType, id: string, field: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save(value: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entity/${type}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `save failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return { save, busy, error, clearError: () => setError(null) };
}

export type { EntityType };
