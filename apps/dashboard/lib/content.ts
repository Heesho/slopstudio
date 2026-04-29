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
import { paths } from "./paths";

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

export async function readDna(): Promise<Dna> {
  return DnaSchema.parse(await readJson(paths.dna));
}

export async function readState(): Promise<State> {
  try {
    return StateSchema.parse(await readJson(paths.state));
  } catch {
    return { lastBalance: null, lastSyncAt: null, recentJobs: [] };
  }
}

export const readAllCharacters = (): Promise<Character[]> =>
  readJsonDir(paths.charactersDir, CharacterSchema);
export const readAllLocations = (): Promise<Location[]> =>
  readJsonDir(paths.locationsDir, LocationSchema);
export const readAllScenes = (): Promise<Scene[]> => readJsonDir(paths.scenesDir, SceneSchema);
export const readAllEpisodes = (): Promise<Episode[]> =>
  readJsonDir(paths.episodesDir, EpisodeSchema);
