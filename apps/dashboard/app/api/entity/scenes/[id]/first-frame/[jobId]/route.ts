import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteTake,
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  TakeNotFoundError,
} from "@/lib/mutations";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await ctx.params;

  try {
    z.string().uuid().parse(jobId);
  } catch {
    return NextResponse.json({ error: "invalid jobId" }, { status: 400 });
  }

  try {
    await deleteTake("scenes", id, jobId, "firstFrameTakes");
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
      { error: "delete-first-frame failed", detail: errMessage(err) },
      { status: 500 },
    );
  }

  revalidatePath("/scenes");
  revalidatePath("/episodes");
  return NextResponse.json({ ok: true });
}
