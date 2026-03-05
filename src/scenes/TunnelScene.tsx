import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { usePreferredAssetPath } from "../game/usePreferredAssetPath";
import { useI18n } from "../i18n";

type TunnelSceneProps = {
  worldShakeClass: string;
  onEnterDoorGame: () => void;
  devToolsEnabled?: boolean;
  onSkipToDoorGame?: () => void;
};

type WallWriting = {
  id: string;
  earlyKey: string;
  lateKey: string;
};

const PROGRESS_ADVANCE_RATE = 19;
const PROGRESS_REVERSE_RATE = 8;
const MILESTONE_REVEAL_MS = 850;
const TUNNEL_BG_CANDIDATES = [
  "/assets/img/tunnel/bg.svg",
  "/images/scenes/tunnel_bg.png",
] as const;

const GLITCH_MILESTONES = [
  { threshold: 20, key: "tunnel.glitch.try" },
  { threshold: 50, key: "tunnel.glitch.door" },
  { threshold: 70, key: "tunnel.glitch.remember" },
  { threshold: 90, key: "tunnel.glitch.noreturn" },
  { threshold: 95, key: "tunnel.glitch.noreturn" },
] as const;

const WALL_WRITINGS: WallWriting[] = [
  { id: "w1", earlyKey: "tunnel.wall.1.early", lateKey: "tunnel.wall.1.late" },
  { id: "w2", earlyKey: "tunnel.wall.2.early", lateKey: "tunnel.wall.2.late" },
  { id: "w3", earlyKey: "tunnel.wall.3.early", lateKey: "tunnel.wall.3.late" },
  { id: "w4", earlyKey: "tunnel.wall.4.early", lateKey: "tunnel.wall.4.late" },
  { id: "w5", earlyKey: "tunnel.wall.5.early", lateKey: "tunnel.wall.5.late" },
  { id: "w6", earlyKey: "tunnel.wall.6.early", lateKey: "tunnel.wall.6.late" },
  { id: "w7", earlyKey: "tunnel.wall.7.early", lateKey: "tunnel.wall.7.late" },
  { id: "w8", earlyKey: "tunnel.wall.8.early", lateKey: "tunnel.wall.8.late" },
  { id: "w9", earlyKey: "tunnel.wall.9.early", lateKey: "tunnel.wall.9.late" },
  { id: "w10", earlyKey: "tunnel.wall.10.early", lateKey: "tunnel.wall.10.late" },
];

const SCRAMBLE_CHARS = ["#", "?", "_", "%", "/", "*"];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const scrambleText = (text: string, amount: number, seed: number) => {
  if (amount <= 0) return text;

  return text
    .split("")
    .map((char, index) => {
      if (char === " " || char === "/" || char === ":" || char === "-" || char === ".") {
        return char;
      }

      const roll = pseudoRandom(seed + index * 1.71);
      if (roll > amount) return char;

      const pick = Math.floor(pseudoRandom(seed * 1.9 + index * 2.11) * SCRAMBLE_CHARS.length);
      return SCRAMBLE_CHARS[pick] ?? char;
    })
    .join("");
};

export function TunnelScene({
  worldShakeClass,
  onEnterDoorGame,
  devToolsEnabled = false,
  onSkipToDoorGame,
}: TunnelSceneProps) {
  const { t } = useI18n();
  const tunnelBgPath = usePreferredAssetPath(TUNNEL_BG_CANDIDATES);
  const [progress, setProgress] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [glitchWord, setGlitchWord] = useState("");
  const [glitchWordVisible, setGlitchWordVisible] = useState(false);
  const [glitchWordKey, setGlitchWordKey] = useState(0);
  const [glitchImpactActive, setGlitchImpactActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [glitchTick, setGlitchTick] = useState(0);
  const [doorBlinking, setDoorBlinking] = useState(false);

  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef(0);
  const glitchWordTimerRef = useRef<number>();
  const glitchImpactTimerRef = useRef<number>();
  const flashTimerRef = useRef<number>();
  const flashEndTimerRef = useRef<number>();
  const glitchIntervalRef = useRef<number>();
  const doorBlinkTimerRef = useRef<number>();
  const keyForwardRef = useRef(false);
  const keyBackwardRef = useRef(false);
  const touchForwardRef = useRef(false);
  const shownMilestonesRef = useRef<Set<number>>(new Set());
  const doorRevealTriggeredRef = useRef(false);

  const syncAdvanceState = useCallback(() => {
    const next = keyForwardRef.current || touchForwardRef.current;
    setIsAdvancing((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const loop = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaSeconds = Math.min(0.05, (timestamp - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = timestamp;

      const moveForward = keyForwardRef.current || touchForwardRef.current;
      const moveBackward = keyBackwardRef.current && !moveForward;

      if (moveForward || moveBackward) {
        setProgress((prev) => {
          let next = prev;

          if (moveForward) next += PROGRESS_ADVANCE_RATE * deltaSeconds;
          if (moveBackward) next -= PROGRESS_REVERSE_RATE * deltaSeconds;

          return clamp(next, 0, 100);
        });
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "w" || key === "arrowup") {
        keyForwardRef.current = true;
        syncAdvanceState();
        event.preventDefault();
      } else if (key === "s" || key === "arrowdown") {
        keyBackwardRef.current = true;
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "w" || key === "arrowup") {
        keyForwardRef.current = false;
        syncAdvanceState();
      } else if (key === "s" || key === "arrowdown") {
        keyBackwardRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keyForwardRef.current = false;
      keyBackwardRef.current = false;
      touchForwardRef.current = false;
      syncAdvanceState();
    };
  }, [syncAdvanceState]);

  useEffect(() => {
    let nextMilestoneWord: string | null = null;

    GLITCH_MILESTONES.forEach((milestone, index) => {
      if (progress >= milestone.threshold && !shownMilestonesRef.current.has(index)) {
        shownMilestonesRef.current.add(index);
        nextMilestoneWord = t(milestone.key);
      }
    });

    if (!nextMilestoneWord) return;

    setGlitchWord(nextMilestoneWord);
    setGlitchWordVisible(true);
    setGlitchWordKey((prev) => prev + 1);
    setGlitchImpactActive(true);

    if (glitchWordTimerRef.current) window.clearTimeout(glitchWordTimerRef.current);
    if (glitchImpactTimerRef.current) window.clearTimeout(glitchImpactTimerRef.current);

    glitchWordTimerRef.current = window.setTimeout(() => {
      setGlitchWordVisible(false);
    }, MILESTONE_REVEAL_MS);

    glitchImpactTimerRef.current = window.setTimeout(() => {
      setGlitchImpactActive(false);
    }, 220);
  }, [progress, t]);

  useEffect(() => {
    if (progress < 90 || doorRevealTriggeredRef.current) return;

    doorRevealTriggeredRef.current = true;
    setDoorBlinking(true);

    if (doorBlinkTimerRef.current) window.clearTimeout(doorBlinkTimerRef.current);
    doorBlinkTimerRef.current = window.setTimeout(() => {
      setDoorBlinking(false);
    }, 1000);
  }, [progress]);

  const flashStage = progress >= 80 ? 2 : progress >= 50 ? 1 : 0;

  useEffect(() => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (flashEndTimerRef.current) window.clearTimeout(flashEndTimerRef.current);
    setFlashActive(false);

    if (flashStage === 0) return;

    const scheduleFlash = () => {
      const baseDelay = flashStage === 2 ? 520 : 860;
      const delay = baseDelay + Math.random() * 450;

      flashTimerRef.current = window.setTimeout(() => {
        setFlashActive(true);

        const flashDuration = 150 + Math.floor(Math.random() * 101);
        flashEndTimerRef.current = window.setTimeout(() => {
          setFlashActive(false);
          scheduleFlash();
        }, flashDuration);
      }, delay);
    };

    scheduleFlash();

    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (flashEndTimerRef.current) window.clearTimeout(flashEndTimerRef.current);
      setFlashActive(false);
    };
  }, [flashStage]);

  useEffect(() => {
    if (glitchIntervalRef.current) window.clearInterval(glitchIntervalRef.current);

    if (progress < 50) return;

    const interval = progress >= 80 ? 120 : 170;
    glitchIntervalRef.current = window.setInterval(() => {
      setGlitchTick((prev) => prev + 1);
    }, interval);

    return () => {
      if (glitchIntervalRef.current) window.clearInterval(glitchIntervalRef.current);
    };
  }, [progress]);

  useEffect(() => {
    return () => {
      if (glitchWordTimerRef.current) window.clearTimeout(glitchWordTimerRef.current);
      if (glitchImpactTimerRef.current) window.clearTimeout(glitchImpactTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (flashEndTimerRef.current) window.clearTimeout(flashEndTimerRef.current);
      if (glitchIntervalRef.current) window.clearInterval(glitchIntervalRef.current);
      if (doorBlinkTimerRef.current) window.clearTimeout(doorBlinkTimerRef.current);
    };
  }, []);

  const handleAdvanceStart = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchForwardRef.current = true;
    syncAdvanceState();
  }, [syncAdvanceState]);

  const handleAdvanceEnd = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    touchForwardRef.current = false;
    syncAdvanceState();
  }, [syncAdvanceState]);

  const glitchClass = progress >= 80 ? "high" : progress >= 50 ? "mid" : progress >= 20 ? "low" : "none";

  const visibleLineCount = progress < 20
    ? 0
    : Math.min(WALL_WRITINGS.length, 3 + Math.floor(((progress - 20) / 80) * WALL_WRITINGS.length));

  const renderedWritings = useMemo(() => {
    return WALL_WRITINGS.slice(0, visibleLineCount).map((line, index) => {
      const baseText = progress < 45 ? t(line.earlyKey) : t(line.lateKey);
      const scrambleAmount = progress >= 80 ? 0.34 : progress >= 50 ? 0.2 : 0;
      const text = scrambleText(baseText, scrambleAmount, glitchTick * 17 + index * 19);

      return {
        id: line.id,
        side: index % 2 === 0 ? "left" : "right",
        depth: `depth${(index % 3) + 1}`,
        drift: index % 4 === 1 ? "driftA" : index % 4 === 3 ? "driftB" : "",
        top: 12 + index * 7 + (index % 2 === 0 ? 0 : 2),
        text,
      };
    });
  }, [glitchTick, progress, t, visibleLineCount]);

  const roundedProgress = Math.round(progress);
  const canRevealDoor = progress >= 90;
  const canContinue = progress >= 95;

  const hintText = useMemo(() => {
    if (progress < 20) return t("tunnel.hint.1");
    if (progress < 50) return t("tunnel.hint.2");
    if (progress < 70) return t("tunnel.hint.3");
    if (progress < 90) return t("tunnel.hint.4");
    if (progress < 95) return t("tunnel.hint.5");
    return t("tunnel.hint.6");
  }, [progress, t]);

  const tunnelScreenStyle = tunnelBgPath
    ? {
      backgroundImage: `url("${tunnelBgPath}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }
    : undefined;

  return (
    <div className="screen tunnelScreen" style={tunnelScreenStyle}>
      <header className="panel hud tunnelHud">
        <div>
          <div className="hudSub">{t("tunnel.hudSub")}</div>
          <div className="hudTitle">{t("tunnel.hudTitle")}</div>
        </div>
        <div className="tunnelProgressHud" aria-live="polite">
          <div className="tunnelProgressLabel">{t("tunnel.progress", { percent: roundedProgress })}</div>
          <div className="tunnelProgressTrack" role="presentation">
            <div className="tunnelProgressFill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {devToolsEnabled && onSkipToDoorGame && (
          <button
            className="btn ghost"
            type="button"
            onClick={onSkipToDoorGame}
            style={{ minWidth: 116, padding: "8px 12px" }}
          >
            {t("tunnel.skipDoors")}
          </button>
        )}
      </header>

      <main className={`world ${worldShakeClass} tunnelWorld tunnelWorld--${glitchClass}`} aria-label={t("tunnel.worldAria")}>
        <div className="worldSurface">
          <div className="tunnelBg" />
          <div className="tunnelVignette" />
          <div className="tunnelNoise" />
          <div className={`tunnelFlash ${flashActive ? "active" : ""}`} />
          <div className={`tunnelRevealImpact ${glitchImpactActive ? "active" : ""}`} />

          <div className="tunnelPerspective">
            <div className="wallL" />
            <div className="wallR" />
            <div className="tunnelCeil" />
            <div className="tunnelFloor" />
            <div className="redLamp" />

            {visibleLineCount > 0 && (
              <div className={`tunnelWritings ${progress >= 50 ? "glitch" : ""}`}>
                {renderedWritings.map((line) => (
                  <div
                    key={line.id}
                    className={`tunnelWriting ${line.side} ${line.depth} ${line.drift}`}
                    style={{ top: `${line.top}%` }}
                  >
                    {line.text}
                  </div>
                ))}
              </div>
            )}

            <button
              className={`metalDoor tunnelExitDoor ${canRevealDoor ? "visible" : ""} ${canContinue ? "ready" : ""} ${doorBlinking ? "blinkIntro" : ""}`}
              type="button"
              onClick={onEnterDoorGame}
              disabled={!canContinue}
            >
              <div className="pill" style={{ background: "rgba(8,11,16,.45)" }}>
                {t("tunnel.exit")}
              </div>
            </button>

            <div className="tunnelPlayer">
              <div className="shoulders" />
              <div className="hood" />
              <div className="hair" />
            </div>
          </div>

          {glitchWordVisible && (
            <div key={glitchWordKey} className="tunnelWordReveal">
              {glitchWord}
            </div>
          )}

          <div className="fogLayer" />

          <div className="tunnelControls">
            <button
              className={`tunnelAdvanceBtn ${isAdvancing ? "active" : ""}`}
              type="button"
              aria-label={t("tunnel.advanceHoldAria")}
              onPointerDown={handleAdvanceStart}
              onPointerUp={handleAdvanceEnd}
              onPointerCancel={handleAdvanceEnd}
              onPointerLeave={handleAdvanceEnd}
            >
              {t("tunnel.advanceHold")}
            </button>
          </div>

          {canContinue && (
            <div className="tunnelContinueWrap">
              <button className="btn danger tunnelContinueBtn" type="button" onClick={onEnterDoorGame}>
                {t("common.continue")}
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="panel hint">
        <div className="hintLabel">{t("tunnel.hintLabel")}</div>
        <div className="hintText">{hintText}</div>
      </footer>
    </div>
  );
}
