import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ENTITY_TYPES,
  EntityCorruptError,
  EntityNotFoundError,
  EntityValidationError,
  FieldNotEditableError,
  updateEntityField,
} from "@/lib/mutations";
import { assertSafeSlug } from "@/lib/studio";

const TypeSchema = z.enum(ENTITY_TYPES);
const Body = z.object({ field: z.string().min(1), value: z.unknown() });

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; type: string; id: string }> },
) {
  const { slug, type, id } = await ctx.params;

  try {
    assertSafeSlug(slug);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid slug", detail: errMessage(err) },
      { status: 400 },
    );
  }

  let parsedType: (typeof ENTITY_TYPES)[number];
  try {
    parsedType = TypeSchema.parse(type);
  } catch {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

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
    await updateEntityField(slug, parsedType, id, body.field, body.value);
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
    if (err instanceof EntityValidationError || err instanceof FieldNotEditableError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "update failed", detail: errMessage(err) },
      { status: 500 },
    );
  }

  // Revalidate the entity's own page + cross-references
  revalidatePath(`/${parsedType}`);
  if (parsedType === "characters" || parsedType === "locations") {
    revalidatePath("/scenes");
    revalidatePath("/episodes");
  }
  if (parsedType === "scenes") {
    revalidatePath("/episodes");
  }
  if (parsedType === "dna") {
    // DNA defaults bleed into all generation surfaces
    revalidatePath("/scenes");
    revalidatePath("/episodes");
  }
  return NextResponse.json({ ok: true });
}
