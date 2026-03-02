import { useEffect, useRef, useState } from "react";
import { usePreferredAssetPath } from "../game/usePreferredAssetPath";
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
};

const DOOR_BG_CANDIDATES = [
  "/assets/img/rooms/bg.svg",
  "/images/scenes/door_room_bg_v2.png.png",
] as const;

function ParticleLayer({ type }: { type: string }) {
  if (type === "none") return null;

  const particleCount = type === "dust" ? 14 : type === "embers" ? 10 : type === "ash" ? 16 : type === "mist" ? 8 : type === "static" ? 20 : 0;

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

export function DoorGameScene({
  worldShakeClass,
  level,
  room,
  roomsPerFloor,
  lives,
  maxLives,
  corruptionActive,
  checkpointUnlocked,
  checkpointLevel,
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
}: DoorGameSceneProps) {
  const doorBgPath = usePreferredAssetPath(DOOR_BG_CANDIDATES);
  const { effects, colors, theme, locationLabel, systemMessage } = levelConfig;

  const bgStyle = {
    background: `
      radial-gradient(ellipse at 50% 120%, ${colors.lightAccent}, transparent 55%),
      linear-gradient(to bottom, rgba(8,10,16,.22) 0%, rgba(5,7,12,.62) 100%)
    `,
  };

  const fogStyle = effects.fogDensity !== "none"
    ? { background: colors.fogColor }
    : undefined;

  const vignetteStyle = {
    background: `radial-gradient(ellipse at 50% 50%, transparent 40%, ${effects.vignetteColor} 100%)`,
  };

  const eventOverlayClass = eventOverlay ? `doorEventOverlay--${eventOverlay.kind.toLowerCase()}` : "";
  const doorScreenStyle = doorBgPath
    ? {
      backgroundImage: `url("${doorBgPath}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }
    : undefined;

  return (
    <div className={`screen doorScreen doorScreen--${theme} ${corruptionActive ? "corruptionActive" : ""}`} style={doorScreenStyle}>
      {hitPulseKey > 0 && <div key={hitPulseKey} className="hitPulse" aria-hidden="true" />}
      {eventOverlay && (
        <div key={`${eventOverlay.kind}-${eventOverlay.key}`} className={`doorEventOverlay ${eventOverlayClass}`} aria-live="assertive">
          <div className="doorEventOverlayText">{eventOverlay.text}</div>
        </div>
      )}

      <header className="panel hud">
        <div>
          <div className="hudSub">{locationLabel}</div>
          <div className="hudTitle">
            Kat {level} / Oda {room}/{roomsPerFloor}
          </div>
        </div>
        <div className="pills">
          <div className={`pill ${lives <= 2 ? "red" : ""}`}>
            {"♥".repeat(lives)}{"♡".repeat(maxLives - lives)}
          </div>
          <div className="pill">
            {checkpointUnlocked ? `✔ KP:${checkpointLevel}` : "KP: Kapalı"}
          </div>
          {corruptionActive && <div className="pill corruptionPill">Bozulma</div>}
          {effects.glitchAmount !== "none" && (
            <div className="pill red">⚠ ANOMALİ</div>
          )}
        </div>
      </header>

      <main className={`world ${worldShakeClass}`}>
        <div className="worldSurface">
          <div className="gameBg" style={bgStyle} />

          <div className="roomPerspective">
            <div className="roomWallL" style={{ background: colors.wallTone }} />
            <div className="roomWallR" style={{ background: colors.wallTone }} />
            <div className="roomBackWall" style={{ background: colors.wallTone }} />
            <div className="roomFloor" style={{ background: colors.floorTone }} />

            {fogStyle && (
              <div className={`fogLayer fogLayer--${effects.fogDensity}`} style={fogStyle} />
            )}

            {effects.scanlines && <div className="scanlinesOverlay" aria-hidden="true" />}

            {effects.redLightIntensity !== "none" && (
              <div className={`redAccentLight redAccentLight--${effects.redLightIntensity}`} aria-hidden="true" />
            )}

            <div className="doorsWall">
              {Array.from({ length: doorCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${getDoorClassName(i)} door--${levelConfig.doorVariation}`}
                  onClick={() => onDoorPick(i)}
                  disabled={doorInputLocked}
                >
                  <div className="doorLabel">{getDoorVisualLabel(i)}</div>
                </button>
              ))}
            </div>

            <div className="playerShoulderOverlay" />
          </div>

          <div className="levelVignette" style={vignetteStyle} aria-hidden="true" />

          <ParticleLayer type={effects.particles} />
          <GlitchOverlay amount={effects.glitchAmount} />
          <SystemMessageOverlay message={systemMessage} level={level} />
        </div>
      </main>

      <footer className="panel hint">
        <div className="hintLabel">Durum</div>
        <div className="hintText">{doorHint}</div>
        <div className="muted">
          1 doğru kapı • 1 lanet kapı (-2 can) • 3 yanlış/yaratık kapı (-1 can)
          {lastOutcome && (
            <>
              {" "}
              • Son seçim:{" "}
              {lastOutcome === "SAFE" ? "✔ Doğru" : lastOutcome === "CURSE" ? "☠ Lanet" : "✖ Yaratık"}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
