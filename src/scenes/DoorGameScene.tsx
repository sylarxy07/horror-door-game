import { useEffect, useRef, useState } from "react";
import type { LevelConfig } from "../game/types";

type DoorEventOverlay = {
  key: number;
  kind: "SAFE" | "MONSTER" | "CURSE";
  text: string;
} | null;

type DoorGameSceneProps = {
  worldShakeClass: string;
  level: number;
  room: number;
  roomsPerFloor: number;
  lives: number;
  maxLives: number;
  corruptionActive: boolean;
  checkpointUnlocked: boolean;
  checkpointLevel: number;
  doorCount: number;
  doorInputLocked: boolean;
  hitPulseKey: number;
  eventOverlay: DoorEventOverlay;
  getDoorClassName: (index: number) => string;
  getDoorVisualLabel: (index: number) => string;
  onDoorPick: (index: number) => void;
  doorHint: string;
  lastOutcome: "SAFE" | "MONSTER" | "CURSE" | null;
  levelConfig: LevelConfig;
  showHotspots: boolean;
};

const DOOR_BG_IMAGE = "/assets/img/door/door_corridor.png";
const CORRIDOR_LABEL = "B\u00d6LGE: KOR\u0130DOR";
const DOOR_OPEN_ANIM_MS = 620;

type DoorHotspotConfig = {
  left: number;
  top: number;
  width: number;
  height: number;
  doorIndex: number;
  label: string;
};

const DOOR_HOTSPOTS: readonly DoorHotspotConfig[] = [
  // 1: sol ondeki
  { left: 2, top: 24, width: 18, height: 58, doorIndex: 0, label: "1" },
  // 2: sol arkadaki
  { left: 22, top: 25, width: 13, height: 50, doorIndex: 1, label: "2" },
  // 3: uzak kapi
  { left: 45, top: 31, width: 10, height: 42, doorIndex: 2, label: "3" },
  // 4: sag arkadaki
  { left: 65, top: 25, width: 13, height: 50, doorIndex: 3, label: "4" },
  // 5: sag ondeki
  { left: 80, top: 24, width: 18, height: 58, doorIndex: 4, label: "5" },
] as const;

function rgbaFrom(base: string, alpha: number) {
  const match = base.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!match) return base;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

function ParticleLayer({ type }: { type: string }) {
  if (type === "none") return null;

  const particleCount =
    type === "dust" ? 14 : type === "embers" ? 10 : type === "ash" ? 16 : type === "mist" ? 8 : type === "static" ? 20 : 0;

  return (
    <div className="particleContainer" aria-hidden="true">
      {Array.from({ length: particleCount }).map((_, i) => (
        <div
          key={i}
          className={`particle particle--${type}`}
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${(i * 0.37).toFixed(2)}s`,
            animationDuration: `${(3.5 + Math.random() * 4).toFixed(2)}s`,
            opacity: 0.3 + Math.random() * 0.5,
          }}
        />
      ))}
    </div>
  );
}

function SystemMessageOverlay({ message, level }: { message?: string; level: number }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState(message ?? "");
  const prevLevelRef = useRef(level);

  useEffect(() => {
    if (!message) return;
    if (level !== prevLevelRef.current) {
      prevLevelRef.current = level;
      setText(message);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(t);
    }
  }, [level, message]);

  useEffect(() => {
    if (!message) return;
    setText(message);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible || !text) return null;

  return (
    <div className="sysMsg" aria-live="polite">
      <span className="sysMsgText">{text}</span>
    </div>
  );
}

function GlitchOverlay({ amount }: { amount: string }) {
  if (amount === "none") return null;
  return (
    <div className={`glitchOverlay glitchOverlay--${amount}`} aria-hidden="true">
      <div className="glitchBar glitchBar--1" />
      <div className="glitchBar glitchBar--2" />
      <div className="glitchBar glitchBar--3" />
    </div>
  );
}

function DoorHotspotStyles() {
  return (
    <style>{`
      .doorHudCompact {
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(8, 11, 16, 0.58);
        backdrop-filter: blur(4px);
      }

      .doorHintCompact {
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(8, 11, 16, 0.6);
        backdrop-filter: blur(4px);
      }

      .doorCorridorStage {
        position: absolute;
        inset: 0;
      }

      .doorCorridorBg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        filter: saturate(0.94) brightness(0.88);
        pointer-events: none;
      }

      .doorHotspotLayer {
        position: absolute;
        inset: 0;
        z-index: 35;
        pointer-events: auto;
      }

      .doorOpenScreenFlash {
        position: absolute;
        inset: 0;
        z-index: 34;
        pointer-events: none;
        background: rgba(0, 0, 0, 0.78);
        animation: doorScreenFlash 200ms steps(2, end) both;
      }

      .doorHotspot {
        position: absolute;
        border: 0;
        border-radius: 16px;
        background: transparent;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
        margin: 0;
        touch-action: manipulation;
        cursor: pointer;
        transition: transform .16s ease, box-shadow .2s ease, background-color .2s ease;
      }

      .doorHotspot:disabled {
        cursor: not-allowed;
      }

      .doorHotspot.is-active {
        transform: scale(1.012);
        animation: doorHotspotPulse 1.45s ease-in-out infinite;
      }

      .doorHotspotDebugLabel {
        position: absolute;
        left: 50%;
        top: 8px;
        transform: translateX(-50%);
        min-width: 22px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.26);
        background: rgba(8, 11, 16, 0.78);
        color: rgba(248, 251, 255, 0.95);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-align: center;
        pointer-events: none;
      }

      .doorHotspotGlow {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        transition: opacity .2s ease;
      }

      .doorOpenFx {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        pointer-events: none;
        opacity: 0;
      }

      .doorOpenFx.is-opening {
        opacity: 1;
      }

      .doorOpenFxFlicker {
        position: absolute;
        inset: -1px;
        background: rgba(0, 0, 0, 0.92);
        animation: doorFxFlicker 210ms steps(2, end) both;
      }

      .doorOpenFxVoid {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 125%;
        height: 125%;
        transform: translate(-50%, -50%) scaleX(.04) scaleY(.22);
        transform-origin: center;
        border-radius: 50%;
        background:
          radial-gradient(ellipse at center, rgba(0, 0, 0, .98) 0%, rgba(0, 0, 0, .9) 32%, rgba(0, 0, 0, .28) 68%, rgba(0, 0, 0, 0) 100%);
        filter: blur(1px);
        animation: doorFxVoidExpand 560ms cubic-bezier(.22, .61, .36, 1) both;
      }

      .doorScreen .hud,
      .doorScreen .hint {
        position: relative;
        z-index: 50;
      }

      @keyframes doorScreenFlash {
        0% { opacity: .75; }
        35% { opacity: .2; }
        60% { opacity: .52; }
        100% { opacity: 0; }
      }

      @keyframes doorFxFlicker {
        0% { opacity: .95; }
        45% { opacity: .18; }
        70% { opacity: .6; }
        100% { opacity: 0; }
      }

      @keyframes doorFxVoidExpand {
        0% { transform: translate(-50%, -50%) scaleX(.04) scaleY(.22); opacity: .9; }
        55% { transform: translate(-50%, -50%) scaleX(.82) scaleY(1.02); opacity: .95; }
        100% { transform: translate(-50%, -50%) scaleX(1.06) scaleY(1.12); opacity: .84; }
      }

      @keyframes doorHotspotPulse {
        0%, 100% { box-shadow: 0 0 0 1px rgba(170, 205, 255, 0.18), 0 0 14px rgba(115, 185, 255, 0.18); }
        50% { box-shadow: 0 0 0 1px rgba(170, 205, 255, 0.32), 0 0 20px rgba(115, 185, 255, 0.34); }
      }

      @media (max-width: 760px) {
        .doorHudCompact,
        .doorHintCompact {
          padding: 7px 8px;
          border-radius: 10px;
        }

        .doorHotspot {
          border-radius: 12px;
        }
      }
    `}</style>
  );
}

export function DoorGameScene({
  worldShakeClass,
  level,
  room,
  roomsPerFloor,
  lives,
  maxLives,
  corruptionActive,
  doorCount,
  doorInputLocked,
  hitPulseKey,
  eventOverlay,
  getDoorClassName,
  getDoorVisualLabel,
  onDoorPick,
  doorHint,
  lastOutcome,
  levelConfig,
  showHotspots,
}: DoorGameSceneProps) {
  const [hoveredDoorIndex, setHoveredDoorIndex] = useState<number | null>(null);
  const [pressedDoorIndex, setPressedDoorIndex] = useState<number | null>(null);
  const [openingDoorIndex, setOpeningDoorIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const openAnimTimeoutRef = useRef<number | null>(null);

  const { effects, colors, theme, systemMessage } = levelConfig;

  const fogStyle = effects.fogDensity !== "none" ? { background: colors.fogColor } : undefined;

  const vignetteStyle = {
    background: `radial-gradient(ellipse at 50% 50%, transparent 40%, ${effects.vignetteColor} 100%)`,
  };

  const eventOverlayClass = eventOverlay ? `doorEventOverlay--${eventOverlay.kind.toLowerCase()}` : "";
  const doorScreenStyle = {
    backgroundImage: `url("${DOOR_BG_IMAGE}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  } as const;

  const visibleHotspots = DOOR_HOTSPOTS.slice(0, Math.min(doorCount, DOOR_HOTSPOTS.length));

  const getHotspotState = (doorIndex: number) => {
    const raw = getDoorClassName(doorIndex);
    const tokens = raw.split(/\s+/);
    return {
      selected: tokens.includes("selected"),
      safe: tokens.includes("safe"),
      monster: tokens.includes("monster"),
      curse: tokens.includes("curse"),
      corruption: tokens.includes("corruption"),
    };
  };

  const getHotspotColor = (doorIndex: number) => {
    const state = getHotspotState(doorIndex);
    if (state.safe) return "rgba(84, 214, 132, .78)";
    if (state.curse) return "rgba(180, 118, 255, .78)";
    if (state.monster) return "rgba(255, 94, 106, .78)";
    if (state.selected) return "rgba(132, 188, 255, .78)";
    return "rgba(132, 188, 255, .55)";
  };

  const isInputBlocked = doorInputLocked || isAnimating;
  const hintText = isAnimating ? "Kapi aralaniyor..." : doorHint;

  useEffect(() => {
    return () => {
      if (openAnimTimeoutRef.current !== null) {
        window.clearTimeout(openAnimTimeoutRef.current);
      }
    };
  }, []);

  const startDoorOpenAnimation = (doorIndex: number) => {
    if (isInputBlocked) return;

    setIsAnimating(true);
    setOpeningDoorIndex(doorIndex);
    setHoveredDoorIndex(null);
    setPressedDoorIndex(null);

    if (openAnimTimeoutRef.current !== null) {
      window.clearTimeout(openAnimTimeoutRef.current);
    }

    openAnimTimeoutRef.current = window.setTimeout(() => {
      openAnimTimeoutRef.current = null;
      onDoorPick(doorIndex);
      setIsAnimating(false);
      setOpeningDoorIndex(null);
    }, DOOR_OPEN_ANIM_MS);
  };

  return (
    <div className={`screen doorScreen doorScreen--${theme} ${corruptionActive ? "corruptionActive" : ""}`} style={doorScreenStyle}>
      <DoorHotspotStyles />

      {hitPulseKey > 0 && <div key={hitPulseKey} className="hitPulse" aria-hidden="true" />}
      {eventOverlay && (
        <div key={`${eventOverlay.kind}-${eventOverlay.key}`} className={`doorEventOverlay ${eventOverlayClass}`} aria-live="assertive">
          <div className="doorEventOverlayText">{eventOverlay.text}</div>
        </div>
      )}

      <header className="panel hud doorHudCompact">
        <div>
          <div className="hudSub">{CORRIDOR_LABEL}</div>
          <div className="hudTitle">
            Kat {level} / Oda {room}/{roomsPerFloor}
          </div>
        </div>
        <div className="pills">
          <div className={`pill ${lives <= 2 ? "red" : ""}`}>
            {"\u2665".repeat(lives)}
            {"\u2661".repeat(maxLives - lives)}
          </div>
          {corruptionActive && <div className="pill corruptionPill">Bozulma</div>}
          {effects.glitchAmount !== "none" && <div className="pill red">\u26a0 ANOMAL\u0130</div>}
        </div>
      </header>

      <main className={`world ${worldShakeClass}`}>
        <div className="worldSurface">
          <div className="doorCorridorStage">
            <div className="doorCorridorBg" style={doorScreenStyle} />
            {isAnimating && <div className="doorOpenScreenFlash" aria-hidden="true" />}

            {fogStyle && <div className={`fogLayer fogLayer--${effects.fogDensity}`} style={fogStyle} />}
            {effects.scanlines && <div className="scanlinesOverlay" aria-hidden="true" />}
            {effects.redLightIntensity !== "none" && (
              <div className={`redAccentLight redAccentLight--${effects.redLightIntensity}`} aria-hidden="true" />
            )}

            <div className="doorHotspotLayer" aria-label="Kapi secim alani">
              {visibleHotspots.map((hotspot) => {
                const doorState = getHotspotState(hotspot.doorIndex);
                const isActive =
                  hoveredDoorIndex === hotspot.doorIndex ||
                  pressedDoorIndex === hotspot.doorIndex ||
                  doorState.selected ||
                  doorState.safe ||
                  doorState.curse ||
                  doorState.monster;

                const glowColor = getHotspotColor(hotspot.doorIndex);
                const defaultFill = doorState.safe
                  ? "rgba(84, 214, 132, .12)"
                  : doorState.curse
                    ? "rgba(180, 118, 255, .12)"
                    : doorState.monster
                      ? "rgba(255, 94, 106, .12)"
                      : "rgba(132, 188, 255, .1)";

                return (
                  <button
                    key={hotspot.doorIndex}
                    type="button"
                    className={`doorHotspot ${showHotspots && isActive ? "is-active" : ""}`}
                    onClick={() => startDoorOpenAnimation(hotspot.doorIndex)}
                    onMouseEnter={() => setHoveredDoorIndex(hotspot.doorIndex)}
                    onMouseLeave={() => {
                      setHoveredDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev));
                      setPressedDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev));
                    }}
                    onPointerDown={() => setPressedDoorIndex(hotspot.doorIndex)}
                    onPointerUp={() => setPressedDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev))}
                    onPointerCancel={() => setPressedDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev))}
                    onBlur={() => {
                      setHoveredDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev));
                      setPressedDoorIndex((prev) => (prev === hotspot.doorIndex ? null : prev));
                    }}
                    disabled={isInputBlocked}
                    aria-label={getDoorVisualLabel(hotspot.doorIndex)}
                    style={{
                      left: `${hotspot.left}%`,
                      top: `${hotspot.top}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`,
                      outline: showHotspots ? `2px dashed ${glowColor}` : "none",
                      outlineOffset: showHotspots ? "-2px" : undefined,
                      background: showHotspots ? defaultFill : "transparent",
                      boxShadow: showHotspots ? `0 0 0 1px ${glowColor}, 0 0 18px ${rgbaFrom(glowColor, 0.22)}` : "none",
                    }}
                  >
                    <span
                      className="doorHotspotGlow"
                      aria-hidden="true"
                      style={{
                        opacity: showHotspots && isActive ? 1 : 0,
                        background: `radial-gradient(circle at 50% 50%, ${rgbaFrom(glowColor, 0.28)} 0%, transparent 68%)`,
                      }}
                    />
                    {openingDoorIndex === hotspot.doorIndex && (
                      <span className="doorOpenFx is-opening" aria-hidden="true">
                        <span className="doorOpenFxFlicker" />
                        <span className="doorOpenFxVoid" />
                      </span>
                    )}
                    {showHotspots && <span className="doorHotspotDebugLabel">{hotspot.label}</span>}
                  </button>
                );
              })}
            </div>

            <div className="levelVignette" style={vignetteStyle} aria-hidden="true" />
            <ParticleLayer type={effects.particles} />
            <GlitchOverlay amount={effects.glitchAmount} />
            <SystemMessageOverlay message={systemMessage} level={level} />
          </div>
        </div>
      </main>

      <footer className="panel hint doorHintCompact">
        <div className="hintLabel">Durum</div>
        <div className="hintText">{hintText}</div>
        <div className="muted">
          1 do\u011fru kap\u0131 \u2022 1 lanet kap\u0131 (-2 can) \u2022 3 yanl\u0131\u015f/yarat\u0131k kap\u0131 (-1 can)
          {lastOutcome && (
            <>
              {" "}
              \u2022 Son se\u00e7im:{" "}
              {lastOutcome === "SAFE" ? "\u2714 Do\u011fru" : lastOutcome === "CURSE" ? "\u2620 Lanet" : "\u2716 Yarat\u0131k"}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
