import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, TouchEvent } from "react";
import type { ClueKey, CluesState, PathObject } from "../game/types";

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

type S1PuzzlePiece = "A" | "B" | "C" | "D" | "E";
type B0HitboxKey = "S1_KEY" | "S1_NOTE";
type B0HitboxRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const FADE_MS = 500;
const FADE_HALF_MS = Math.floor(FADE_MS / 2);
const S1_PUZZLE_PIECES: readonly S1PuzzlePiece[] = ["A", "B", "C", "D", "E"];
const S1_PUZZLE_TARGET: readonly S1PuzzlePiece[] = ["E", "B", "C", "A", "D"];
const B0_KEY_HIT: B0HitboxRect = { left: 78, top: 49, width: 20, height: 18 };
const B0_NOTE_HIT: B0HitboxRect = { left: 46, top: 66, width: 20, height: 20 };
const B0_HITBOXES: Record<B0HitboxKey, B0HitboxRect> = {
  S1_KEY: B0_KEY_HIT,
  S1_NOTE: B0_NOTE_HIT,
};
const INVENTORY_LABELS: Record<string, string> = {
  S1_KEY: "Anahtar",
  S1_NOTE: "Islak Not",
  S2_BADGE: "Rozet",
  S3_NOTE: "Not",
  S4_WATCH: "Saat",
  S5_PLATE: "Plaka",
  HATCH: "Kapak",
};
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
    bg: "/assets/img/beach/beach_b0.png",
    hotspots: [
      {
        id: "S1_KEY",
        label: "Anahtar",
        obj: "/assets/img/beach/obj1_key.png",
        pos: { left: 83.3, top: 80.4 },
        renderSprite: false,
      },
      {
        id: "S1_NOTE",
        label: "Not",
        obj: "/assets/img/beach/obj3_note.png",
        pos: { left: 77.3, top: 84.4 },
        renderSprite: false,
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
      obj: "/assets/img/beach/obj_hatch.png",
      pos: { left: 55, top: 83.6 },
    },
  ],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isB0HitboxKey(id: string): id is B0HitboxKey {
  return id === "S1_KEY" || id === "S1_NOTE";
}

export function BeachScene({
  worldShakeClass,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onEnterTunnel,
}: BeachSceneProps) {
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
  const [s1PuzzleSlots, setS1PuzzleSlots] = useState<Array<S1PuzzlePiece | null>>([null, null, null, null, null]);
  const [s1SelectedPiece, setS1SelectedPiece] = useState<S1PuzzlePiece | null>(null);

  const [posMode, setPosMode] = useState(false);
  const [showHitboxDebug, setShowHitboxDebug] = useState(false);
  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null);
  const [devHotspotPositions, setDevHotspotPositions] = useState<Record<string, HotspotPosition>>({});
  const [posToast, setPosToast] = useState<PosToast | null>(null);

  const dragRef = useRef<DragMeta | null>(null);
  const timersRef = useRef<number[]>([]);
  const posToastTimerRef = useRef<number | null>(null);

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
  const activeSceneHotspots = activeStep.hotspots;
  const s1NoteHotspot = activeSceneHotspots.find((hotspot) => hotspot.id === "S1_NOTE");
  const visibleHotspots = posMode
    ? activeSceneHotspots
    : activeSceneHotspots.filter((hotspot) => !collectedIds.has(hotspot.id));
  const b0HitboxHotspots = useMemo(
    () => (isB0Scene ? visibleHotspots.filter((hotspot) => isB0HitboxKey(hotspot.id)) : []),
    [isB0Scene, visibleHotspots]
  );

  const b0ItemsVisibleCount = activeSceneId === "B0" ? visibleHotspots.length : 0;
  const collectedCount = collectedIds.size;
  const inventoryItems = useMemo(() => {
    const orderedIds: string[] = [];
    for (const step of BEACH_STEPS) {
      for (const hotspot of step.hotspots) {
        if (!orderedIds.includes(hotspot.id)) orderedIds.push(hotspot.id);
      }
    }
    return orderedIds
      .filter((id) => collectedIds.has(id))
      .map((id) => INVENTORY_LABELS[id] ?? id);
  }, [collectedIds]);
  const bgName = useMemo(() => {
    const parts = activeStep.bg.split("/");
    return parts[parts.length - 1] ?? activeStep.bg;
  }, [activeStep.bg]);

  const isS1KeyPanel = overlayTarget === "scene" && selectedHotspot?.id === "S1_KEY";
  const isS1NotePanel = overlayTarget === "scene" && selectedHotspot?.id === "S1_NOTE";
  const overlayTitle = isS1KeyPanel ? "Paslı Anahtar" : isS1NotePanel ? "Kenar Notu" : "Nesneyi incele";
  const overlayDescription = isS1KeyPanel
    ? "Soğuk… sanki biraz önce tutulmuş."
    : isS1NotePanel
      ? "Halkanın çentikleri yerlerini ister. Kenarlarından başla."
    : overlayTarget === "hatch"
      ? "Kapak acik. Asagi inis icin gecis hazir."
      : "Kayit tamamlandi. Panel kapaninca bir sonraki sahneye gecilecek.";
  const overlayButtonLabel = overlayTarget === "hatch" ? "Kapat ve Tunnel'a gec" : "Kapat";

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

  const openS1Puzzle = useCallback(() => {
    setS1PuzzleOpen(true);
    setS1PuzzleAdvancing(false);
    setS1PuzzleStatus(null);
    setS1PuzzleSlots([null, null, null, null, null]);
    setS1SelectedPiece(null);
  }, []);

  const onS1PieceSelect = useCallback(
    (piece: S1PuzzlePiece) => {
      if (s1PuzzleAdvancing) return;

      setS1PuzzleStatus(null);
      setS1SelectedPiece(piece);
      setS1PuzzleSlots((prev) => prev.map((slotPiece) => (slotPiece === piece ? null : slotPiece)));
    },
    [s1PuzzleAdvancing]
  );

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
    setS1PuzzleSolved(true);
    setS1PuzzleAdvancing(true);
    setS1PuzzleStatus("Anahtar kilidi hatırladı.");

    schedule(() => {
      setS1PuzzleOpen(false);
      setS1PuzzleAdvancing(false);
      setTransitionText("Kilit çözüldü. Tunnel açılıyor...");
      runFade(
        () => {
          onEnterTunnel();
        },
        () => {
          setTransitionText(null);
        }
      );
    }, 700);
  }, [onEnterTunnel, runFade, schedule]);

  const onS1SlotClick = useCallback(
    (index: number) => {
      if (s1PuzzleAdvancing) return;

      if (!s1SelectedPiece) {
        const pieceOnSlot = s1PuzzleSlots[index];
        if (!pieceOnSlot) return;

        setS1PuzzleStatus(null);
        setS1SelectedPiece(pieceOnSlot);
        setS1PuzzleSlots((prev) => {
          const next = [...prev];
          next[index] = null;
          return next;
        });
        return;
      }

      const nextSlots = [...s1PuzzleSlots].map((slotPiece) => (slotPiece === s1SelectedPiece ? null : slotPiece));
      const replacedPiece = nextSlots[index];
      nextSlots[index] = s1SelectedPiece;

      setS1PuzzleStatus(null);
      setS1PuzzleSlots(nextSlots);
      setS1SelectedPiece(replacedPiece ?? null);

      const allFilled = nextSlots.every((slotPiece): slotPiece is S1PuzzlePiece => slotPiece !== null);
      if (!allFilled) return;

      const isCorrect = nextSlots.every((slotPiece, slotIndex) => slotPiece === S1_PUZZLE_TARGET[slotIndex]);
      if (isCorrect) {
        completeS1Puzzle();
      } else {
        setS1PuzzleStatus("Dizilim kilide uymadı. Parçaları yeniden yerleştir.");
      }
    },
    [completeS1Puzzle, s1PuzzleAdvancing, s1PuzzleSlots, s1SelectedPiece]
  );

  const advanceScene = useCallback(
    (fromIndex: number) => {
      if (fromIndex === 3) {
        setTransitionText("Run 1 tamamlandi. Run 2 basliyor...");
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
    [runFade]
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
      setTransitionText("Kapak aciliyor...");
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
  ]);

  const devNext = useCallback(() => {
    if (!isDev || busy) return;

    if (overlayOpen) {
      closeOverlay();
      return;
    }

    if (hatchVisible) {
      setTransitionText("DEV: Tunnel'a geciliyor...");
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

  const onHotspotClick = useCallback(
    (hotspot: BeachHotspot) => {
      if (posMode) return;
      openOverlay(hotspot);
    },
    [openOverlay, posMode]
  );

  const onB0HitboxClick = useCallback(
    (hotspot: BeachHotspot) => {
      if (hotspot.id === "S1_KEY") {
        console.log("B0_KEY hit");
      } else if (hotspot.id === "S1_NOTE") {
        console.log("B0_NOTE hit");
      }
      onHotspotClick(hotspot);
    },
    [onHotspotClick]
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulseTick((prev) => prev + 1);
    }, 80);

    return () => {
      window.clearInterval(id);
    };
  }, []);

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
    };
  }, [clearTimers]);

  return (
    <div
      className={worldShakeClass}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#05070b",
      }}
      onTouchStart={isB0Scene ? undefined : onTouchStart}
      onTouchMove={isB0Scene ? undefined : onTouchMove}
      onTouchEnd={isB0Scene ? undefined : onTouchEnd}
      onTouchCancel={isB0Scene ? undefined : onTouchEnd}
      aria-label="Beach"
    >
      <img
        src={activeStep.bg}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

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
          const isS1ClusterKey = activeSceneId === "B0" && isS1Key;
          const isS1ClusterNote = activeSceneId === "B0" && isS1Note;
          const shouldRenderSprite = hotspot.renderSprite !== false;
          const usesB0Hitbox = isB0Scene && isB0HitboxKey(hotspot.id);
          const hotspotPosBase = getHotspotPosition(hotspot);
          const s1NotePos = s1NoteHotspot ? getHotspotPosition(s1NoteHotspot) : null;
          const hotspotPos =
            isS1ClusterKey && s1NotePos && shouldRenderSprite
              ? {
                  left: clamp(s1NotePos.left + 1.8, 0, 100),
                  top: clamp(s1NotePos.top - 0.6, 0, 100),
                }
              : hotspotPosBase;
          const hotspotScale = busy ? 1 : pulseScale;
          const hotspotZIndex = isS1Key ? 30 : isS1Note ? 20 : 1;
          const shouldRenderShadow = !isS1Key;
          const hotspotImageFilter = isS1ClusterKey
            ? "drop-shadow(0 6px 6px rgba(0,0,0,0.35))"
            : isS1Key
              ? OBJECT_VISUAL_TUNING.dropShadow
              : `${OBJECT_VISUAL_TUNING.toneFilter} ${OBJECT_VISUAL_TUNING.hazeBlur} ${OBJECT_VISUAL_TUNING.dropShadow}`;
          const hotspotMixBlendMode = isS1Key ? "normal" : "multiply";
          const hotspotImageTransform = isS1ClusterKey
            ? "rotate(0deg) rotateX(0deg) rotateZ(0deg) scale(0.90)"
            : isS1Key
              ? `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${hotspotScale})`
              : `perspective(900px) rotateX(58deg) rotateZ(-8deg) scale(${hotspotScale})`;

          if (!shouldRenderSprite || usesB0Hitbox) return null;

          if (isS1Note) {
            const noteScale = hotspotScale * 1.08;
            return (
              <button
                key={hotspot.id}
                type="button"
                onClick={() => onHotspotClick(hotspot)}
                onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
                disabled={busy}
                aria-label={hotspot.label}
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
                  cursor: posMode ? (draggingHotspotId === hotspot.id ? "grabbing" : "grab") : "pointer",
                  pointerEvents: "auto",
                  touchAction: posMode ? "none" : "manipulation",
                }}
              >
                <img
                  src={hotspot.obj}
                  alt={hotspot.label}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    background: "transparent",
                    opacity: isS1ClusterNote ? 0.96 : pulseOpacity,
                    filter: isS1ClusterNote ? "brightness(0.95)" : undefined,
                    transform: isS1ClusterNote ? "rotate(4deg) scale(1.08)" : `scale(${noteScale})`,
                    transformOrigin: "50% 50%",
                    position: isS1ClusterNote ? "relative" : undefined,
                    zIndex: isS1ClusterNote ? 20 : undefined,
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
              onClick={() => onHotspotClick(hotspot)}
              onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
              disabled={busy}
              aria-label={hotspot.label}
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
                cursor: posMode ? (draggingHotspotId === hotspot.id ? "grabbing" : "grab") : "pointer",
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
                  alt={hotspot.label}
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
                    position: isS1ClusterKey ? "relative" : undefined,
                    zIndex: isS1ClusterKey ? 30 : undefined,
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

      {isB0Scene && b0HitboxHotspots.length > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9999,
            pointerEvents: overlayOpen || s1PuzzleOpen || busy ? "none" : "auto",
          }}
        >
          {b0HitboxHotspots.map((hotspot) => {
            const hitbox = B0_HITBOXES[hotspot.id];
            const showDebug = isDev && showHitboxDebug;

            return (
              <button
                key={`hitbox-${hotspot.id}`}
                type="button"
                onClick={() => onB0HitboxClick(hotspot)}
                onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
                disabled={busy}
                aria-label={`${hotspot.label} hitbox`}
                style={{
                  position: "absolute",
                  left: `${hitbox.left}%`,
                  top: `${hitbox.top}%`,
                  width: `${hitbox.width}%`,
                  height: `${hitbox.height}%`,
                  border: 0,
                  outline: showDebug ? "2px solid red" : "none",
                  borderRadius: 6,
                  background: showDebug ? "rgba(255,0,0,0.08)" : "transparent",
                  margin: 0,
                  padding: 0,
                  zIndex: 9999,
                  pointerEvents: "auto",
                  cursor: posMode ? (draggingHotspotId === hotspot.id ? "grabbing" : "grab") : "pointer",
                  touchAction: posMode ? "none" : "manipulation",
                }}
              />
            );
          })}
        </div>
      )}

      <div
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
        {isDev && activeSceneHotspots[0] && (
          <div>
            POS={posMode ? "ON" : "OFF"} {activeSceneId} pos: {getHotspotPosition(activeSceneHotspots[0]).left.toFixed(1)},{getHotspotPosition(activeSceneHotspots[0]).top.toFixed(1)}
          </div>
        )}
        {isDev && activeSceneId === "B0" && <div>B0 items visible: {b0ItemsVisibleCount}</div>}
      </div>

      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 20,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(5,8,12,.72)",
          color: "#eef2fb",
          fontSize: 12,
          lineHeight: 1.35,
          minWidth: 168,
          maxWidth: 260,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Envanter ({inventoryItems.length})</div>
        {inventoryItems.length === 0 ? (
          <div style={{ opacity: 0.72 }}>- Bos</div>
        ) : (
          inventoryItems.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden style={{ width: 4, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
              <span>- {item}</span>
            </div>
          ))
        )}
      </div>

      {isDev && (
        <button
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
          <button
            type="button"
            onClick={() => setShowHitboxDebug((prev) => !prev)}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.26)",
              background: showHitboxDebug ? "rgba(190,52,52,.28)" : "rgba(6,10,16,.92)",
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
            HITBOX: {showHitboxDebug ? "ON" : "OFF"}
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
            Kopyala
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

      {s1PuzzleOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 33,
            display: "grid",
            placeItems: "center",
            background: "rgba(2,6,11,.82)",
            padding: 14,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Anahtar Halkası"
            style={{
              width: "min(94vw, 640px)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,.22)",
              background: "rgba(11,15,22,.96)",
              boxShadow: "0 20px 56px rgba(0,0,0,.5)",
              padding: "16px 14px",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ color: "#eef2fb", fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>Anahtar Halkası</div>
            <div style={{ color: "#d7e0f5", fontSize: 13, lineHeight: 1.35 }}>
              Parçayı seç, sonra boş bir yuvaya dokun.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {s1PuzzleSlots.map((slotPiece, slotIndex) => (
                <button
                  key={`slot-${slotIndex}`}
                  type="button"
                  onClick={() => onS1SlotClick(slotIndex)}
                  disabled={s1PuzzleAdvancing}
                  style={{
                    minHeight: 58,
                    borderRadius: 12,
                    border: "1px dashed rgba(255,255,255,.34)",
                    background: slotPiece ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.04)",
                    color: "#f2f5fb",
                    fontSize: 20,
                    fontWeight: 800,
                    cursor: s1PuzzleAdvancing ? "default" : "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  {slotPiece ?? "•"}
                </button>
              ))}
            </div>

            <div style={{ color: "#d7e0f5", fontSize: 12, letterSpacing: ".04em", opacity: 0.88 }}>PARÇALAR</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {S1_PUZZLE_PIECES.map((piece) => {
                const isSelected = s1SelectedPiece === piece;
                const isPlaced = s1PuzzleSlots.includes(piece) && !isSelected;
                return (
                  <button
                    key={piece}
                    type="button"
                    onClick={() => onS1PieceSelect(piece)}
                    disabled={s1PuzzleAdvancing}
                    style={{
                      minHeight: 56,
                      borderRadius: 12,
                      border: isSelected ? "1px solid rgba(132,196,255,.95)" : "1px solid rgba(255,255,255,.3)",
                      background: isSelected
                        ? "rgba(102,165,240,.26)"
                        : isPlaced
                          ? "rgba(255,255,255,.06)"
                          : "rgba(255,255,255,.12)",
                      color: "#f2f5fb",
                      fontSize: 20,
                      fontWeight: 800,
                      opacity: isPlaced ? 0.7 : 1,
                      cursor: s1PuzzleAdvancing ? "default" : "pointer",
                      touchAction: "manipulation",
                    }}
                  >
                    {piece}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ color: "#eef2fb", fontSize: 13 }}>Seçili parça: {s1SelectedPiece ?? "Yok"}</div>
              <button
                type="button"
                onClick={() => {
                  if (s1PuzzleAdvancing) return;
                  setS1PuzzleStatus(null);
                  setS1SelectedPiece(null);
                  setS1PuzzleSlots([null, null, null, null, null]);
                }}
                disabled={s1PuzzleAdvancing}
                style={{
                  minHeight: 40,
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
                Sıfırla
              </button>
            </div>

            {s1PuzzleStatus && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.18)",
                  background:
                    s1PuzzleStatus === "Anahtar kilidi hatırladı." ? "rgba(62,170,106,.26)" : "rgba(255,255,255,.08)",
                  color: "#eef2fb",
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  padding: "10px 12px",
                }}
              >
                {s1PuzzleStatus}
              </div>
            )}
          </div>
        </div>
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
            aria-label="Nesneyi incele"
            style={{
              width: "min(92vw, 520px)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,.22)",
              background: "rgba(10,13,19,.95)",
              boxShadow: "0 18px 56px rgba(0,0,0,.45)",
              padding: "18px 18px 16px",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.75 }}>
              {overlayTitle}
            </div>

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

              {isS1NotePanel ? (
                <div style={{ color: "#eef2fb", fontSize: 14, lineHeight: 1.4, display: "grid", gap: 10 }}>
                  <div>{overlayDescription}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      aria-hidden
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minHeight: 18,
                      }}
                    >
                      <span style={{ width: 34, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
                      <span style={{ width: 20, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
                      <span style={{ width: 28, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
                      <span style={{ width: 20, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
                      <span style={{ width: 34, height: 4, borderRadius: 999, background: "#d7e0f5" }} />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.82 }}>uzun-kısa-orta-kısa-uzun</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "#eef2fb", fontSize: 14, lineHeight: 1.4 }}>{overlayDescription}</div>
              )}
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
