import path from "node:path";
import * as self from "./paths";

export function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export function projectRoot(slug: string): string {
  return path.join(self.repoRoot(), "projects", slug);
}

export function projectPaths(slug: string) {
  const root = projectRoot(slug);
  return {
    contentDir: path.join(root, "content"),
    mediaDir: path.join(root, "media"),
    dna: path.join(root, "content/dna.json"),
    state: path.join(root, "content/_state.json"),
    charactersDir: path.join(root, "content/characters"),
    locationsDir: path.join(root, "content/locations"),
    scenesDir: path.join(root, "content/scenes"),
    episodesDir: path.join(root, "content/episodes"),
  };
}

export const studioPaths = {
  get configFile() {
    return path.join(self.repoRoot(), "slopstudio.json");
  },
  get projectsDir() {
    return path.join(self.repoRoot(), "projects");
  },
};

// LEGACY — to be removed in Task 13. Reads from /content and /media at repo root.
// Kept temporarily so unmigrated callers still compile.
export const paths = {
  get contentDir() {
    return path.join(self.repoRoot(), "content");
  },
  get mediaDir() {
    return path.join(self.repoRoot(), "media");
  },
  get dna() {
    return path.join(self.repoRoot(), "content/dna.json");
  },
  get state() {
    return path.join(self.repoRoot(), "content/_state.json");
  },
  get charactersDir() {
    return path.join(self.repoRoot(), "content/characters");
  },
  get locationsDir() {
    return path.join(self.repoRoot(), "content/locations");
  },
  get scenesDir() {
    return path.join(self.repoRoot(), "content/scenes");
  },
  get episodesDir() {
    return path.join(self.repoRoot(), "content/episodes");
  },
};
