import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd(), "../..");

export const paths = {
  get contentDir() {
    return path.join(REPO_ROOT, "content");
  },
  get mediaDir() {
    return path.join(REPO_ROOT, "media");
  },
  get dna() {
    return path.join(REPO_ROOT, "content/dna.json");
  },
  get state() {
    return path.join(REPO_ROOT, "content/_state.json");
  },
  get charactersDir() {
    return path.join(REPO_ROOT, "content/characters");
  },
  get locationsDir() {
    return path.join(REPO_ROOT, "content/locations");
  },
  get scenesDir() {
    return path.join(REPO_ROOT, "content/scenes");
  },
  get episodesDir() {
    return path.join(REPO_ROOT, "content/episodes");
  },
};
