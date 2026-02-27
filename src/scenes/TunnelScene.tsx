import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type TunnelSceneProps = {
  worldShakeClass: string;
  onEnterDoorGame: () => void;
  devToolsEnabled?: boolean;
  onSkipToDoorGame?: () => void;
};

type WallWriting = {
  id: string;
  early: string;
  late: string;
};

const PROGRESS_ADVANCE_RATE = 19;
const PROGRESS_REVERSE_RATE = 8;
const DENEME_REVEAL_MS = 1600;

const WALL_WRITINGS: WallWriting[] = [
  { id: "w1", early: "KAYIT 03 // D?NEME BASLADI", late: "KAYIT 03 // DENEME BASLADI" },
  { id: "w2", early: "SISTEM: DE#EME 08 tekrar", late: "SISTEM: DENEME 08 tekrar" },
  { id: "w3", early: "D E N _ M E : CIKIS red", late: "DENEME: CIKIS red" },
  { id: "w4", early: "DONGU SAYACI artis", late: "DONGU SAYACI artiyor" },
  { id: "w5", early: "KAYIT KATMANI ustune KATMAN", late: "KAYIT KATMANI ustune katman" },
  { id: "w6", early: "TEKRAR edilen ses disari siz?", late: "TEKRAR edilen ses disari siziyor" },
  { id: "w7", early: "SISTEM geri cagirir", late: "SISTEM geri cagirir" },
  { id: "w8", early: "YOL kisaliyor // DUVAR uzuyor", late: "YOL kisaliyor // DUVAR uzuyor" },
  { id: "w9", early: "KAPI etiketi: CIKI? ?", late: "KAPI etiketi: CIKIS?" },
  { id: "w10", early: "SON KAYIT: tekrar basladi", late: "SON KAYIT: tekrar basladi" },
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
  const [progress, setProgress] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showDeneme, setShowDeneme] = useState(false);
  const [denemeImpactActive, setDenemeImpactActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [glitchTick, setGlitchTick] = useState(0);
  const [doorBlinking, setDoorBlinking] = useState(false);

  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef(0);
  const denemeTimerRef = useRef<number>();
  const denemeImpactTimerRef = useRef<number>();
  const flashTimerRef = useRef<number>();
  const flashEndTimerRef = useRef<number>();
  const glitchIntervalRef = useRef<number>();
  const doorBlinkTimerRef = useRef<number>();
  const keyForwardRef = useRef(false);
  const keyBackwardRef = useRef(false);
  const touchForwardRef = useRef(false);
  const denemeShownRef = useRef(false);
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
    if (progress < 70 || denemeShownRef.current) return;

    denemeShownRef.current = true;
    setShowDeneme(true);
    setDenemeImpactActive(true);

    if (denemeTimerRef.current) window.clearTimeout(denemeTimerRef.current);
    if (denemeImpactTimerRef.current) window.clearTimeout(denemeImpactTimerRef.current);
    denemeTimerRef.current = window.setTimeout(() => {
      setShowDeneme(false);
    }, DENEME_REVEAL_MS);
    denemeImpactTimerRef.current = window.setTimeout(() => {
      setDenemeImpactActive(false);
    }, 200);
  }, [progress]);

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
      if (denemeTimerRef.current) window.clearTimeout(denemeTimerRef.current);
      if (denemeImpactTimerRef.current) window.clearTimeout(denemeImpactTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (flashEndTimerRef.current) window.clearTimeout(flashEndTimerRef.current);
      if (glitchIntervalRef.current) window.clearInterval(glitchIntervalRef.current);
      if (doorBlinkTimerRef.current) window.clearTimeout(doorBlinkTimerRef.current);
    };
  }, []);

  const handleAdvanceStart = useCallback((event: PointerEvent<HTMLButtonElement>) => {
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
      const baseText = progress < 45 ? line.early : line.late;
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
  }, [glitchTick, progress, visibleLineCount]);

  const roundedProgress = Math.round(progress);
  const canRevealDoor = progress >= 90;
  const canContinue = progress >= 95;

  const hintText = useMemo(() => {
    if (progress < 20) return "Koridor sessiz degil. Adimlar duvara geri donuyor.";
    if (progress < 50) return "Yazilar aciliyor, ama satirlar tamamlanmiyor.";
    if (progress < 70) return "Sinyal karisiyor. Kayit katmanlari ust uste biniyor.";
    if (progress < 90) return "Bir kelime netlesiyor, sonra tekrar bozuluyor.";
    if (progress < 95) return "Uzakta bir cikis sekli var. Hala kararsiz.";
    return "Gecis acik. Devam etmek icin onay ver.";
  }, [progress]);

  return (
    <div className="screen">
      <header className="panel hud tunnelHud">
        <div>
          <div className="hudSub">Gecis</div>
          <div className="hudTitle">Servis Tuneli</div>
        </div>
        <div className="tunnelProgressHud" aria-live="polite">
          <div className="tunnelProgressLabel">Ilerleme %{roundedProgress}</div>
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
            Kapilara Atla
          </button>
        )}
      </header>

      <main className={`world ${worldShakeClass} tunnelWorld tunnelWorld--${glitchClass}`} aria-label="Tunel">
        <div className="worldSurface">
          <div className="tunnelBg" />
          <div className="tunnelNoise" />
          <div className={`tunnelFlash ${flashActive ? "active" : ""}`} />
          <div className={`tunnelRevealImpact ${denemeImpactActive ? "active" : ""}`} />

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
                ÇIKIŞ?
              </div>
            </button>

            <div className="tunnelPlayer">
              <div className="shoulders" />
              <div className="hood" />
              <div className="hair" />
            </div>
          </div>

          {showDeneme && <div className="tunnelWordReveal">DENEME</div>}

          <div className="fogLayer" />

          <div className="tunnelControls">
            <button
              className={`tunnelAdvanceBtn ${isAdvancing ? "active" : ""}`}
              type="button"
              onPointerDown={handleAdvanceStart}
              onPointerUp={handleAdvanceEnd}
              onPointerCancel={handleAdvanceEnd}
              onPointerLeave={handleAdvanceEnd}
            >
              İLERLE
            </button>
          </div>

          {canContinue && (
            <div className="tunnelContinueWrap">
              <button className="btn danger tunnelContinueBtn" type="button" onClick={onEnterDoorGame}>
                DEVAM
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="panel hint">
        <div className="hintLabel">Ic Ses</div>
        <div className="hintText">{hintText}</div>
      </footer>
    </div>
  );
}
