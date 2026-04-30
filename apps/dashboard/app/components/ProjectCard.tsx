"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProjectCard({
  slug,
  href,
  children,
}: {
  slug: string;
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    fetch("/api/active-project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).finally(() => router.push(href));
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      data-slug={slug}
      className="block border border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-600 transition-colors"
    >
      {children}
    </Link>
  );
}
