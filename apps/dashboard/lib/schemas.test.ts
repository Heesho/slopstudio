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
      title: "Test Show",
      concept: "test",
      stylePrompt: "style",
      aspectRatio: "9:16",
      videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2",
      characterRefAspectRatio: "16:9",
      characterRefTemplate: "ref {imagePrompt}",
      locationImageModel: "nano_banana_2",
      locationRefAspectRatio: "16:9",
      locationRefTemplate: "loc {imagePrompt}",
    };
    expect(DnaSchema.parse(valid)).toMatchObject(valid);
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

describe("cinematic additions", () => {
  it("DNA defaults all cinematic fields to 'auto' when missing", () => {
    const minimal = {
      title: "X", concept: "Y", stylePrompt: "Z",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "nano_banana_2", characterRefAspectRatio: "16:9",
      characterRefTemplate: "{imagePrompt}",
      locationImageModel: "nano_banana_2", locationRefAspectRatio: "16:9",
      locationRefTemplate: "{imagePrompt}",
    };
    const parsed = DnaSchema.parse(minimal);
    expect(parsed.genre).toBe("auto");
    expect(parsed.colorPalette).toBe("auto");
    expect(parsed.aperture).toBe("auto");
  });

  it("DNA accepts a non-auto cinematic value", () => {
    const minimal = {
      title: "X", concept: "Y", stylePrompt: "Z",
      aspectRatio: "9:16", videoModel: "seedance_2_0",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "drama", focalLength: "85mm",
    };
    const parsed = DnaSchema.parse(minimal);
    expect(parsed.genre).toBe("drama");
    expect(parsed.focalLength).toBe("85mm");
    expect(parsed.aperture).toBe("auto");
  });

  it("DNA rejects an invalid genre", () => {
    const bad = {
      title: "X", concept: "Y", stylePrompt: "Z",
      aspectRatio: "9:16", videoModel: "v",
      characterImageModel: "m", characterRefAspectRatio: "16:9", characterRefTemplate: "t",
      locationImageModel: "m", locationRefAspectRatio: "16:9", locationRefTemplate: "t",
      genre: "musical",
    };
    expect(() => DnaSchema.parse(bad)).toThrow();
  });

  it("Scene cinematic fields are all optional", () => {
    const minimal = {
      id: "s1", episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
    };
    const parsed = SceneSchema.parse(minimal);
    expect(parsed.genre).toBeUndefined();
    expect(parsed.colorPalette).toBeUndefined();
  });

  it("Scene accepts cinematic overrides", () => {
    const valid = {
      id: "s1", episodeId: "e1", order: 0, title: "T", prompt: "p",
      characters: [], locations: [], duration: 6, videoModel: "v",
      takes: [], selectedTakeId: null,
      genre: "noir", focalLength: "35mm",
    };
    const parsed = SceneSchema.parse(valid);
    expect(parsed.genre).toBe("noir");
    expect(parsed.focalLength).toBe("35mm");
  });
});

describe("CharacterSchema voice", () => {
  const baseChar = {
    id: "anom",
    name: "Anomalocaris",
    imagePrompt: "x",
    description: "y",
    imageModel: "nano_banana_2",
    takes: [],
    selectedTakeId: null,
  };

  it("defaults voice to null", () => {
    const parsed = CharacterSchema.parse(baseChar);
    expect(parsed.voice).toBeNull();
  });

  it("accepts free-text voice", () => {
    const parsed = CharacterSchema.parse({ ...baseChar, voice: "gruff, gravelly" });
    expect(parsed.voice).toBe("gruff, gravelly");
  });
});

describe("SceneSchema duration clamp", () => {
  const baseScene = {
    id: "s1", episodeId: "ep-1", order: 0, title: "x", prompt: "p",
    characters: [], locations: [], videoModel: "seedance_2_0", takes: [], selectedTakeId: null,
  };

  it("accepts duration in [4, 15]", () => {
    expect(SceneSchema.parse({ ...baseScene, duration: 4 }).duration).toBe(4);
    expect(SceneSchema.parse({ ...baseScene, duration: 15 }).duration).toBe(15);
  });

  it("rejects duration < 4", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: 3 })).toThrow();
  });

  it("rejects duration > 15", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: 16 })).toThrow();
  });

  it("rejects non-integer duration", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: 6.5 })).toThrow();
  });

  it("rejects NaN duration", () => {
    expect(() => SceneSchema.parse({ ...baseScene, duration: NaN })).toThrow();
  });
});

describe("EpisodeSchema story fields", () => {
  const baseEp = {
    id: "ep-1",
    number: 1,
    title: "Birth",
    hook: "What if...",
    scenes: [],
  };

  it("defaults logline and synopsis to empty string", () => {
    const parsed = EpisodeSchema.parse(baseEp);
    expect(parsed.logline).toBe("");
    expect(parsed.synopsis).toBe("");
  });

  it("accepts populated logline and synopsis", () => {
    const parsed = EpisodeSchema.parse({
      ...baseEp,
      logline: "Apex predators emerge.",
      synopsis: "Trilobites graze in peace until Anomalocaris arrives.",
    });
    expect(parsed.logline).toBe("Apex predators emerge.");
    expect(parsed.synopsis.length).toBeGreaterThan(0);
  });
});

describe("SceneSchema archived flag", () => {
  const baseScene = {
    id: "s1", episodeId: "ep-1", order: 0, title: "x", prompt: "p",
    characters: [], locations: [], duration: 6, videoModel: "v",
    takes: [], selectedTakeId: null,
  };

  it("defaults archived to false", () => {
    const parsed = SceneSchema.parse(baseScene);
    expect(parsed.archived).toBe(false);
  });

  it("accepts archived: true", () => {
    const parsed = SceneSchema.parse({ ...baseScene, archived: true });
    expect(parsed.archived).toBe(true);
  });

  it("rejects non-boolean archived", () => {
    expect(() =>
      SceneSchema.parse({ ...baseScene, archived: "yes" }),
    ).toThrow();
  });
});

describe("SceneSchema audio flag", () => {
  const baseScene = {
    id: "s1", episodeId: "ep-1", order: 0, title: "x", prompt: "p",
    characters: [], locations: [], duration: 6, videoModel: "v",
    takes: [], selectedTakeId: null,
  };

  it("defaults audio to true", () => {
    const parsed = SceneSchema.parse(baseScene);
    expect(parsed.audio).toBe(true);
  });

  it("accepts audio: false", () => {
    const parsed = SceneSchema.parse({ ...baseScene, audio: false });
    expect(parsed.audio).toBe(false);
  });

  it("rejects non-boolean audio", () => {
    expect(() =>
      SceneSchema.parse({ ...baseScene, audio: "loud" }),
    ).toThrow();
  });
});

describe("EpisodeSchema targetSeconds", () => {
  const baseEp = {
    id: "ep-1", number: 1, title: "T", hook: "H", scenes: [],
  };

  it("defaults targetSeconds to null", () => {
    const parsed = EpisodeSchema.parse(baseEp);
    expect(parsed.targetSeconds).toBeNull();
  });

  it("accepts a positive integer target", () => {
    const parsed = EpisodeSchema.parse({ ...baseEp, targetSeconds: 60 });
    expect(parsed.targetSeconds).toBe(60);
  });

  it("rejects zero or negative target", () => {
    expect(() => EpisodeSchema.parse({ ...baseEp, targetSeconds: 0 })).toThrow();
    expect(() => EpisodeSchema.parse({ ...baseEp, targetSeconds: -5 })).toThrow();
  });

  it("rejects non-integer target", () => {
    expect(() => EpisodeSchema.parse({ ...baseEp, targetSeconds: 60.5 })).toThrow();
  });
});
