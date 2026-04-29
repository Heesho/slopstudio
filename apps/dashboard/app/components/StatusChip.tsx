import type { TakeStatus } from "@/lib/schemas";

const COLORS: Record<TakeStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  generating: "bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function StatusChip({ status }: { status: TakeStatus }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${COLORS[status]}`}
    >
      {status}
    </span>
  );
}
