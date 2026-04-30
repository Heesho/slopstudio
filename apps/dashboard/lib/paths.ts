import path from "node:path";

export function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export const paths = {
  get contentDir() {
    return path.join(repoRoot(), "content");
  },
  get mediaDir() {
    return path.join(repoRoot(), "media");
  },
  get dna() {
    return path.join(repoRoot(), "content/dna.json");
  },
  get state() {
    return path.join(repoRoot(), "content/_state.json");
  },
  get charactersDir() {
    return path.join(repoRoot(), "content/characters");
  },
  get locationsDir() {
    return path.join(repoRoot(), "content/locations");
  },
  get scenesDir() {
    return path.join(repoRoot(), "content/scenes");
  },
  get episodesDir() {
    return path.join(repoRoot(), "content/episodes");
  },
};
