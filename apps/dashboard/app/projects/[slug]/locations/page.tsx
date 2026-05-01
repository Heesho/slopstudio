import EntityCard from "@/app/components/EntityCard";
import EmptyState from "@/app/components/EmptyState";
import { readAllLocations, readAllScenes } from "@/lib/content";

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locations, scenes] = await Promise.all([
    readAllLocations(slug),
    readAllScenes(slug),
  ]);
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
      <h1 className="text-2xl font-semibold">Locations</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-400">
        Recurring places. Lock a reference take to use across scenes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {locations.map((l) => (
          <EntityCard
            key={l.id}
            slug={slug}
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
