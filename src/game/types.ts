export type Scene = "MENU" | "INTRO" | "BEACH" | "TUNNEL" | "DOOR_GAME" | "GAME_OVER" | "WIN";

export type ClueKey = "band" | "recorder" | "note" | "phone" | "tag";
export type CluesState = Record<ClueKey, boolean>;
export type DoorOutcome = "SAFE" | "MONSTER" | "CURSE";

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
  shortHint: string;
  loreTitle: string;
  loreText: string;
  icon: string;
  lane: -2 | -1 | 0 | 1 | 2;
};
