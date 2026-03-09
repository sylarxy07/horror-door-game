import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLevelConfig } from "./game/levelConfig";
import {
  CHECKPOINT_LEVEL,
  DOOR_COUNT,
  INITIAL_CLUES,
  INITIAL_PUZZLES,
  INTERACT_RADIUS,
  MAX_LEVEL,
  MAX_LIVES,
  PATH_LEN,
  PATH_VIEW,
  START_POS,
  TUNNEL_ENTER_RADIUS,
  TUNNEL_POS,
} from "./game/constants";
import { BEACH_PUZZLE_CODE, objectByKey, pathObjects, sidePosts } from "./game/data";
import type { ClueKey, CluesState, DoorOutcome, PathObject, PuzzleState, RoundLayout, Scene } from "./game/types";
import { clamp, createRoundLayout, getDoorOutcome } from "./game/utils";
import { BeachScene } from "./scenes/BeachScene";
import { BeachWorld } from "./scenes/BeachWorld";
import { DemoEndScene } from "./scenes/DemoEndScene";
import { DoorGameScene } from "./scenes/DoorGameScene";
import { ElevatorScene } from "./scenes/ElevatorScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { IntroScene } from "./scenes/IntroScene";
import { MenuScene } from "./scenes/MenuScene";
import { PuzzleModal } from "./scenes/PuzzleModal";
import { TunnelScene } from "./scenes/TunnelScene";
import { WinScene } from "./scenes/WinScene";
import { useI18n } from "./i18n";
import "./game/game.css";
import "./game/demo-overrides.css";

const EPISODE_1_MAX_FLOOR = 5;
const ROOMS_PER_FLOOR = 1;
const SCENE_FADE_MS = 500;
const BEACH_ENTRY_PRELOAD_SOURCES = [
  "/assets/img/beach/beach_b0_key.png",
  "/assets/img/beach/beach_b0_nokey.png",
  "/assets/img/beach/beach_b0_v2_with_key.png",
  "/assets/img/beach/beach_b0_v2.png",
  "/assets/img/beach/obj1_key.png",
  "/assets/img/beach/obj3_note.png",
] as const;

const INTRO_AUDIO = {
  typing: "/audio/intro/typing.mp3",
  hum: "/audio/intro/computer-hum.mp3",
  room: "/audio/intro/room-tone.mp3",
  glitch: "/audio/intro/glitch.mp3",
  redEyesBoom: "/audio/intro/red-eyes-boom.mp3",
  rainThunder: "/audio/intro/rain-thunder.mp3",
} as const;

const DOOR_AUDIO = {
  safe: "/audio/door/safe.mp3",
  monster: "/audio/door/monster.mp3",
  curse: "/audio/door/curse.mp3",
} as const;

type DoorEventOverlay = {
  key: number;
  kind: "SAFE" | "MONSTER" | "CURSE";
  text: string;
} | null;

type IntroAudioRefs = {
  typing: HTMLAudioElement | null;
  hum: HTMLAudioElement | null;
  room: HTMLAudioElement | null;
  rainThunder: HTMLAudioElement | null;
};

function preloadImageSources(sources: readonly string[]) {
  if (typeof window === "undefined") return Promise.resolve();

  return Promise.all(
    sources.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };

          image.onload = finish;
          image.onerror = finish;
          image.src = src;
          if (image.complete) finish();
        })
    )
  ).then(() => undefined);
}

export default function App() {
  const { currentLang, t, tLines } = useI18n();
  const episodeMaxFloor = Math.min(EPISODE_1_MAX_FLOOR, MAX_LEVEL);
  const devParamEnabled =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dev") === "1";
  const devToolsEnabled = import.meta.env.DEV || (devParamEnabled && !import.meta.env.PROD);

  const [scene, setScene] = useState<Scene>("MENU");

  const [introStep, setIntroStep] = useState(0);
  const [beachSceneResetKey, setBeachSceneResetKey] = useState(0);
  const [elevatorSceneResetKey, setElevatorSceneResetKey] = useState(0);

  const [fadeOn, setFadeOn] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shake, setShake] = useState<0 | 1 | 2>(0);

  // BEACH
  const [clues, setClues] = useState<CluesState>(INITIAL_CLUES);
  const [selectedClue, setSelectedClue] = useState<ClueKey | null>(null);
  const [beachHint, setBeachHint] = useState(() => t("beach.hint.start"));
  const [redLightUnlocked, setRedLightUnlocked] = useState(false);
  const [redLightPhase, setRedLightPhase] = useState<"IDLE" | "SHOW_TEXT" | "READY">("IDLE");
  const [tamayPos, setTamayPos] = useState(START_POS);
  const [cameraPos, setCameraPos] = useState(clamp(START_POS - 18, 0, PATH_LEN - PATH_VIEW));
  const [moveDir, setMoveDir] = useState<-1 | 0 | 1>(0);
  const [journalOpen, setJournalOpen] = useState(false);

  // movement feel
  const [walkClock, setWalkClock] = useState(0);
  const [walkBlend, setWalkBlend] = useState(0);

  // puzzles
  const [puzzles, setPuzzles] = useState<PuzzleState>(INITIAL_PUZZLES);
  const [puzzleFeedback, setPuzzleFeedback] = useState("");
  const [beachPuzzleOpen, setBeachPuzzleOpen] = useState(false);
  const [beachPuzzleInput, setBeachPuzzleInput] = useState("");
  const [beachPuzzleFeedback, setBeachPuzzleFeedback] = useState("");
  const [beachGateUnlocked, setBeachGateUnlocked] = useState(false);

  // TUNNEL / DOOR GAME
  const [level, setLevel] = useState(1);
  const [room, setRoom] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [checkpointUnlocked, setCheckpointUnlocked] = useState(false);
  const [carryoverCurseActive, setCarryoverCurseActive] = useState(false);
  const [carryoverCursePending, setCarryoverCursePending] = useState(false);

  const [roundLayout, setRoundLayout] = useState<RoundLayout>(createRoundLayout());
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);
  const [selectedDoorOutcome, setSelectedDoorOutcome] = useState<DoorOutcome | null>(null);
  const [doorInputLocked, setDoorInputLocked] = useState(false);
  const [doorHint, setDoorHint] = useState(() => t("door.hint.start"));
  const [lastOutcome, setLastOutcome] = useState<DoorOutcome | null>(null);
  const [doorHitPulseKey, setDoorHitPulseKey] = useState(0);
  const [doorEventOverlay, setDoorEventOverlay] = useState<DoorEventOverlay>(null);
  const [showHotspots, setShowHotspots] = useState(false);

  const timeoutRefs = useRef<number[]>([]);
  const touchYRef = useRef<number | null>(null);
  const doorEventCounterRef = useRef(0);
  const beachPreloadPromiseRef = useRef<Promise<void> | null>(null);
  const introToBeachTransitionTokenRef = useRef(0);
  const introAudioRefs = useRef<IntroAudioRefs>({
    typing: null,
    hum: null,
    room: null,
    rainThunder: null,
  });
  const introAudioStartedRef = useRef(false);
  const introRainTimeoutRef = useRef<number | null>(null);

  // refs for smooth camera loop
  const tamayPosRef = useRef(tamayPos);
  const moveDirRef = useRef(moveDir);
  const selectedClueRef = useRef<ClueKey | null>(selectedClue);
  const beachModalLockedRef = useRef(selectedClue !== null || beachPuzzleOpen);

  useEffect(() => {
    tamayPosRef.current = tamayPos;
  }, [tamayPos]);
  useEffect(() => {
    moveDirRef.current = moveDir;
  }, [moveDir]);
  useEffect(() => {
    selectedClueRef.current = selectedClue;
  }, [selectedClue]);
  useEffect(() => {
    beachModalLockedRef.current = selectedClue !== null || beachPuzzleOpen;
  }, [selectedClue, beachPuzzleOpen]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, []);

  const introLines = useMemo(() => {
    const lines = tLines("intro.lines");
    return lines.length ? [...lines] : [];
  }, [tLines]);

  const inspectedCount = useMemo(() => Object.values(clues).filter(Boolean).length, [clues]);
  const allCluesFound = useMemo(() => Object.values(clues).every(Boolean), [clues]);

  const nearestObject = useMemo(() => {
    let best: { obj: PathObject; dist: number } | null = null;
    for (const obj of pathObjects) {
      const dist = Math.abs(tamayPos - obj.pos);
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best;
  }, [tamayPos]);

  const interactableObject = useMemo(() => {
    if (!nearestObject) return null;
    if (nearestObject.dist > INTERACT_RADIUS) return null;
    return nearestObject.obj;
  }, [nearestObject]);

  const nextUnsolvedObject = useMemo(() => {
    const unsolved = pathObjects.filter((o) => !clues[o.key]);
    if (!unsolved.length) return null;
    let best: { obj: PathObject; dist: number } | null = null;
    for (const obj of unsolved) {
      const dist = Math.abs(tamayPos - obj.pos);
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best;
  }, [clues, tamayPos]);

  const canInspect =
    scene === "BEACH" &&
    !!interactableObject &&
    !selectedClue &&
    !beachPuzzleOpen &&
    !clues[interactableObject.key] &&
    !isTransitioning;

  const canOpenBeachPuzzle =
    scene === "BEACH" &&
    allCluesFound &&
    !beachGateUnlocked &&
    !selectedClue &&
    !beachPuzzleOpen &&
    !isTransitioning;

  const canUseTunnelGate =
    scene === "BEACH" &&
    !selectedClue &&
    !beachPuzzleOpen &&
    !isTransitioning &&
    tamayPos >= TUNNEL_POS - TUNNEL_ENTER_RADIUS;

  const canEnterTunnel = canUseTunnelGate && beachGateUnlocked;

  const pathProgressPercentRaw = Math.round((Math.min(tamayPos, TUNNEL_POS) / TUNNEL_POS) * 100);
  const pathProgressPercent = canEnterTunnel ? 100 : pathProgressPercentRaw;

  const targetHint = useMemo(() => {
    if (scene !== "BEACH") return "";
    if (canEnterTunnel) return t("beach.target.tunnelReady");
    if (!allCluesFound) {
      if (interactableObject && !clues[interactableObject.key]) {
        return t("beach.target.nearObject", { label: interactableObject.label });
      }
      if (nextUnsolvedObject) {
        const dir = nextUnsolvedObject.obj.pos > tamayPos ? t("beach.dir.forward") : t("beach.dir.back");
        return t("beach.target.nextObject", {
          label: nextUnsolvedObject.obj.label,
          distance: Math.round(nextUnsolvedObject.dist),
          dir,
        });
      }
      return t("beach.target.searching");
    }
    const distToTunnel = Math.max(0, Math.round(TUNNEL_POS - tamayPos));
    return t("beach.target.redLight", { distance: distToTunnel });
  }, [scene, canEnterTunnel, allCluesFound, interactableObject, clues, nextUnsolvedObject, tamayPos, t]);

  const beachTargetHint = useMemo(() => {
    if (canEnterTunnel) return t("beach.target.reachTunnel");
    if (!allCluesFound) return targetHint;
    if (!beachGateUnlocked) return t("beach.target.openPanel");
    const distToTunnel = Math.max(0, Math.round(TUNNEL_POS - tamayPos));
    return t("beach.target.verified", { distance: distToTunnel });
  }, [canEnterTunnel, allCluesFound, beachGateUnlocked, tamayPos, targetHint, t]);

  const beachPuzzleStatusLabel = allCluesFound
    ? t("beach.puzzleStatus.ready")
    : t("beach.puzzleStatus.locked");

  useEffect(() => {
    if (scene === "BEACH") {
      if (beachGateUnlocked) {
        setBeachHint(t("beach.hint.beachGateUnlocked"));
      } else if (allCluesFound) {
        setBeachHint(t("beach.hint.collectReady"));
      } else {
        setBeachHint(t("beach.hint.start"));
      }
    }

    if (scene === "DOOR_GAME") {
      if (selectedDoorOutcome === "SAFE") setDoorHint(t("door.hint.unlocked"));
      else if (selectedDoorOutcome === "CURSE") setDoorHint(t("door.hint.curse"));
      else if (selectedDoorOutcome === "MONSTER") setDoorHint(t("door.hint.monster"));
      else setDoorHint(t("door.hint.start"));
    }
  }, [allCluesFound, beachGateUnlocked, currentLang, scene, selectedDoorOutcome, t]);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }, []);

  const stopIntroSceneOneAudio = useCallback(() => {
    if (introRainTimeoutRef.current !== null) {
      window.clearTimeout(introRainTimeoutRef.current);
      introRainTimeoutRef.current = null;
    }

    const refs = introAudioRefs.current;

    (Object.keys(refs) as Array<keyof IntroAudioRefs>).forEach((key) => {
      const audio = refs[key];
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      refs[key] = null;
    });

    introAudioStartedRef.current = false;
  }, []);

  const startIntroSceneOneAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (introAudioStartedRef.current) return;

    const room = new Audio(INTRO_AUDIO.room);
    room.preload = "auto";
    room.loop = true;
    room.volume = 0.22;

    const hum = new Audio(INTRO_AUDIO.hum);
    hum.preload = "auto";
    hum.loop = true;
    hum.volume = 0.18;
    hum.addEventListener("loadedmetadata", () => {
      hum.currentTime = 10;
    });

    const typing = new Audio(INTRO_AUDIO.typing);
    typing.preload = "auto";
    typing.loop = false;
    typing.volume = 0.34;
    typing.playbackRate = 0.74;

    const rainThunder = new Audio(INTRO_AUDIO.rainThunder);
    rainThunder.preload = "auto";
    rainThunder.loop = false;
    rainThunder.volume = 0.12;

    introAudioRefs.current = {
      room,
      hum,
      typing,
      rainThunder,
    };
    introAudioStartedRef.current = true;

    void room.play().catch(() => undefined);
    void hum.play().catch(() => undefined);
    void typing.play().catch(() => undefined);
    void rainThunder.play().catch(() => undefined);
    introRainTimeoutRef.current = window.setTimeout(() => {
      rainThunder.pause();
      rainThunder.currentTime = 0;
      introRainTimeoutRef.current = null;
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
      stopIntroSceneOneAudio();
    };
  }, [clearAllTimeouts, stopIntroSceneOneAudio]);

  useEffect(() => {
    if (scene === "INTRO" && introStep === 0 && !isTransitioning) {
      startIntroSceneOneAudio();
      return;
    }

    stopIntroSceneOneAudio();
  }, [scene, introStep, isTransitioning, startIntroSceneOneAudio, stopIntroSceneOneAudio]);

  useEffect(() => {
    if (scene !== "INTRO" || introStep !== 1) return;

    const glitch = new Audio(INTRO_AUDIO.glitch);
    glitch.preload = "auto";
    glitch.volume = 0.3;

    const timeoutId = window.setTimeout(() => {
      void glitch.play().catch(() => undefined);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
      glitch.pause();
      glitch.currentTime = 0;
    };
  }, [scene, introStep]);

  useEffect(() => {
    if (scene !== "INTRO" || introStep !== 2) return;

    const boom = new Audio(INTRO_AUDIO.redEyesBoom);
    boom.preload = "auto";
    boom.volume = 0.28;

    const timeoutId = window.setTimeout(() => {
      void boom.play().catch(() => undefined);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
      boom.pause();
      boom.currentTime = 0;
    };
  }, [scene, introStep]);

  const triggerDoorHitPulse = useCallback((pulseCount: 1 | 2) => {
    setDoorHitPulseKey((prev) => prev + 1);
    if (pulseCount === 2) {
      addTimeout(() => {
        setDoorHitPulseKey((prev) => prev + 1);
      }, 140);
    }
  }, [addTimeout]);

  const showDoorEventOverlay = useCallback((
    kind: "SAFE" | "MONSTER" | "CURSE",
    text: string,
    durationMs: number
  ) => {
    doorEventCounterRef.current += 1;
    const key = doorEventCounterRef.current;
    setDoorEventOverlay({ key, kind, text });
    addTimeout(() => {
      setDoorEventOverlay((current) => (current?.key === key ? null : current));
    }, durationMs);
  }, [addTimeout]);

  const playStaticIfAvailable = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const staticAudio = new Audio("/audio/sfx/static.mp3");
      staticAudio.volume = 0.12;
      void staticAudio.play().catch(() => undefined);
    } catch {
    }
  }, []);

  const playDoorSfx = useCallback((src: string, volume = 0.5, playbackRate = 1) => {
    if (typeof window === "undefined") return;
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.playbackRate = playbackRate;
      void audio.play().catch(() => undefined);
    } catch {
    }
  }, []);

  const triggerShake = useCallback((strength: 1 | 2) => {
    setShake(strength);
    addTimeout(() => setShake(0), strength === 2 ? 320 : 180);
  }, [addTimeout]);

  const preloadBeachEntryAssets = useCallback(() => {
    if (!beachPreloadPromiseRef.current) {
      beachPreloadPromiseRef.current = preloadImageSources(BEACH_ENTRY_PRELOAD_SOURCES);
    }
    return beachPreloadPromiseRef.current;
  }, []);

  const transitionIntroToBeach = useCallback(() => {
    if (isTransitioning) return;

    const transitionToken = introToBeachTransitionTokenRef.current + 1;
    introToBeachTransitionTokenRef.current = transitionToken;
    setIsTransitioning(true);
    setFadeOn(true);
    setMoveDir(0);

    addTimeout(() => {
      void preloadBeachEntryAssets().finally(() => {
        if (introToBeachTransitionTokenRef.current !== transitionToken) return;
        setBeachSceneResetKey((prev) => prev + 1);
        setScene("BEACH");
        addTimeout(() => {
          if (introToBeachTransitionTokenRef.current !== transitionToken) return;
          setFadeOn(false);
          setIsTransitioning(false);
        }, SCENE_FADE_MS);
      });
    }, SCENE_FADE_MS);
  }, [addTimeout, isTransitioning, preloadBeachEntryAssets]);

  const goWithFade = useCallback((nextScene: Scene) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setFadeOn(true);
    setMoveDir(0);

    if (nextScene === "ELEVATOR") {
      setElevatorSceneResetKey((prev) => prev + 1);
    }

    addTimeout(() => setScene(nextScene), 520);
    addTimeout(() => {
      setFadeOn(false);
      setIsTransitioning(false);
    }, 980);
  }, [addTimeout, isTransitioning]);

  const resetFullGameState = () => {
    introToBeachTransitionTokenRef.current += 1;
    clearAllTimeouts();
    stopIntroSceneOneAudio();

    setScene("MENU");
    setIntroStep(0);

    setFadeOn(false);
    setIsTransitioning(false);
    setShake(0);

    setClues(INITIAL_CLUES);
    setSelectedClue(null);
    setBeachHint(t("beach.hint.start"));
    setRedLightUnlocked(false);
    setRedLightPhase("IDLE");
    setTamayPos(START_POS);
    setCameraPos(clamp(START_POS - 18, 0, PATH_LEN - PATH_VIEW));
    setMoveDir(0);
    setJournalOpen(false);
    setWalkClock(0);
    setWalkBlend(0);

    setPuzzles(INITIAL_PUZZLES);
    setPuzzleFeedback("");
    setBeachPuzzleOpen(false);
    setBeachPuzzleInput("");
    setBeachPuzzleFeedback("");
    setBeachGateUnlocked(false);

    setLevel(1);
    setRoom(1);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(false);
    setCarryoverCurseActive(false);
    setCarryoverCursePending(false);
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setSelectedDoorOutcome(null);
    setDoorHitPulseKey(0);
    setDoorInputLocked(false);
    setDoorHint(t("door.hint.start"));
    setLastOutcome(null);
    setDoorEventOverlay(null);
  };

  const startNewRun = () => {
    resetFullGameState();
    setScene("INTRO");
  };

  const skipIntro = useCallback(() => {
    setIntroStep(introLines.length - 1);
    transitionIntroToBeach();
  }, [introLines.length, transitionIntroToBeach]);

  const jumpToBeachWorld = useCallback(() => {
    introToBeachTransitionTokenRef.current += 1;
    clearAllTimeouts();
    stopIntroSceneOneAudio();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setBeachSceneResetKey((prev) => prev + 1);
    setScene("BEACH");
  }, [clearAllTimeouts, stopIntroSceneOneAudio]);

  const jumpToTunnel = useCallback(() => {
    introToBeachTransitionTokenRef.current += 1;
    clearAllTimeouts();
    stopIntroSceneOneAudio();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setScene("TUNNEL");
  }, [clearAllTimeouts, stopIntroSceneOneAudio]);

  const jumpToDoorGame = useCallback(() => {
    introToBeachTransitionTokenRef.current += 1;
    clearAllTimeouts();
    stopIntroSceneOneAudio();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setLevel(1);
    setRoom(1);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(false);
    setCarryoverCurseActive(false);
    setCarryoverCursePending(false);
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setSelectedDoorOutcome(null);
    setDoorHitPulseKey(0);
    setDoorInputLocked(false);
    setLastOutcome(null);
    setDoorHint(t("door.hint.start"));
    setDoorEventOverlay(null);
    setScene("DOOR_GAME");
  }, [clearAllTimeouts, stopIntroSceneOneAudio, t]);

  const jumpToElevator = useCallback(() => {
    introToBeachTransitionTokenRef.current += 1;
    clearAllTimeouts();
    stopIntroSceneOneAudio();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setElevatorSceneResetKey((prev) => prev + 1);
    setScene("ELEVATOR");
  }, [clearAllTimeouts, stopIntroSceneOneAudio]);

  useEffect(() => {
    if (!devToolsEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.code === "F1") {
        event.preventDefault();
        jumpToBeachWorld();
      } else if (event.code === "F2") {
        event.preventDefault();
        jumpToTunnel();
      } else if (event.code === "F3") {
        event.preventDefault();
        jumpToDoorGame();
      } else if (event.code === "F4") {
        event.preventDefault();
        jumpToElevator();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [devToolsEnabled, jumpToBeachWorld, jumpToDoorGame, jumpToTunnel, jumpToElevator]);

  // when BEACH opens, snap camera near player start (only once on entry)
  useEffect(() => {
    if (scene === "BEACH") {
      setCameraPos(clamp(tamayPosRef.current - 18, 0, PATH_LEN - PATH_VIEW));
      setWalkBlend(0);
      setBeachPuzzleOpen(false);
    }
  }, [scene]);

  // BEACH movement loop (player position)
  useEffect(() => {
    if (scene !== "BEACH") return;
    if (moveDir === 0) return;
    if (selectedClue || beachPuzzleOpen) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;

      const speed = moveDir === 1 ? 0.034 : 0.03;
      setTamayPos((p) => clamp(p + moveDir * dt * speed, 5, PATH_LEN - 4));

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [scene, moveDir, selectedClue, beachPuzzleOpen]);

  // BEACH camera lag + gait feeling loop
  useEffect(() => {
    if (scene !== "BEACH") return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;

      const moving = moveDirRef.current !== 0 && !beachModalLockedRef.current;
      const dir = moveDirRef.current;

      setWalkBlend((prev) => {
        const target = moving ? 1 : 0;
        const k = moving ? 0.18 : 0.11;
        return prev + (target - prev) * (1 - Math.exp(-dt * k));
      });

      setWalkClock((prev) => prev + dt * (moving ? (dir === 1 ? 0.024 : 0.018) : 0.006));

      setCameraPos((prev) => {
        const tPos = tamayPosRef.current;
        const forwardLook = dir === 1 ? 6 : dir === -1 ? -1.5 : 2;
        const target = clamp(tPos - 18 + forwardLook, 0, PATH_LEN - PATH_VIEW);
        const lerp = 1 - Math.exp(-dt * 0.08);
        return prev + (target - prev) * lerp;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [scene]);

  // all clues -> red light unlock
  useEffect(() => {
    if (scene !== "BEACH") return;
    if (!allCluesFound) return;
    if (redLightUnlocked) return;

    setRedLightUnlocked(true);
    setRedLightPhase("SHOW_TEXT");
    setBeachHint(t("beach.hint.redLightRising"));
    triggerShake(1);

    addTimeout(() => setBeachHint(t("beach.hint.innerVoice")), 1100);
    addTimeout(() => {
      setRedLightPhase("READY");
      setBeachHint(t("beach.hint.readyToTunnel"));
      triggerShake(1);
    }, 2300);
  }, [scene, allCluesFound, redLightUnlocked, triggerShake, addTimeout, t]);

  useEffect(() => {
    if (scene !== "BEACH") return;
    if (!allCluesFound) {
      setBeachPuzzleOpen(false);
      setBeachPuzzleInput("");
      setBeachPuzzleFeedback("");
      setBeachGateUnlocked(false);
      return;
    }

    if (beachGateUnlocked) {
      setRedLightPhase("READY");
      return;
    }

    setRedLightPhase("SHOW_TEXT");
    if (!beachPuzzleOpen) {
      setBeachHint(t("beach.hint.collectReady"));
    }
  }, [scene, allCluesFound, beachGateUnlocked, beachPuzzleOpen, t]);

  const openClue = useCallback((key: ClueKey) => {
    if (scene !== "BEACH" || isTransitioning) return;
    setMoveDir(0);
    setBeachPuzzleOpen(false);
    setPuzzleFeedback("");
    setSelectedClue(key);
  }, [isTransitioning, scene]);

  const closeClueModal = () => {
    setSelectedClue(null);
    setPuzzleFeedback("");
  };

  const openBeachPuzzle = useCallback(() => {
    if (!canOpenBeachPuzzle) return;
    setMoveDir(0);
    setSelectedClue(null);
    setBeachPuzzleFeedback("");
    setBeachPuzzleOpen(true);
  }, [canOpenBeachPuzzle]);

  const closeBeachPuzzle = useCallback(() => {
    setBeachPuzzleOpen(false);
    setPuzzleFeedback("");
  }, []);

  const markClueSolved = (key: ClueKey) => {
    if (clues[key]) {
      closeClueModal();
      return;
    }

    setClues((prev) => ({ ...prev, [key]: true }));
    setSelectedClue(null);
    setPuzzleFeedback("");

    const obj = objectByKey[key];
    const nextCount = inspectedCount + 1;
    setBeachHint(`${obj.label} çözüldü (${nextCount}/5). ${obj.shortHint}`);
  };

  const pushBeachDigit = (digit: string) => {
    if (beachGateUnlocked) return;
    setBeachPuzzleInput((prev) => (prev.length >= BEACH_PUZZLE_CODE.length ? prev : `${prev}${digit}`));
    setBeachPuzzleFeedback("");
  };

  const clearBeachPuzzle = () => {
    setBeachPuzzleInput("");
    setBeachPuzzleFeedback("");
  };

  const backspaceBeachPuzzle = () => {
    setBeachPuzzleInput((prev) => prev.slice(0, -1));
    setBeachPuzzleFeedback("");
  };

  const submitBeachPuzzle = () => {
    if (beachPuzzleInput.length !== BEACH_PUZZLE_CODE.length) {
      setBeachPuzzleFeedback("Tum rakamlari gir.");
      return;
    }

    if (beachPuzzleInput !== BEACH_PUZZLE_CODE) {
      setBeachPuzzleFeedback("Kod yanlis. Kayitlari tekrar inceleyebilirsin.");
      return;
    }

    setBeachGateUnlocked(true);
    setBeachPuzzleOpen(false);
    setBeachPuzzleFeedback("");
    setBeachHint(t("beach.hint.beachGateUnlocked"));
    triggerShake(1);
  };

  const startBeachToTunnel = useCallback(() => {
    if (!allCluesFound) return;
    if (!canUseTunnelGate) return;
    if (!beachGateUnlocked) {
      openBeachPuzzle();
      return;
    }
    setBeachHint(t("beach.hint.enterTunnel"));
    goWithFade("TUNNEL");
  }, [allCluesFound, canUseTunnelGate, beachGateUnlocked, openBeachPuzzle, goWithFade, t]);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (scene !== "BEACH") return;

      const key = e.key.toLowerCase();
      if ((e.key === "ArrowUp" || key === "w") && !selectedClue && !beachPuzzleOpen) setMoveDir(1);
      if ((e.key === "ArrowDown" || key === "s") && !selectedClue && !beachPuzzleOpen) setMoveDir(-1);

      if (key === "e") {
        if (canInspect && interactableObject) {
          openClue(interactableObject.key);
        } else if (canUseTunnelGate) {
          startBeachToTunnel();
        }
      }
      if (key === "j") setJournalOpen((prev) => !prev);

      if (e.key === "Escape") {
        if (selectedClue) closeClueModal();
        if (beachPuzzleOpen) closeBeachPuzzle();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (scene !== "BEACH") return;
      const key = e.key.toLowerCase();
      if (e.key === "ArrowUp" || key === "w" || e.key === "ArrowDown" || key === "s") setMoveDir(0);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    scene,
    selectedClue,
    beachPuzzleOpen,
    canInspect,
    canUseTunnelGate,
    canOpenBeachPuzzle,
    interactableObject,
    canEnterTunnel,
    openClue,
    openBeachPuzzle,
    closeBeachPuzzle,
    startBeachToTunnel,
  ]);

  const startDoorGameFromElevator = () => {
    if (isTransitioning) return;

    setLevel(1);
    setRoom(1);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(false);
    setCarryoverCurseActive(false);
    setCarryoverCursePending(false);
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setSelectedDoorOutcome(null);
    setDoorHitPulseKey(0);
    setDoorInputLocked(false);
    setLastOutcome(null);
    setDoorHint(t("door.hint.start"));
    setDoorEventOverlay(null);

    goWithFade("DOOR_GAME");
  };

  const prepareNextRoom = (message: string) => {
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setSelectedDoorOutcome(null);
    setDoorHitPulseKey(0);
    setDoorInputLocked(false);
    setLastOutcome(null);
    setDoorEventOverlay(null);
    setDoorHint(message);
  };

  const handleDoorPick = (doorIndex: number) => {
    if (scene !== "DOOR_GAME") return;
    if (doorInputLocked) return;

    setDoorInputLocked(true);
    setSelectedDoor(doorIndex);

    const outcome = getDoorOutcome(doorIndex, roundLayout);
    setSelectedDoorOutcome(outcome);
    setLastOutcome(outcome);

    if (outcome === "SAFE") {
      setDoorHint(t("door.hint.unlocked"));
      showDoorEventOverlay("SAFE", t("door.event.unlocked"), 740);
      playDoorSfx(DOOR_AUDIO.safe, 0.42, 1);

      addTimeout(() => {
        setCarryoverCurseActive(carryoverCursePending);
        setCarryoverCursePending(false);
        setDoorInputLocked(false);
        setScene("DEMO_END");
      }, 760);
      return;
    }

    const damage = outcome === "CURSE" ? 2 : 1;
    if (outcome === "CURSE") {
      setCarryoverCursePending(true);
      showDoorEventOverlay("CURSE", t("door.event.curse"), 620);
      playDoorSfx(DOOR_AUDIO.curse, 0.5, 0.96);
    } else {
      showDoorEventOverlay("MONSTER", t("door.event.monster"), 620);
      playStaticIfAvailable();
      playDoorSfx(DOOR_AUDIO.monster, 0.56, 1);
    }
    const nextLives = clamp(lives - damage, 0, MAX_LIVES);
    setLives(nextLives);

    triggerDoorHitPulse(outcome === "CURSE" ? 2 : 1);
    triggerShake(outcome === "CURSE" ? 2 : 1);

    setDoorHint(outcome === "CURSE" ? t("door.hint.curse") : t("door.hint.monster"));

    setRoundLayout(createRoundLayout());

    addTimeout(() => {
      if (nextLives <= 0) {
        setDoorEventOverlay(null);
        setScene("GAME_OVER");
        setDoorInputLocked(false);
        return;
      }
      setCarryoverCurseActive((prev) => prev || carryoverCursePending || outcome === "CURSE");
      setSelectedDoor(null);
      setSelectedDoorOutcome(null);
      setDoorHitPulseKey(0);
      setDoorInputLocked(false);
      setDoorHint(t("door.hint.start"));
    }, 950);
  };

  const retryToMenu = () => {
    resetFullGameState();
    setScene("MENU");
  };

  const retryFromCheckpoint = () => {
    clearAllTimeouts();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setShake(0);

    setScene("DOOR_GAME");
    setLevel(CHECKPOINT_LEVEL);
    setRoom(1);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(true);
    setCarryoverCurseActive(false);
    setCarryoverCursePending(false);
    setDoorHitPulseKey(0);
    prepareNextRoom(t("door.hint.start"));
  };

  const getDoorClassName = (index: number) => {
    let cls = "door";
    if (selectedDoor === index) cls += " selected";
    if (carryoverCurseActive) cls += " corruption";
    if (selectedDoor === index && selectedDoorOutcome) {
      if (selectedDoorOutcome === "SAFE") cls += " safe";
      else if (selectedDoorOutcome === "CURSE") cls += " curse";
      else cls += " monster";
    }
    return cls;
  };

  const getDoorVisualLabel = (index: number) => {
    if (selectedDoor !== index || !selectedDoorOutcome) return "🚪";
    if (selectedDoorOutcome === "SAFE") return t("door.outcome.safe");
    if (selectedDoorOutcome === "CURSE") return t("door.outcome.curse");
    return t("door.outcome.monster");
  };

  const relToScreen = (worldPos: number, lane: number) => {
    const rel = worldPos - cameraPos;
    const nearBack = -14;
    const farMax = 150;
    const normalized = clamp((rel - nearBack) / (farMax - nearBack), 0, 1);
    const dist = 1 - normalized;
    const t = dist;
    const y = 17 + dist * 64;
    const baseHalfRoad = 6 + dist * 24;
    const x = 50 + lane * baseHalfRoad * 0.62;
    const scale = 0.54 + t * 1.2;
    const opacity = rel < -20 || rel > 158 ? 0 : 0.2 + t * 0.8;
    const visible = rel > -22 && rel < 158;
    return { rel, x, y, scale, opacity, visible, dist, t };
  };

  const tunnelProj = relToScreen(TUNNEL_POS, 0);
  const redLampProj = relToScreen(TUNNEL_POS + 6, 0);

  const moveStrength = walkBlend;
  const bob = Math.sin(walkClock) * 3.4 * moveStrength;
  const stride = Math.cos(walkClock * 0.5) * 1.8 * moveStrength;
  const tamayLift = (moveDir === 1 ? -10 : moveDir === -1 ? 2 : 0) * moveStrength;
  const tamayScale = 1 + (moveDir === 1 ? -0.02 : 0.008) * moveStrength;
  const tamayX = stride * 0.8;
  const camSwayX = Math.sin(walkClock * 0.45) * 1.2 * moveStrength;
  const camSwayY = Math.cos(walkClock * 0.9) * 0.8 * moveStrength;

  const canSolveNote =
    puzzles.noteSeq.length === 4 &&
    [2, 4, 1, 3].every((n, i) => puzzles.noteSeq[i] === n);

  const beachObjectsSolvedList = pathObjects.filter((o) => clues[o.key]).map((o) => o.label);
  const worldShakeClass = shake === 2 ? "shake2" : shake === 1 ? "shake1" : "";

  const NOTE_TARGET = [2, 4, 1, 3];

  const renderPuzzleContent = () => {
    if (!selectedClue) return null;
    const meta = objectByKey[selectedClue];
    const solved = clues[selectedClue];

    if (solved) {
      return (
        <div className="puzzleWrap">
          <div className="puzzleLore">
            <div className="puzzleLoreTitle">{meta.loreTitle}</div>
            <div className="puzzleLoreText">{meta.loreText}</div>
          </div>
          <div className="rowEnd">
            <button className="btn" onClick={closeClueModal} type="button">
              Kapat
            </button>
          </div>
        </div>
      );
    }

    switch (selectedClue) {
      case "band": {
        const canSolve = puzzles.bandScrub >= 85;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Tuz ve kiri temizle. Kod görünür hale gelsin.</div>
            <div className="box">
              <div className="smallText">Temizlik: %{Math.round(puzzles.bandScrub)}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={puzzles.bandScrub}
                onChange={(e) => setPuzzles((p) => ({ ...p, bandScrub: Number(e.target.value) }))}
              />
            </div>
            <div className="smallText">
              {puzzles.bandScrub < 40 ? "Kirli" : puzzles.bandScrub < 85 ? "Kod seçiliyor..." : "Kod netleşti: D-05"}
            </div>
            <div className="rowEnd">
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("band")} disabled={!canSolve} type="button">
                {"Kaydı Al"}
              </button>
            </div>
          </div>
        );
      }

      case "recorder": {
        const tuned = Math.abs(puzzles.recorderTune - 73) <= 3;
        const canSolve = tuned && puzzles.recorderChecked;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Frekansı ayarla, sonra Dinle.</div>
            <div className="box">
              <div className="smallText">Frekans: {Math.round(puzzles.recorderTune)}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={puzzles.recorderTune}
                onChange={(e) =>
                  setPuzzles((p) => ({
                    ...p,
                    recorderTune: Number(e.target.value),
                    recorderChecked: false,
                  }))
                }
              />
            </div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setPuzzles((p) => ({ ...p, recorderChecked: true }));
                  setPuzzleFeedback(tuned ? "Ses kısa süreliğine netleşti." : "Hâlâ cızırtı var.");
                }}
              >
                Dinle
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("recorder")} disabled={!canSolve} type="button">
                {"Kaydı Al"}
              </button>
            </div>
          </div>
        );
      }

      case "note": {
        const push = (n: number) => {
          setPuzzles((p) => {
            const next = [...p.noteSeq, n];
            const prefixOk = NOTE_TARGET.slice(0, next.length).every((v, i) => v === next[i]);
            if (!prefixOk) {
              setPuzzleFeedback("Yanlış sırada. Parçalar dağıldı.");
              return { ...p, noteSeq: [] };
            }
            setPuzzleFeedback("");
            return { ...p, noteSeq: next };
          });
        };

        return (
          <div className="puzzleWrap">
            <div className="smallText">Parçaları doğru sırada hizala. (Yanlışta sıfırlanır)</div>
            <div className="box smallText">Sıra: {puzzles.noteSeq.length ? puzzles.noteSeq.join(" - ") : "boş"}</div>
            <div className="grid2">
              {[1, 2, 3, 4].map((n) => (
                <button className="btn" key={n} type="button" onClick={() => push(n)} disabled={canSolveNote}>
                  {"Parça"} {n}
                </button>
              ))}
            </div>
            <div className="smallText">İpucu: Köşedeki rüzgar izi, 2. parçayı öne itiyor.</div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setPuzzles((p) => ({ ...p, noteSeq: [] }));
                  setPuzzleFeedback("");
                }}
              >
                {"Sıfırla"}
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("note")} disabled={canSolveNote} type="button">
                {"Kaydı Al"}
              </button>
            </div>
          </div>
        );
      }

      case "phone": {
        const canSolve = puzzles.phonePin === "0510";

        const addDigit = (d: string) => {
          setPuzzles((p) => (p.phonePin.length >= 4 ? p : { ...p, phonePin: p.phonePin + d }));
          setPuzzleFeedback("");
        };

        const backspace = () => setPuzzles((p) => ({ ...p, phonePin: p.phonePin.slice(0, -1) }));

        return (
          <div className="puzzleWrap">
            <div className="smallText">4 haneli kodu gir. (İpucu: 5. kat + 10 döngü)</div>
            <div className="pinRow">
              {(puzzles.phonePin + "____")
                .slice(0, 4)
                .split("")
                .map((ch, i) => (
                  <div className="pinCell" key={i}>
                    {ch === "_" ? "•" : ch}
                  </div>
                ))}
            </div>
            <div className="grid3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "\u232b"].map((k) => (
                <button
                  className="btn"
                  key={String(k)}
                  type="button"
                  onClick={() => {
                    if (k === "C") {
                      setPuzzles((p) => ({ ...p, phonePin: "" }));
                      setPuzzleFeedback("");
                      return;
                    }
                    if (k === "\u232b") {
                      backspace();
                      return;
                    }
                    addDigit(String(k));
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => setPuzzleFeedback(canSolve ? "Kilit açıldı." : "Kod yanlış.")}
              >
                Kontrol Et
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("phone")} disabled={!canSolve} type="button">
                {"Kaydı Al"}
              </button>
            </div>
          </div>
        );
      }

      case "tag": {
        const canSolve = puzzles.tagUv && puzzles.tagDial === 5;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Kadranı 5'e getir ve UV aç.</div>
            <div className="box">
              <div style={{ fontSize: 26, fontWeight: 800, textAlign: "center" }}>{puzzles.tagDial}</div>
              <div className="grid3">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagDial: (p.tagDial + 9) % 10 }))}
                >
                  -1
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagDial: (p.tagDial + 1) % 10 }))}
                >
                  +1
                </button>
                <button
                  className={`btn ${puzzles.tagUv ? "danger" : ""}`}
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagUv: !p.tagUv }))}
                >
                  UV {puzzles.tagUv ? "Açık" : "Kapalı"}
                </button>
              </div>
            </div>
            <div className="smallText">
              {puzzles.tagUv ? (puzzles.tagDial === 5 ? "Yazı beliriyor..." : "UV var ama hizalama yanlış.") : "UV kapalı"}
            </div>
            <div className="rowEnd">
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("tag")} disabled={!canSolve} type="button">
                {"Kaydı Al"}
              </button>
            </div>
          </div>
        );
      }
    }
  };

  const renderBeachPuzzleContent = () => (
    <div className="puzzleWrap">
      <div className="smallText">Önce 5 ipucunu topla.</div>
      <div className="smallText">İpuçlarındaki rakamları doğru sırada gir.</div>
      <div className="smallText">Etkileşim: E</div>
      <div className="smallText">Toplanan ipucu: {inspectedCount}/5</div>
      <div className="box">
        <div className="smallText">Şifre Girdisi</div>
        <div className="pinRow">
          {(beachPuzzleInput + "_".repeat(BEACH_PUZZLE_CODE.length))
            .slice(0, BEACH_PUZZLE_CODE.length)
            .split("")
            .map((ch, idx) => (
              <div className="pinCell" key={`beach-pin-${idx}`}>
                {ch === "_" ? "•" : ch}
              </div>
            ))}
        </div>
      </div>
      <div className="grid3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "Temizle", 0, "Sil"].map((key) => (
          <button
            className="btn"
            key={`beach-key-${String(key)}`}
            type="button"
            onClick={() => {
              if (key === "Temizle") {
                clearBeachPuzzle();
                return;
              }
              if (key === "Sil") {
                backspaceBeachPuzzle();
                return;
              }
              pushBeachDigit(String(key));
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="rowEnd">
        <button className="btn" type="button" onClick={closeBeachPuzzle}>
          Geri
        </button>
        <button className="btn danger" type="button" onClick={submitBeachPuzzle}>
          Onayla
        </button>
      </div>
    </div>
  );

  const handleBeachTouchStart = (e: React.TouchEvent) => {
    if (selectedClue || beachPuzzleOpen) return;
    if ((e.target as HTMLElement).closest("button")) return;
    touchYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleBeachTouchMove = (e: React.TouchEvent) => {
    if (selectedClue || beachPuzzleOpen) return;
    if (touchYRef.current == null) return;
    const y = e.touches[0]?.clientY ?? touchYRef.current;
    const delta = y - touchYRef.current;
    if (Math.abs(delta) < 8) return;
    setMoveDir(delta < 0 ? 1 : -1);
    touchYRef.current = y;
  };

  const handleBeachTouchEnd = () => {
    touchYRef.current = null;
    setMoveDir(0);
  };

  return (
    <div className="app">
      {scene === "MENU" && <MenuScene onStart={startNewRun} />}

      {scene === "INTRO" && (
        <>
          <IntroScene
            worldShakeClass={worldShakeClass}
            introStep={introStep}
            introLines={introLines}
            onAdvance={() => {
              if (introStep < introLines.length - 1) setIntroStep((s) => s + 1);
              else transitionIntroToBeach();
            }}
            onSkip={skipIntro}
          />
          {!isTransitioning && (
            <button
              className="btn"
              type="button"
              onClick={skipIntro}
              style={{
                position: "fixed",
                right: 12,
                bottom: 16,
                zIndex: 1200,
                minWidth: 128,
                padding: "10px 14px",
                touchAction: "manipulation",
              }}
            >
              {t("intro.skip")}
            </button>
          )}
        </>
      )}

      {scene === "BEACH" && (
        <BeachScene
          key={beachSceneResetKey}
          worldShakeClass={worldShakeClass}
          inspectedCount={inspectedCount}
          pathProgressPercent={pathProgressPercent}
          redLightPhase={redLightPhase}
          onTouchStart={handleBeachTouchStart}
          onTouchMove={handleBeachTouchMove}
          onTouchEnd={handleBeachTouchEnd}
          camSwayX={camSwayX}
          camSwayY={camSwayY}
          cameraPos={cameraPos}
          moveStrength={moveStrength}
          redLightUnlocked={redLightUnlocked}
          sidePosts={sidePosts}
          relToScreen={relToScreen}
          tunnelProj={tunnelProj}
          redLampProj={redLampProj}
          clues={clues}
          interactableObject={interactableObject}
          targetHint={beachTargetHint}
          canInspect={canInspect}
          canEnterTunnel={canEnterTunnel}
          canOpenBeachPuzzle={false}
          beachPuzzleStatusLabel={beachPuzzleStatusLabel}
          selectedClue={selectedClue}
          moveDir={moveDir}
          tamayX={tamayX}
          tamayLift={tamayLift}
          bob={bob}
          tamayScale={tamayScale}
          stride={stride}
          onMoveDir={setMoveDir}
          onOpenClue={openClue}
          onOpenBeachPuzzle={openBeachPuzzle}
          onEnterTunnel={() => goWithFade("TUNNEL")}
          beachHint={beachHint}
          beachObjectsSolvedList={beachObjectsSolvedList}
          journalOpen={journalOpen}
          onToggleJournal={() => setJournalOpen((v) => !v)}
          onOpenWorld={() => setScene("BEACH")}
        />
      )}

      {scene === "BEACH_WORLD" && (
        <>
          <BeachWorld
            onBack={retryToMenu}
            onEnterTunnel={() => goWithFade("TUNNEL")}
            devToolsEnabled={devToolsEnabled}
            onSkipToDoorGame={jumpToDoorGame}
          />
          {import.meta.env.DEV && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 1390,
                display: "grid",
                placeItems: "center",
                color: "rgba(255,255,255,.22)",
                fontSize: "clamp(36px, 8vw, 92px)",
                fontWeight: 900,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              DEMO
            </div>
          )}
        </>
      )}

      {scene === "TUNNEL" && (
        <TunnelScene
          worldShakeClass={worldShakeClass}
          onEnterElevator={() => goWithFade("ELEVATOR")}
          devToolsEnabled={devToolsEnabled}
          onSkipToDoorGame={jumpToDoorGame}
        />
      )}

      {scene === "ELEVATOR" && (
        <ElevatorScene
          key={elevatorSceneResetKey}
          onTransitionComplete={startDoorGameFromElevator}
        />
      )}

      {scene === "DOOR_GAME" && (
        <DoorGameScene
          worldShakeClass={worldShakeClass}
          level={level}
          room={room}
          roomsPerFloor={ROOMS_PER_FLOOR}
          lives={lives}
          maxLives={MAX_LIVES}
          corruptionActive={carryoverCurseActive}
          checkpointUnlocked={checkpointUnlocked}
          checkpointLevel={CHECKPOINT_LEVEL}
          doorCount={DOOR_COUNT}
          doorInputLocked={doorInputLocked}
          hitPulseKey={doorHitPulseKey}
          eventOverlay={doorEventOverlay}
          getDoorClassName={getDoorClassName}
          getDoorVisualLabel={getDoorVisualLabel}
          onDoorPick={handleDoorPick}
          doorHint={doorHint}
          lastOutcome={lastOutcome}
          levelConfig={getLevelConfig(level)}
          showHotspots={showHotspots}
        />
      )}

      {scene === "DEMO_END" && <DemoEndScene onBackToMenu={retryToMenu} />}

      {scene === "GAME_OVER" && (
        <GameOverScene
          level={level}
          checkpointUnlocked={checkpointUnlocked}
          checkpointLevel={CHECKPOINT_LEVEL}
          onRetryFromCheckpoint={retryFromCheckpoint}
          onRetryToMenu={retryToMenu}
        />
      )}

      {scene === "WIN" && (
        <WinScene maxLevel={episodeMaxFloor} lives={lives} onStartNewRun={startNewRun} onRetryToMenu={retryToMenu} />
      )}

      {selectedClue && (
        <PuzzleModal clueLabel={objectByKey[selectedClue].label} puzzleFeedback={puzzleFeedback} onClose={closeClueModal}>
          {renderPuzzleContent()}
        </PuzzleModal>
      )}

      {beachPuzzleOpen && (
        <PuzzleModal clueLabel={t("beach.modal.beachPanel")} puzzleFeedback={beachPuzzleFeedback} onClose={closeBeachPuzzle}>
          {renderBeachPuzzleContent()}
        </PuzzleModal>
      )}

      {devToolsEnabled && (
        <div
          style={{
            position: "fixed",
            top: 10,
            right: 10,
            zIndex: 1400,
            display: "grid",
            gap: 6,
            padding: "8px",
            width: 150,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(8,11,16,.82)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: ".06em", opacity: 0.78, textTransform: "uppercase" }}>
            Test Paneli
          </div>
          <button className="btn ghost" type="button" onClick={jumpToBeachWorld}>
            Sahile Atla
          </button>
          {import.meta.env.DEV && (
            <button className="btn ghost" type="button" onClick={() => setScene("BEACH_WORLD")}>
              Demo
            </button>
          )}
          <button className="btn ghost" type="button" onClick={jumpToTunnel}>
            {"Tünele Atla"}
          </button>
          <button className="btn ghost" type="button" onClick={jumpToDoorGame}>
            {"Kapılara Atla"}
          </button>
          <button className="btn ghost" type="button" onClick={jumpToElevator}>
            Asansöre Atla
          </button>
          <button className="btn ghost" type="button" onClick={() => setShowHotspots((prev) => !prev)}>
            {`KP Debug: ${showHotspots ? "Açık" : "Kapalı"}`}
          </button>
        </div>
      )}

      <div className={`fade ${fadeOn ? "on" : ""}`} />
    </div>
  );
}
