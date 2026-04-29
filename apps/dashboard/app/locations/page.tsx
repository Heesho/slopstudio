import EntityCard from "@/app/components/EntityCard";
import EmptyState from "@/app/components/EmptyState";
import { readAllLocations, readAllScenes } from "@/lib/content";

export default async function LocationsPage() {
  const [locations, scenes] = await Promise.all([readAllLocations(), readAllScenes()]);
  if (locations.length === 0) {
    return (
      <EmptyState
        title="No locations yet"
        body={
          <>
            Ask Claude to create your first location in <code>content/locations/</code>.
          </>
        }
      />
    );
  }
  // Build a lookup: location id -> count of scenes referencing it
  const counts = new Map<string, number>();
  for (const s of scenes) {
    for (const lid of s.locations) counts.set(lid, (counts.get(lid) ?? 0) + 1);
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Locations</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {locations.map((l) => (
          <EntityCard
            key={l.id}
            entity={l}
            entityType="locations"
            prompt={l.imagePrompt}
            appearsInScenes={counts.get(l.id) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
