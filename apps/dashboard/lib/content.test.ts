import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAllCharacters,
  readAllEpisodes,
  readAllLocations,
  readAllScenes,
  readDna,
  readState,
} from "./content";
import { paths } from "./paths";

describe("content readers", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cambria-test-"));
    await fs.mkdir(path.join(tmpRoot, "characters"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "locations"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "scenes"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "episodes"), { recursive: true });
    vi.spyOn(paths, "dna", "get").mockReturnValue(path.join(tmpRoot, "dna.json"));
    vi.spyOn(paths, "state", "get").mockReturnValue(path.join(tmpRoot, "_state.json"));
    vi.spyOn(paths, "charactersDir", "get").mockReturnValue(path.join(tmpRoot, "characters"));
    vi.spyOn(paths, "locationsDir", "get").mockReturnValue(path.join(tmpRoot, "locations"));
    vi.spyOn(paths, "scenesDir", "get").mockReturnValue(path.join(tmpRoot, "scenes"));
    vi.spyOn(paths, "episodesDir", "get").mockReturnValue(path.join(tmpRoot, "episodes"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("readDna parses dna.json", async () => {
    const dna = {
      title: "Test",
      concept: "c",
      stylePrompt: "s",
      narratorVoice: "n",
      aspectRatio: "9:16",
      videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2",
      characterRefAspectRatio: "16:9",
      characterRefTemplate: "{imagePrompt}",
      locationImageModel: "nano_banana_2",
      locationRefAspectRatio: "16:9",
      locationRefTemplate: "{imagePrompt}",
    };
    await fs.writeFile(path.join(tmpRoot, "dna.json"), JSON.stringify(dna));
    expect(await readDna()).toEqual(dna);
  });

  it("readState returns empty defaults when file missing", async () => {
    expect(await readState()).toEqual({ lastBalance: null, lastSyncAt: null, recentJobs: [] });
  });

  it("readState parses an existing _state.json", async () => {
    const state = { lastBalance: 100, lastSyncAt: "2026-04-28T12:00:00Z", recentJobs: [] };
    await fs.writeFile(path.join(tmpRoot, "_state.json"), JSON.stringify(state));
    expect(await readState()).toEqual(state);
  });

  it("readAllCharacters returns [] when dir is empty", async () => {
    expect(await readAllCharacters()).toEqual([]);
  });

  it("readAllCharacters reads and validates each .json file", async () => {
    const c1 = {
      id: "anomalocaris",
      name: "Anomalocaris",
      imagePrompt: "p",
      description: "d",
      imageModel: "nano_banana_2",
      takes: [],
      selectedTakeId: null,
    };
    await fs.writeFile(path.join(tmpRoot, "characters", "anomalocaris.json"), JSON.stringify(c1));
    const result = await readAllCharacters();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("anomalocaris");
  });

  it("readAllCharacters skips non-json files and underscore-prefixed files", async () => {
    await fs.writeFile(path.join(tmpRoot, "characters", "_index.json"), JSON.stringify({}));
    await fs.writeFile(path.join(tmpRoot, "characters", "README.md"), "ignore me");
    expect(await readAllCharacters()).toEqual([]);
  });

  it("readAllLocations returns [] when dir missing", async () => {
    await fs.rm(path.join(tmpRoot, "locations"), { recursive: true });
    expect(await readAllLocations()).toEqual([]);
  });

  it("readAllScenes parses a scene file", async () => {
    const s = {
      id: "001",
      episodeId: "ep-1",
      order: 0,
      title: "T",
      prompt: "p",
      narration: "n",
      characters: [],
      locations: [],
      duration: 6,
      videoModel: "seedance_2_0",
      takes: [],
      selectedTakeId: null,
    };
    await fs.writeFile(path.join(tmpRoot, "scenes", "001.json"), JSON.stringify(s));
    const result = await readAllScenes();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("T");
  });

  it("readAllEpisodes parses an episode file", async () => {
    const e = { id: "ep-1", number: 1, title: "T", hook: "H", scenes: [] };
    await fs.writeFile(path.join(tmpRoot, "episodes", "ep-1.json"), JSON.stringify(e));
    const result = await readAllEpisodes();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ep-1");
  });
});
