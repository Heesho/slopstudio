import fs from "node:fs/promises";
import path from "node:path";
import { studioPaths, projectPaths } from "./paths";
import { DnaSchema } from "./schemas";

export type ProjectListEntry = {
  slug: string;
  title: string;
  charCount: number;
  locCount: number;
  sceneCount: number;
  thumbnailPath: string | null; // project-relative (e.g. "media/characters/foo/x.png"); null if none
};

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function safeReadJson(filepath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filepath, "utf-8"));
  } catch {
    return null;
  }
}

async function countJsonFiles(dir: string): Promise<number> {
  return (await safeReadDir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length;
}

async function firstThumbnailFor(slug: string): Promise<string | null> {
  // Pick the first character (sorted by filename) with a selectedTakeId pointing at an imagePath take.
  const charsDir = projectPaths(slug).charactersDir;
  const files = (await safeReadDir(charsDir)).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const data = await safeReadJson(path.join(charsDir, f));
    if (!data || typeof data !== "object") continue;
    const d = data as { selectedTakeId?: string | null; takes?: Array<{ jobId: string; imagePath?: string }> };
    if (!d.selectedTakeId || !Array.isArray(d.takes)) continue;
    const sel = d.takes.find((t) => t.jobId === d.selectedTakeId);
    if (sel?.imagePath) return sel.imagePath;
  }
  return null;
}

export async function listProjects(): Promise<ProjectListEntry[]> {
  const dirEntries = await safeReadDir(studioPaths.projectsDir);
  const projects: ProjectListEntry[] = [];

  for (const name of dirEntries) {
    if (name.startsWith(".")) continue;
    const stat = await fs.stat(path.join(studioPaths.projectsDir, name)).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const p = projectPaths(name);
    const dnaRaw = await safeReadJson(p.dna);
    const dna = dnaRaw ? DnaSchema.safeParse(dnaRaw) : null;
    const title = dna?.success ? dna.data.title : name;

    projects.push({
      slug: name,
      title,
      charCount: await countJsonFiles(p.charactersDir),
      locCount: await countJsonFiles(p.locationsDir),
      sceneCount: await countJsonFiles(p.scenesDir),
      thumbnailPath: await firstThumbnailFor(name),
    });
  }
  return projects.sort((a, b) => a.slug.localeCompare(b.slug));
}
