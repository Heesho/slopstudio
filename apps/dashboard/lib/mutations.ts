import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import {
  CharacterSchema,
  DnaSchema,
  EpisodeSchema,
  LocationSchema,
  SceneSchema,
} from "./schemas";
import { paths } from "./paths";

export const ENTITY_TYPES = ["dna", "characters", "locations", "scenes", "episodes"] as const;
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
export class FieldNotEditableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldNotEditableError";
  }
}

const SCHEMAS = {
  dna: DnaSchema,
  characters: CharacterSchema,
  locations: LocationSchema,
  scenes: SceneSchema,
  episodes: EpisodeSchema,
} as const;

const DIRS: Record<Exclude<EntityType, "dna">, () => string> = {
  characters: () => paths.charactersDir,
  locations: () => paths.locationsDir,
  scenes: () => paths.scenesDir,
  episodes: () => paths.episodesDir,
};

export const EDITABLE_FIELDS: Record<EntityType, readonly string[]> = {
  dna: [
    "title",
    "concept",
    "stylePrompt",
    "narratorVoice",
    "aspectRatio",
    "videoModel",
    "characterImageModel",
    "characterRefAspectRatio",
    "characterRefTemplate",
    "locationImageModel",
    "locationRefAspectRatio",
    "locationRefTemplate",
    "genre",
    "colorPalette",
    "lighting",
    "cameraMoveset",
    "camera",
    "lens",
    "focalLength",
    "aperture",
  ],
  characters: ["name", "imagePrompt", "description", "imageModel"],
  locations: ["name", "imagePrompt", "imageModel"],
  scenes: [
    "title",
    "prompt",
    "narration",
    "duration",
    "videoModel",
    "characters",
    "locations",
    "genre",
    "colorPalette",
    "lighting",
    "cameraMoveset",
    "camera",
    "lens",
    "focalLength",
    "aperture",
    "firstFramePrompt",
  ],
  episodes: ["title", "hook"],
} as const;

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function assertSafeId(type: Exclude<EntityType, "dna">, id: string): void {
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

type EntityData<T extends EntityType> = z.infer<(typeof SCHEMAS)[T]>;

export async function readEntity<T extends EntityType>(
  type: T,
  id: string,
): Promise<{ file: string; data: EntityData<T> }> {
  if (type === "dna") {
    let raw: string;
    try {
      raw = await fs.readFile(paths.dna, "utf-8");
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new EntityNotFoundError("dna not found");
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new EntityCorruptError(
        `dna has invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      return { file: paths.dna, data: DnaSchema.parse(parsed) as EntityData<T> };
    } catch (err) {
      throw new EntityCorruptError(
        `dna fails schema: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const dirType = type as Exclude<EntityType, "dna">;
  assertSafeId(dirType, id);
  const file = path.join(DIRS[dirType](), `${id}.json`);

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

  const schema = SCHEMAS[dirType];
  try {
    return { file, data: schema.parse(parsed) as EntityData<T> };
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

export async function updateEntityField(
  type: EntityType,
  id: string,
  field: string,
  value: unknown,
): Promise<void> {
  if (!EDITABLE_FIELDS[type].includes(field)) {
    throw new FieldNotEditableError(`field "${field}" is not editable on ${type}`);
  }
  const { file, data } = await readEntity(type, id);
  const updated = { ...data, [field]: value };
  let validated: unknown;
  try {
    validated = SCHEMAS[type].parse(updated);
  } catch (err) {
    throw new EntityValidationError(
      `value rejected by schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await writeAtomic(file, validated);
}

type TakeEntityType = Exclude<EntityType, "dna" | "episodes">;

export async function selectTake(type: EntityType, id: string, jobId: string) {
  if (type === "dna" || type === "episodes") {
    throw new EntityValidationError(`takes are not supported on ${type}`);
  }
  const takeType = type as TakeEntityType;
  const { file, data } = await readEntity(takeType, id);
  if (!data.takes.some((t) => t.jobId === jobId)) {
    throw new TakeNotFoundError(`take ${jobId} not found on ${type}/${id}`);
  }
  await writeAtomic(file, { ...data, selectedTakeId: jobId });
}

export async function deleteTake(type: EntityType, id: string, jobId: string) {
  if (type === "dna" || type === "episodes") {
    throw new EntityValidationError(`takes are not supported on ${type}`);
  }
  const takeType = type as TakeEntityType;
  const { file, data } = await readEntity(takeType, id);
  const take = data.takes.find((t) => t.jobId === jobId);
  if (!take) {
    throw new TakeNotFoundError(`take ${jobId} not found on ${type}/${id}`);
  }

  // Resolve the on-disk file to unlink (imagePath for images, videoPath for video).
  // The path is repo-root-relative (e.g. "media/characters/foo/abc.png").
  const filePath =
    "imagePath" in take && typeof take.imagePath === "string"
      ? take.imagePath
      : "videoPath" in take && typeof take.videoPath === "string"
        ? take.videoPath
        : undefined;

  if (filePath) {
    // mediaDir is the absolute path to <repo>/media, so we need to strip the leading "media/" segment from the JSON-stored path.
    const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const relInsideMedia = normalized.startsWith("media/") ? normalized.slice("media/".length) : normalized;
    const absolutePath = path.join(paths.mediaDir, relInsideMedia);
    // Ensure we're still inside mediaDir (defense-in-depth)
    const mediaRoot = path.resolve(paths.mediaDir);
    const resolved = path.resolve(absolutePath);
    if (resolved.startsWith(mediaRoot + path.sep) || resolved === mediaRoot) {
      try {
        await fs.unlink(resolved);
      } catch {
        // Silently ignore missing file or unlink failure — JSON state is the
        // source of truth; orphaned media is preferable to a stuck delete.
      }
    }
  }

  const remaining = data.takes.filter((t) => t.jobId !== jobId);
  let nextSelected: string | null = data.selectedTakeId;
  if (data.selectedTakeId === jobId) {
    // Fall back to most recent `done` take; null if none.
    const candidates = remaining.filter((t) => t.status === "done");
    candidates.sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""));
    nextSelected = candidates[0]?.jobId ?? null;
  }

  await writeAtomic(file, { ...data, takes: remaining, selectedTakeId: nextSelected });
}
