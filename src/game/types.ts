export type Scene = "MENU" | "INTRO" | "BEACH" | "TUNNEL" | "DOOR_GAME" | "GAME_OVER" | "WIN";

export type ClueKey = "band" | "recorder" | "note" | "phone" | "tag";
export type CluesState = Record<ClueKey, boolean>;
export type DoorOutcome = "SAFE" | "MONSTER" | "CURSE";

// ── LEVEL ATMOSPHERE TYPES ──────────────────────────────────────────────────
export type LevelTheme =
  | "beach"       // Level 1: Ada / Islak Kıyı
  | "path"        // Level 2: Patika / Çalılık
  | "forest"      // Level 3: Orman Girişi
  | "exterior"    // Level 4: Gökdelen Dışı
  | "checkpoint"  // Level 5: Checkpoint Katı
  | "corridor"    // Level 6: Uzun Koridor
  | "elevator"    // Level 7: Asansör Önü
  | "empty"       // Level 8: Boş Kat
  | "trace"       // Level 9: İz Katı
  | "roof";       // Level 10: Çatı Kapısı

export type ParticleType = "none" | "dust" | "embers" | "ash" | "mist" | "static";

export type LevelEffects = {
  fogDensity: "none" | "light" | "medium" | "heavy" | "extreme";
  glitchAmount: "none" | "subtle" | "moderate" | "heavy";
  vignetteColor: string;
  particles: ParticleType;
  shakeMultiplier: number;
  scanlines: boolean;
  redLightIntensity: "none" | "faint" | "pulse" | "strong";
};

export type LevelAmbience = {
  type: "waves" | "wind" | "forest" | "city" | "hum" | "echo" | "machine" | "silence" | "static";
  droneFreq: number;
  tempo: "slow" | "medium" | "tense";
};

export type LevelColors = {
  skyTop: string;
  skyBottom: string;
  floorTone: string;
  wallTone: string;
  lightAccent: string;
  fogColor: string;
};

export type LevelConfig = {
  id: number;
  name: string;
  locationLabel: string;
  theme: LevelTheme;
  colors: LevelColors;
  effects: LevelEffects;
  ambience: LevelAmbience;
  systemMessage?: string;
  hint: string;
  doorVariation: "normal" | "worn" | "chained" | "cursed" | "blank";
};

export type RoundLayout = {
  safeDoor: number;
  curseDoor: number;
};

export type PuzzleState = {
  bandScrub: number;
  recorderTune: number;
  recorderChecked: boolean;
  noteSeq: number[];
  phonePin: string;
  tagDial: number;
  tagUv: boolean;
};

export type PathObject = {
  key: ClueKey;
  pos: number;
  label: string;
  artifactType: string;
  shortHint: string;
  loreTitle: string;
  loreText: string;
  cluePiece: string;
  clueHint: string;
  icon: string;
  lane: -2 | -1 | 0 | 1 | 2;
};
