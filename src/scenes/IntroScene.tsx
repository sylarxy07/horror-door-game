import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

type IntroSceneProps = {
  worldShakeClass: string;
  introStep: number;
  introLines: string[];
  onAdvance: () => void;
  onSkip: () => void;
};

type IntroMediaCandidate =
  | { kind: "image"; src: string }
  | { kind: "video"; src: string };

  const introSlideMediaCandidates: IntroMediaCandidate[][] = [
    [
      { kind: "video", src: "/video/intro/scene1.mp4" },
      { kind: "image", src: "/images/scenes/prologue_s1_home_code.png" },
      { kind: "image", src: "/image/scence/prologue_s1_home_code.png" },
    ],
    [
      { kind: "video", src: "/video/intro/scene2.mp4" },
      { kind: "image", src: "/images/scenes/prologue_s2_screen_glitch.png" },
      { kind: "image", src: "/image/scence/prologue_s2_screen_glitch.png" },
    ],
    [
      { kind: "video", src: "/video/intro/scene3.mp4" },
      { kind: "image", src: "/images/scenes/prologue_s3_redeyes.png" },
      { kind: "image", src: "/image/scence/prologue_s3_redeyes.png" },
    ],
  ];

const introBaseStepMs = 1700;
const introCharMs = 48;
const introMinStepMs = 5400;
const introMaxStepMs = 9800;
const introInterludeFadeMs = 1200;
const introInterludeReadMs = 9500;
const introMusicPeakGain = 0.022;
const introMusicFadeInSec = 2.2;
const introMusicFadeOutSec = 0.85;

const introSubtitleFadeOutMs = 120;
const introSubtitleFadeInMs = 180;

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
  const { currentLang, t } = useI18n();
  const { worldShakeClass, introStep, introLines, onAdvance } = props;
  const [cmdLines, setCmdLines] = useState<string[] | null>(null);
  const [mediaCandidateByStep, setMediaCandidateByStep] = useState<Record<number, number>>({});
  const [isOutroFading, setIsOutroFading] = useState(false);
  const [isInterludeActive, setIsInterludeActive] = useState(false);
  const [isInterludeTextVisible, setIsInterludeTextVisible] = useState(false);

  const [displayedMedia, setDisplayedMedia] = useState<IntroMediaCandidate | null>(null);
  const pendingMediaRef = useRef<IntroMediaCandidate | null>(null);
  const [bridgePhase, setBridgePhase] = useState<"idle" | "darkening" | "revealing">("idle");

  const [subtitleText, setSubtitleText] = useState("");
  const [subtitleToken, setSubtitleToken] = useState(0);
  const [subtitlePhase, setSubtitlePhase] = useState<"in" | "steady" | "out">("in");

  const ambienceRef = useRef<IntroAmbienceHandle | null>(null);
  const didMusicFadeOutRef = useRef(false);
  const advancedStepRef = useRef<number | null>(null);
  const interludeStartedStepRef = useRef<number | null>(null);
  const subtitleTimersRef = useRef<number[]>([]);
  const interludeTimersRef = useRef<number[]>([]);
  const isFirstImageRef = useRef(true);

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
        // Fallback to existing intro lines from game data.
      });

    return () => {
      active = false;
    };
  }, []);

  const sceneCount = introSlideMediaCandidates.length;
  const step = Math.min(introStep, sceneCount - 1);

  const resolvedLines = useMemo(() => {
    const preferred = currentLang === "tr" && cmdLines && cmdLines.length ? cmdLines : introLines;
    return introSlideMediaCandidates.map((_, idx) => preferred[idx] ?? introLines[idx] ?? "");
  }, [cmdLines, currentLang, introLines]);

  const isLastStep = step >= sceneCount - 1;
  const candidateIndex = mediaCandidateByStep[step] ?? 0;
  const mediaCandidates = introSlideMediaCandidates[step] ?? [];
  const activeMedia = mediaCandidates[candidateIndex] ?? null;

  const stepDurationMs = useMemo(() => {
    const text = (resolvedLines[step] ?? "").replace(/\s+/g, " ").trim();
    const dynamicMs = introBaseStepMs + text.length * introCharMs;
    const clampedMs = Math.max(introMinStepMs, Math.min(introMaxStepMs, dynamicMs));
  
    if (step === 1) return clampedMs + 1200;
  
    return clampedMs;
  }, [resolvedLines, step]);

  const resolvedLinesRef = useRef(resolvedLines);
  resolvedLinesRef.current = resolvedLines;
  const stepRef = useRef(step);
  stepRef.current = step;
  const subtitleTextRef = useRef(subtitleText);
  subtitleTextRef.current = subtitleText;

  const startSubtitleTransition = useCallback(
    (nextText: string, immediate: boolean) => {
      clearSubtitleTimers();

      if (immediate || !subtitleTextRef.current) {
        setSubtitleText(nextText);
        setSubtitleToken((prev) => prev + 1);
        setSubtitlePhase("in");
        const steadyId = window.setTimeout(() => setSubtitlePhase("steady"), introSubtitleFadeInMs);
        subtitleTimersRef.current.push(steadyId);
        return;
      }

      if (nextText === subtitleTextRef.current) {
        setSubtitlePhase("steady");
        return;
      }

      setSubtitlePhase("out");
      const swapId = window.setTimeout(() => {
        setSubtitleText(nextText);
        setSubtitleToken((prev) => prev + 1);
        setSubtitlePhase("in");
        const steadyId = window.setTimeout(() => setSubtitlePhase("steady"), introSubtitleFadeInMs);
        subtitleTimersRef.current.push(steadyId);
      }, introSubtitleFadeOutMs);
      subtitleTimersRef.current.push(swapId);
    },
    [clearSubtitleTimers],
  );

  useEffect(() => {
    if (!activeMedia) return;

    const sameMedia =
      displayedMedia &&
      displayedMedia.kind === activeMedia.kind &&
      displayedMedia.src === activeMedia.src;

    if (sameMedia) return;

    if (!displayedMedia) {
      isFirstImageRef.current = true;
      setDisplayedMedia(activeMedia);
      const nextText = (resolvedLinesRef.current[stepRef.current] ?? "").trim();
      startSubtitleTransition(nextText, true);
      return;
    }

    isFirstImageRef.current = false;
    pendingMediaRef.current = activeMedia;
    setBridgePhase("darkening");

    const nextText = (resolvedLinesRef.current[stepRef.current] ?? "").trim();
    startSubtitleTransition(nextText, false);
  }, [activeMedia, displayedMedia, startSubtitleTransition]);

  const handleBridgeTransitionEnd = useCallback(() => {
    setBridgePhase((phase) => {
      if (phase === "darkening") {
        const next = pendingMediaRef.current;
        if (next) {
          setDisplayedMedia(next);
          pendingMediaRef.current = null;
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

      const tNow = ambience.ctx.currentTime;
      ambience.masterGain.gain.cancelScheduledValues(tNow);
      ambience.masterGain.gain.setValueAtTime(ambience.masterGain.gain.value, tNow);
      ambience.masterGain.gain.linearRampToValueAtTime(0.0001, tNow + introMusicFadeOutSec);

      const stopAt = tNow + introMusicFadeOutSec + 0.08;
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

  const handleMediaError = useCallback(() => {
    setMediaCandidateByStep((prev) => {
      const next = (prev[step] ?? 0) + 1;
      if (next >= mediaCandidates.length) return prev;
      return { ...prev, [step]: next };
    });
  }, [mediaCandidates.length, step]);

  const displayedMediaKey = displayedMedia ? `${displayedMedia.kind}:${displayedMedia.src}` : "empty";
  const displayedMediaStyle =
    displayedMedia?.kind === "video" && displayedMedia.src === "/video/intro/scene2.mp4"
      ? {
          objectFit: "cover" as const,
          transform: "scale(1.16) translateX(-4%)",
          transformOrigin: "center center",
        }
      : undefined;

  return (
    <div className="screen introScreen">
      <main className={`world introStage ${worldShakeClass}`}>
        <div className="worldSurface">
          <div className="introSceneLayer">
            {!displayedMedia && <div className="introArt" />}

            {displayedMedia?.kind === "image" && (
              <img
                key={`intro-scene-${displayedMediaKey}`}
                className="introSceneImage introSceneImageCurrent"
                src={displayedMedia.src}
                alt={t("intro.sceneAlt", { index: step + 1 })}
                loading="eager"
                onError={handleMediaError}
              />
            )}

            {displayedMedia?.kind === "video" && (
              <video
                key={`intro-scene-${displayedMediaKey}`}
                className="introSceneImage introSceneImageCurrent"
                src={displayedMedia.src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                style={displayedMediaStyle}
                onError={handleMediaError}
              />
            )}

            <div
              className={`introSceneBridge ${bridgePhase === "darkening" ? "dark" : ""}`}
              onTransitionEnd={handleBridgeTransitionEnd}
            />
          </div>

          <div className="introFog" />
          <div className="introVignette" />

          

          {!isInterludeActive && (
            <div className="introSubtitleArea" aria-live="polite">
              <p
                key={`intro-line-${subtitleToken}`}
                className={`introSubtitleText ${
                  subtitlePhase === "out"
                    ? "introSubtitleTextOut"
                    : subtitlePhase === "in"
                      ? "introSubtitleTextIn"
                      : ""
                }`}
              >
                {subtitleText}
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
                  transition: "opacity 420ms ease, transform 220ms ease",
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
                {t("intro.interlude")}
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
