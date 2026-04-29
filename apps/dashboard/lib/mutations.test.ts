import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectTake } from "./mutations";
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
    await expect(selectTake("characters", id, "999e8400-e29b-41d4-a716-446655440000")).rejects.toThrow();
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

  it("rejects an invalid entity type", async () => {
    await expect(selectTake("unknown", "x", "550e8400-e29b-41d4-a716-446655440000")).rejects.toThrow();
  });

  it("rejects a missing entity file", async () => {
    await expect(
      selectTake("characters", "does-not-exist", "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toThrow();
  });
});
