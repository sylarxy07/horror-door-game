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
];
const introInterludeText =
  "Ekrandaki deh\u015fet verici g\u00f6zlerin etkisiyle bay\u0131lan Tamay,\n" +
  "\u0131ss\u0131z bir kumsalda uyan\u0131r.\n\n" +
  "Kendine geldikten sonra i\u00e7ini tuhaf ama tan\u0131d\u0131k bir his kaplar ve der ki:\n\n" +
  "\u2018Buraya nas\u0131l geldim?\nNeresi buras\u0131?\n\u0130lk kez mi geliyorum\u2026 yoksa tekrar m\u0131?\u2019";
const introBaseStepMs = 1700;
const introCharMs = 48;
const introMinStepMs = 5400;
const introMaxStepMs = 9800;
const introInterludeFadeMs = 400;
const introInterludeReadMs = 7000;
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
  const [isInterludeActive, setIsInterludeActive] = useState(false);
  const [isInterludeTextVisible, setIsInterludeTextVisible] = useState(false);
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
  const advancedStepRef = useRef<number | null>(null);
  const interludeStartedStepRef = useRef<number | null>(null);
  const subtitleTimersRef = useRef<number[]>([]);
  const subtitleCurrentRef = useRef("");
  const subtitleKeyRef = useRef<string | null>(null);
  const interludeTimersRef = useRef<number[]>([]);

  const clearSubtitleTimers = useCallback(() => {
    subtitleTimersRef.current.forEach((id) => window.clearTimeout(id));
    subtitleTimersRef.current = [];
  }, []);

  const clearInterludeTimers = useCallback(() => {
    interludeTimersRef.current.forEach((id) => window.clearTimeout(id));
    interludeTimersRef.current = [];
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
      // First image â€” show immediately, no bridge needed.
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
        // Peak reached â€” swap image and reveal immediately (no hold).
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
    const subtitleKey = `${step}:${nextText}`;

    clearSubtitleTimers();

    if (!currentText) {
      if (subtitleKeyRef.current === subtitleKey) {
        setSubtitlePhase("steady");
        return () => {
          clearSubtitleTimers();
        };
      }

      subtitleKeyRef.current = subtitleKey;
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
      subtitleKeyRef.current = subtitleKey;
      setSubtitlePhase("steady");
      return () => {
        clearSubtitleTimers();
      };
    }

    setSubtitlePhase("out");
    const swapId = window.setTimeout(() => {
      if (subtitleKeyRef.current === subtitleKey) {
        setSubtitlePhase("steady");
        return;
      }

      subtitleKeyRef.current = subtitleKey;
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
    return () => {
      clearInterludeTimers();
    };
  }, [clearInterludeTimers]);

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
    if (!isLastStep) {
      setIsOutroFading(false);
      setIsInterludeActive(false);
      setIsInterludeTextVisible(false);
      interludeStartedStepRef.current = null;
      clearInterludeTimers();
    }

    const durationMs = stepDurationMs;

    const advanceOnceForStep = () => {
      if (advancedStepRef.current === step) return false;
      advancedStepRef.current = step;
      return true;
    };

    const timerId = window.setTimeout(() => {
      if (!isLastStep) {
        if (!advanceOnceForStep()) return;
        onAdvance();
        return;
      }

      if (interludeStartedStepRef.current === step) return;
      interludeStartedStepRef.current = step;

      clearInterludeTimers();
      setIsOutroFading(true);
      setIsInterludeActive(true);
      setIsInterludeTextVisible(false);

      const fadeId = window.setTimeout(() => {
        setIsInterludeTextVisible(true);
      }, introInterludeFadeMs);
      interludeTimersRef.current.push(fadeId);
      const exitDelay = introInterludeFadeMs + introInterludeReadMs;
      const exitId = window.setTimeout(() => {
        if (!advanceOnceForStep()) return;
        onAdvance();
      }, exitDelay);
      interludeTimersRef.current.push(exitId);
    }, durationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [clearInterludeTimers, isLastStep, onAdvance, step, stepDurationMs]);

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
                alt={`GiriÅŸ sahnesi ${step + 1}`}
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

          {!isInterludeActive && (
            <div className="introSubtitleArea" aria-live="polite">
              <p
                key={`intro-line-${subtitleVisual.token}-${step}`}
                className={`introSubtitleText ${
                  subtitlePhase === "out" ? "introSubtitleTextOut" : subtitlePhase === "in" ? "introSubtitleTextIn" : ""
                }`}
              >
                {subtitleVisual.current}
              </p>
            </div>
          )}

          {isInterludeActive && (
            <div className="introInterlude" aria-live="polite">
              <p
                style={{
                  margin: 0,
                  color: "rgba(245,247,252,.96)",
                  opacity: isInterludeTextVisible ? 1 : 0,
                  transform: `translateY(${isInterludeTextVisible ? 0 : 4}px)`,
                  transition: "opacity 220ms ease, transform 220ms ease",
                  fontSize: "clamp(16px, 3.6vw, 27px)",
                  fontWeight: 600,
                  lineHeight: 1.45,
                  letterSpacing: "normal",
                  whiteSpace: "pre-line",
                  textAlign: "center",
                  textShadow: "0 10px 26px rgba(0,0,0,.66)",
                  maxWidth: "min(940px, 92vw)",
                }}
              >
                {introInterludeText}
              </p>
            </div>
          )}

          <div
            className={`introOutroFade ${isOutroFading ? "on" : ""}`}
            style={{ transition: `opacity ${introInterludeFadeMs}ms ease-in-out` }}
          />
        </div>
      </main>
    </div>
  );
}




