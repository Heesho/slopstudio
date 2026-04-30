import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "./projects";
import * as pathsModule from "./paths";

describe("listProjects", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-list-"));
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("returns [] when projects/ doesn't exist", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("returns one entry per subdirectory of projects/", async () => {
    const a = path.join(tmpRoot, "projects", "alpha", "content");
    const b = path.join(tmpRoot, "projects", "beta", "content");
    await fs.mkdir(a, { recursive: true });
    await fs.mkdir(b, { recursive: true });
    await fs.writeFile(
      path.join(a, "dna.json"),
      JSON.stringify({
        title: "Alpha", concept: "c", stylePrompt: "s", narratorVoice: "n",
        aspectRatio: "9:16", videoModel: "v", characterImageModel: "c",
        characterRefAspectRatio: "16:9", characterRefTemplate: "{imagePrompt}",
        locationImageModel: "l", locationRefAspectRatio: "16:9",
        locationRefTemplate: "{imagePrompt}",
      }),
    );
    // beta has no dna.json — should still appear, with title falling back to slug.
    const result = await listProjects();
    const slugs = result.map((p) => p.slug).sort();
    expect(slugs).toEqual(["alpha", "beta"]);
    const alpha = result.find((p) => p.slug === "alpha");
    expect(alpha).toBeDefined();
    expect(alpha?.title).toBe("Alpha");
    const beta = result.find((p) => p.slug === "beta");
    expect(beta).toBeDefined();
    expect(beta?.title).toBe("beta"); // fallback
  });

  it("ignores files (only directories)", async () => {
    await fs.mkdir(path.join(tmpRoot, "projects"), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, "projects", "stray.txt"), "x");
    expect(await listProjects()).toEqual([]);
  });

  it("ignores hidden directories", async () => {
    await fs.mkdir(path.join(tmpRoot, "projects", ".trash"), { recursive: true });
    expect(await listProjects()).toEqual([]);
  });
});
