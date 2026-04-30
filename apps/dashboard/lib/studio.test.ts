import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStudioConfig, writeActiveProjectSlug, StudioConfigSchema } from "./studio";
import * as pathsModule from "./paths";

describe("studio config", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "slopstudio-test-"));
    vi.spyOn(pathsModule, "repoRoot").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("StudioConfigSchema parses a minimal config", () => {
    expect(StudioConfigSchema.parse({ name: "X", activeProjectSlug: "y" }))
      .toEqual({ name: "X", activeProjectSlug: "y" });
  });

  it("readStudioConfig returns defaults when file missing", async () => {
    expect(await readStudioConfig()).toEqual({
      name: "slopstudio",
      activeProjectSlug: null,
    });
  });

  it("readStudioConfig parses an existing file", async () => {
    await fs.writeFile(
      path.join(tmpRoot, "slopstudio.json"),
      JSON.stringify({ name: "My Studio", activeProjectSlug: "demo" }),
    );
    expect(await readStudioConfig()).toEqual({
      name: "My Studio",
      activeProjectSlug: "demo",
    });
  });

  it("writeActiveProjectSlug updates only that field", async () => {
    await fs.writeFile(
      path.join(tmpRoot, "slopstudio.json"),
      JSON.stringify({ name: "S", activeProjectSlug: "a" }),
    );
    await writeActiveProjectSlug("b");
    const after = JSON.parse(
      await fs.readFile(path.join(tmpRoot, "slopstudio.json"), "utf-8"),
    );
    expect(after).toEqual({ name: "S", activeProjectSlug: "b" });
  });

  it("writeActiveProjectSlug rejects invalid slugs", async () => {
    await expect(writeActiveProjectSlug("../etc")).rejects.toThrow();
    await expect(writeActiveProjectSlug("HAS UPPER")).rejects.toThrow();
  });
});
