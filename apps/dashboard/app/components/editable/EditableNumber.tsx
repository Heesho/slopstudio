"use client";
import { useState, useRef, useEffect } from "react";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

export default function EditableNumber({
  slug,
  type,
  id,
  field,
  value,
  min,
  max,
  className = "",
}: {
  slug: string;
  type: EntityType;
  id: string;
  field: string;
  value: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [localError, setLocalError] = useState<string | null>(null);
  const { save, busy, error } = useFieldUpdate(slug, type, id, field);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = async () => {
    const trimmed = draft.trim();
    const n = Number(trimmed);
    if (trimmed === "" || Number.isNaN(n)) {
      setLocalError("must be a number");
      return;
    }
    if (typeof min === "number" && n < min) {
      setLocalError(`must be ≥ ${min}`);
      return;
    }
    if (typeof max === "number" && n > max) {
      setLocalError(`must be ≤ ${max}`);
      return;
    }
    setLocalError(null);
    if (n === value) {
      setEditing(false);
      return;
    }
    try {
      await save(n);
      setEditing(false);
    } catch {
      /* keep editing */
    }
  };
  const cancel = () => {
    setDraft(String(value));
    setLocalError(null);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors cursor-text ${className}`}
        title="Click to edit"
      >
        {value}
      </button>
    );
  }

  const visibleError = localError ?? error;
  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:border-neutral-500 ${className}`}
      />
      {busy && <span className="text-xs text-neutral-400">…</span>}
      {visibleError && (
        <span className="text-xs text-red-400 truncate" title={visibleError}>
          {visibleError}
        </span>
      )}
    </span>
  );
}
