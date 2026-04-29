import fs from "node:fs/promises";
import path from "node:path";
import {
  CharacterSchema,
  LocationSchema,
  SceneSchema,
} from "./schemas";
import { paths } from "./paths";

export type EntityType = "characters" | "locations" | "scenes";

const SCHEMAS = {
  characters: CharacterSchema,
  locations: LocationSchema,
  scenes: SceneSchema,
} as const;

const DIRS: Record<EntityType, () => string> = {
  characters: () => paths.charactersDir,
  locations: () => paths.locationsDir,
  scenes: () => paths.scenesDir,
};

function isEntityType(t: string): t is EntityType {
  return t === "characters" || t === "locations" || t === "scenes";
}

async function readEntity(type: EntityType, id: string) {
  const file = path.join(DIRS[type](), `${id}.json`);
  const raw = JSON.parse(await fs.readFile(file, "utf-8"));
  const schema = SCHEMAS[type];
  return { file, data: schema.parse(raw) };
}

async function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, file);
}

export async function selectTake(type: string, id: string, jobId: string) {
  if (!isEntityType(type)) throw new Error(`unsupported entity type: ${type}`);
  const { file, data } = await readEntity(type, id);
  if (!data.takes.some((t) => t.jobId === jobId)) {
    throw new Error(`take ${jobId} not found on ${type}/${id}`);
  }
  await writeAtomic(file, { ...data, selectedTakeId: jobId });
}
