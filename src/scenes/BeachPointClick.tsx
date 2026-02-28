import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferredAssetPath } from "../game/usePreferredAssetPath";

type BeachRun = 1 | 2;
type HotspotRun = BeachRun | "both";
type HotspotType = "LOOT" | "EXIT";

type HotspotPosition = {
  leftPct: number;
  bottomPct: number;
};

type BeachHotspot = {
  id: string;
  sceneId: string;
  title: string;
  desc: string;
  run: HotspotRun;
  worldMeters: number;
  radiusPx: number;
  givesItemId?: string;
  type: HotspotType;
};

type BeachPointClickProps = {
  onEnterTunnel: () => void;
  devToolsEnabled?: boolean;
  showHotspots?: boolean;
};

type MovementTween = {
  fromMeters: number;
  toMeters: number;
  startMs: number;
  durationMs: number;
  onComplete?: () => void;
};

const MAX_INVENTORY = 5;
const WORLD_END_METERS = 1400;
const HOTSPOT_VISIBILITY_RANGE_M = 320;
const TRAVEL_DURATION_MS = 1500;
const RUN_TRANSITION_MS = 1000;
const TUNNEL_TRANSITION_MS = 1000;
const WALK_HINT_MS = 600;
const CAMERA_LERP = 0.08;
const ZOOM_LERP = 0.1;
const CAMERA_EDGE_MARGIN = 0.08;

const BEACH_BG_S1_CANDIDATES = [
  "/assets/img/beach/beach_s1.png",
  "/assets/img/beach/bg_back.jpg",
  "/assets/img/beach/bg.jpg",
] as const;
const BEACH_BG_S2_CANDIDATES = [
  "/assets/img/beach/beach_s2.png",
  "/assets/img/beach/bg_back.jpg",
  "/assets/img/beach/bg.jpg",
] as const;
const BEACH_BG_S3_CANDIDATES = [
  "/assets/img/beach/beach_s3.png",
  "/assets/img/beach/bg_back.jpg",
  "/assets/img/beach/bg.jpg",
] as const;
const BEACH_BG_S4_CANDIDATES = [
  "/assets/img/beach/beach_s4.png",
  "/assets/img/beach/bg_back.jpg",
  "/assets/img/beach/bg.jpg",
] as const;

const BEACH_FOREGROUND_LAYER_CANDIDATES = [
  "/assets/img/beach/railings_fg.png",
  "/assets/img/beach/railings_fg.webp",
  "/assets/img/beach/fg_railings.png",
  "/assets/img/beach/bg_front.png",
] as const;

const HOTSPOTS: BeachHotspot[] = [
  {
    id: "LC_A",
    sceneId: "S1 key",
    title: "Pasli Kutup Feneri",
    desc: "Kiyiya vurmus pasli bir deniz ekipmani. Uzerinde eski bir isaret var.",
    run: 1,
    worldMeters: 260,
    radiusPx: 46,
    givesItemId: "LC_A",
    type: "LOOT",
  },
  {
    id: "LC_B",
    sceneId: "S2 badge",
    title: "Cam Sis Kupu",
    desc: "Nemli cam yuzeyin altinda sanki bir isaret saklanmis.",
    run: 1,
    worldMeters: 540,
    radiusPx: 46,
    givesItemId: "LC_B",
    type: "LOOT",
  },
  {
    id: "LC_C",
    sceneId: "S3 note",
    title: "Kirik Kilit Mekanizmasi",
    desc: "Mekanizma bozulmus ama ustundeki cizikler hala yeni gorunuyor.",
    run: 1,
    worldMeters: 820,
    radiusPx: 46,
    givesItemId: "LC_C",
    type: "LOOT",
  },
  {
    id: "CIPHER_1",
    sceneId: "S4 watch",
    title: "Kirik Bileklik Saat",
    desc: "Cami catlamis bir saat. Kadranin ustunde silik bir sembol kalmis.",
    run: 2,
    worldMeters: 1100,
    radiusPx: 46,
    givesItemId: "CIPHER_1",
    type: "LOOT",
  },
  {
    id: "CIPHER_2",
    sceneId: "S5 plate",
    title: "Islak Not Parcasi",
    desc: "Tuzlu suyla dagilmis nottan okunabilen tek bir satir kalmis.",
    run: 2,
    worldMeters: 1350,
    radiusPx: 46,
    givesItemId: "CIPHER_2",
    type: "LOOT",
  },
  {
    id: "EXIT_MANHOLE",
    sceneId: "Hatch",
    title: "Yer Alti Kapagi",
    desc: "Kapagi araliyorsun...",
    run: 2,
    worldMeters: 1400,
    radiusPx: 52,
    type: "EXIT",
  },
];

const HOTSPOT_SCENE_POSITIONS: Record<string, HotspotPosition> = {
  LC_A: { leftPct: 82, bottomPct: 12 },
  LC_B: { leftPct: 60, bottomPct: 14 },
  LC_C: { leftPct: 72, bottomPct: 10 },
  CIPHER_1: { leftPct: 35, bottomPct: 14 },
  CIPHER_2: { leftPct: 68, bottomPct: 12 },
  EXIT_MANHOLE: { leftPct: 50, bottomPct: 8 },
};

const RUN1_LOOT_IDS = ["LC_A", "LC_B", "LC_C"] as const;
const RUN2_LOOT_IDS = ["CIPHER_1", "CIPHER_2"] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

const metersToCameraX = (meters: number) => {
  const normalized = clamp(meters / WORLD_END_METERS, 0, 1);
  return clamp(CAMERA_EDGE_MARGIN + normalized * (1 - CAMERA_EDGE_MARGIN * 2), 0, 1);
};

export function BeachPointClick({
  onEnterTunnel,
  devToolsEnabled = false,
  showHotspots = false,
}: BeachPointClickProps) {
  const [beachRun, setBeachRun] = useState<BeachRun>(1);
  const [inventory, setInventory] = useState<string[]>([]);
  const [collected, setCollected] = useState<Record<string, boolean>>({});
  const [hotspotPositions, setHotspotPositions] = useState<Record<string, HotspotPosition>>(HOTSPOT_SCENE_POSITIONS);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [playerProgressMeters, setPlayerProgressMeters] = useState(0);
  const [cameraX, setCameraX] = useState(() => metersToCameraX(0));
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [isTraveling, setIsTraveling] = useState(false);
  const [showWalkHint, setShowWalkHint] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [motionOverlayActive, setMotionOverlayActive] = useState(false);
  const [hotspotVisualActive, setHotspotVisualActive] = useState(false);
  const [isPosModeEnabled, setIsPosModeEnabled] = useState(false);
  const [isBgDebugEnabled, setIsBgDebugEnabled] = useState(false);
  const [posMessage, setPosMessage] = useState("");

  const beachS1Path = usePreferredAssetPath(BEACH_BG_S1_CANDIDATES);
  const beachS2Path = usePreferredAssetPath(BEACH_BG_S2_CANDIDATES);
  const beachS3Path = usePreferredAssetPath(BEACH_BG_S3_CANDIDATES);
  const beachS4Path = usePreferredAssetPath(BEACH_BG_S4_CANDIDATES);
  const foregroundLayerPath = usePreferredAssetPath(BEACH_FOREGROUND_LAYER_CANDIDATES);
  const activeBackLayerFallback = beachS1Path ?? beachS2Path ?? beachS3Path ?? beachS4Path ?? "/assets/img/beach/bg.svg";

  const playerProgressRef = useRef(0);
  const cameraXRef = useRef(metersToCameraX(0));
  const targetCameraXRef = useRef(metersToCameraX(0));
  const bgScaleRef = useRef(1);
  const movementTweenRef = useRef<MovementTween | null>(null);
  const rafRef = useRef<number | null>(null);
  const tunnelTransitionTimeoutRef = useRef<number | null>(null);
  const walkHintTimeoutRef = useRef<number | null>(null);
  const hotspotBandRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ hotspotId: string; pointerId: number } | null>(null);

  const hotspotById = useMemo(() => {
    const byId: Record<string, BeachHotspot> = {};
    HOTSPOTS.forEach((hotspot) => {
      byId[hotspot.id] = hotspot;
    });
    return byId;
  }, []);

  const canUsePosMode = import.meta.env.DEV && devToolsEnabled;
  const showDevOutline = canUsePosMode && (showHotspots || isPosModeEnabled);

  const run1Completed = RUN1_LOOT_IDS.every((id) => collected[id]);
  const run2Completed = RUN2_LOOT_IDS.every((id) => collected[id]);
  const hatchUnlocked = beachRun === 2 && run2Completed;

  const availableHotspots = useMemo(() => {
    return HOTSPOTS.filter((hotspot) => {
      if (hotspot.run !== "both" && hotspot.run !== beachRun) return false;
      if (hotspot.type === "EXIT") return hatchUnlocked;
      return !collected[hotspot.id];
    }).sort((a, b) => a.worldMeters - b.worldMeters);
  }, [beachRun, collected, hatchUnlocked]);

  const activeObjective = availableHotspots[0] ?? null;
  const activeObjectiveDistance = activeObjective
    ? Math.abs(activeObjective.worldMeters - playerProgressMeters)
    : null;

  const canRenderObjective =
    !!activeObjective &&
    activeObjectiveDistance !== null &&
    activeObjectiveDistance <= HOTSPOT_VISIBILITY_RANGE_M &&
    !activeHotspotId &&
    !transitionMessage &&
    !isTraveling;

  const objectivePosition = activeObjective ? hotspotPositions[activeObjective.id] ?? HOTSPOT_SCENE_POSITIONS[activeObjective.id] : null;

  const activeHotspot = useMemo(() => {
    if (!activeHotspotId) return null;
    return HOTSPOTS.find((hotspot) => hotspot.id === activeHotspotId) ?? null;
  }, [activeHotspotId]);

  const targetStatusLabel = useMemo(() => {
    if (transitionMessage) return transitionMessage;
    if (!activeObjective || activeObjectiveDistance === null) return "Su an: Hedef yok";
    return `Su an: ${activeObjective.title} (${Math.max(1, Math.round(activeObjectiveDistance))}m)`;
  }, [activeObjective, activeObjectiveDistance, transitionMessage]);

  const activeBackgroundPath = useMemo(() => {
    const objectiveId = activeObjective?.id;
    if (objectiveId === "LC_A") return beachS1Path ?? activeBackLayerFallback;
    if (objectiveId === "LC_B") return beachS2Path ?? activeBackLayerFallback;
    if (objectiveId === "LC_C") return beachS3Path ?? activeBackLayerFallback;
    if (objectiveId === "CIPHER_1" || objectiveId === "CIPHER_2" || objectiveId === "EXIT_MANHOLE") {
      return beachS4Path ?? activeBackLayerFallback;
    }
    if (beachRun === 1) return beachS1Path ?? activeBackLayerFallback;
    return beachS4Path ?? activeBackLayerFallback;
  }, [activeBackLayerFallback, activeObjective?.id, beachRun, beachS1Path, beachS2Path, beachS3Path, beachS4Path]);

  const activeBackgroundFileName = activeBackgroundPath.split("/").pop() ?? activeBackgroundPath;

  const fogOpacityRaw = transitionMessage ? 0.4 : isTraveling ? 0.3 : motionOverlayActive ? 0.24 : 0.18;
  const fogOpacity = clamp(fogOpacityRaw, 0, 0.45);

  const backgroundStyle = useMemo(
    () =>
      ({
        backgroundPosition: `${(cameraX * 100).toFixed(2)}% center`,
        transform: `scale(${backgroundScale.toFixed(4)})`,
      }) as React.CSSProperties,
    [backgroundScale, cameraX]
  );

  const startTravel = useCallback(
    (
      toMeters: number,
      options: {
        durationMs: number;
        showWalkingHint?: boolean;
        onComplete?: () => void;
      }
    ) => {
      if (movementTweenRef.current) return false;

      const destination = clamp(toMeters, 0, WORLD_END_METERS);
      movementTweenRef.current = {
        fromMeters: playerProgressRef.current,
        toMeters: destination,
        startMs: performance.now(),
        durationMs: options.durationMs,
        onComplete: options.onComplete,
      };

      targetCameraXRef.current = metersToCameraX(destination);
      setIsTraveling(true);
      setMotionOverlayActive(true);

      if (options.showWalkingHint) {
        setShowWalkHint(true);
        if (walkHintTimeoutRef.current !== null) {
          window.clearTimeout(walkHintTimeoutRef.current);
        }
        walkHintTimeoutRef.current = window.setTimeout(() => {
          setShowWalkHint(false);
        }, WALK_HINT_MS);
      }

      return true;
    },
    []
  );

  const updateHotspotPositionFromPointer = useCallback((hotspotId: string, clientX: number, clientY: number) => {
    const band = hotspotBandRef.current;
    if (!band) return;

    const rect = band.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const leftPct = clamp(((clientX - rect.left) / rect.width) * 100, 2, 98);
    const bottomPct = clamp(((rect.bottom - clientY) / rect.height) * 100, 2, 98);

    setHotspotPositions((prev) => {
      const current = prev[hotspotId];
      if (current && Math.abs(current.leftPct - leftPct) < 0.05 && Math.abs(current.bottomPct - bottomPct) < 0.05) {
        return prev;
      }
      return {
        ...prev,
        [hotspotId]: { leftPct, bottomPct },
      };
    });
  }, []);

  const announceHotspotPosition = useCallback(
    (hotspotId: string) => {
      const hotspot = hotspotById[hotspotId];
      const position = hotspotPositions[hotspotId];
      if (!hotspot || !position) return;

      const line = `${hotspot.sceneId} left=${Math.round(position.leftPct)} bottom=${Math.round(position.bottomPct)}`;
      setPosMessage(line);
      console.log(`[Beach POS] ${line}`);
    },
    [hotspotById, hotspotPositions]
  );

  const handleHotspotClick = useCallback(
    (hotspot: BeachHotspot) => {
      if (isTraveling || transitionMessage) return;
      if (isPosModeEnabled && canUsePosMode) return;

      if (hotspot.type === "EXIT") {
        startTravel(hotspot.worldMeters, {
          durationMs: TRAVEL_DURATION_MS,
          showWalkingHint: true,
          onComplete: () => {
            setTransitionMessage("Kapak aciliyor...");
            setMotionOverlayActive(true);
            if (tunnelTransitionTimeoutRef.current !== null) {
              window.clearTimeout(tunnelTransitionTimeoutRef.current);
            }
            tunnelTransitionTimeoutRef.current = window.setTimeout(() => {
              onEnterTunnel();
            }, TUNNEL_TRANSITION_MS);
          },
        });
        return;
      }

      startTravel(hotspot.worldMeters, {
        durationMs: TRAVEL_DURATION_MS,
        showWalkingHint: true,
        onComplete: () => {
          setActiveHotspotId(hotspot.id);
        },
      });
    },
    [canUsePosMode, isPosModeEnabled, isTraveling, onEnterTunnel, startTravel, transitionMessage]
  );

  const collectActiveHotspot = useCallback(() => {
    if (!activeHotspot || activeHotspot.type !== "LOOT") return;
    if (collected[activeHotspot.id]) return;

    setCollected((prev) => ({ ...prev, [activeHotspot.id]: true }));
    if (activeHotspot.givesItemId) {
      setInventory((prev) => {
        if (prev.includes(activeHotspot.givesItemId!)) return prev;
        if (prev.length >= MAX_INVENTORY) return prev;
        return [...prev, activeHotspot.givesItemId!];
      });
    }
    setActiveHotspotId(null);
  }, [activeHotspot, collected]);

  useEffect(() => {
    if (!canUsePosMode) {
      setIsPosModeEnabled(false);
      setIsBgDebugEnabled(false);
      setPosMessage("");
    }
  }, [canUsePosMode]);

  useEffect(() => {
    if (beachRun !== 1 || !run1Completed) return;
    if (isTraveling || transitionMessage) return;

    setActiveHotspotId(null);
    setTransitionMessage("SISTEM KAYDI GUNCELLENIYOR...");
    startTravel(1080, {
      durationMs: RUN_TRANSITION_MS,
      onComplete: () => {
        setBeachRun(2);
        setTransitionMessage(null);
      },
    });
  }, [beachRun, isTraveling, run1Completed, startTravel, transitionMessage]);

  useEffect(() => {
    const tick = (now: number) => {
      const tween = movementTweenRef.current;
      if (tween) {
        const normalized = clamp((now - tween.startMs) / tween.durationMs, 0, 1);
        const eased = smoothstep(normalized);
        const meters = tween.fromMeters + (tween.toMeters - tween.fromMeters) * eased;
        playerProgressRef.current = meters;

        setPlayerProgressMeters((prev) => (Math.abs(prev - meters) < 0.25 ? prev : meters));

        if (normalized >= 1) {
          movementTweenRef.current = null;
          playerProgressRef.current = tween.toMeters;
          setPlayerProgressMeters(tween.toMeters);
          setIsTraveling(false);
          setMotionOverlayActive(false);
          tween.onComplete?.();
        }
      } else {
        targetCameraXRef.current = metersToCameraX(playerProgressRef.current);
      }

      const nextCamera = cameraXRef.current + (targetCameraXRef.current - cameraXRef.current) * CAMERA_LERP;
      cameraXRef.current = nextCamera;
      setCameraX((prev) => (Math.abs(prev - nextCamera) < 0.0005 ? prev : nextCamera));

      const wantedScale = movementTweenRef.current ? 1.03 : 1;
      const nextScale = bgScaleRef.current + (wantedScale - bgScaleRef.current) * ZOOM_LERP;
      bgScaleRef.current = nextScale;
      setBackgroundScale((prev) => (Math.abs(prev - nextScale) < 0.0005 ? prev : nextScale));

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tunnelTransitionTimeoutRef.current !== null) {
        window.clearTimeout(tunnelTransitionTimeoutRef.current);
      }
      if (walkHintTimeoutRef.current !== null) {
        window.clearTimeout(walkHintTimeoutRef.current);
      }
    };
  }, []);

  const hotspotVisualOn = showDevOutline || isPosModeEnabled || hotspotVisualActive;

  const hotspotButtonStyle: React.CSSProperties = {
    width: activeObjective ? `${activeObjective.radiusPx * 2}px` : "88px",
    height: activeObjective ? `${activeObjective.radiusPx * 2}px` : "88px",
    borderRadius: "999px",
    border: "none",
    cursor: canUsePosMode && isPosModeEnabled ? "grab" : "pointer",
    background: hotspotVisualOn ? "rgba(120,200,160,.08)" : "transparent",
    boxShadow: hotspotVisualOn
      ? showDevOutline || isPosModeEnabled
        ? "0 0 0 1px rgba(70,190,110,.65), 0 0 20px rgba(70,190,110,.42)"
        : "0 0 0 1px rgba(120,200,160,.2), 0 0 14px rgba(80,220,130,.22)"
      : "none",
    outline: showDevOutline || isPosModeEnabled ? "1px dashed rgba(140,230,170,.65)" : "none",
    outlineOffset: "2px",
    transform: "translateX(-50%)",
    transition: "background-color .2s ease, box-shadow .2s ease, opacity .2s ease",
    animation: hotspotVisualOn && !(showDevOutline || isPosModeEnabled) ? "beachHotspotPulse 1.4s ease-in-out infinite" : "none",
    pointerEvents: "auto",
  };

  return (
    <div className="beachWorldScreen beachWorldRoot">
      <main className="beachWorldMain">
        <div className="beachWorldViewport beachPointClickViewport" style={{ position: "relative" }}>
          <div
            className="beachWorldBackgroundLayer"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            <img
              src={activeBackgroundPath}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: backgroundStyle.backgroundPosition,
                transform: backgroundStyle.transform,
                transformOrigin: "center center",
                display: "block",
                userSelect: "none",
              }}
            />
          </div>

          {!isBgDebugEnabled && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                pointerEvents: "none",
                opacity: fogOpacity,
                background:
                  "radial-gradient(circle at 50% 48%, rgba(245,250,255,.12), transparent 58%), radial-gradient(circle at 20% 16%, rgba(220,240,255,.14), transparent 40%), linear-gradient(to bottom, rgba(8,11,16,.08), rgba(7,10,15,.22))",
                transition: "opacity .25s ease",
              }}
            />
          )}

          <div className="beachPointClickHud" style={{ zIndex: 3 }}>
            <div className="beachPointClickChip">{`RUN ${beachRun}/2`}</div>
            <div className="beachPointClickChip">{`Envanter: ${inventory.length}/${MAX_INVENTORY}`}</div>
            <div className="beachPointClickChip beachPointClickTargetChip">{targetStatusLabel}</div>
            {canUsePosMode && (
              <button
                type="button"
                className="beachPointClickChip"
                onClick={() => setIsPosModeEnabled((prev) => !prev)}
                style={{ cursor: "pointer", pointerEvents: "auto", color: isPosModeEnabled ? "#9cffb4" : undefined }}
              >
                {isPosModeEnabled ? "POS ON" : "POS"}
              </button>
            )}
            {canUsePosMode && (
              <button
                type="button"
                className="beachPointClickChip"
                onClick={() => setIsBgDebugEnabled((prev) => !prev)}
                style={{ cursor: "pointer", pointerEvents: "auto", color: isBgDebugEnabled ? "#9cffb4" : undefined }}
              >
                {isBgDebugEnabled ? "BG ON" : "BG"}
              </button>
            )}
            {import.meta.env.DEV && devToolsEnabled && (
              <div className="beachPointClickChip">{`Test: ${Math.round(playerProgressMeters)}m | Cam ${Math.round(cameraX * 100)}%`}</div>
            )}
            {import.meta.env.DEV && devToolsEnabled && (
              <div className="beachPointClickChip">{`bg=${activeBackgroundFileName} fog=${fogOpacity.toFixed(2)}`}</div>
            )}
          </div>

          <div
            ref={hotspotBandRef}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "42%",
              zIndex: 2,
              pointerEvents: "none",
              background: canUsePosMode && isPosModeEnabled ? "rgba(0,255,0,0.08)" : "transparent",
              borderTop: canUsePosMode && isPosModeEnabled ? "1px dashed rgba(0,255,0,0.35)" : "none",
            }}
            aria-hidden="true"
          >
            {canRenderObjective && activeObjective && objectivePosition && (
              <button
                type="button"
                onClick={() => handleHotspotClick(activeObjective)}
                onPointerEnter={() => setHotspotVisualActive(true)}
                onPointerLeave={() => setHotspotVisualActive(false)}
                onFocus={() => setHotspotVisualActive(true)}
                onBlur={() => setHotspotVisualActive(false)}
                onPointerDown={(event) => {
                  if (canUsePosMode && isPosModeEnabled) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragStateRef.current = { hotspotId: activeObjective.id, pointerId: event.pointerId };
                    updateHotspotPositionFromPointer(activeObjective.id, event.clientX, event.clientY);
                    return;
                  }
                  setHotspotVisualActive(true);
                }}
                onPointerMove={(event) => {
                  const drag = dragStateRef.current;
                  if (!drag) return;
                  if (drag.hotspotId !== activeObjective.id || drag.pointerId !== event.pointerId) return;
                  event.preventDefault();
                  updateHotspotPositionFromPointer(activeObjective.id, event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  const drag = dragStateRef.current;
                  if (drag && drag.hotspotId === activeObjective.id && drag.pointerId === event.pointerId) {
                    event.preventDefault();
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    dragStateRef.current = null;
                    announceHotspotPosition(activeObjective.id);
                    return;
                  }
                  setHotspotVisualActive(false);
                }}
                onPointerCancel={(event) => {
                  const drag = dragStateRef.current;
                  if (drag && drag.hotspotId === activeObjective.id && drag.pointerId === event.pointerId) {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    dragStateRef.current = null;
                    announceHotspotPosition(activeObjective.id);
                    return;
                  }
                  setHotspotVisualActive(false);
                }}
                aria-label={activeObjective.title}
                style={{
                  ...hotspotButtonStyle,
                  position: "absolute",
                  left: `${objectivePosition.leftPct}%`,
                  bottom: `${objectivePosition.bottomPct}%`,
                }}
              >
                {(showDevOutline || isPosModeEnabled) && (
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "999px",
                      background: "rgba(140,245,180,.95)",
                      boxShadow: "0 0 12px rgba(80,220,130,.65)",
                      display: "inline-block",
                    }}
                  />
                )}
              </button>
            )}
          </div>

          {showWalkHint && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: "absolute",
                left: "50%",
                bottom: 40,
                transform: "translateX(-50%)",
                zIndex: 2800,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(8,11,16,.72)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".08em",
              }}
            >
              YURUYOR...
            </div>
          )}

          {canUsePosMode && isPosModeEnabled && posMessage && (
            <div
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                zIndex: 3000,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(90,255,140,.35)",
                background: "rgba(10,20,12,.76)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".02em",
              }}
            >
              {posMessage}
            </div>
          )}

          {foregroundLayerPath && (
            <div
              className="beachWorldForegroundLayer"
              style={{ backgroundImage: `url("${foregroundLayerPath}")` }}
              aria-hidden="true"
            />
          )}

          {transitionMessage && (
            <div className="beachPointClickRunTransition" role="status" aria-live="polite">
              {transitionMessage}
            </div>
          )}
        </div>
      </main>

      {activeHotspot && activeHotspot.type === "LOOT" && (
        <div className="modalOverlay">
          <div className="modalContent beachPointClickModal">
            <div className="modalBody">
              <h2>{activeHotspot.title}</h2>
              <p>{activeHotspot.desc}</p>
              <div className="modalActions">
                <button className="btn danger" type="button" onClick={collectActiveHotspot}>
                  Al
                </button>
                <button className="btn" type="button" onClick={() => setActiveHotspotId(null)}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BeachPointClick;
