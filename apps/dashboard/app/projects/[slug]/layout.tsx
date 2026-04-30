import { readDna, readState } from "@/lib/content";
import Header from "@/app/components/Header";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dna = await readDna(slug).catch(() => null);
  const state = await readState(slug);
  return (
    <>
      <Header title={dna?.title ?? slug} state={state} slug={slug} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
