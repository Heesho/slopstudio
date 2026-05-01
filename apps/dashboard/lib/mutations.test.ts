import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  type EntityType,
  FieldNotEditableError,
  deleteTake,
  selectTake,
  TakeNotFoundError,
  updateEntityField,
} from "./mutations";
import * as pathsModule from "./paths";

const slug = "test-project";

describe("selectTake", () => {
  let tmpRoot: string;
  let projectDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-mut-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "locations"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("updates selectedTakeId on a character", async () => {
    const id = "char1";
    const file = path.join(projectDir, "characters", `${id}.json`);
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
    await selectTake(slug, "characters", id, "660e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("660e8400-e29b-41d4-a716-446655440000");
    expect(updated.takes).toHaveLength(2); // takes array preserved
  });

  it("rejects a jobId that doesn't exist in takes", async () => {
    const id = "char2";
    const file = path.join(projectDir, "characters", `${id}.json`);
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
      selectTake(slug, "characters", id, "999e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(TakeNotFoundError);
  });

  it("works on a location", async () => {
    const id = "loc1";
    const file = path.join(projectDir, "locations", `${id}.json`);
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
    await selectTake(slug, "locations", id, "770e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("770e8400-e29b-41d4-a716-446655440000");
  });

  it("works on a scene", async () => {
    const id = "scene1";
    const file = path.join(projectDir, "scenes", `${id}.json`);
    await fs.writeFile(
      file,
      JSON.stringify({
        id,
        episodeId: "ep-1",
        order: 0,
        title: "T",
        prompt: "p",
        characters: [],
        locations: [],
        duration: 6,
        videoModel: "m",
        takes: [{ jobId: "880e8400-e29b-41d4-a716-446655440000", status: "done" as const }],
        selectedTakeId: null,
      }),
    );
    await selectTake(slug, "scenes", id, "880e8400-e29b-41d4-a716-446655440000");
    const updated = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(updated.selectedTakeId).toBe("880e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects a missing entity file with EntityNotFoundError", async () => {
    await expect(
      selectTake(slug, "characters", "does-not-exist", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  it("rejects an id that escapes the entity dir (path traversal)", async () => {
    // Defense-in-depth — exercise the regex+relative path guard.
    await expect(
      selectTake(slug, "characters", "../../etc/passwd", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an id with disallowed characters", async () => {
    await expect(
      selectTake(slug, "characters", "name with spaces", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an entity file with malformed JSON as EntityCorruptError", async () => {
    const id = "bad-json";
    await fs.writeFile(path.join(projectDir, "characters", `${id}.json`), "{not json");
    await expect(
      selectTake(slug, "characters", id, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityCorruptError);
  });

  it("rejects an entity file that fails schema validation as EntityCorruptError", async () => {
    const id = "bad-shape";
    await fs.writeFile(
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({ id, name: "C" }), // missing required fields
    );
    await expect(
      selectTake(slug, "characters", id, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(EntityCorruptError);
  });

  it("rejects an unsupported entity type at the type system boundary", async () => {
    // Defense-in-depth: route narrows via Zod, but a misuse-from-internal-code
    // should still fail loudly. We cast through unknown to simulate that.
    await expect(
      selectTake(
        slug,
        "unknown" as unknown as EntityType,
        "char1",
        "550e8400-e29b-41d4-a716-446655440000",
      ),
    ).rejects.toThrow();
  });
});

describe("deleteTake", () => {
  let tmpRoot: string;
  let projectDir: string;
  let mediaRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-mut-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    mediaRoot = path.join(tmpRoot, "projects", slug, "media");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "locations"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    await fs.mkdir(path.join(mediaRoot, "characters", "char1"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
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
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [
          { jobId: jobIdA, imagePath: takeAFile, status: "done", generatedAt: "2026-04-28T12:00:00Z" },
          { jobId: jobIdB, imagePath: `media/characters/${id}/${jobIdB}.png`, status: "done", generatedAt: "2026-04-28T13:00:00Z" },
        ],
        selectedTakeId: jobIdB,
      }),
    );

    await deleteTake(slug, "characters", id, jobIdA);

    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "characters", `${id}.json`), "utf-8"));
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
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [
          { jobId: jobIdA, status: "done", generatedAt: "2026-04-28T12:00:00Z" },
          { jobId: jobIdB, status: "done", generatedAt: "2026-04-28T13:00:00Z" },
        ],
        selectedTakeId: jobIdB,
      }),
    );

    await deleteTake(slug, "characters", id, jobIdB);

    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(1);
    expect(updated.selectedTakeId).toBe(jobIdA); // newest remaining done take
  });

  it("sets selectedTakeId to null when no done takes remain", async () => {
    const id = "char-empty";
    const jobIdA = "550e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId: jobIdA, status: "done", generatedAt: "2026-04-28T12:00:00Z" }],
        selectedTakeId: jobIdA,
      }),
    );

    await deleteTake(slug, "characters", id, jobIdA);

    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
    expect(updated.selectedTakeId).toBeNull();
  });

  it("rejects deleting a take that does not exist with TakeNotFoundError", async () => {
    const id = "char-x";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "done" }],
        selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );

    await expect(
      deleteTake(slug, "characters", id, "999e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBeInstanceOf(TakeNotFoundError);
  });

  it("works on a scene with videoPath", async () => {
    const id = "scene1";
    const jobId = "880e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "scenes", id), { recursive: true });
    await fs.writeFile(path.join(mediaRoot, "scenes", id, `${jobId}.mp4`), "fake-mp4");
    await fs.writeFile(
      path.join(projectDir, "scenes", `${id}.json`),
      JSON.stringify({
        id, episodeId: "ep-1", order: 0, title: "T", prompt: "p",
        characters: [], locations: [], duration: 6, videoModel: "m",
        takes: [{ jobId, videoPath: `media/scenes/${id}/${jobId}.mp4`, status: "done", generatedAt: "2026-04-28T12:00:00Z" }],
        selectedTakeId: jobId,
      }),
    );

    await deleteTake(slug, "scenes", id, jobId);

    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
    expect(updated.selectedTakeId).toBeNull();
    await expect(fs.access(path.join(mediaRoot, "scenes", id, `${jobId}.mp4`))).rejects.toThrow();
  });

  it("does not throw when the media file is already missing", async () => {
    const id = "char-no-file";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    await fs.mkdir(path.join(mediaRoot, "characters", id), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "characters", `${id}.json`),
      JSON.stringify({
        id, name: "C", imagePrompt: "", description: "", imageModel: "m",
        takes: [{ jobId, imagePath: `media/characters/${id}/${jobId}.png`, status: "done" }],
        selectedTakeId: jobId,
      }),
    );

    // No file written to media — unlink should silently no-op
    await expect(deleteTake(slug, "characters", id, jobId)).resolves.toBeUndefined();
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "characters", `${id}.json`), "utf-8"));
    expect(updated.takes).toHaveLength(0);
  });
});

describe("updateEntityField", () => {
  let tmpRoot: string;
  let projectDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-mut-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("updates a free-text field on a character", async () => {
    const id = "c1";
    await fs.writeFile(path.join(projectDir, "characters", `${id}.json`), JSON.stringify({
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [], selectedTakeId: null,
    }));
    await updateEntityField(slug, "characters", id, "description", "new behavioral description");
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "characters", `${id}.json`), "utf-8"));
    expect(updated.description).toBe("new behavioral description");
  });

  it("updates a cinematic field on DNA (single-file)", async () => {
    await fs.writeFile(path.join(projectDir, "dna.json"), JSON.stringify({
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "auto", colorPalette: "auto", lighting: "auto", cameraMoveset: "auto",
      camera: "auto", lens: "auto", focalLength: "auto", aperture: "auto",
    }));
    await updateEntityField(slug, "dna", "_", "genre", "drama");
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "dna.json"), "utf-8"));
    expect(updated.genre).toBe("drama");
  });

  it("updates an array field on a scene", async () => {
    const id = "s1";
    await fs.writeFile(path.join(projectDir, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: ["anomalocaris"], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    }));
    await updateEntityField(slug, "scenes", id, "characters", ["anomalocaris", "trilobite"]);
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"));
    expect(updated.characters).toEqual(["anomalocaris", "trilobite"]);
  });

  it("rejects an unknown field with FieldNotEditableError", async () => {
    const id = "c1";
    await fs.writeFile(path.join(projectDir, "characters", `${id}.json`), JSON.stringify({
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [], selectedTakeId: null,
    }));
    await expect(
      updateEntityField(slug, "characters", id, "id", "renamed"),
    ).rejects.toBeInstanceOf(FieldNotEditableError);
  });

  it("rejects an invalid value via Zod (negative duration)", async () => {
    const id = "s1";
    await fs.writeFile(path.join(projectDir, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    }));
    await expect(
      updateEntityField(slug, "scenes", id, "duration", -3),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("rejects an invalid genre enum value on DNA", async () => {
    await fs.writeFile(path.join(projectDir, "dna.json"), JSON.stringify({
      title: "X", concept: "Y", stylePrompt: "Z", narratorVoice: "N",
      aspectRatio: "9:16", videoModel: "v",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "auto", colorPalette: "auto", lighting: "auto", cameraMoveset: "auto",
      camera: "auto", lens: "auto", focalLength: "auto", aperture: "auto",
    }));
    await expect(
      updateEntityField(slug, "dna", "_", "genre", "musical"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  describe("audioMode coordinated writes", () => {
    const baseScene = (overrides: Record<string, unknown> = {}) => ({
      id: "s1",
      episodeId: "e1",
      order: 0,
      title: "T",
      prompt: "p",
      audioMode: "none",
      audioText: null,
      speakerCharacterId: null,
      characters: [],
      locations: [],
      duration: 6,
      videoModel: "v",
      takes: [],
      selectedTakeId: null,
      ...overrides,
    });

    it("none -> narration coerces audioText to '' and clears speaker", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(baseScene()),
      );
      await updateEntityField(slug, "scenes", id, "audioMode", "narration");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.audioMode).toBe("narration");
      expect(updated.audioText).toBe("");
      expect(updated.speakerCharacterId).toBeNull();
    });

    it("narration -> none clears audioText and keeps speaker null", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(
          baseScene({
            audioMode: "narration",
            audioText: "hello",
            speakerCharacterId: null,
          }),
        ),
      );
      await updateEntityField(slug, "scenes", id, "audioMode", "none");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.audioMode).toBe("none");
      expect(updated.audioText).toBeNull();
      expect(updated.speakerCharacterId).toBeNull();
    });

    it("none -> dialogue auto-picks the first linked character", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(
          baseScene({ characters: ["anomalocaris", "trilobite"] }),
        ),
      );
      await updateEntityField(slug, "scenes", id, "audioMode", "dialogue");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.audioMode).toBe("dialogue");
      expect(updated.audioText).toBe("");
      expect(updated.speakerCharacterId).toBe("anomalocaris");
    });

    it("none -> dialogue throws EntityValidationError with no linked characters", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(baseScene({ characters: [] })),
      );
      await expect(
        updateEntityField(slug, "scenes", id, "audioMode", "dialogue"),
      ).rejects.toThrowError(
        /cannot set audioMode='dialogue' on a scene with no linked characters/,
      );
      await expect(
        updateEntityField(slug, "scenes", id, "audioMode", "dialogue"),
      ).rejects.toBeInstanceOf(EntityValidationError);
    });

    it("dialogue -> narration clears speaker and keeps audioText", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(
          baseScene({
            characters: ["anomalocaris"],
            audioMode: "dialogue",
            audioText: "look out!",
            speakerCharacterId: "anomalocaris",
          }),
        ),
      );
      await updateEntityField(slug, "scenes", id, "audioMode", "narration");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.audioMode).toBe("narration");
      expect(updated.audioText).toBe("look out!");
      expect(updated.speakerCharacterId).toBeNull();
    });

    it("dialogue with stale speaker (not in characters list) auto-repicks first", async () => {
      const id = "s1";
      // The Scene schema's superRefine doesn't enforce that
      // speakerCharacterId is a member of `characters` — only that it's
      // non-null when audioMode==='dialogue'. So this on-disk state is valid
      // and exercises the stale-speaker branch when we toggle audioMode again.
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(
          baseScene({
            characters: ["trilobite"],
            audioMode: "dialogue",
            audioText: "stale dialog",
            speakerCharacterId: "anomalocaris", // not in characters
          }),
        ),
      );
      // Re-set audioMode to dialogue: the coercion should detect the stale
      // speaker (not in characters) and re-pick the first linked character.
      await updateEntityField(slug, "scenes", id, "audioMode", "dialogue");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.audioMode).toBe("dialogue");
      expect(updated.speakerCharacterId).toBe("trilobite");
      expect(updated.audioText).toBe("stale dialog"); // preserved
    });

    it("non-audioMode field changes do not trigger coercion", async () => {
      const id = "s1";
      await fs.writeFile(
        path.join(projectDir, "scenes", `${id}.json`),
        JSON.stringify(
          baseScene({
            audioMode: "narration",
            audioText: "preserved",
            speakerCharacterId: null,
          }),
        ),
      );
      await updateEntityField(slug, "scenes", id, "title", "new title");
      const updated = JSON.parse(
        await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"),
      );
      expect(updated.title).toBe("new title");
      // audio fields untouched
      expect(updated.audioMode).toBe("narration");
      expect(updated.audioText).toBe("preserved");
      expect(updated.speakerCharacterId).toBeNull();
    });
  });
});

describe("selectTake / deleteTake on firstFrameTakes", () => {
  let tmpRoot: string;
  let projectDir: string;
  let mediaRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-mut-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    mediaRoot = path.join(tmpRoot, "projects", slug, "media");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    await fs.mkdir(path.join(mediaRoot, "scenes", "s1"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("selectTake updates firstFrameSelectedTakeId on a scene", async () => {
    const id = "s1";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    await fs.writeFile(path.join(projectDir, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      firstFramePrompt: "wide opening",
      firstFrameTakes: [{
        jobId, imagePath: "media/scenes/s1/firstframe-x.png",
        status: "done", generatedAt: "2026-04-29T10:00:00Z",
      }],
      firstFrameSelectedTakeId: null,
    }));
    await selectTake(slug, "scenes", id, jobId, "firstFrameTakes");
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"));
    expect(updated.firstFrameSelectedTakeId).toBe(jobId);
    expect(updated.selectedTakeId).toBeNull(); // unchanged
  });

  it("deleteTake removes a firstFrameTake and unlinks the file", async () => {
    const id = "s1";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const filePath = `media/scenes/s1/firstframe-${jobId}.png`;
    await fs.writeFile(path.join(mediaRoot, "scenes", id, `firstframe-${jobId}.png`), "fake-png");
    await fs.writeFile(path.join(projectDir, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      firstFramePrompt: "wide opening",
      firstFrameTakes: [{
        jobId, imagePath: filePath, status: "done", generatedAt: "2026-04-29T10:00:00Z",
      }],
      firstFrameSelectedTakeId: jobId,
    }));
    await deleteTake(slug, "scenes", id, jobId, "firstFrameTakes");
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"));
    expect(updated.firstFrameTakes).toEqual([]);
    expect(updated.firstFrameSelectedTakeId).toBeNull();
    await expect(fs.access(path.join(mediaRoot, "scenes", id, `firstframe-${jobId}.png`))).rejects.toThrow();
  });

  it("rejects firstFrameTakes on a non-scene entity", async () => {
    const id = "c1";
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    await fs.writeFile(path.join(projectDir, "characters", `${id}.json`), JSON.stringify({
      id, name: "C", imagePrompt: "p", description: "d", imageModel: "m",
      takes: [], selectedTakeId: null,
    }));
    await expect(
      selectTake(slug, "characters", id, jobId, "firstFrameTakes"),
    ).rejects.toBeInstanceOf(EntityValidationError);
  });

  it("does not affect the regular takes collection", async () => {
    // Verify selectTake on default 'takes' collection still works post-refactor.
    const id = "s1";
    const jobId = "660e8400-e29b-41d4-a716-446655440000";
    await fs.writeFile(path.join(projectDir, "scenes", `${id}.json`), JSON.stringify({
      id, episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [{ jobId, videoPath: "media/scenes/s1/video.mp4", status: "done", generatedAt: "..." }],
      selectedTakeId: null,
    }));
    await selectTake(slug, "scenes", id, jobId); // default collection = "takes"
    const updated = JSON.parse(await fs.readFile(path.join(projectDir, "scenes", `${id}.json`), "utf-8"));
    expect(updated.selectedTakeId).toBe(jobId);
  });
});
