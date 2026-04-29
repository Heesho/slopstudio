import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ENTITY_TYPES,
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  selectTake,
  TakeNotFoundError,
} from "@/lib/mutations";

const Body = z.object({ jobId: z.string().uuid() });
const TypeSchema = z.enum(ENTITY_TYPES);

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await ctx.params;

  let parsedType: (typeof ENTITY_TYPES)[number];
  try {
    parsedType = TypeSchema.parse(type);
  } catch {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  let body: { jobId: string };
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", detail: errMessage(err) },
      { status: 400 },
    );
  }

  try {
    await selectTake(parsedType, id, body.jobId);
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
      { error: "select-take failed", detail: errMessage(err) },
      { status: 500 },
    );
  }

  revalidatePath(`/${parsedType}`);
  if (parsedType === "characters" || parsedType === "locations") {
    revalidatePath("/scenes");
    revalidatePath("/episodes");
  }
  if (parsedType === "scenes") {
    revalidatePath("/episodes");
  }
  return NextResponse.json({ ok: true });
}
