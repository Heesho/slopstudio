import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CharacterSchema, LocationSchema, SceneSchema } from "./schemas";
import { paths } from "./paths";

export const ENTITY_TYPES = ["characters", "locations", "scenes"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export class EntityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityValidationError";
  }
}
export class EntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityNotFoundError";
  }
}
export class EntityCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityCorruptError";
  }
}
export class TakeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TakeNotFoundError";
  }
}

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

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function assertSafeId(type: EntityType, id: string): void {
  if (!ID_PATTERN.test(id) || id.length > 128) {
    throw new EntityValidationError(`invalid id: ${id}`);
  }
  // Defense-in-depth: ensure the resolved file path stays within the entity dir.
  const dir = DIRS[type]();
  const file = path.join(dir, `${id}.json`);
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.includes(path.sep)) {
    throw new EntityValidationError(`id escapes entity dir: ${id}`);
  }
}

export async function readEntity(type: EntityType, id: string) {
  assertSafeId(type, id);
  const file = path.join(DIRS[type](), `${id}.json`);

  let raw: string;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new EntityNotFoundError(`entity not found: ${type}/${id}`);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new EntityCorruptError(
      `entity ${type}/${id} has invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const schema = SCHEMAS[type];
  try {
    return { file, data: schema.parse(parsed) };
  } catch (err) {
    throw new EntityCorruptError(
      `entity ${type}/${id} fails schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, file);
}

export async function selectTake(type: EntityType, id: string, jobId: string) {
  const { file, data } = await readEntity(type, id);
  if (!data.takes.some((t) => t.jobId === jobId)) {
    throw new TakeNotFoundError(`take ${jobId} not found on ${type}/${id}`);
  }
  await writeAtomic(file, { ...data, selectedTakeId: jobId });
}
