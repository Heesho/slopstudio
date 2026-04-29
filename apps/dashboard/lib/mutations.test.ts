import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  type EntityType,
  deleteTake,
  selectTake,
  TakeNotFoundError,
} from "./mutations";
import { paths } from "./paths";

describe("selectTake", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-mut-"));
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "locations"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "scenes"), { recursive: true });
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
    vi.spyOn(paths, "locationsDir", "get").mockReturnValue(path.join(tmpRoot, "locations"));
    vi.spyOn(paths, "scenesDir", "get").mockReturnValue(path.join(tmpRoot, "scenes"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("updates selectedTakeId on a character", async () => {
    const id = "char1";
    const file = path.join(tmpRoot, "characters", `${id}.json`);
    const data = {
      id,
      name: "C",
      imagePrompt: "p",
      description: "d",
      imageModel: "m",
      takes: [
        { jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" as const },
        { jobId: "660e8400-e29b-41d4-a716-446655440000", status: "done" as const },
      ],
      selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    };
    await fs.writeFile(file, JSON.stringify(data));
    await selectTake("characters", id, "660e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("660e8400-e29b-41d4-a716-446655440000");
    expect(updated.takes).toHaveLength(2); // takes array preserved
  });

  it("rejects a jobId that doesn't exist in takes", async () => {
    const id = "char2";
    const file = path.join(tmpRoot, "characters", `${id}.json`);
    await fs.writeFile(
      file,
      JSON.stringify({
        id,
        name: "C",
        imagePrompt: "",
        description: "",
        imageModel: "m",
        takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" as const }],
        selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
    await expect(
      selectTake("characters", id, "999e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(TakeNotFoundError);
  });

  it("works on a location", async () => {
    const id = "loc1";
    const file = path.join(tmpRoot, "locations", `${id}.json`);
    await fs.writeFile(
      file,
      JSON.stringify({
        id,
        name: "L",
        imagePrompt: "p",
        imageModel: "m",
        takes: [{ jobId: "770e8400-e29b-41d4-a716-446655440000", status: "done" as const }],
        selectedTakeId: null,
      }),
    );
    await selectTake("locations", id, "770e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("770e8400-e29b-41d4-a716-446655440000");
  });

  it("works on a scene", async () => {
    const id = "scene1";
    const file = path.join(tmpRoot, "scenes", `${id}.json`);
    await fs.writeFile(
      file,
      JSON.stringify({
        id,
        episodeId: "ep-1",
        order: 0,
        title: "T",
        prompt: "p",
        narration: "n",
        characters: [],
        locations: [],
        duration: 6,
        videoModel: "m",
        takes: [{ jobId: "880e8400-e29b-41d4-a716-446655440000", status: "done" as const }],
        selectedTakeId: null,
      }),
    );
    await selectTake("scenes", id, "880e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("880e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects a missing entity file with EntityNotFoundError", async () => {
    await expect(
      selectTake("characters", "does-not-exist", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it("rejects an id that escapes the entity dir (path traversal)", async () => {
    // Defense-in-depth — exercise the regex+relative path guard.
    await expect(
      selectTake("characters", "../../etc/passwd", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an id with disallowed characters", async () => {
    await expect(
      selectTake("characters", "name with spaces", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an entity file with malformed JSON as EntityCorruptError", async () => {
    const id = "bad-json";
    await fs.writeFile(path.join(tmpRoot, "characters", `${id}.json`), "{not json");
    await expect(
      selectTake("characters", id, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityCorruptError);
  });

  it("rejects an entity file that fails schema validation as EntityCorruptError", async () => {
    const id = "bad-shape";
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({ id, name: "C" }), // missing required fields
    );
    await expect(
      selectTake("characters", id, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityCorruptError);
  });

  it("rejects an unsupported entity type at the type system boundary", async () => {
    // Defense-in-depth: route narrows via Zod, but a misuse-from-internal-code
    // should still fail loudly. We cast through unknown to simulate that.
    await expect(
      selectTake(
        "unknown" as unknown as EntityType,
        "char1",
        "550e8400-e29b-41d4-a716-446655440000",
      ),
    ).rejects.toThrow();
  });
});

describe("deleteTake", () => {
  let tmpRoot: string;
  let mediaRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-del-"));
    mediaRoot = path.join(tmpRoot, "media");
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "locations"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "scenes"), { recursive: true });
    await fs.mkdir(path.join(mediaRoot, "characters", "char1"), { recursive: true });
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
    vi.spyOn(paths, "locationsDir", "get").mockReturnValue(path.join(tmpRoot, "locations"));
    vi.spyOn(paths, "scenesDir", "get").mockReturnValue(path.join(tmpRoot, "scenes"));
    vi.spyOn(paths, "mediaDir", "get").mockReturnValue(mediaRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("removes the take from the JSON and unlinks the file", async () => {
    const id = "char1";
    const jobIdA = "550e8400-e29b-41d4-a716-446655440000";
    const jobIdB = "660e8400-e29b-41d4-a716-446655440000";
    const takeAFile = `media/characters/${id}/${jobIdA}.png`;
    await fs.writeFile(path.join(mediaRoot, "characters", id, `${jobIdA}.png`), "fake-png-bytes");
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [
          { jobId: jobIdA, imagePath: takeAFile, status: "done", generatedAt: "2026-04-28T12:00:00Z" },
          { jobId: jobIdB, imagePath: `media/characters/${id}/${jobIdB}.png`, status: "done", generatedAt: "2026-04-28T13:00:00Z" },
        ],
        selectedTakeId: jobIdB,
      }),
    );

    await deleteTake("characters", id, jobIdA);

    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(1);
    expect(updated.takes[0].jobId).toBe(jobIdB);
    expect(updated.selectedTakeId).toBe(jobIdB); // unchanged because deleted take wasn't selected

    // File unlinked from media
    await expect(fs.access(path.join(mediaRoot, "characters", id, `${jobIdA}.png`))).rejects.toThrow();
  });

  it("falls back selectedTakeId to most recent done take when selected is deleted", async () => {
    const id = "char-fallback";
    const jobIdA = "550e8400-e29b-41d4-a716-446655440000";
    const jobIdB = "660e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [
          { jobId: jobIdA, status: "done", generatedAt: "2026-04-28T12:00:00Z" },
          { jobId: jobIdB, status: "done", generatedAt: "2026-04-28T13:00:00Z" },
        ],
        selectedTakeId: jobIdB,
      }),
    );

    await deleteTake("characters", id, jobIdB);

    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(1);
    expect(updated.selectedTakeId).toBe(jobIdA); // newest remaining done take
  });

  it("sets selectedTakeId to null when no done takes remain", async () => {
    const id = "char-empty";
    const jobIdA = "550e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId: jobIdA, status: "done", generatedAt: "2026-04-28T12:00:00Z" }],
        selectedTakeId: jobIdA,
      }),
    );

    await deleteTake("characters", id, jobIdA);

    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
    expect(updated.selectedTakeId).toBeNull();
  });

  it("rejects deleting a take that does not exist with TakeNotFoundError", async () => {
    const id = "char-x";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" }],
        selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );

    await expect(
      deleteTake("characters", id, "999e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(TakeNotFoundError);
  });

  it("works on a scene with videoPath", async () => {
    const id = "scene1";
    const jobId = "880e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "scenes", id), { recursive: true });
    await fs.writeFile(path.join(mediaRoot, "scenes", id, `${jobId}.mp4`), "fake-mp4");
    await fs.writeFile(
      path.join(tmpRoot, "scenes", `${id}.json`),
      JSON.stringify({
        id, episodeId: "ep-1", order: 0, title: "T", prompt: "p", narration: "n",
        characters: [], locations: [], duration: 6, videoModel: "m",
        takes: [{ jobId, videoPath: `media/scenes/${id}/${jobId}.mp4`, status: "done", generatedAt: "2026-04-28T12:00:00Z" }],
        selectedTakeId: jobId,
      }),
    );

    await deleteTake("scenes", id, jobId);

    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "scenes", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
    expect(updated.selectedTakeId).toBeNull();
    await expect(fs.access(path.join(mediaRoot, "scenes", id, `${jobId}.mp4`))).rejects.toThrow();
  });

  it("does not throw when the media file is already missing", async () => {
    const id = "char-no-file";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId, imagePath: `media/characters/${id}/${jobId}.png`, status: "done" }],
        selectedTakeId: jobId,
      }),
    );

    // No file written to media — unlink should silently no-op
    await expect(deleteTake("characters", id, jobId)).resolves.toBeUndefined();
    const updated = JSON.parse(await fs.readFile(path.join(tmpRoot, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
  });
});
