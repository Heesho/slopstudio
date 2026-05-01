import EntityCard from "@/app/components/EntityCard";
import EmptyState from "@/app/components/EmptyState";
import { readAllCharacters, readAllScenes } from "@/lib/content";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [characters, scenes] = await Promise.all([
    readAllCharacters(slug),
    readAllScenes(slug),
  ]);
  if (characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        body="Ask Claude to create your first character in content/characters/."
      />
    );
  }
  // Build a lookup: character id -> count of scenes referencing them
  const counts = new Map<string, number>();
  for (const s of scenes) {
    for (const cid of s.characters) counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold">Characters</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-400">
        Recurring beings. Lock a reference take to use across scenes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {characters.map((c) => (
          <EntityCard
            key={c.id}
            slug={slug}
            entity={c}
            entityType="characters"
            prompt={c.imagePrompt}
            description={c.description}
            voice={c.voice}
            appearsInScenes={counts.get(c.id) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
