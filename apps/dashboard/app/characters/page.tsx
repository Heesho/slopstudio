import EntityCard from "@/app/components/EntityCard";
import EmptyState from "@/app/components/EmptyState";
import { readAllCharacters, readAllScenes } from "@/lib/content";

export default async function CharactersPage() {
  const [characters, scenes] = await Promise.all([readAllCharacters(), readAllScenes()]);
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
      <h1 className="text-2xl font-semibold mb-6">Characters</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {characters.map((c) => (
          <EntityCard
            key={c.id}
            entity={c}
            entityType="characters"
            prompt={c.imagePrompt}
            description={c.description}
            appearsInScenes={counts.get(c.id) ?? 0}
            kind="image"
          />
        ))}
      </div>
    </div>
  );
}
