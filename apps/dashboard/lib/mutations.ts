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
import { projectPaths } from "./paths";
import { assertSafeSlug } from "./studio";

export const ENTITY_TYPES = ["dna", "characters", "locations", "scenes", "episodes"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type TakeCollection = "takes" | "firstFrameTakes";

const SELECTED_KEY: Record<TakeCollection, string> = {
  takes: "selectedTakeId",
  firstFrameTakes: "firstFrameSelectedTakeId",
};

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

function dirsFor(slug: string) {
  const p = projectPaths(slug);
  return {
    characters: p.charactersDir,
    locations: p.locationsDir,
    scenes: p.scenesDir,
    episodes: p.episodesDir,
  } as const;
}

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

function assertSafeId(slug: string, type: Exclude<EntityType, "dna">, id: string): void {
  if (!ID_PATTERN.test(id) || id.length > 128) {
    throw new EntityValidationError(`invalid id: ${id}`);
  }
  // Defense-in-depth: ensure the resolved file path stays within the entity dir.
  const dir = dirsFor(slug)[type];
  const file = path.join(dir, `${id}.json`);
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.includes(path.sep)) {
    throw new EntityValidationError(`id escapes entity dir: ${id}`);
  }
}

type EntityData<T extends EntityType> = z.infer<(typeof SCHEMAS)[T]>;

export async function readEntity<T extends EntityType>(
  slug: string,
  type: T,
  id: string,
): Promise<{ file: string; data: EntityData<T> }> {
  assertSafeSlug(slug);
  const p = projectPaths(slug);
  if (type === "dna") {
    let raw: string;
    try {
      raw = await fs.readFile(p.dna, "utf-8");
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
      return { file: p.dna, data: DnaSchema.parse(parsed) as EntityData<T> };
    } catch (err) {
      throw new EntityCorruptError(
        `dna fails schema: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const dirType = type as Exclude<EntityType, "dna">;
  assertSafeId(slug, dirType, id);
  const file = path.join(dirsFor(slug)[dirType], `${id}.json`);

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
  slug: string,
  type: EntityType,
  id: string,
  field: string,
  value: unknown,
): Promise<void> {
  assertSafeSlug(slug);
  if (!EDITABLE_FIELDS[type].includes(field)) {
    throw new FieldNotEditableError(`field "${field}" is not editable on ${type}`);
  }
  const { file, data } = await readEntity(slug, type, id);
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

export async function selectTake(
  slug: string,
  type: EntityType,
  id: string,
  jobId: string,
  collection: TakeCollection = "takes",
) {
  assertSafeSlug(slug);
  if (type === "dna" || type === "episodes") {
    throw new EntityValidationError(`takes are not supported on ${type}`);
  }
  if (collection === "firstFrameTakes" && type !== "scenes") {
    throw new EntityValidationError(`firstFrameTakes only exist on scenes`);
  }
  const takeType = type as TakeEntityType;
  const { file, data } = await readEntity(slug, takeType, id);
  const list = (data as Record<string, unknown>)[collection] as
    | Array<{ jobId: string }>
    | undefined;
  if (!list || !list.some((t) => t.jobId === jobId)) {
    throw new TakeNotFoundError(
      `take ${jobId} not found in ${collection} on ${type}/${id}`,
    );
  }
  await writeAtomic(file, { ...data, [SELECTED_KEY[collection]]: jobId });
}

export async function deleteTake(
  slug: string,
  type: EntityType,
  id: string,
  jobId: string,
  collection: TakeCollection = "takes",
) {
  assertSafeSlug(slug);
  if (type === "dna" || type === "episodes") {
    throw new EntityValidationError(`takes are not supported on ${type}`);
  }
  if (collection === "firstFrameTakes" && type !== "scenes") {
    throw new EntityValidationError(`firstFrameTakes only exist on scenes`);
  }

  const takeType = type as TakeEntityType;
  const { file, data } = await readEntity(slug, takeType, id);
  const list = (data as Record<string, unknown>)[collection] as
    | Array<{
        jobId: string;
        imagePath?: string;
        videoPath?: string;
        status?: string;
        generatedAt?: string;
      }>
    | undefined;

  if (!list) {
    throw new TakeNotFoundError(
      `collection ${collection} missing on ${type}/${id}`,
    );
  }
  const take = list.find((t) => t.jobId === jobId);
  if (!take) {
    throw new TakeNotFoundError(
      `take ${jobId} not found in ${collection} on ${type}/${id}`,
    );
  }

  // Resolve the on-disk file to unlink (imagePath for images, videoPath for video).
  // The path is project-relative (e.g. "media/characters/foo/abc.png").
  const filePath = take.imagePath ?? take.videoPath;

  if (filePath) {
    // mediaDir is the absolute path to <project>/media, so we need to strip the leading "media/" segment from the JSON-stored path.
    const mediaDir = projectPaths(slug).mediaDir;
    const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const relInsideMedia = normalized.startsWith("media/") ? normalized.slice("media/".length) : normalized;
    const absolutePath = path.join(mediaDir, relInsideMedia);
    // Ensure we're still inside mediaDir (defense-in-depth)
    const mediaRoot = path.resolve(mediaDir);
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

  const remaining = list.filter((t) => t.jobId !== jobId);
  const selectedKey = SELECTED_KEY[collection];
  const currentSelected = (data as Record<string, unknown>)[selectedKey] as
    | string
    | null;

  let nextSelected: string | null = currentSelected;
  if (currentSelected === jobId) {
    // Fall back to most recent `done` take; null if none.
    const candidates = remaining.filter((t) => t.status === "done");
    candidates.sort((a, b) =>
      (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""),
    );
    nextSelected = candidates[0]?.jobId ?? null;
  }

  await writeAtomic(file, {
    ...data,
    [collection]: remaining,
    [selectedKey]: nextSelected,
  });
}
