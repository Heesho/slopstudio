import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "@/lib/paths";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const fullPath = path.join(paths.mediaDir, ...parts);

  // Path traversal guard: ensure resolved path is still inside mediaDir
  const resolved = path.resolve(fullPath);
  const mediaRoot = path.resolve(paths.mediaDir);
  if (!resolved.startsWith(mediaRoot + path.sep) && resolved !== mediaRoot) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
    };
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": types[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
