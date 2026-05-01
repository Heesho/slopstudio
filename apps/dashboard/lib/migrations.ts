type SceneIsh = Record<string, unknown>;
type CharacterIsh = Record<string, unknown>;

export function migrateSceneToV02(scene: SceneIsh): SceneIsh {
  if (scene.audioMode !== undefined) return scene; // idempotent
  const narration = typeof scene.narration === "string" ? scene.narration : "";
  if (narration.length > 0) {
    return { ...scene, audioMode: "narration", audioText: narration, speakerCharacterId: null };
  }
  return { ...scene, audioMode: "none", audioText: null, speakerCharacterId: null };
}

export function migrateCharacterToV02(character: CharacterIsh): CharacterIsh {
  if (character.voice !== undefined) return character;
  return { ...character, voice: null };
}
