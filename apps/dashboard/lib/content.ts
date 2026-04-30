import fs from "node:fs/promises";
import path from "node:path";
import {
  CharacterSchema,
  DnaSchema,
  EpisodeSchema,
  LocationSchema,
  SceneSchema,
  StateSchema,
  type Character,
  type Dna,
  type Episode,
  type Location,
  type Scene,
  type State,
} from "./schemas";
import { projectPaths } from "./paths";
import { assertSafeSlug } from "./studio";

async function readJson(filepath: string): Promise<unknown> {
  const raw = await fs.readFile(filepath, "utf-8");
  return JSON.parse(raw);
}

async function readJsonDir<T>(dir: string, schema: { parse: (x: unknown) => T }): Promise<T[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const jsons = entries.filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const items = await Promise.all(
    jsons.map(async (f) => schema.parse(await readJson(path.join(dir, f)))),
  );
  return items;
}

export async function readDna(slug: string): Promise<Dna> {
  assertSafeSlug(slug);
  return DnaSchema.parse(await readJson(projectPaths(slug).dna));
}

export async function readState(slug: string): Promise<State> {
  assertSafeSlug(slug);
  try {
    return StateSchema.parse(await readJson(projectPaths(slug).state));
  } catch {
    return { lastBalance: null, lastSyncAt: null, recentJobs: [] };
  }
}

export const readAllCharacters = (slug: string): Promise<Character[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).charactersDir, CharacterSchema);
};
export const readAllLocations = (slug: string): Promise<Location[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).locationsDir, LocationSchema);
};
export const readAllScenes = (slug: string): Promise<Scene[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).scenesDir, SceneSchema);
};
export const readAllEpisodes = (slug: string): Promise<Episode[]> => {
  assertSafeSlug(slug);
  return readJsonDir(projectPaths(slug).episodesDir, EpisodeSchema);
};
