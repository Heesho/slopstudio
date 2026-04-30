import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  selectTake,
  TakeNotFoundError,
} from "@/lib/mutations";

const Body = z.object({ jobId: z.string().uuid() });

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: errMessage(err) },
      { status: 400 },
    );
  }

  try {
    await selectTake("scenes", id, body.jobId, "firstFrameTakes");
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      return NextResponse.json({ error: "entity not found" }, { status: 404 });
    }
    if (err instanceof EntityCorruptError) {
      return NextResponse.json(
        { error: "entity corrupt", detail: err.message },
        { status: 500 },
      );
    }
    if (err instanceof TakeNotFoundError || err instanceof EntityValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "select-first-frame failed", detail: errMessage(err) },
      { status: 500 },
    );
  }

  revalidatePath("/scenes");
  revalidatePath("/episodes");
  return NextResponse.json({ ok: true });
}
