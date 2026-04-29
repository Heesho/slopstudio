import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { selectTake } from "@/lib/mutations";

const Body = z.object({ jobId: z.string().uuid() });
const TypeSchema = z.enum(["characters", "locations", "scenes"]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await ctx.params;
  let parsed;
  try {
    parsed = TypeSchema.parse(type);
  } catch {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  let body: { jobId: string };
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: (err as Error).message },
      { status: 400 },
    );
  }

  try {
    await selectTake(parsed, id, body.jobId);
  } catch (err) {
    return NextResponse.json(
      { error: "select-take failed", detail: (err as Error).message },
      { status: 400 },
    );
  }

  revalidatePath(`/${parsed}`);
  return NextResponse.json({ ok: true });
}
