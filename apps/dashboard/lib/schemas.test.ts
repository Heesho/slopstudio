import { describe, expect, it } from "vitest";
import {
  CharacterSchema,
  DnaSchema,
  EpisodeSchema,
  LocationSchema,
  SceneSchema,
  StateSchema,
} from "./schemas";

describe("schemas", () => {
  it("validates a minimal DNA file", () => {
    const valid = {
      title: "Cambria",
      concept: "test",
      stylePrompt: "style",
      narratorVoice: "voice",
      aspectRatio: "9:16",
      videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2",
      characterRefAspectRatio: "16:9",
      characterRefTemplate: "ref {imagePrompt}",
      locationImageModel: "nano_banana_2",
      locationRefAspectRatio: "16:9",
      locationRefTemplate: "loc {imagePrompt}",
    };
    expect(DnaSchema.parse(valid)).toEqual(valid);
  });

  it("validates a character with takes", () => {
    const valid = {
      id: "anomalocaris",
      name: "Anomalocaris",
      imagePrompt: "p",
      description: "d",
      imageModel: "nano_banana_2",
      takes: [
        {
          jobId: "550e8400-e29b-41d4-a716-446655440000",
          imagePath: "media/x.png",
          status: "done",
          generatedAt: "2026-04-28T12:00:00Z",
        },
      ],
      selectedTakeId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(CharacterSchema.parse(valid)).toBeTruthy();
  });

  it("rejects an invalid take status", () => {
    expect(() =>
      CharacterSchema.parse({
        id: "x",
        name: "X",
        imagePrompt: "",
        description: "",
        imageModel: "m",
        takes: [{ jobId: "550e8400-e29b-41d4-a716-446655440000", status: "weird" }],
        selectedTakeId: null,
      }),
    ).toThrow();
  });

  it("validates a location with no takes yet", () => {
    const valid = {
      id: "burgess",
      name: "Burgess",
      imagePrompt: "p",
      imageModel: "nano_banana_2",
      takes: [],
      selectedTakeId: null,
    };
    expect(LocationSchema.parse(valid)).toBeTruthy();
  });

  it("validates a scene with characters and locations referenced", () => {
    const valid = {
      id: "001-hunt",
      episodeId: "ep-1",
      order: 3,
      title: "First Hunt",
      prompt: "Anomalocaris hunts",
      narration: "Narration text",
      characters: ["anomalocaris"],
      locations: ["burgess"],
      duration: 6,
      videoModel: "seedance_2_0",
      takes: [],
      selectedTakeId: null,
    };
    expect(SceneSchema.parse(valid)).toBeTruthy();
  });

  it("rejects a scene with negative order", () => {
    expect(() =>
      SceneSchema.parse({
        id: "x",
        episodeId: "y",
        order: -1,
        title: "t",
        prompt: "p",
        narration: "n",
        characters: [],
        locations: [],
        duration: 1,
        videoModel: "m",
        takes: [],
        selectedTakeId: null,
      }),
    ).toThrow();
  });

  it("validates an episode with scene order", () => {
    const valid = {
      id: "ep-1",
      number: 1,
      title: "Birth",
      hook: "What if...",
      scenes: ["000-cold-open", "001-hunt"],
    };
    expect(EpisodeSchema.parse(valid)).toBeTruthy();
  });

  it("validates state with empty defaults", () => {
    const valid = { lastBalance: null, lastSyncAt: null, recentJobs: [] };
    expect(StateSchema.parse(valid)).toEqual(valid);
  });

  it("state recentJobs defaults to empty array if omitted", () => {
    const result = StateSchema.parse({ lastBalance: null, lastSyncAt: null });
    expect(result.recentJobs).toEqual([]);
  });
});
