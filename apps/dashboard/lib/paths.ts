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
