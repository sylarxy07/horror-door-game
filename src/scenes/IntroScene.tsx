import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type IntroSceneProps = {
  worldShakeClass: string;
  introStep: number;
  introLines: string[];
  onAdvance: () => void;
  onSkip: () => void;
};

const introSlideImageCandidates = [
  ["/images/scenes/prologue_s1_home_code.png", "/image/scence/prologue_s1_home_code.png"],
  ["/images/scenes/prologue_s2_screen_glitch.png", "/image/scence/prologue_s2_screen_glitch.png"],
  ["/images/scenes/prologue_s3_redeyes.png", "/image/scence/prologue_s3_redeyes.png"],
  ["/images/scenes/prologue_s4_island_wakeup_path.png", "/image/scence/prologue_s4_island_wakeup_path.png"],
];
const introBaseStepMs = 1700;
const introCharMs = 48;
const introMinStepMs = 5400;
const introMaxStepMs = 9800;
const introFinalHoldMs = 820;
const introMusicPeakGain = 0.022;
const introMusicFadeInSec = 2.2;
const introMusicFadeOutSec = 0.85;
const introSubtitleFadeOutMs = 400;
const introSubtitleFadeInMs = 500;
const introSubtitleSwapGapMs = 140;

type IntroAmbienceHandle = {
  ctx: AudioContext;
  masterGain: GainNode;
  nodes: OscillatorNode[];
};

const parsePrologueCmd = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, "").trim())
    .filter((line) => line.length > 0 && !/^(::|#|REM\s)/i.test(line));

export function IntroScene(props: IntroSceneProps) {
  const { worldShakeClass, introStep, introLines, onAdvance } = props;
  const [cmdLines, setCmdLines] = useState<string[] | null>(null);
  const [imageCandidateByStep, setImageCandidateByStep] = useState<Record<number, number>>({});
  const [isOutroFading, setIsOutroFading] = useState(false);
  // Single-layer scene: only one image is ever in the DOM.
  // Bridge phase drives a black overlay for scene-to-scene transitions.
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(null);
  const [sceneToken, setSceneToken] = useState(0);
  const pendingSrcRef = useRef<string | null>(null);
  const [bridgePhase, setBridgePhase] = useState<"idle" | "darkening" | "revealing">("idle");
  const [subtitleVisual, setSubtitleVisual] = useState<{ current: string; token: number }>({
    current: "",
    token: 0,
  });
  const [subtitlePhase, setSubtitlePhase] = useState<"in" | "steady" | "out">("in");
  const ambienceRef = useRef<IntroAmbienceHandle | null>(null);
  const didMusicFadeOutRef = useRef(false);
  const subtitleTimersRef = useRef<number[]>([]);
  const subtitleCurrentRef = useRef("");

  const clearSubtitleTimers = useCallback(() => {
    subtitleTimersRef.current.forEach((id) => window.clearTimeout(id));
    subtitleTimersRef.current = [];
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/cmd/prologe.cmd")
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("prologe.cmd not found"))))
      .then((text) => {
        if (!active) return;
        const parsed = parsePrologueCmd(text);
        if (parsed.length) setCmdLines(parsed);
      })
      .catch(() => {
        // Fallback to the existing intro lines from game data.
      });

    return () => {
      active = false;
    };
  }, []);

  const sceneCount = introSlideImageCandidates.length;
  const step = Math.min(introStep, sceneCount - 1);
  const resolvedLines = useMemo(() => {
    const preferred = cmdLines && cmdLines.length ? cmdLines : introLines;
    return introSlideImageCandidates.map((_, idx) => preferred[idx] ?? introLines[idx] ?? "");
  }, [cmdLines, introLines]);

  const isLastStep = step >= sceneCount - 1;
  const candidateIndex = imageCandidateByStep[step] ?? 0;
  const imageCandidates = introSlideImageCandidates[step] ?? [];
  const activeImageSrc = imageCandidates[candidateIndex] ?? null;
  const stepDurationMs = useMemo(() => {
    const text = (resolvedLines[step] ?? "").replace(/\s+/g, " ").trim();
    const dynamicMs = introBaseStepMs + text.length * introCharMs;
    return Math.max(introMinStepMs, Math.min(introMaxStepMs, dynamicMs));
  }, [resolvedLines, step]);

  // Single-layer bridge: when activeImageSrc changes, fade to black then swap.
  useEffect(() => {
    if (!activeImageSrc) return;
    if (displayedSrc === activeImageSrc) return;

    if (!displayedSrc) {
      // First image — show immediately, no bridge needed.
      setDisplayedSrc(activeImageSrc);
      setSceneToken((t) => t + 1);
      return;
    }

    // Queue the new src and start darkening.
    pendingSrcRef.current = activeImageSrc;
    setBridgePhase("darkening");
  }, [activeImageSrc, displayedSrc]);

  const handleBridgeTransitionEnd = useCallback(() => {
    setBridgePhase((phase) => {
      if (phase === "darkening") {
        // Peak reached — swap image and reveal immediately (no hold).
        const next = pendingSrcRef.current;
        if (next) {
          setDisplayedSrc(next);
          setSceneToken((t) => t + 1);
          pendingSrcRef.current = null;
        }
        return "revealing";
      }
      if (phase === "revealing") {
        return "idle";
      }
      return phase;
    });
  }, []);

  useEffect(() => {
    const nextText = (resolvedLines[step] ?? "").trim();
    const currentText = subtitleCurrentRef.current;

    clearSubtitleTimers();

    if (!currentText) {
      subtitleCurrentRef.current = nextText;
      setSubtitleVisual((prev) => ({ ...prev, current: nextText, token: prev.token + 1 }));
      setSubtitlePhase("in");
      const steadyId = window.setTimeout(() => setSubtitlePhase("steady"), introSubtitleFadeInMs);
      subtitleTimersRef.current.push(steadyId);
      return () => {
        clearSubtitleTimers();
      };
    }

    if (nextText === currentText) {
      setSubtitlePhase("steady");
      return () => {
        clearSubtitleTimers();
      };
    }

    setSubtitlePhase("out");
    const swapId = window.setTimeout(() => {
      subtitleCurrentRef.current = nextText;
      setSubtitleVisual((prev) => ({ ...prev, current: nextText, token: prev.token + 1 }));
      setSubtitlePhase("in");
      const steadyId = window.setTimeout(() => setSubtitlePhase("steady"), introSubtitleFadeInMs);
      subtitleTimersRef.current.push(steadyId);
    }, introSubtitleFadeOutMs + introSubtitleSwapGapMs);
    subtitleTimersRef.current.push(swapId);

    return () => {
      clearSubtitleTimers();
    };
  }, [clearSubtitleTimers, resolvedLines, step]);

  useEffect(() => {
    return () => {
      clearSubtitleTimers();
    };
  }, [clearSubtitleTimers]);

  useEffect(() => {
    const AudioCtxCtor =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    const ctx = new AudioCtxCtor();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 680;
    lowPass.Q.value = 0.82;

    const highPass = ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 34;
    highPass.Q.value = 0.4;

    lowPass.connect(highPass);
    highPass.connect(masterGain);
    masterGain.connect(ctx.destination);

    const droneA = ctx.createOscillator();
    droneA.type = "triangle";
    droneA.frequency.value = 56;
    const droneAGain = ctx.createGain();
    droneAGain.gain.value = 0.56;
    droneA.connect(droneAGain).connect(lowPass);

    const droneB = ctx.createOscillator();
    droneB.type = "sine";
    droneB.frequency.value = 84;
    const droneBGain = ctx.createGain();
    droneBGain.gain.value = 0.27;
    droneB.connect(droneBGain).connect(lowPass);

    const tremolo = ctx.createOscillator();
    tremolo.type = "sine";
    tremolo.frequency.value = 0.17;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.0048;
    tremolo.connect(tremoloGain).connect(masterGain.gain);

    const drift = ctx.createOscillator();
    drift.type = "sine";
    drift.frequency.value = 0.065;
    const driftGain = ctx.createGain();
    driftGain.gain.value = 2.3;
    drift.connect(driftGain).connect(droneB.frequency);

    const nodes = [droneA, droneB, tremolo, drift];
    nodes.forEach((n) => n.start());

    ambienceRef.current = { ctx, masterGain, nodes };
    ctx.resume().catch(() => {
      // Autoplay policies can block audio start on some devices.
    });

    const now = ctx.currentTime;
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(introMusicPeakGain, now + introMusicFadeInSec);

    return () => {
      const ambience = ambienceRef.current;
      if (!ambience) return;

      const t = ambience.ctx.currentTime;
      ambience.masterGain.gain.cancelScheduledValues(t);
      ambience.masterGain.gain.setValueAtTime(ambience.masterGain.gain.value, t);
      ambience.masterGain.gain.linearRampToValueAtTime(0.0001, t + introMusicFadeOutSec);

      const stopAt = t + introMusicFadeOutSec + 0.08;
      ambience.nodes.forEach((node) => {
        try {
          node.stop(stopAt);
        } catch {
          // no-op
        }
      });

      window.setTimeout(() => {
        ambience.ctx.close().catch(() => {
          // no-op
        });
      }, Math.ceil((introMusicFadeOutSec + 0.2) * 1000));

      ambienceRef.current = null;
      didMusicFadeOutRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLastStep) setIsOutroFading(false);
    let outroTimerId: number | null = null;
    const durationMs = stepDurationMs;
    const timerId = window.setTimeout(() => {
      if (!isLastStep) {
        onAdvance();
        return;
      }

      setIsOutroFading(true);
      outroTimerId = window.setTimeout(() => {
        onAdvance();
      }, introFinalHoldMs);
    }, durationMs);

    return () => {
      window.clearTimeout(timerId);
      if (outroTimerId !== null) window.clearTimeout(outroTimerId);
    };
  }, [step, isLastStep, onAdvance, stepDurationMs]);

  useEffect(() => {
    if (!isOutroFading || didMusicFadeOutRef.current) return;
    const ambience = ambienceRef.current;
    if (!ambience) return;

    didMusicFadeOutRef.current = true;
    const now = ambience.ctx.currentTime;
    ambience.masterGain.gain.cancelScheduledValues(now);
    ambience.masterGain.gain.setValueAtTime(ambience.masterGain.gain.value, now);
    ambience.masterGain.gain.linearRampToValueAtTime(0.0001, now + introMusicFadeOutSec);
  }, [isOutroFading]);

  return (
    <div className="screen introScreen">
      <main className={`world introStage ${worldShakeClass}`}>
        <div className="worldSurface">
          <div className="introSceneLayer">
            {!displayedSrc && <div className="introArt" />}
            {displayedSrc && (
              <img
                key={`intro-scene-${sceneToken}`}
                className="introSceneImage introSceneImageCurrent"
                src={displayedSrc}
                alt={`Giris sahnesi ${step + 1}`}
                loading="eager"
                onError={() => {
                  setImageCandidateByStep((prev) => {
                    const next = (prev[step] ?? 0) + 1;
                    if (next > imageCandidates.length) return prev;
                    return { ...prev, [step]: next };
                  });
                }}
              />
            )}
            <div
              className={`introSceneBridge ${bridgePhase === "darkening" ? "dark" : ""}`}
              onTransitionEnd={handleBridgeTransitionEnd}
            />
          </div>

          <div className="introFog" />
          <div className="introVignette" />

          <div className="introSignalDot" aria-hidden="true" />
          <div className="introEyes" aria-hidden="true">
            <span className="introEye introEyeLeft" />
            <span className="introEye introEyeRight" />
          </div>

          <div className="introSubtitleArea" aria-live="polite">
            <p
              key={`intro-line-${subtitleVisual.token}-${step}`}
              className={`introSubtitleText ${
                subtitlePhase === "out" ? "introSubtitleTextOut" : subtitlePhase === "in" ? "introSubtitleTextIn" : ""
              }`}
            >
              {subtitleVisual.current}
            </p>
            {isLastStep && <span className="introSubtitleEnd" aria-hidden="true">...</span>}
          </div>

          <div className={`introOutroFade ${isOutroFading ? "on" : ""}`} />
        </div>
      </main>
    </div>
  );
}
