"use client";
import { useEffect, useState } from "react";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

export default function EditableSelect({
  type,
  id,
  field,
  value,
  options,
  className = "",
}: {
  type: EntityType;
  id: string;
  field: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { save, busy, error } = useFieldUpdate(type, id, field);
  const [draft, setDraft] = useState(value);

  // Mirror upstream value into draft on prop change (e.g. after router.refresh).
  useEffect(() => {
    if (!busy) setDraft(value);
  }, [value, busy]);

  const onChange = async (next: string) => {
    setDraft(next);
    try {
      await save(next);
    } catch {
      setDraft(value); /* revert on error */
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={draft}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-neutral-500 ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {busy && <span className="text-xs text-neutral-400">…</span>}
      {error && (
        <span className="text-xs text-red-400 truncate" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
