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
import * as pathsModule from "./paths";

describe("content readers", () => {
  let tmpRoot: string;
  let projectDir: string;
  const slug = "test-project";

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-content-"));
    projectDir = path.join(tmpRoot, "projects", slug, "content");
    await fs.mkdir(path.join(projectDir, "characters"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "locations"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "scenes"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "episodes"), { recursive: true });
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
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
    await fs.writeFile(path.join(projectDir, "dna.json"), JSON.stringify(dna));
    expect(await readDna(slug)).toMatchObject(dna);
  });

  it("readState returns empty defaults when file missing", async () => {
    expect(await readState(slug)).toEqual({ lastBalance: null, lastSyncAt: null, recentJobs: [] });
  });

  it("readState parses an existing _state.json", async () => {
    const state = { lastBalance: 100, lastSyncAt: "2026-04-28T12:00:00Z", recentJobs: [] };
    await fs.writeFile(path.join(projectDir, "_state.json"), JSON.stringify(state));
    expect(await readState(slug)).toEqual(state);
  });

  it("readAllCharacters returns [] when dir is empty", async () => {
    expect(await readAllCharacters(slug)).toEqual([]);
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
    await fs.writeFile(
      path.join(projectDir, "characters", "anomalocaris.json"),
      JSON.stringify(c1),
    );
    const result = await readAllCharacters(slug);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("anomalocaris");
  });

  it("readAllCharacters skips non-json files and underscore-prefixed files", async () => {
    await fs.writeFile(path.join(projectDir, "characters", "_index.json"), JSON.stringify({}));
    await fs.writeFile(path.join(projectDir, "characters", "README.md"), "ignore me");
    expect(await readAllCharacters(slug)).toEqual([]);
  });

  it("readAllLocations returns [] when dir missing", async () => {
    await fs.rm(path.join(projectDir, "locations"), { recursive: true });
    expect(await readAllLocations(slug)).toEqual([]);
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
    await fs.writeFile(path.join(projectDir, "scenes", "001.json"), JSON.stringify(s));
    const result = await readAllScenes(slug);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("T");
  });

  it("readAllEpisodes parses an episode file", async () => {
    const e = { id: "ep-1", number: 1, title: "T", hook: "H", scenes: [] };
    await fs.writeFile(path.join(projectDir, "episodes", "ep-1.json"), JSON.stringify(e));
    const result = await readAllEpisodes(slug);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ep-1");
  });
});
