import { describe, it, expect } from "vitest";
import { migrateSceneToV02, migrateCharacterToV02 } from "./migrations";

describe("migrateSceneToV02", () => {
  it("converts non-empty narration into audioMode='narration' + audioText", () => {
    const input = {
      id: "s1",
      narration: "for three billion years",
    };
    const out = migrateSceneToV02(input);
    expect(out.audioMode).toBe("narration");
    expect(out.audioText).toBe("for three billion years");
    expect(out.speakerCharacterId).toBeNull();
  });

  it("converts empty narration into audioMode='none'", () => {
    const out = migrateSceneToV02({ id: "s1", narration: "" });
    expect(out.audioMode).toBe("none");
    expect(out.audioText).toBeNull();
    expect(out.speakerCharacterId).toBeNull();
  });

  it("is idempotent — already-migrated scenes pass through unchanged (narration stripped)", () => {
    const input = { id: "s1", narration: "x", audioMode: "narration", audioText: "x", speakerCharacterId: null };
    const expected = { id: "s1", audioMode: "narration", audioText: "x", speakerCharacterId: null };
    expect(migrateSceneToV02(input)).toEqual(expected);
  });

  it("strips narration from output", () => {
    const out = migrateSceneToV02({ id: "s1", narration: "hello" });
    expect("narration" in out).toBe(false);
  });
});

describe("migrateCharacterToV02", () => {
  it("adds voice: null to characters that lack it", () => {
    const out = migrateCharacterToV02({ id: "anom", name: "Anomalocaris" });
    expect(out.voice).toBeNull();
  });

  it("preserves existing voice", () => {
    const out = migrateCharacterToV02({ id: "anom", voice: "gruff" });
    expect(out.voice).toBe("gruff");
  });
});
