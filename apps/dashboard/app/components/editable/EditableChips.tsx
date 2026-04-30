"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

type Option = { id: string; label: string };

export default function EditableChips({
  type,
  id,
  field,
  value,
  options,
  chipHref,
}: {
  type: EntityType;
  id: string;
  field: string;
  value: string[];
  options: Option[];
  // optional: turn each chip's label into a link (e.g. "/characters" for character chips).
  // String only — RSC cannot serialise function props to client components.
  chipHref?: string;
}) {
  const [adding, setAdding] = useState(false);
  const { save, busy, error } = useFieldUpdate(type, id, field);

  const remove = async (chipId: string) => {
    try {
      await save(value.filter((v) => v !== chipId));
    } catch {
      /* error shown inline */
    }
  };
  const add = async (chipId: string) => {
    setAdding(false);
    if (value.includes(chipId)) return;
    try {
      await save([...value, chipId]);
    } catch {
      /* error shown inline */
    }
  };

  const remaining = options.filter((o) => !value.includes(o.id));

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {value.map((chipId) => {
        const opt = options.find((o) => o.id === chipId);
        const label = opt?.label ?? chipId;
        // Avoid <button> nested in <a>: when linking, the label is the <Link>,
        // and the remove button sits as a sibling inside the chip wrapper.
        return (
          <span
            key={chipId}
            className="inline-flex items-center px-2 py-0.5 rounded bg-neutral-800 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            {chipHref ? (
              <Link
                href={chipHref}
                className="hover:underline"
              >
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                remove(chipId);
              }}
              disabled={busy}
              className="ml-1.5 text-neutral-400 hover:text-red-400 disabled:opacity-50"
              aria-label={`Remove ${label}`}
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
      {remaining.length > 0 && (
        <span className="relative">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            disabled={busy}
            className="inline-flex items-center px-2 py-0.5 rounded border border-dashed border-neutral-700 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
            aria-label="Add"
          >
            <Plus size={12} className="mr-0.5" /> add
          </button>
          {adding && (
            <span className="absolute z-10 mt-1 left-0 bg-neutral-900 border border-neutral-700 rounded shadow-lg py-1 min-w-[10rem]">
              {remaining.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => add(opt.id)}
                  className="block w-full text-left px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  {opt.label}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      {busy && <span className="text-xs text-neutral-400">…</span>}
      {error && (
        <span className="text-xs text-red-400 truncate" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
