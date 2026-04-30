import fs from "node:fs/promises";
import path from "node:path";
import { StudioConfigSchema, type StudioConfig } from "./schemas";
import { repoRoot } from "./paths";
import { writeAtomic } from "./mutations";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function assertSafeSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > 64 || slug.length < 1) {
    throw new Error(`invalid project slug: ${slug}`);
  }
}

function studioConfigPath(): string {
  return path.join(repoRoot(), "slopstudio.json");
}

export { StudioConfigSchema };
export type { StudioConfig };

export async function readStudioConfig(): Promise<StudioConfig> {
  try {
    const raw = await fs.readFile(studioConfigPath(), "utf-8");
    return StudioConfigSchema.parse(JSON.parse(raw));
  } catch {
    return { name: "slopstudio", activeProjectSlug: null };
  }
}

export async function writeActiveProjectSlug(slug: string): Promise<void> {
  assertSafeSlug(slug);
  const current = await readStudioConfig();
  await writeAtomic(studioConfigPath(), { ...current, activeProjectSlug: slug });
}
