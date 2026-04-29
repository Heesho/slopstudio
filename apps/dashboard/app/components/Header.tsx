import Link from "next/link";
import type { State } from "@/lib/schemas";

const TABS = [
  { href: "/dna", label: "DNA" },
  { href: "/characters", label: "Characters" },
  { href: "/locations", label: "Locations" },
  { href: "/scenes", label: "Scenes" },
  { href: "/episodes", label: "Episodes" },
];

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

export default function Header({ title, state }: { title: string; state: State }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <h1 className="font-mono text-sm tracking-wide text-neutral-300 truncate">
          {title}
        </h1>
        <nav className="flex gap-6">
          {TABS.map((t) => (
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
