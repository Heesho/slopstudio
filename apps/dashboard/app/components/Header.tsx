import Link from "next/link";
import type { State } from "@/lib/schemas";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "unknown";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Header({
  title,
  state,
  slug,
}: {
  title: string;
  state: State;
  slug: string;
}) {
  const tabs = [
    { href: `/projects/${slug}/dna`, label: "DNA" },
    { href: `/projects/${slug}/characters`, label: "Characters" },
    { href: `/projects/${slug}/locations`, label: "Locations" },
    { href: `/projects/${slug}/episodes`, label: "Episodes" },
    { href: `/projects/${slug}/scenes`, label: "Scenes" },
  ];
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 font-mono"
          >
            ←
          </Link>
          <p
            className="font-mono text-sm tracking-wide text-neutral-300 truncate max-w-[240px]"
            title={title}
          >
            {title}
          </p>
        </div>
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-sm text-neutral-300 hover:text-white transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-neutral-400 font-mono whitespace-nowrap">
          {state.lastBalance !== null
            ? `${Math.round(state.lastBalance)} credits · synced ${timeAgo(state.lastSyncAt)}`
            : "no balance yet"}
        </div>
      </div>
    </header>
  );
}
