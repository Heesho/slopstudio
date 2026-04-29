import { z } from "zod";

export const TakeStatus = z.enum(["pending", "generating", "done", "failed"]);
export type TakeStatus = z.infer<typeof TakeStatus>;

const ImageTake = z.object({
  jobId: z.string().uuid(),
  imagePath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

const VideoTake = z.object({
  jobId: z.string().uuid(),
  videoPath: z.string().optional(),
  status: TakeStatus,
  generatedAt: z.string().optional(),
  error: z.string().optional(),
});

export const DnaSchema = z.object({
  title: z.string(),
  concept: z.string(),
  stylePrompt: z.string(),
  narratorVoice: z.string(),
  aspectRatio: z.string(),
  videoModel: z.string(),
  characterImageModel: z.string(),
  characterRefAspectRatio: z.string(),
  characterRefTemplate: z.string(),
  locationImageModel: z.string(),
  locationRefAspectRatio: z.string(),
  locationRefTemplate: z.string(),
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

export const SceneSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  prompt: z.string(),
  narration: z.string(),
  characters: z.array(z.string()),
  locations: z.array(z.string()),
  duration: z.number().int().positive(),
  videoModel: z.string(),
  takes: z.array(VideoTake),
  selectedTakeId: z.string().uuid().nullable(),
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
