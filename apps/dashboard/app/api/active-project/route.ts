import { writeActiveProjectSlug } from "@/lib/studio";

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof (body as { slug?: unknown }).slug !== "string") {
    return new Response("missing slug", { status: 400 });
  }
  try {
    await writeActiveProjectSlug((body as { slug: string }).slug);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "error", { status: 400 });
  }
  return new Response(null, { status: 204 });
}
