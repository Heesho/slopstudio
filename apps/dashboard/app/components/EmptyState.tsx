import type { ReactNode } from "react";

export default function EmptyState({
  title,
  body,
}: {
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="flex justify-center py-16">
      <div className="max-w-xl rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-neutral-400">{body}</p>
      </div>
    </div>
  );
}
