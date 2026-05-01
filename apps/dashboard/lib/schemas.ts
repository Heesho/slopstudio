import { z } from "zod";

export const TakeStatus = z.enum(["pending", "generating", "done", "failed"]);
export type TakeStatus = z.infer<typeof TakeStatus>;

export const GenreSchema = z.enum([
  "auto", "general", "action", "horror", "comedy", "noir", "drama", "epic",
]);
export type Genre = z.infer<typeof GenreSchema>;

// Cinematic field set. "auto" is the sentinel meaning "skip in prompt /
// let model decide". DNA gets defaults so missing seed fields parse cleanly.
const cinematicDefaults = {
  genre: GenreSchema.default("auto"),
  colorPalette: z.string().default("auto"),
  lighting: z.string().default("auto"),
  cameraMoveset: z.string().default("auto"),
  camera: z.string().default("auto"),
  lens: z.string().default("auto"),
  focalLength: z.string().default("auto"),
  aperture: z.string().default("auto"),
};

// Same fields, but optional on Scene (Scene falls back to DNA when missing).
const cinematicOverrides = {
  genre: GenreSchema.optional(),
  colorPalette: z.string().optional(),
  lighting: z.string().optional(),
  cameraMoveset: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  focalLength: z.string().optional(),
  aperture: z.string().optional(),
};

const ImageTake = z.object({
  jobId: z.string().uuid(),
  imagePath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});
export type ImageTake = z.infer<typeof ImageTake>;

const VideoTake = z.object({
  jobId: z.string().uuid(),
  videoPath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});
export type VideoTake = z.infer<typeof VideoTake>;

export const DnaSchema = z.object({
  title: z.string(),
  concept: z.string(),
  stylePrompt: z.string(),
  narratorVoice: z.string().nullable(),
  aspectRatio: z.string(),
  videoModel: z.string(),
  characterImageModel: z.string(),
  characterRefAspectRatio: z.string(),
  characterRefTemplate: z.string(),
  locationImageModel: z.string(),
  locationRefAspectRatio: z.string(),
  locationRefTemplate: z.string(),
  ...cinematicDefaults,
});
export type Dna = z.infer<typeof DnaSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  imagePrompt: z.string(),
  description: z.string(),
  imageModel: z.string(),
  takes: z.array(ImageTake),
  selectedTakeId: z.string().uuid().nullable(),
  voice: z.string().nullable().default(null),
});
export type Character = z.infer<typeof CharacterSchema>;

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  imagePrompt: z.string(),
  imageModel: z.string(),
  takes: z.array(ImageTake),
  selectedTakeId: z.string().uuid().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export const SceneSchema = z
  .object({
    id: z.string(),
    episodeId: z.string(),
    order: z.number().int().nonnegative(),
    title: z.string(),
    prompt: z.string(),
    audioMode: z.enum(["narration", "dialogue", "none"]).default("none"),
    audioText: z.string().nullable().default(null),
    speakerCharacterId: z.string().nullable().default(null),
    characters: z.array(z.string()),
    locations: z.array(z.string()),
    duration: z.number().int().min(4).max(15),
    videoModel: z.string(),
    takes: z.array(VideoTake),
    selectedTakeId: z.string().uuid().nullable(),
    ...cinematicOverrides,
    firstFramePrompt: z.string().optional().default(""),
    firstFrameTakes: z.array(ImageTake).default([]),
    firstFrameSelectedTakeId: z.string().uuid().nullable().default(null),
  })
  .superRefine((scene, ctx) => {
    if (scene.audioMode === "narration") {
      if (scene.audioText === null) {
        ctx.addIssue({ code: "custom", message: "audioText required when audioMode='narration'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId !== null) {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId must be null when audioMode='narration'", path: ["speakerCharacterId"] });
      }
    } else if (scene.audioMode === "dialogue") {
      if (scene.audioText === null) {
        ctx.addIssue({ code: "custom", message: "audioText required when audioMode='dialogue'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId === null || scene.speakerCharacterId === "") {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId required when audioMode='dialogue'", path: ["speakerCharacterId"] });
      }
    } else {
      if (scene.audioText !== null) {
        ctx.addIssue({ code: "custom", message: "audioText must be null when audioMode='none'", path: ["audioText"] });
      }
      if (scene.speakerCharacterId !== null) {
        ctx.addIssue({ code: "custom", message: "speakerCharacterId must be null when audioMode='none'", path: ["speakerCharacterId"] });
      }
    }
  });
export type Scene = z.infer<typeof SceneSchema>;

export const EpisodeSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  hook: z.string(),
  scenes: z.array(z.string()),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const StateSchema = z.object({
  lastBalance: z.number().nullable(),
  lastSyncAt: z.string().nullable(),
  recentJobs: z
    .array(
      z.object({
        jobId: z.string(),
        entity: z.string(),
        status: z.string(),
        completedAt: z.string(),
      }),
    )
    .default([]),
});
export type State = z.infer<typeof StateSchema>;

export const StudioConfigSchema = z.object({
  name: z.string().default("slopstudio"),
  activeProjectSlug: z.string().nullable().default(null),
});
export type StudioConfig = z.infer<typeof StudioConfigSchema>;
