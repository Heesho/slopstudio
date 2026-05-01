export const ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 (vertical)" },
  { value: "16:9", label: "16:9 (horizontal)" },
  { value: "1:1", label: "1:1 (square)" },
  { value: "4:5", label: "4:5" },
  { value: "21:9", label: "21:9 (cinematic)" },
];

export const VIDEO_MODEL_OPTIONS = [
  { value: "seedance_2_0", label: "seedance_2_0" },
  { value: "kling_2_0", label: "kling_2_0" },
  { value: "veo_3", label: "veo_3" },
];

export const IMAGE_MODEL_OPTIONS = [
  { value: "nano_banana_2", label: "nano_banana_2" },
  { value: "flux_pro_1_1", label: "flux_pro_1_1" },
  { value: "ideogram_3", label: "ideogram_3" },
];

const FOCAL_LENGTHS = ["auto", "14mm", "24mm", "35mm", "50mm", "85mm", "135mm"];
export const FOCAL_LENGTH_OPTIONS = FOCAL_LENGTHS.map((v) => ({ value: v, label: v }));

const APERTURES = ["auto", "f/1.4", "f/2", "f/2.8", "f/4", "f/5.6", "f/8", "f/11"];
export const APERTURE_OPTIONS = APERTURES.map((v) => ({ value: v, label: v }));

const CAMERAS = ["auto", "ARRI Alexa 35", "RED Komodo", "Sony Venice 2", "iPhone Pro"];
export const CAMERA_OPTIONS = CAMERAS.map((v) => ({ value: v, label: v }));

const LENSES = ["auto", "wide-angle", "standard", "telephoto", "macro", "anamorphic"];
export const LENS_OPTIONS = LENSES.map((v) => ({ value: v, label: v }));
