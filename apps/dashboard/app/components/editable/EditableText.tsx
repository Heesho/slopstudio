"use client";
import { useState, useRef, useEffect } from "react";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

export default function EditableText({
  slug,
  type,
  id,
  field,
  value,
  placeholder,
  className = "",
}: {
  slug: string;
  type: EntityType;
  id: string;
  field: string;
  value: string;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { save, busy, error } = useFieldUpdate(slug, type, id, field);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    try {
      await save(draft);
      setEditing(false);
    } catch {
      /* keep edit mode; error shown inline */
    }
  };
  const cancel = () => {
    setDraft(value);
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
        {value || (
          <span className="text-neutral-500 italic">
            {placeholder ?? "(empty)"}
          </span>
        )}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 w-full">
      <input
        ref={ref}
        type="text"
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
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:border-neutral-500 ${className}`}
      />
      {busy && <span className="text-xs text-neutral-400">…</span>}
      {error && (
        <span className="text-xs text-red-400 truncate" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
