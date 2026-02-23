import type { CluesState, PuzzleState } from "./types";

export const DOOR_COUNT = 5;
export const MAX_LIVES = 5;
export const MAX_LEVEL = 10;
export const CHECKPOINT_LEVEL = 5;

export const PATH_LEN = 360;
export const PATH_VIEW = 100;
export const TUNNEL_POS = 336;
export const START_POS = 10;

export const INTERACT_RADIUS = 10.5;
export const TUNNEL_ENTER_RADIUS = 14;

export const INITIAL_CLUES: CluesState = {
  band: false,
  recorder: false,
  note: false,
  phone: false,
  tag: false,
};

export const INITIAL_PUZZLES: PuzzleState = {
  bandScrub: 0,
  recorderTune: 50,
  recorderChecked: false,
  noteSeq: [],
  phonePin: "",
  tagDial: 0,
  tagUv: false,
};
