"use client";
import { useState, useRef, useEffect } from "react";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

export default function EditableTextArea({
  type,
  id,
  field,
  value,
  placeholder,
  className = "",
  rows = 3,
}: {
  type: EntityType;
  id: string;
  field: string;
  value: string;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { save, busy, error } = useFieldUpdate(type, id, field);
  const ref = useRef<HTMLTextAreaElement>(null);

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
      /* keep editing */
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
        className={`block text-left hover:bg-neutral-800/50 rounded px-1 -mx-1 transition-colors cursor-text whitespace-pre-wrap break-words w-full ${className}`}
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
    <span className="block w-full">
      <textarea
        ref={ref}
        value={draft}
        rows={rows}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-neutral-500 resize-y ${className}`}
      />
      <span className="flex items-center justify-between text-xs text-neutral-500 mt-1">
        <span>Cmd/Ctrl+Enter to save · Esc to cancel</span>
        {busy && <span className="text-neutral-400">saving…</span>}
        {error && (
          <span className="text-red-400 truncate" title={error}>
            {error}
          </span>
        )}
      </span>
    </span>
  );
}
