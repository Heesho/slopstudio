type SceneIsh = Record<string, unknown>;
type CharacterIsh = Record<string, unknown>;

export function migrateSceneToV02(scene: SceneIsh): SceneIsh {
  const { narration: _drop, ...rest } = scene;
  if (rest.audioMode !== undefined) return rest;
  const narration = typeof scene.narration === "string" ? scene.narration : "";
  if (narration.length > 0) {
    return { ...rest, audioMode: "narration", audioText: narration, speakerCharacterId: null };
  }
  return { ...rest, audioMode: "none", audioText: null, speakerCharacterId: null };
}

export function migrateCharacterToV02(character: CharacterIsh): CharacterIsh {
  if (character.voice !== undefined) return character;
  return { ...character, voice: null };
}
