import { DOOR_COUNT } from "./constants";
import type { DoorOutcome, RoundLayout } from "./types";

const rand = (max: number) => Math.floor(Math.random() * max);

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function createRoundLayout(): RoundLayout {
  const safeDoor = rand(DOOR_COUNT);
  let curseDoor = rand(DOOR_COUNT);
  while (curseDoor === safeDoor) curseDoor = rand(DOOR_COUNT);
  return { safeDoor, curseDoor };
}

export function getDoorOutcome(index: number, layout: RoundLayout): DoorOutcome {
  if (index === layout.safeDoor) return "SAFE";
  if (index === layout.curseDoor) return "CURSE";
  return "MONSTER";
}
