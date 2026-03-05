import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, TouchEvent } from "react";
import type { ClueKey, CluesState, PathObject } from "../game/types";
import { useI18n } from "../i18n";

type WorldProjection = {
  rel: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  visible: boolean;
  dist: number;
  t: number;
};

type SidePost = {
  pos: number;
  lane: -2 | 2;
  heightBias: number;
};

type BeachSceneProps = {
  worldShakeClass: string;
  inspectedCount: number;
  pathProgressPercent: number;
  redLightPhase: "IDLE" | "SHOW_TEXT" | "READY";
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  camSwayX: number;
  camSwayY: number;
  cameraPos: number;
  moveStrength: number;
  redLightUnlocked: boolean;
  sidePosts: SidePost[];
  relToScreen: (worldPos: number, lane: number) => WorldProjection;
  tunnelProj: WorldProjection;
  redLampProj: WorldProjection;
  clues: CluesState;
  interactableObject: PathObject | null;
  targetHint: string;
  canInspect: boolean;
  canEnterTunnel: boolean;
  canOpenBeachPuzzle: boolean;
  beachPuzzleStatusLabel: string;
  selectedClue: ClueKey | null;
  moveDir: -1 | 0 | 1;
  tamayX: number;
  tamayLift: number;
  bob: number;
  tamayScale: number;
  stride: number;
  onMoveDir: (dir: -1 | 0 | 1) => void;
  onOpenClue: (key: ClueKey) => void;
  onOpenBeachPuzzle: () => void;
  onEnterTunnel: () => void;
  beachHint: string;
  beachObjectsSolvedList: string[];
  journalOpen: boolean;
  onToggleJournal: () => void;
  onOpenWorld?: () => void;
};

type HotspotPosition = {
  left: number;
  top: number;
};

type BeachHotspot = {
  id: string;
  label: string;
  obj: string;
  pos: HotspotPosition;
  renderSprite?: boolean;
};

type BeachSceneStep = {
  id: string;
  run: 1 | 2;
  scene: string;
  bg: string;
  hotspots: BeachHotspot[];
};

type DragMeta = {
  pointerId: number;
  hotspotId: string;
  sceneId: string;
};

type PosToast = {
  label: string;
  copyText: string;
};

const PUZZLE_SEQUENCE = ["moon", "lighthouse", "sun", "star"] as const;
type S1PuzzlePiece = (typeof PUZZLE_SEQUENCE)[number];
type B0HitboxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type B0BgVariant = "key" | "nokey";

const FADE_MS = 500;
const FADE_HALF_MS = Math.floor(FADE_MS / 2);
const B0_FOG_START_OPACITY = 2.95;
const B0_FOG_END_OPACITY = 0.01;
const B0_FOG_FADE_MS = 12000;
const B0_BG_KEY_PRIMARY = "/assets/img/beach/beach_b0_key.png";
const B0_BG_NOKEY_PRIMARY = "/assets/img/beach/beach_b0_nokey.png";
const B0_BG_KEY_FALLBACK = "/assets/img/beach/beach_b0_v2_with_key.png";
const B0_BG_NOKEY_FALLBACK = "/assets/img/beach/beach_b0_v2.png";
const B0_BACKGROUND_HAS_NOTE = false;
const B0_RENDER_NOTE_SPRITE = !B0_BACKGROUND_HAS_NOTE;
const B0_AMBIENT_SRC = "/assets/audio/b0_ambience.mp3";
const B0_AMBIENT_VOLUME = 0.3;
const B0_AMBIENT_FADE_IN_MS = 1000;
const B0_AMBIENT_FADE_OUT_MS = 650;
const B0_AMBIENT_VISIBILITY_FADE_MS = 220;
const S1_PUZZLE_PIECES: readonly S1PuzzlePiece[] = PUZZLE_SEQUENCE;
const S1_PUZZLE_TARGET: readonly S1PuzzlePiece[] = PUZZLE_SEQUENCE;
const S1_PUZZLE_ICONS: Record<S1PuzzlePiece, { src: string; labelKey: string }> = {
  moon: { src: "/images/icon/puzzle/moon_256.png", labelKey: "beach.puzzle.icon.moon" },
  lighthouse: { src: "/images/icon/puzzle/lighthouse_256.png", labelKey: "beach.puzzle.icon.lighthouse" },
  sun: { src: "/images/icon/puzzle/sun_256.png", labelKey: "beach.puzzle.icon.sun" },
  star: { src: "/images/icon/puzzle/star_256.png", labelKey: "beach.puzzle.icon.star" },
};
const S1_TOUCH_FEEDBACK_MS = 140;
const S1_GLITCH_MS = 200;
const S1_SUCCESS_FEEDBACK_MS = 320;
const S1_UNLOCK_FEEDBACK_MS = 1200;
const B0_LOCKED_FEEDBACK_MS = 1500;
const B0_LOCKED_FEEDBACK_FADE_MS = 240;
const B0_HATCH_ID = "B0_HATCH";
const B0_HATCH_SRC = "/image/object/hatch.png";
const B0_HATCH_DEFAULT_POS: HotspotPosition = { left: 55, top: 78 };
const B0_HATCH_BASE_SIZE = 92;
const B0_HATCH_SCALE = 3.4;
const B0_HATCH_MOBILE_SCALE = 3.8;
const B0_HATCH_MOBILE_BREAKPOINT = 768;
const B0_HATCH_REVEAL_MS = 420;
const B0_HATCH_HINT_MS = 1000;
const B0_NOTE_HIT: B0HitboxRect = { left: 46, top: 66, width: 20, height: 20 };
const B0_KEY_HIT: B0HitboxRect = { left: 55.2, top: 67.9, width: 14, height: 14 };
const OBJECT_VISUAL_TUNING = {
  toneFilter: "brightness(0.9) contrast(0.95) saturate(0.8)",
  hazeBlur: "blur(0.2px)",
  dropShadow: "drop-shadow(0 9px 8px rgba(0,0,0,0.34))",
  contactOverlay:
    "linear-gradient(to top, rgba(160,150,140,0.35) 0%, rgba(160,150,140,0.10) 25%, rgba(0,0,0,0) 55%)",
} as const;

const BEACH_STEPS: readonly BeachSceneStep[] = [
  {
    id: "run1-b0",
    run: 1,
    scene: "B0",
    bg: B0_BG_KEY_PRIMARY,
    hotspots: [
      {
        id: "S1_KEY",
        label: "Anahtar",
        obj: "/assets/img/beach/obj1_key.png",
        pos: { left: 62.2, top: 74.9 },
        renderSprite: false,
      },
      {
        id: "S1_NOTE",
        label: "Not",
        obj: "/assets/img/beach/obj3_note.png",
        pos: { left: 77.3, top: 84.4 },
        renderSprite: B0_RENDER_NOTE_SPRITE,
      },
    ],
  },
  {
    id: "run1-s1",
    run: 1,
    scene: "S1",
    bg: "/assets/img/beach/beach_s1.png",
    hotspots: [],
  },
  {
    id: "run1-s2",
    run: 1,
    scene: "S2",
    bg: "/assets/img/beach/beach_s2.png",
    hotspots: [
      {
        id: "S2_BADGE",
        label: "Rozet",
        obj: "/assets/img/beach/obj2_badge.png",
        pos: { left: 84.1, top: 88.1 },
      },
    ],
  },
  {
    id: "run1-s3",
    run: 1,
    scene: "S3",
    bg: "/assets/img/beach/beach_s3.png",
    hotspots: [
      {
        id: "S3_NOTE",
        label: "Not",
        obj: "/assets/img/beach/obj3_note.png",
        pos: { left: 88.5, top: 91.2 },
      },
    ],
  },
  {
    id: "run2-s4",
    run: 2,
    scene: "S4",
    bg: "/assets/img/beach/beach_s4.png",
    hotspots: [
      {
        id: "S4_WATCH",
        label: "Saat",
        obj: "/assets/img/beach/obj4_watch.png",
        pos: { left: 52.7, top: 84.6 },
      },
    ],
  },
  {
    id: "run2-s5",
    run: 2,
    scene: "S5",
    bg: "/assets/img/beach/beach_s2.png",
    hotspots: [
      {
        id: "S5_PLATE",
        label: "Plaka",
        obj: "/assets/img/beach/obj5_plate.png",
        pos: { left: 83.2, top: 89.8 },
      },
    ],
  },
] as const;

const HATCH_STEP = {
  id: "hatch",
  scene: "HATCH",
  bg: "/assets/img/beach/beach_s4.png",
  hotspots: [
    {
      id: "HATCH",
      label: "Hatch",
      obj: B0_HATCH_SRC,
      pos: B0_HATCH_DEFAULT_POS,
      renderSprite: true,
    },
  ],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shufflePieces<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function BeachScene({
  worldShakeClass,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onEnterTunnel,
}: BeachSceneProps) {
  const { t, tLines } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [hatchVisible, setHatchVisible] = useState(false);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(() => new Set());

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTarget, setOverlayTarget] = useState<"scene" | "hatch" | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<BeachHotspot | null>(null);

  const [fadeOn, setFadeOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transitionText, setTransitionText] = useState<string | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [s1PuzzleOpen, setS1PuzzleOpen] = useState(false);
  const [s1PuzzleSolved, setS1PuzzleSolved] = useState(false);
  const [s1PuzzleAdvancing, setS1PuzzleAdvancing] = useState(false);
  const [s1PuzzleStatus, setS1PuzzleStatus] = useState<string | null>(null);
  const [s1PuzzleInput, setS1PuzzleInput] = useState<S1PuzzlePiece[]>([]);
  const [s1PuzzleDisplayPieces, setS1PuzzleDisplayPieces] = useState<S1PuzzlePiece[]>(() => [...S1_PUZZLE_PIECES]);
  const [s1PuzzlePulsePiece, setS1PuzzlePulsePiece] = useState<S1PuzzlePiece | null>(null);
  const [s1PuzzleGlitchOn, setS1PuzzleGlitchOn] = useState(false);
  const [s1PuzzleSuccessOn, setS1PuzzleSuccessOn] = useState(false);
  const [puzzleError, setPuzzleError] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(false);
  const [s1PuzzlePanel, setS1PuzzlePanel] = useState<"PUZZLE" | "NOTE">("PUZZLE");
  const [b0LockedToastMounted, setB0LockedToastMounted] = useState(false);
  const [b0LockedToastVisible, setB0LockedToastVisible] = useState(false);
  const [b0HatchVisible, setB0HatchVisible] = useState(false);
  const [b0HatchRevealOn, setB0HatchRevealOn] = useState(false);
  const [b0HatchHintVisible, setB0HatchHintVisible] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${B0_HATCH_MOBILE_BREAKPOINT}px)`).matches;
  });
  const [fogOpacity, setFogOpacity] = useState(B0_FOG_START_OPACITY);
  const [b0BgFallback, setB0BgFallback] = useState<{ key: boolean; nokey: boolean }>({
    key: false,
    nokey: false,
  });

  const [posMode, setPosMode] = useState(false);
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [devHotspotPositions, setDevHotspotPositions] = useState<Record<string, HotspotPosition>>({});
  const [posToast, setPosToast] = useState<PosToast | null>(null);

  const dragRef = useRef<DragMeta | null>(null);
  const timersRef = useRef<number[]>([]);
  const posToastTimerRef = useRef<number | null>(null);
  const fogRafRef = useRef<number | null>(null);
  const fogStartTimeRef = useRef<number | null>(null);
  const fogAnimActiveRef = useRef(false);
  const b0AmbientAudioRef = useRef<HTMLAudioElement | null>(null);
  const b0AmbientFadeRafRef = useRef<number | null>(null);
  const b0AmbientMissingRef = useRef(false);
  const b0AmbientWarnedRef = useRef(false);
  const b0AmbientPendingAutoStartRef = useRef(false);
  const b0AmbientMutedAutoplayRef = useRef(false);
  const b0AmbientGestureUnlockedRef = useRef(false);
  const b0AmbientResumeOnVisibleRef = useRef(false);
  const b0LockedToastHideTimeoutRef = useRef<number | null>(null);
  const b0LockedToastUnmountTimeoutRef = useRef<number | null>(null);

  const isDev = import.meta.env.DEV;

  const currentStep = BEACH_STEPS[Math.min(stepIndex, BEACH_STEPS.length - 1)];
  const activeStep = hatchVisible
    ? {
        id: HATCH_STEP.id,
        run: 2 as const,
        scene: HATCH_STEP.scene,
        bg: HATCH_STEP.bg,
        hotspots: HATCH_STEP.hotspots,
      }
    : currentStep;

  const allCollectibleCount = useMemo(() => {
    const ids = new Set<string>();
    for (const step of BEACH_STEPS) {
      for (const hotspot of step.hotspots) {
        ids.add(hotspot.id);
      }
    }
    return ids.size;
  }, []);

  const runLabel = hatchVisible ? "RUN2" : currentStep.run === 1 ? "RUN1" : "RUN2";
  const activeSceneId = activeStep.scene;
  const isB0Scene = activeSceneId === "B0";
  const keyCollected = collectedIds.has("S1_KEY");
  const b0BgVariant: B0BgVariant = keyCollected ? "nokey" : "key";
  const activeBgSrc = isB0Scene
    ? b0BgVariant === "key"
      ? b0BgFallback.key
        ? B0_BG_KEY_FALLBACK
        : B0_BG_KEY_PRIMARY
      : b0BgFallback.nokey
        ? B0_BG_NOKEY_FALLBACK
        : B0_BG_NOKEY_PRIMARY
    : activeStep.bg;
  const activeSceneHotspots = activeStep.hotspots;
  const visibleHotspots = posMode
    ? activeSceneHotspots
    : activeSceneHotspots.filter((hotspot) => !collectedIds.has(hotspot.id));
  const b0KeyHotspot = useMemo(
    () => (isB0Scene ? visibleHotspots.find((hotspot) => hotspot.id === "S1_KEY") ?? null : null),
    [isB0Scene, visibleHotspots]
  );
  const b0NoteHotspot = useMemo(
    () => (isB0Scene ? visibleHotspots.find((hotspot) => hotspot.id === "S1_NOTE") ?? null : null),
    [isB0Scene, visibleHotspots]
  );
  const b0HatchPosition = useMemo(
    () => (posMode ? devHotspotPositions[B0_HATCH_ID] ?? B0_HATCH_DEFAULT_POS : B0_HATCH_DEFAULT_POS),
    [devHotspotPositions, posMode]
  );
  const b0HatchScale = isMobileViewport ? B0_HATCH_MOBILE_SCALE : B0_HATCH_SCALE;
  const b0HatchSizePx = useMemo(() => Math.round(B0_HATCH_BASE_SIZE * b0HatchScale), [b0HatchScale]);

  const b0ItemsVisibleCount = activeSceneId === "B0" ? visibleHotspots.length : 0;
  const collectedCount = collectedIds.size;
  const bgName = useMemo(() => {
    const parts = activeBgSrc.split("/");
    return parts[parts.length - 1] ?? activeBgSrc;
  }, [activeBgSrc]);
  const b0NoteTitle = t("beach.note.title");
  const b0NoteLines = useMemo(() => tLines("beach.note.lines"), [tLines]);
  const b0NoteTitleParts = useMemo(() => {
    const divider = " — ";
    if (!b0NoteTitle.includes(divider)) return null;
    const [glitchPart, ...rest] = b0NoteTitle.split(divider);
    if (!glitchPart || rest.length === 0) return null;
    const suffix = rest.join(divider).trim();
    if (!suffix) return null;
    return { glitchPart: glitchPart.trim(), suffix: `— ${suffix}` };
  }, [b0NoteTitle]);
  const b0NoteTitleNode = b0NoteTitleParts ? (
    <>
      <span className="glitch" data-text={b0NoteTitleParts.glitchPart}>
        {b0NoteTitleParts.glitchPart}
      </span>{" "}
      <span>{b0NoteTitleParts.suffix}</span>
    </>
  ) : (
    b0NoteTitle
  );
  const getHotspotLabel = useCallback(
    (hotspot: BeachHotspot) => {
      if (hotspot.id === "S1_KEY") return t("beach.overlay.rustyKeyTitle");
      if (hotspot.id === "S1_NOTE") return t("beach.note.title");
      if (hotspot.id === B0_HATCH_ID) return t("beach.tunnelLabel");
      return hotspot.label;
    },
    [t]
  );

  const isS1KeyPanel = overlayTarget === "scene" && selectedHotspot?.id === "S1_KEY";
  const isS1NotePanel = overlayTarget === "scene" && selectedHotspot?.id === "S1_NOTE";
  const overlayTitle = isS1KeyPanel
    ? t("beach.overlay.rustyKeyTitle")
    : isS1NotePanel
      ? b0NoteTitleNode
      : overlayTarget === "hatch"
        ? t("beach.overlay.hatchTitle")
        : t("beach.overlay.inspectTitle");
  const overlayDescription = isS1KeyPanel
    ? t("beach.overlay.keyDesc")
    : overlayTarget === "hatch"
      ? t("beach.overlay.hatchDesc")
      : t("beach.overlay.defaultDesc");
  const overlayButtonLabel = overlayTarget === "hatch" ? t("beach.overlay.closeAndEnter") : t("common.close");

  const pulsePhase = pulseTick * (Math.PI / 10);
  const pulseWave = (Math.sin(pulsePhase) + 1) / 2;
  const pulseScale = 1 + pulseWave * 0.03;
  const pulseOpacity = 0.92 + pulseWave * 0.04;
  const shadowOpacity = 0.78 + pulseWave * 0.12;

  const getHotspotPosition = useCallback(
    (hotspot: BeachHotspot) => (posMode ? (devHotspotPositions[hotspot.id] ?? hotspot.pos) : hotspot.pos),
    [devHotspotPositions, posMode]
  );

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const stopFogAnimation = useCallback(() => {
    if (fogRafRef.current !== null) {
      window.cancelAnimationFrame(fogRafRef.current);
      fogRafRef.current = null;
    }
    fogStartTimeRef.current = null;
    fogAnimActiveRef.current = false;
  }, []);

  const onB0ImageError = useCallback((variant: B0BgVariant) => {
    setB0BgFallback((prev) => {
      if (prev[variant]) return prev;
      return {
        ...prev,
        [variant]: true,
      };
    });
  }, []);

  const stopB0AmbientFade = useCallback(() => {
    if (b0AmbientFadeRafRef.current !== null) {
      window.cancelAnimationFrame(b0AmbientFadeRafRef.current);
      b0AmbientFadeRafRef.current = null;
    }
  }, []);

  const hasUserActivation = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    const userActivation = (navigator as Navigator & {
      userActivation?: { hasBeenActive?: boolean };
    }).userActivation;
    return Boolean(userActivation?.hasBeenActive);
  }, []);

  const ensureB0AmbientAudio = useCallback(() => {
    if (b0AmbientAudioRef.current) return b0AmbientAudioRef.current;

    const audio = new Audio(B0_AMBIENT_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;

    audio.addEventListener("error", () => {
      b0AmbientMissingRef.current = true;
      if (b0AmbientWarnedRef.current) return;
      b0AmbientWarnedRef.current = true;
      console.warn(
        `[BeachScene] Ambient dosyasi bulunamadi: ${B0_AMBIENT_SRC}. ` +
          "Dosyayi public/assets/audio/b0_ambience.mp3 yoluna ekleyin."
      );
    });

    b0AmbientAudioRef.current = audio;
    return audio;
  }, []);

  const fadeB0AmbientTo = useCallback(
    (audio: HTMLAudioElement, targetVolume: number, durationMs: number, onComplete?: () => void) => {
      stopB0AmbientFade();

      const from = clamp(audio.volume, 0, 1);
      const to = clamp(targetVolume, 0, 1);
      if (durationMs <= 0 || Math.abs(from - to) < 0.001) {
        audio.volume = to;
        onComplete?.();
        return;
      }

      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = clamp((now - startedAt) / durationMs, 0, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        const next = from + (to - from) * eased;
        audio.volume = clamp(next, 0, 1);

        if (progress < 1) {
          b0AmbientFadeRafRef.current = window.requestAnimationFrame(step);
          return;
        }

        b0AmbientFadeRafRef.current = null;
        onComplete?.();
      };

      b0AmbientFadeRafRef.current = window.requestAnimationFrame(step);
    },
    [stopB0AmbientFade]
  );

  const attemptB0AmbientAutoplay = useCallback(async () => {
    if (!isB0Scene || document.hidden || b0AmbientMissingRef.current) return;

    const audio = ensureB0AmbientAudio();
    b0AmbientPendingAutoStartRef.current = false;
    b0AmbientResumeOnVisibleRef.current = true;
    b0AmbientMutedAutoplayRef.current = false;
    audio.loop = true;
    audio.volume = 0;
    audio.muted = true;

    try {
      if (audio.paused) {
        await audio.play();
      }
    } catch {
      audio.muted = false;
      b0AmbientPendingAutoStartRef.current = true;
      return;
    }

    b0AmbientMutedAutoplayRef.current = true;

    if (b0AmbientGestureUnlockedRef.current || hasUserActivation()) {
      audio.muted = false;
      b0AmbientMutedAutoplayRef.current = false;
      fadeB0AmbientTo(audio, B0_AMBIENT_VOLUME, B0_AMBIENT_FADE_IN_MS);
    }
  }, [ensureB0AmbientAudio, fadeB0AmbientTo, hasUserActivation, isB0Scene]);

  const onB0AmbientGesture = useCallback(async () => {
    b0AmbientGestureUnlockedRef.current = true;
    if (!isB0Scene || document.hidden || b0AmbientMissingRef.current) return;

    const audio = ensureB0AmbientAudio();
    b0AmbientResumeOnVisibleRef.current = true;

    if (!audio.paused && (audio.muted || b0AmbientMutedAutoplayRef.current)) {
      audio.muted = false;
      b0AmbientMutedAutoplayRef.current = false;
      b0AmbientPendingAutoStartRef.current = false;
      fadeB0AmbientTo(audio, B0_AMBIENT_VOLUME, B0_AMBIENT_FADE_IN_MS);
      return;
    }

    if (!audio.paused) {
      b0AmbientPendingAutoStartRef.current = false;
      if (audio.volume < B0_AMBIENT_VOLUME - 0.01) {
        fadeB0AmbientTo(audio, B0_AMBIENT_VOLUME, B0_AMBIENT_FADE_IN_MS);
      }
      return;
    }

    audio.muted = false;
    audio.volume = 0;
    try {
      await audio.play();
    } catch {
      b0AmbientPendingAutoStartRef.current = true;
      return;
    }

    b0AmbientPendingAutoStartRef.current = false;
    b0AmbientMutedAutoplayRef.current = false;
    fadeB0AmbientTo(audio, B0_AMBIENT_VOLUME, B0_AMBIENT_FADE_IN_MS);
  }, [ensureB0AmbientAudio, fadeB0AmbientTo, isB0Scene]);

  const fadeOutAndStopB0Ambient = useCallback(() => {
    b0AmbientResumeOnVisibleRef.current = false;
    b0AmbientPendingAutoStartRef.current = false;
    b0AmbientMutedAutoplayRef.current = false;
    const audio = b0AmbientAudioRef.current;
    if (!audio) return;

    fadeB0AmbientTo(audio, 0, B0_AMBIENT_FADE_OUT_MS, () => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    });
  }, [fadeB0AmbientTo]);

  const pauseB0AmbientForVisibility = useCallback(() => {
    const audio = b0AmbientAudioRef.current;
    if (!audio) return;

    b0AmbientResumeOnVisibleRef.current = !audio.paused && isB0Scene;
    if (audio.paused) return;

    fadeB0AmbientTo(audio, 0, B0_AMBIENT_VISIBILITY_FADE_MS, () => {
      audio.pause();
    });
  }, [fadeB0AmbientTo, isB0Scene]);

  const resumeB0AmbientForVisibility = useCallback(async () => {
    if (!isB0Scene || !b0AmbientResumeOnVisibleRef.current || b0AmbientMissingRef.current) return;

    const audio = ensureB0AmbientAudio();
    try {
      await audio.play();
    } catch {
      b0AmbientPendingAutoStartRef.current = true;
      return;
    }

    if (audio.muted || b0AmbientMutedAutoplayRef.current) {
      audio.volume = 0;
      return;
    }

    fadeB0AmbientTo(audio, B0_AMBIENT_VOLUME, B0_AMBIENT_FADE_IN_MS);
  }, [ensureB0AmbientAudio, fadeB0AmbientTo, isB0Scene]);

  const showPosToast = useCallback(
    (sceneId: string, left: number, top: number) => {
      if (!isDev) return;

      const label = `${sceneId} left=${left.toFixed(1)} top=${top.toFixed(1)}`;
      setPosToast({ label, copyText: label });

      if (posToastTimerRef.current !== null) {
        window.clearTimeout(posToastTimerRef.current);
      }
      posToastTimerRef.current = window.setTimeout(() => {
        setPosToast(null);
        posToastTimerRef.current = null;
      }, 2000);
    },
    [isDev]
  );

  const onCopyPosToast = useCallback(async () => {
    if (!posToast) return;

    try {
      await navigator.clipboard.writeText(posToast.copyText);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
  }, [posToast]);

  const onPuzzleIconError = useCallback((src: string) => {
    console.warn(`[BeachScene] Puzzle icon failed to load: ${src}`);
  }, []);

  const showB0LockedToast = useCallback(() => {
    if (b0LockedToastHideTimeoutRef.current !== null) {
      window.clearTimeout(b0LockedToastHideTimeoutRef.current);
      b0LockedToastHideTimeoutRef.current = null;
    }
    if (b0LockedToastUnmountTimeoutRef.current !== null) {
      window.clearTimeout(b0LockedToastUnmountTimeoutRef.current);
      b0LockedToastUnmountTimeoutRef.current = null;
    }

    setB0LockedToastMounted(true);
    setB0LockedToastVisible(true);

    b0LockedToastHideTimeoutRef.current = window.setTimeout(() => {
      setB0LockedToastVisible(false);
      b0LockedToastHideTimeoutRef.current = null;
    }, Math.max(0, B0_LOCKED_FEEDBACK_MS - B0_LOCKED_FEEDBACK_FADE_MS));

    b0LockedToastUnmountTimeoutRef.current = window.setTimeout(() => {
      setB0LockedToastMounted(false);
      b0LockedToastUnmountTimeoutRef.current = null;
    }, B0_LOCKED_FEEDBACK_MS);
  }, []);

  const openS1Puzzle = useCallback(() => {
    setS1PuzzleOpen(true);
    setS1PuzzleDisplayPieces((prev) => {
      const next = shufflePieces(S1_PUZZLE_PIECES);
      const sameAsPrev =
        next.length === prev.length && next.every((piece, index) => piece === prev[index]);
      if (!sameAsPrev || next.length <= 1) return next;
      return [...next.slice(1), next[0]];
    });
    setS1PuzzlePanel("PUZZLE");
    setS1PuzzleAdvancing(false);
    setS1PuzzleStatus(null);
    setS1PuzzleInput([]);
    setS1PuzzlePulsePiece(null);
    setS1PuzzleGlitchOn(false);
    setS1PuzzleSuccessOn(false);
    setPuzzleError(false);
    setIsInputLocked(false);
  }, []);

  const resetS1PuzzleInput = useCallback(() => {
    if (s1PuzzleAdvancing) return;
    setS1PuzzleInput([]);
    setS1PuzzleStatus(null);
    setS1PuzzlePulsePiece(null);
    setS1PuzzleGlitchOn(false);
    setS1PuzzleSuccessOn(false);
    setPuzzleError(false);
    setIsInputLocked(false);
  }, [s1PuzzleAdvancing]);

  const retryS1Puzzle = useCallback(() => {
    setPuzzleError(false);
    setIsInputLocked(false);
    setS1PuzzleInput([]);
    setS1PuzzleStatus(null);
    setS1PuzzlePulsePiece(null);
    setS1PuzzleGlitchOn(false);
    setS1PuzzleSuccessOn(false);
  }, []);

  const closeS1Puzzle = useCallback(() => {
    if (s1PuzzleAdvancing) return;
    setS1PuzzleOpen(false);
    setS1PuzzlePanel("PUZZLE");
    setPuzzleError(false);
    setIsInputLocked(false);
    setS1PuzzleStatus(null);
    setS1PuzzleSuccessOn(false);

    if (!s1PuzzleSolved && currentStep.scene === "B0") {
      setCollectedIds((prev) => {
        const next = new Set(prev);
        next.delete("S1_KEY");
        next.delete("S1_NOTE");
        return next;
      });
    }
  }, [currentStep.scene, s1PuzzleAdvancing, s1PuzzleSolved]);

  const openS1PuzzleNote = useCallback(() => {
    setS1PuzzlePanel("NOTE");
  }, []);

  const backToS1Puzzle = useCallback(() => {
    setS1PuzzlePanel("PUZZLE");
  }, []);

  const runFade = useCallback(
    (onMidpoint: () => void, onDone?: () => void) => {
      if (busy) return;

      setBusy(true);
      setFadeOn(true);

      schedule(() => {
        onMidpoint();
      }, FADE_HALF_MS);

      schedule(() => {
        setFadeOn(false);
        setBusy(false);
        onDone?.();
      }, FADE_MS);
    },
    [busy, schedule]
  );

  const completeS1Puzzle = useCallback(() => {
    const unlockedStatus = t("beach.unlockedToast");
    const tunnelOpenedText = t("beach.tunnelUnlockedToast");

    setS1PuzzleSolved(true);
    if (!b0HatchVisible) {
      setB0HatchVisible(true);
      setB0HatchRevealOn(false);
      setB0HatchHintVisible(true);
      schedule(() => {
        setB0HatchRevealOn(true);
      }, 24);
      schedule(() => {
        setB0HatchHintVisible(false);
      }, B0_HATCH_HINT_MS);
    } else {
      setB0HatchRevealOn(true);
    }
    setS1PuzzleAdvancing(true);
    setS1PuzzleStatus(unlockedStatus);
    setTransitionText(tunnelOpenedText);
    setS1PuzzleGlitchOn(false);
    setS1PuzzleSuccessOn(true);
    setPuzzleError(false);
    setIsInputLocked(true);

    schedule(() => {
      setTransitionText((current) => (current === tunnelOpenedText ? null : current));
    }, S1_UNLOCK_FEEDBACK_MS);

    schedule(() => {
      setS1PuzzleSuccessOn(false);
    }, S1_SUCCESS_FEEDBACK_MS);

    schedule(() => {
      setS1PuzzleOpen(false);
      setS1PuzzlePanel("PUZZLE");
      setS1PuzzleAdvancing(false);
      setS1PuzzlePulsePiece(null);
      setIsInputLocked(false);
    }, S1_SUCCESS_FEEDBACK_MS + 80);
  }, [b0HatchVisible, schedule, t]);

  const onS1TargetTouch = useCallback(
    (piece: S1PuzzlePiece) => {
      if (s1PuzzleAdvancing || s1PuzzleSolved || isInputLocked) return;

      setS1PuzzlePulsePiece(piece);
      schedule(() => {
        setS1PuzzlePulsePiece((current) => (current === piece ? null : current));
      }, S1_TOUCH_FEEDBACK_MS);

      const expectedPiece = S1_PUZZLE_TARGET[s1PuzzleInput.length];
      if (piece !== expectedPiece) {
        setS1PuzzleStatus(t("common.wrongShort"));
        setS1PuzzleInput([]);
        setPuzzleError(true);
        setIsInputLocked(true);
        setS1PuzzleGlitchOn(true);
        setS1PuzzleSuccessOn(false);
        schedule(() => {
          setS1PuzzleGlitchOn(false);
        }, S1_GLITCH_MS);
        return;
      }

      const nextInput = [...s1PuzzleInput, piece];
      setS1PuzzleInput(nextInput);
      setS1PuzzleGlitchOn(false);
      setS1PuzzleSuccessOn(false);
      setPuzzleError(false);
      setIsInputLocked(false);
      setS1PuzzleStatus(null);

      if (nextInput.length === S1_PUZZLE_TARGET.length) {
        completeS1Puzzle();
        return;
      }
    },
    [completeS1Puzzle, isInputLocked, s1PuzzleAdvancing, s1PuzzleInput, s1PuzzleSolved, schedule, t]
  );

  const openB0TunnelOverlay = useCallback(() => {
    if (!isB0Scene || busy || overlayOpen || s1PuzzleOpen) return;
    if (!b0HatchVisible) {
      showB0LockedToast();
      return;
    }
    setTransitionText(t("beach.hatchOpening"));
    runFade(
      () => {
        onEnterTunnel();
      },
      () => {
        setTransitionText(null);
      }
    );
  }, [b0HatchVisible, busy, isB0Scene, onEnterTunnel, overlayOpen, runFade, s1PuzzleOpen, showB0LockedToast, t]);

  const advanceScene = useCallback(
    (fromIndex: number) => {
      if (fromIndex === 3) {
        setTransitionText(t("beach.transition.run2"));
        runFade(
          () => {
            setStepIndex(4);
          },
          () => {
            setTransitionText(null);
          }
        );
        return;
      }

      if (fromIndex < BEACH_STEPS.length - 1) {
        runFade(() => {
          setStepIndex(fromIndex + 1);
        });
        return;
      }

      runFade(() => {
        setHatchVisible(true);
      });
    },
    [runFade, t]
  );

  const openOverlay = useCallback(
    (hotspot: BeachHotspot) => {
      if (busy) return;
      setSelectedHotspot(hotspot);
      setOverlayTarget(hatchVisible ? "hatch" : "scene");
      setOverlayOpen(true);
    },
    [busy, hatchVisible]
  );

  const closeOverlay = useCallback(() => {
    if (!overlayOpen || busy) return;

    const target = overlayTarget;
    const hotspot = selectedHotspot;

    setOverlayOpen(false);
    setOverlayTarget(null);
    setSelectedHotspot(null);

    if (target === "hatch") {
      setTransitionText(t("beach.hatchOpening"));
      runFade(
        () => {
          onEnterTunnel();
        },
        () => {
          setTransitionText(null);
        }
      );
      return;
    }

    if (target === "scene" && !hatchVisible && hotspot) {
      const nextCollected = new Set(collectedIds);
      nextCollected.add(hotspot.id);
      setCollectedIds(nextCollected);

      const allCollectedInScene = currentStep.hotspots.every((sceneHotspot) => nextCollected.has(sceneHotspot.id));
      if (allCollectedInScene) {
        if (currentStep.scene === "B0" && !s1PuzzleSolved) {
          openS1Puzzle();
          return;
        }
        advanceScene(stepIndex);
      }
    }
  }, [
    advanceScene,
    busy,
    collectedIds,
    currentStep.hotspots,
    currentStep.scene,
    hatchVisible,
    onEnterTunnel,
    openS1Puzzle,
    overlayOpen,
    overlayTarget,
    runFade,
    s1PuzzleSolved,
    selectedHotspot,
    stepIndex,
    t,
  ]);

  const devNext = useCallback(() => {
    if (!isDev || busy) return;

    if (overlayOpen) {
      closeOverlay();
      return;
    }

    if (hatchVisible) {
      setTransitionText(t("beach.hatchOpening"));
      runFade(
        () => {
          onEnterTunnel();
        },
        () => {
          setTransitionText(null);
        }
      );
      return;
    }

    if (currentStep.scene === "B0" && !s1PuzzleSolved) {
      setCollectedIds((prev) => {
        const next = new Set(prev);
        for (const hotspot of currentStep.hotspots) {
          next.add(hotspot.id);
        }
        return next;
      });
      openS1Puzzle();
      return;
    }

    setCollectedIds((prev) => {
      const next = new Set(prev);
      for (const hotspot of currentStep.hotspots) {
        next.add(hotspot.id);
      }
      return next;
    });
    advanceScene(stepIndex);
  }, [
    advanceScene,
    busy,
    closeOverlay,
    currentStep.hotspots,
    currentStep.scene,
    hatchVisible,
    isDev,
    onEnterTunnel,
    openS1Puzzle,
    overlayOpen,
    runFade,
    s1PuzzleSolved,
    stepIndex,
    t,
  ]);

  const updateHotspotFromClient = useCallback(
    (meta: DragMeta, clientX: number, clientY: number, logValue: boolean) => {
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);

      const leftPct = clamp((clientX / viewportWidth) * 100, 4, 96);
      const topPct = clamp((clientY / viewportHeight) * 100, 4, 96);

      setDevHotspotPositions((prev) => ({
        ...prev,
        [meta.hotspotId]: {
          left: leftPct,
          top: topPct,
        },
      }));

      if (logValue) {
        console.log(`POS ${meta.sceneId}: left=${leftPct.toFixed(1)} top=${topPct.toFixed(1)}`);
        showPosToast(meta.sceneId, leftPct, topPct);
      }
    },
    [showPosToast]
  );

  const onHotspotPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, hotspot: BeachHotspot) => {
      if (!isDev || !posMode || busy || overlayOpen) return;

      e.preventDefault();
      e.stopPropagation();

      const meta: DragMeta = {
        pointerId: e.pointerId,
        hotspotId: hotspot.id,
        sceneId: activeSceneId,
      };

      dragRef.current = meta;
      setDraggingHotspotId(meta.hotspotId);
      updateHotspotFromClient(meta, e.clientX, e.clientY, false);
    },
    [activeSceneId, busy, isDev, overlayOpen, posMode, updateHotspotFromClient]
  );

  const onB0HatchPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isDev || !posMode || busy || overlayOpen || s1PuzzleOpen) return;

      e.preventDefault();
      e.stopPropagation();

      const meta: DragMeta = {
        pointerId: e.pointerId,
        hotspotId: B0_HATCH_ID,
        sceneId: activeSceneId,
      };

      dragRef.current = meta;
      setDraggingHotspotId(meta.hotspotId);
      updateHotspotFromClient(meta, e.clientX, e.clientY, false);
    },
    [activeSceneId, busy, isDev, overlayOpen, posMode, s1PuzzleOpen, updateHotspotFromClient]
  );

  const onHotspotClick = useCallback(
    (hotspot: BeachHotspot) => {
      if (posMode) return;
      openOverlay(hotspot);
    },
    [openOverlay, posMode]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${B0_HATCH_MOBILE_BREAKPOINT}px)`);
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => {
        mediaQuery.removeEventListener("change", syncViewport);
      };
    }

    window.addEventListener("resize", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulseTick((prev) => prev + 1);
    }, 80);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!isB0Scene) return;
    void attemptB0AmbientAutoplay();
  }, [attemptB0AmbientAutoplay, isB0Scene]);

  useEffect(() => {
    if (!isB0Scene) return;

    const onFirstInteraction = () => {
      void onB0AmbientGesture();
    };

    window.addEventListener("pointerdown", onFirstInteraction, { passive: true });
    window.addEventListener("touchstart", onFirstInteraction, { passive: true });
    window.addEventListener("keydown", onFirstInteraction);

    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [isB0Scene, onB0AmbientGesture]);

  useEffect(() => {
    if (isB0Scene) return;
    fadeOutAndStopB0Ambient();
  }, [fadeOutAndStopB0Ambient, isB0Scene]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseB0AmbientForVisibility();
        return;
      }
      void resumeB0AmbientForVisibility();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pauseB0AmbientForVisibility, resumeB0AmbientForVisibility]);

  useEffect(() => {
    if (!isB0Scene) {
      stopFogAnimation();
      return;
    }

    // Guard against duplicate loops in StrictMode effect re-runs.
    if (fogAnimActiveRef.current) return;

    setFogOpacity(B0_FOG_START_OPACITY);
    fogAnimActiveRef.current = true;
    fogStartTimeRef.current = null;

    const tick = (now: number) => {
      if (!fogAnimActiveRef.current) return;

      if (fogStartTimeRef.current === null) {
        fogStartTimeRef.current = now;
      }

      const elapsed = now - fogStartTimeRef.current;
      const progress = clamp(elapsed / B0_FOG_FADE_MS, 0, 1);
      const easeOutProgress = 1 - (1 - progress) * (1 - progress);
      const nextOpacity = B0_FOG_START_OPACITY + (B0_FOG_END_OPACITY - B0_FOG_START_OPACITY) * easeOutProgress;
      setFogOpacity(nextOpacity);

      if (progress >= 1) {
        stopFogAnimation();
        return;
      }

      fogRafRef.current = window.requestAnimationFrame(tick);
    };

    fogRafRef.current = window.requestAnimationFrame(tick);

    return () => {
      stopFogAnimation();
    };
  }, [isB0Scene, stopFogAnimation]);

  useEffect(() => {
    if (activeSceneId !== "S1" || hatchVisible || busy || overlayOpen || s1PuzzleOpen) return;
    if (activeSceneHotspots.length > 0) return;

    runFade(() => {
      setStepIndex(2);
    });
  }, [activeSceneHotspots.length, activeSceneId, busy, hatchVisible, overlayOpen, runFade, s1PuzzleOpen]);

  useEffect(() => {
    if (!draggingHotspotId) return;

    const onPointerMove = (event: PointerEvent) => {
      const meta = dragRef.current;
      if (!meta || meta.pointerId !== event.pointerId) return;
      updateHotspotFromClient(meta, event.clientX, event.clientY, false);
    };

    const onPointerUp = (event: PointerEvent) => {
      const meta = dragRef.current;
      if (!meta || meta.pointerId !== event.pointerId) return;

      updateHotspotFromClient(meta, event.clientX, event.clientY, true);
      dragRef.current = null;
      setDraggingHotspotId(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingHotspotId, updateHotspotFromClient]);

  useEffect(() => {
    if (posMode) return;
    dragRef.current = null;
    setDraggingHotspotId(null);
  }, [posMode]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (posToastTimerRef.current !== null) {
        window.clearTimeout(posToastTimerRef.current);
        posToastTimerRef.current = null;
      }
      if (b0LockedToastHideTimeoutRef.current !== null) {
        window.clearTimeout(b0LockedToastHideTimeoutRef.current);
        b0LockedToastHideTimeoutRef.current = null;
      }
      if (b0LockedToastUnmountTimeoutRef.current !== null) {
        window.clearTimeout(b0LockedToastUnmountTimeoutRef.current);
        b0LockedToastUnmountTimeoutRef.current = null;
      }
      stopB0AmbientFade();
      b0AmbientPendingAutoStartRef.current = false;
      b0AmbientMutedAutoplayRef.current = false;
      b0AmbientResumeOnVisibleRef.current = false;
      const audio = b0AmbientAudioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        audio.load();
        b0AmbientAudioRef.current = null;
      }
    };
  }, [clearTimers, stopB0AmbientFade]);

  return (
    <div
      className={`beachSceneRoot ${worldShakeClass}`}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#05070b",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      }}
      onTouchStart={isB0Scene ? undefined : onTouchStart}
      onTouchMove={isB0Scene ? undefined : onTouchMove}
      onTouchEnd={isB0Scene ? undefined : onTouchEnd}
      onTouchCancel={isB0Scene ? undefined : onTouchEnd}
      aria-label={t("beach.regionTitle")}
    >
      {isB0Scene ? (
        <>
          <img
            src={activeBgSrc}
            alt=""
            draggable={false}
            onError={() => onB0ImageError(b0BgVariant)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              userSelect: "none",
              pointerEvents: "none",
              filter: "blur(12px)",
              opacity: 0.6,
              transform: "scale(1.06)",
              transformOrigin: "center",
            }}
          />
          <img
            src={activeBgSrc}
            alt=""
            draggable={false}
            onError={() => onB0ImageError(b0BgVariant)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <img
          src={activeBgSrc}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}

      {isB0Scene && (
        <>
          <div
            aria-hidden
            className="fogOverlay fogBase"
            style={{
              opacity: fogOpacity,
            }}
          />
          <div
            aria-hidden
            className="fogOverlay groundFog"
            style={{
              opacity: fogOpacity * 0.6,
            }}
          />
        </>
      )}

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 6,
        }}
      >
        {visibleHotspots.map((hotspot) => {
          const isS1Key = hotspot.id === "S1_KEY";
          const isS1Note = hotspot.id === "S1_NOTE";
          const shouldRenderSprite = hotspot.renderSprite !== false;
          const hotspotPos = getHotspotPosition(hotspot);
          const hotspotScale = busy ? 1 : pulseScale;
          const hotspotZIndex = isS1Key ? 30 : isS1Note ? 20 : 1;
          const shouldRenderShadow = !isS1Key;
          const hotspotImageFilter = isS1Key
            ? OBJECT_VISUAL_TUNING.dropShadow
            : `${OBJECT_VISUAL_TUNING.toneFilter} ${OBJECT_VISUAL_TUNING.hazeBlur} ${OBJECT_VISUAL_TUNING.dropShadow}`;
          const hotspotMixBlendMode = isS1Key ? "normal" : "multiply";
          const hotspotImageTransform =
            isS1Key || isS1Note
              ? `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${hotspotScale})`
              : `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${hotspotScale})`;

          if (!shouldRenderSprite) return null;

          if (isS1Note) {
            const noteScale = hotspotScale * 1.08;
            return (
              <button
                key={hotspot.id}
                type="button"
                className="beachHotspotButton"
                onClick={() => onHotspotClick(hotspot)}
                onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
                disabled={busy}
                aria-label={getHotspotLabel(hotspot)}
                style={{
                  position: "absolute",
                  left: `${hotspotPos.left}%`,
                  top: `${hotspotPos.top}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: hotspotZIndex,
                  width: 72,
                  height: 72,
                  minWidth: 72,
                  minHeight: 72,
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  margin: 0,
                  boxShadow: "none",
                  outline: "none",
                  cursor: "default",
                  pointerEvents: "auto",
                  touchAction: posMode ? "none" : "manipulation",
                }}
              >
                <img
                  src={hotspot.obj}
                  alt={getHotspotLabel(hotspot)}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    background: "transparent",
                    opacity: pulseOpacity,
                    transform: `scale(${noteScale})`,
                    transformOrigin: "50% 50%",
                    transition: "transform 220ms ease, opacity 220ms ease",
                  }}
                />
              </button>
            );
          }

          return (
            <button
              key={hotspot.id}
              type="button"
              className="beachHotspotButton"
              onClick={() => onHotspotClick(hotspot)}
              onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
              disabled={busy}
              aria-label={getHotspotLabel(hotspot)}
              style={{
                position: "absolute",
                left: `${hotspotPos.left}%`,
                top: `${hotspotPos.top}%`,
                transform: "translate(-50%, -50%)",
                zIndex: hotspotZIndex,
                width: 72,
                height: 72,
                minWidth: 72,
                minHeight: 72,
                border: "none",
                borderRadius: 12,
                background: "transparent",
                padding: 0,
                margin: 0,
                cursor: "default",
                pointerEvents: "auto",
                touchAction: posMode ? "none" : "manipulation",
                outline: isS1Key ? "none" : undefined,
                boxShadow: isS1Key ? "none" : undefined,
                appearance: isS1Key ? "none" : undefined,
                WebkitTapHighlightColor: isS1Key ? "transparent" : undefined,
                backdropFilter: isS1Key ? "none" : undefined,
                WebkitBackdropFilter: isS1Key ? "none" : undefined,
                filter: isS1Key ? "none" : undefined,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  background: "transparent",
                  backdropFilter: isS1Key ? "none" : undefined,
                  WebkitBackdropFilter: isS1Key ? "none" : undefined,
                  filter: isS1Key ? "none" : undefined,
                }}
              >
                {shouldRenderShadow && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "80%",
                      transform: "translateX(-50%)",
                      width: "108%",
                      height: "20%",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.34)",
                      filter: "blur(6px)",
                      opacity: shadowOpacity,
                    }}
                  />
                )}

                <img
                  src={hotspot.obj}
                  alt={getHotspotLabel(hotspot)}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                    objectFit: "contain",
                    display: "block",
                    opacity: pulseOpacity,
                    transform: hotspotImageTransform,
                    transformOrigin: "50% 50%",
                    filter: hotspotImageFilter,
                    mixBlendMode: hotspotMixBlendMode,
                    transition: "transform 220ms ease, opacity 220ms ease",
                  }}
                />

                {!isS1Key && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0.72,
                      background: OBJECT_VISUAL_TUNING.contactOverlay,
                      mixBlendMode: "multiply",
                      filter: "blur(0.2px)",
                      clipPath: "ellipse(58% 44% at 50% 86%)",
                      transform: `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${hotspotScale})`,
                      transformOrigin: "50% 50%",
                    }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isB0Scene && b0KeyHotspot && (
        <button
          type="button"
          className="beachHitboxButton"
          onClick={() => onHotspotClick(b0KeyHotspot)}
          onPointerDown={(e) => onHotspotPointerDown(e, b0KeyHotspot)}
          disabled={busy}
          aria-label={getHotspotLabel(b0KeyHotspot)}
          style={{
            position: "absolute",
            left: `${B0_KEY_HIT.left}%`,
            top: `${B0_KEY_HIT.top}%`,
            width: `${B0_KEY_HIT.width}%`,
            height: `${B0_KEY_HIT.height}%`,
            border: 0,
            outline: "none",
            borderRadius: 6,
            background: "transparent",
            margin: 0,
            padding: 0,
            zIndex: 12,
            pointerEvents: overlayOpen || s1PuzzleOpen || busy ? "none" : "auto",
            cursor: "default",
            touchAction: posMode ? "none" : "manipulation",
          }}
        />
      )}

      {isB0Scene && b0NoteHotspot && (
        <button
          type="button"
          className="beachHitboxButton"
          onClick={() => onHotspotClick(b0NoteHotspot)}
          onPointerDown={(e) => onHotspotPointerDown(e, b0NoteHotspot)}
          disabled={busy}
          aria-label={getHotspotLabel(b0NoteHotspot)}
          style={{
            position: "absolute",
            left: `${B0_NOTE_HIT.left}%`,
            top: `${B0_NOTE_HIT.top}%`,
            width: `${B0_NOTE_HIT.width}%`,
            height: `${B0_NOTE_HIT.height}%`,
            border: 0,
            outline: "none",
            borderRadius: 6,
            background: "transparent",
            margin: 0,
            padding: 0,
            zIndex: 12,
            pointerEvents: overlayOpen || s1PuzzleOpen || busy ? "none" : "auto",
            cursor: "default",
            touchAction: posMode ? "none" : "manipulation",
          }}
        />
      )}

      {isDev && (
        <div
          className="beachDebugHud"
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 20,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(5,8,12,.72)",
            color: "#eef2fb",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <div>run: {runLabel}</div>
          <div>scene: {activeSceneId}</div>
          <div>collected: {collectedCount}/{allCollectibleCount}</div>
          <div>bg: {bgName}</div>
          {activeSceneHotspots[0] && (
            <div>
              POS={posMode ? "ON" : "OFF"} {activeSceneId} pos: {getHotspotPosition(activeSceneHotspots[0]).left.toFixed(1)},
              {getHotspotPosition(activeSceneHotspots[0]).top.toFixed(1)}
            </div>
          )}
          {isB0Scene && <div style={{ fontSize: 11, opacity: 0.8 }}>fog: {fogOpacity.toFixed(2)}</div>}
          {activeSceneId === "B0" && <div>B0 items visible: {b0ItemsVisibleCount}</div>}
        </div>
      )}

      {isDev && (
        <button
          className="beachPosBadge"
          type="button"
          onClick={() => setPosMode((prev) => !prev)}
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 24,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.28)",
            background: posMode ? "rgba(74,180,120,.32)" : "rgba(8,12,18,.88)",
            color: "#eef2fb",
            fontSize: 12,
            fontWeight: 800,
            padding: "8px 12px",
            minHeight: 36,
            minWidth: 88,
            cursor: "pointer",
            touchAction: "manipulation",
            boxShadow: "0 8px 18px rgba(0,0,0,.3)",
          }}
        >
          POS: {posMode ? "ON" : "OFF"}
        </button>
      )}

      {isDev && (
        <div
          className="beachDevPanel"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 21,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.26)",
            background: "rgba(8,12,18,.82)",
            color: "#eef2fb",
            padding: 8,
            display: "grid",
            gap: 6,
            minWidth: 126,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: ".04em" }}>TEST PANEL</div>
          <button
            type="button"
            onClick={devNext}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.26)",
              background: "rgba(6,10,16,.92)",
              color: "#eef2fb",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 10px",
              minHeight: 34,
              width: "100%",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            NEXT
          </button>
        </div>
      )}

      {isDev && posToast && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 12,
            zIndex: 25,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.26)",
            background: "rgba(10,14,20,.94)",
            color: "#eef2fb",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 10px",
            display: "grid",
            gap: 8,
            minWidth: 220,
            boxShadow: "0 10px 24px rgba(0,0,0,.35)",
          }}
        >
          <div style={{ userSelect: "text" }}>{posToast.label}</div>
          <button
            type="button"
            onClick={onCopyPosToast}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.28)",
              background: "rgba(255,255,255,.08)",
              color: "#eef2fb",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              minHeight: 30,
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            {t("common.copy")}
          </button>
        </div>
      )}

      {transitionText && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "14%",
            transform: "translateX(-50%)",
            zIndex: 32,
            width: "min(88vw, 620px)",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.22)",
            background: "rgba(6,10,15,.84)",
            color: "#eef2fb",
            fontSize: 14,
            lineHeight: 1.35,
            textAlign: "center",
          }}
        >
          {transitionText}
        </div>
      )}

      {b0HatchHintVisible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "clamp(62px, 11vh, 110px)",
            transform: "translateX(-50%)",
            zIndex: 34,
            minHeight: 32,
            padding: "7px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.2)",
            background: "rgba(6,10,15,.78)",
            color: "#deebff",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: ".02em",
            pointerEvents: "none",
          }}
        >
          {t("beach.hatchEmerges")}
        </div>
      )}

      {b0LockedToastMounted && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "clamp(18px, 6vh, 42px)",
            transform: "translateX(-50%)",
            zIndex: 34,
            minHeight: 38,
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.24)",
            background: "rgba(6,10,15,.86)",
            color: "#eef2fb",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            opacity: b0LockedToastVisible ? 1 : 0,
            transition: `opacity ${B0_LOCKED_FEEDBACK_FADE_MS}ms ease`,
            pointerEvents: "none",
          }}
        >
          {t("common.locked")}
        </div>
      )}

      {s1PuzzleOpen && (
        <div
          className="s1PuzzleOverlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 33,
            display: "grid",
            placeItems: "center",
            background: "rgba(2,6,11,.82)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            paddingRight: "calc(env(safe-area-inset-right, 0px) + 12px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            paddingLeft: "calc(env(safe-area-inset-left, 0px) + 12px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("beach.tabletTitle")}
            className={`s1PuzzlePanel ${s1PuzzleGlitchOn ? "s1PuzzlePanel--glitch" : ""}`}
            style={{
              width: "min(92vw, 520px)",
              maxWidth: 520,
              height: "min(78vh, 560px)",
              maxHeight: 560,
              display: "grid",
              overflow: "hidden",
            }}
          >
            <div className="s1PuzzleTabletFrame" style={{ width: "100%", height: "100%" }}>
              <div aria-hidden className="s1PuzzleTabletBezel" />
              <div className="s1PuzzleTabletScreen" style={{ height: "100%", overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: "auto auto 1fr auto auto",
                    gap: 10,
                    height: "100%",
                    minHeight: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div className="s1PuzzleTitle" style={{ color: "#eef2fb", fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                      {s1PuzzlePanel === "NOTE" ? b0NoteTitleNode : t("beach.tabletTitle")}
                    </div>
                    <button
                      type="button"
                      onClick={closeS1Puzzle}
                      disabled={s1PuzzleAdvancing}
                      aria-label={t("common.close")}
                      style={{
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        minHeight: 44,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,.24)",
                        background: "rgba(255,255,255,.08)",
                        color: "#eef2fb",
                        fontSize: 20,
                        lineHeight: 1,
                        cursor: s1PuzzleAdvancing ? "default" : "pointer",
                        touchAction: "manipulation",
                      }}
                    >
                      X
                    </button>
                  </div>

                  <div className="s1PuzzleSubtitle" style={{ color: "#d7e0f5", fontSize: 13, lineHeight: 1.45 }}>
                    {s1PuzzlePanel === "NOTE" ? t("beach.tabletNoteHint") : t("beach.tabletHint")}
                  </div>

                  {s1PuzzlePanel === "NOTE" ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: "1fr auto",
                        minHeight: 0,
                        gap: 10,
                      }}
                    >
                      <div
                        className="b0NotePaper"
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(231,238,250,.24)",
                          background: "rgba(17,24,34,.86)",
                          padding: "12px 12px 14px",
                          display: "grid",
                          gap: 8,
                          color: "#eff4ff",
                          fontSize: 14,
                          lineHeight: 1.5,
                          overflow: "hidden",
                        }}
                      >
                        {b0NoteLines.map((line, index) =>
                          line ? (
                            <p key={`s1-note-line-${index}`} style={{ margin: 0 }}>
                              {line}
                            </p>
                          ) : (
                            <div key={`s1-note-gap-${index}`} style={{ height: 6 }} />
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={backToS1Puzzle}
                        style={{
                          width: "100%",
                          minHeight: 44,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,.28)",
                          background: "rgba(255,255,255,.1)",
                          color: "#eef2fb",
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        {t("beach.tabletBackToPuzzle")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 10, alignContent: "start", minHeight: 0 }}>
                        <div
                          className="s1PuzzleSlots"
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${S1_PUZZLE_TARGET.length}, minmax(0, 1fr))`,
                            gap: 8,
                          }}
                        >
                          {S1_PUZZLE_TARGET.map((_, slotIndex) => {
                            const slotPiece = s1PuzzleInput[slotIndex] ?? null;
                            return (
                              <div
                                key={`slot-${slotIndex}`}
                                className={`s1PuzzleSlot ${slotPiece ? "*" : "."}`}
                                aria-label={t("beach.tabletSlot", {
                                  index: slotIndex + 1,
                                  value: slotPiece ? t(S1_PUZZLE_ICONS[slotPiece].labelKey) : t("beach.tabletSlotEmpty"),
                                })}
                                role="status"
                                aria-live="polite"
                                style={{
                                  minHeight: 46,
                                  borderRadius: 12,
                                  border: "1px dashed rgba(255,255,255,.34)",
                                  background: slotPiece ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.04)",
                                  color: "#f2f5fb",
                                  fontSize: 18,
                                  fontWeight: 800,
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                {slotPiece ? "*" : "."}
                              </div>
                            );
                          })}
                        </div>

                        <div className="s1PuzzleLabel" style={{ color: "#d7e0f5", fontSize: 12, letterSpacing: ".04em", opacity: 0.88 }}>
                          {t("beach.tabletTapLabel")}
                        </div>
                        <div
                          className="s1PuzzlePieces"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 8,
                            alignContent: "start",
                          }}
                        >
                          {s1PuzzleDisplayPieces.map((piece) => {
                            const isPulse = s1PuzzlePulsePiece === piece;
                            const isDisabled = s1PuzzleAdvancing || isInputLocked;
                            return (
                              <button
                                key={piece}
                                type="button"
                                onClick={() => onS1TargetTouch(piece)}
                                disabled={isDisabled}
                                className={`s1PuzzlePiece ${isPulse ? "s1PuzzlePiece--pulse" : ""}`}
                                style={{
                                  minHeight: 72,
                                  minWidth: 72,
                                  borderRadius: 12,
                                  border: isPulse ? "1px solid rgba(132,196,255,.95)" : "1px solid rgba(255,255,255,.3)",
                                  background: isPulse ? "rgba(94,164,242,.32)" : "rgba(255,255,255,.12)",
                                  color: "#f2f5fb",
                                  fontSize: 24,
                                  fontWeight: 800,
                                  cursor: isDisabled ? "default" : "pointer",
                                  touchAction: "manipulation",
                                  position: "relative",
                                  overflow: "hidden",
                                  opacity: isDisabled ? 0.58 : 1,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <img
                                  className="s1PuzzlePieceIcon"
                                  src={S1_PUZZLE_ICONS[piece].src}
                                  alt={t(S1_PUZZLE_ICONS[piece].labelKey)}
                                  draggable={false}
                                  onError={() => onPuzzleIconError(S1_PUZZLE_ICONS[piece].src)}
                                  style={{
                                    opacity: isPulse ? 1 : 0.94,
                                    transform: `scale(${isPulse ? 1.05 : 1})`,
                                    filter: isPulse ? "drop-shadow(0 0 8px rgba(151,205,255,.65))" : "none",
                                  }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        className="s1PuzzleFooter"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                      >
                        <div className="s1PuzzleSelected" style={{ color: "#eef2fb", fontSize: 13 }}>
                          {t("beach.tabletInput", { current: s1PuzzleInput.length, total: S1_PUZZLE_TARGET.length })}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={openS1PuzzleNote}
                            style={{
                              minHeight: 44,
                              minWidth: 96,
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,.28)",
                              background: "rgba(255,255,255,.1)",
                              color: "#eef2fb",
                              fontSize: 13,
                              fontWeight: 700,
                              padding: "0 12px",
                              cursor: "pointer",
                              touchAction: "manipulation",
                            }}
                          >
                            {t("common.readNote")}
                          </button>
                          <button
                            type="button"
                            onClick={resetS1PuzzleInput}
                            disabled={s1PuzzleAdvancing}
                            className="s1PuzzleResetBtn"
                            style={{
                              minHeight: 44,
                              minWidth: 96,
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,.28)",
                              background: "rgba(255,255,255,.08)",
                              color: "#eef2fb",
                              fontSize: 13,
                              fontWeight: 700,
                              padding: "0 12px",
                              cursor: s1PuzzleAdvancing ? "default" : "pointer",
                              touchAction: "manipulation",
                            }}
                          >
                            {t("common.reset")}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {s1PuzzleStatus && (
                          <div
                            className={`s1PuzzleStatus ${s1PuzzleStatus === t("beach.unlockedToast") ? "s1PuzzleStatus--ok" : ""}`}
                            style={{
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,.18)",
                              background: s1PuzzleStatus === t("beach.unlockedToast") ? "rgba(62,170,106,.28)" : "rgba(255,255,255,.08)",
                              color: "#eef2fb",
                              fontSize: 14,
                              fontWeight: 700,
                              lineHeight: 1.35,
                              padding: "10px 12px",
                              boxShadow: s1PuzzleSuccessOn ? "0 0 18px rgba(80,214,146,.36)" : "none",
                              transition: "box-shadow 200ms ease, background-color 200ms ease",
                            }}
                          >
                            {s1PuzzleStatus}
                          </div>
                        )}

                        {puzzleError && (
                          <div style={{ display: "grid", gap: 8 }}>
                            <button
                              type="button"
                              onClick={retryS1Puzzle}
                              disabled={s1PuzzleAdvancing}
                              style={{
                                width: "100%",
                                minHeight: 48,
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,.3)",
                                background: "rgba(255,255,255,.14)",
                                color: "#eef2fb",
                                fontSize: 15,
                                fontWeight: 800,
                                cursor: s1PuzzleAdvancing ? "default" : "pointer",
                                touchAction: "manipulation",
                              }}
                            >
                              {t("common.retry")}
                            </button>
                            <button
                              type="button"
                              onClick={openS1PuzzleNote}
                              style={{
                                width: "100%",
                                minHeight: 44,
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,.3)",
                                background: "rgba(255,255,255,.1)",
                                color: "#eef2fb",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                                touchAction: "manipulation",
                              }}
                            >
                              {t("common.readNote")}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isB0Scene && (
        <button
          type="button"
          className="beachHotspotButton"
          onClick={() => {
            if (posMode) return;
            openB0TunnelOverlay();
          }}
          onPointerDown={onB0HatchPointerDown}
          disabled={busy || (!b0HatchVisible && !posMode)}
          aria-label={t("beach.tunnelLabel")}
          style={{
            position: "absolute",
            left: `${b0HatchPosition.left}%`,
            top: `${b0HatchPosition.top}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 16,
            width: b0HatchSizePx,
            height: b0HatchSizePx,
            minWidth: 44,
            minHeight: 44,
            border: "none",
            borderRadius: 12,
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "default",
            pointerEvents: overlayOpen || s1PuzzleOpen || busy || (!b0HatchVisible && !posMode) ? "none" : "auto",
            touchAction: posMode ? "none" : "manipulation",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <img
              src={B0_HATCH_SRC}
              alt={t("beach.tunnelLabel")}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                opacity: b0HatchVisible ? (b0HatchRevealOn ? pulseOpacity : 0) : posMode ? 0.22 : 0,
                transform: `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${
                  b0HatchVisible && b0HatchRevealOn ? pulseScale : 0.96
                })`,
                transformOrigin: "50% 50%",
                filter: "drop-shadow(0 14px 34px rgba(0,0,0,0.55))",
                transition: `transform ${b0HatchRevealOn ? 220 : B0_HATCH_REVEAL_MS}ms ease, opacity ${
                  b0HatchRevealOn ? 220 : B0_HATCH_REVEAL_MS
                }ms ease`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "calc(100% + 10px)",
                transform: "translate(-50%, 0)",
                minHeight: 22,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.3)",
                background: "rgba(7,11,16,.8)",
                color: "#eef2fb",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                opacity: b0HatchVisible ? 1 : 0,
                transition: `opacity ${B0_HATCH_REVEAL_MS}ms ease`,
              }}
            >
              {t("beach.tunnelLabel")}
            </div>
          </div>
        </button>
      )}

      {overlayOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            display: "grid",
            placeItems: "center",
            background: "rgba(1,3,7,.74)",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("beach.overlay.inspectTitle")}
            style={{
              width: "min(92vw, 520px)",
              maxHeight: "min(86vh, 680px)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,.22)",
              background: "rgba(10,13,19,.95)",
              boxShadow: "0 18px 56px rgba(0,0,0,.45)",
              padding: "18px 18px 16px",
              display: "grid",
              gap: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: isS1NotePanel ? ".02em" : ".08em",
                  textTransform: isS1NotePanel ? "none" : "uppercase",
                  opacity: 0.75,
                }}
              >
                {overlayTitle}
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                disabled={busy}
                aria-label={t("common.close")}
                style={{
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.24)",
                  background: "rgba(255,255,255,.08)",
                  color: "#eef2fb",
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: "pointer",
                  touchAction: "manipulation",
                }}
              >
                X
              </button>
            </div>

            {isS1NotePanel ? (
              <div
                className="b0NotePaper"
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(231,238,250,.24)",
                  background: "rgba(17,24,34,.86)",
                  padding: "14px 14px 16px",
                  display: "grid",
                  gap: 10,
                  color: "#eff4ff",
                  fontSize: "clamp(15px, 3.9vw, 18px)",
                  lineHeight: 1.6,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {b0NoteLines.map((line, index) =>
                  line ? (
                    <p key={`note-line-${index}`} style={{ margin: 0 }}>
                      {line}
                    </p>
                  ) : (
                    <div key={`note-gap-${index}`} style={{ height: 12 }} />
                  )
                )}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.2)",
                      background: "rgba(0,0,0,.28)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <img
                      src={
                        overlayTarget === "hatch"
                          ? HATCH_STEP.hotspots[0].obj
                          : (selectedHotspot?.obj ?? activeSceneHotspots[0]?.obj ?? HATCH_STEP.hotspots[0].obj)
                      }
                      alt=""
                      draggable={false}
                      style={{ width: "80%", height: "80%", objectFit: "contain" }}
                    />
                  </div>

                  <div style={{ color: "#eef2fb", fontSize: 14, lineHeight: 1.4 }}>{overlayDescription}</div>
                </div>

                <button
                  type="button"
                  onClick={closeOverlay}
                  disabled={busy}
                  style={{
                    width: "100%",
                    minHeight: 46,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.24)",
                    background: overlayTarget === "hatch" ? "rgba(255,58,58,.22)" : "rgba(255,255,255,.08)",
                    color: "#eef2fb",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  {overlayButtonLabel}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 31,
          background: "#000",
          opacity: fadeOn ? 0.86 : 0,
          pointerEvents: "none",
          transition: `opacity ${FADE_HALF_MS}ms ease`,
        }}
      />
    </div>
  );
}
