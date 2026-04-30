import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertSafeSlug, readStudioConfig, writeActiveProjectSlug } from "./studio";
import { StudioConfigSchema } from "./schemas";
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

  it("StudioConfigSchema applies defaults for empty input", () => {
    expect(StudioConfigSchema.parse({})).toEqual({
      name: "slopstudio",
      activeProjectSlug: null,
    });
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

  it("readStudioConfig throws on malformed JSON", async () => {
    await fs.writeFile(path.join(tmpRoot, "slopstudio.json"), "{not json");
    await expect(readStudioConfig()).rejects.toThrow();
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

describe("assertSafeSlug", () => {
  it("accepts valid slugs", () => {
    expect(() => assertSafeSlug("a")).not.toThrow();
    expect(() => assertSafeSlug("cambrian-docuseries")).not.toThrow();
    expect(() => assertSafeSlug("a-b-c-1-2-3")).not.toThrow();
    expect(() => assertSafeSlug("a".repeat(64))).not.toThrow();
  });
  it("rejects empty, too long, uppercase, and path-escape attempts", () => {
    expect(() => assertSafeSlug("")).toThrow();
    expect(() => assertSafeSlug("a".repeat(65))).toThrow();
    expect(() => assertSafeSlug("HAS-UPPER")).toThrow();
    expect(() => assertSafeSlug("..")).toThrow();
    expect(() => assertSafeSlug("a/b")).toThrow();
    expect(() => assertSafeSlug("a_b")).toThrow();
  });
});
