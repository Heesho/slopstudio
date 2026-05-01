"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { mediaUrl } from "@/lib/media";
import { useFieldUpdate, type EntityType } from "./useFieldUpdate";

type Option = { id: string; label: string; imagePath?: string };

export default function EditableChips({
  slug,
  type,
  id,
  field,
  value,
  options,
  chipHref,
}: {
  slug: string;
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
  const { save, busy, error } = useFieldUpdate(slug, type, id, field);

  useEffect(() => {
    if (!adding) return;
    const handler = () => setAdding(false);
    const id = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [adding]);

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
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-neutral-800 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
          >
            {opt?.imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(slug, opt.imagePath)}
                alt=""
                className="w-6 h-6 rounded object-cover"
              />
            )}
            {chipHref ? (
              <Link href={chipHref} className="hover:underline">
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
              className="text-neutral-400 hover:text-red-400 disabled:opacity-50"
              aria-label={`Remove ${label}`}
            >
              <X size={14} />
            </button>
          </span>
        );
      })}
      {remaining.length > 0 && (
        <span
          className="relative"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            disabled={busy}
            className="inline-flex items-center px-2.5 py-1 rounded border border-dashed border-neutral-700 text-sm text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors"
            aria-label="Add"
          >
            <Plus size={14} className="mr-0.5" /> add
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
