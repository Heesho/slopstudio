"use client";
import { useEffect, useState } from "react";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

export default function EditableBoolean({
  slug,
  type,
  id,
  field,
  value,
  trueLabel,
  falseLabel,
  className = "",
}: {
  slug: string;
  type: EntityType;
  id: string;
  field: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  className?: string;
}) {
  const { save, busy, error } = useFieldUpdate(slug, type, id, field);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!busy) setDraft(value);
  }, [value, busy]);

  const onChange = async (next: string) => {
    const asBool = next === "true";
    setDraft(asBool);
    try {
      await save(asBool);
    } catch {
      setDraft(value);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={String(draft)}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-neutral-500 ${className}`}
      >
        <option value="true">{trueLabel}</option>
        <option value="false">{falseLabel}</option>
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
