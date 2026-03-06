import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent,
} from "react";
// Fake-walk animation: background zooms/shifts while holding, freeze on release
import { usePreferredAssetPath } from "../game/usePreferredAssetPath";
import { useI18n } from "../i18n";

// ─────────────────────────────────────────────────────────────────────────────
// Whisper ambience config
// ─────────────────────────────────────────────────────────────────────────────
const WHISPER_BASE = "/audio/tunnel/";
const WHISPER_CANDIDATES: string[] = [
  "whisper_01.mp3",
  "whisper_02.mp3",
  "whisper_03.mp3",
  "whisper_04.mp3",
  "whisper_05.mp3",
  "whisper_06.mp3",
  "whisper_07.mp3",
  "whisper_08.mp3",
  "whisper_09.mp3",
  "whisper_10.mp3",
  "whisper_11.mp3",
  "whisper_12.mp3",
  "whisper_long_01.mp3",
  "whisper_long_02.mp3",
];

const WHISPER_FIRST_MIN = 2_000; // ms — first whisper after entering tunnel
const WHISPER_FIRST_MAX = 5_000; // ms
const WHISPER_INTERVAL_MIN = 5_000; // ms — gap after a whisper ends (min)
const WHISPER_INTERVAL_MAX = 10_000; // ms — gap after a whisper ends (max)
const WHISPER_VOL_MIN = 0.10;
const WHISPER_VOL_MAX = 0.18;
const WHISPER_RATE_MIN = 0.92;
const WHISPER_RATE_MAX = 1.05;
const WHISPER_PAN_MAX = 0.35; // ±
const WHISPER_FADE_IN_MIN = 450; // ms — fade-in ramp minimum
const WHISPER_FADE_IN_MAX = 700; // ms — fade-in ramp maximum
const WHISPER_FADE_OUT_MIN = 200; // ms — fade-out before natural end (min)
const WHISPER_FADE_OUT_MAX = 350; // ms — fade-out before natural end (max)
const WHISPER_BUSY_RETRY_MS = 700; // ms — retry quickly when audio channel is busy

const rndBetween = (min: number, max: number) => min + Math.random() * (max - min);

/** Probe which whisper files actually exist; returns their full URL-paths. */
function probeWhisperFiles(candidates: string[]): Promise<string[]> {
  const available: string[] = [];
  const promises = candidates.map(
    (file) =>
      new Promise<void>((resolve) => {
        const audio = new Audio(`${WHISPER_BASE}${file}`);
        audio.preload = "metadata";
        const done = () => {
          audio.src = "";
          resolve();
        };
        audio.addEventListener(
          "canplaythrough",
          () => {
            available.push(`${WHISPER_BASE}${file}`);
            done();
          },
          { once: true }
        );
        audio.addEventListener("error", done, { once: true });
        // Timeout fallback — some browsers never fire events for missing files
        const tid = window.setTimeout(done, 4_000);
        audio.addEventListener("canplaythrough", () => window.clearTimeout(tid), { once: true });
        audio.addEventListener("error", () => window.clearTimeout(tid), { once: true });
        audio.load();
      })
  );
  return Promise.all(promises).then(() => available);
}

type TunnelSceneProps = {
  worldShakeClass: string;
  onEnterDoorGame: () => void;
  devToolsEnabled?: boolean;
  onSkipToDoorGame?: () => void;
};

const PROGRESS_ADVANCE_RATE = 4.125; // tunnel dwell speed (keep as you tuned)
const PROGRESS_REVERSE_RATE = 8;

// Fake-walk tuning (NO BOB, NO X SWAY, NO RESET)
const WALK_FOLLOW = 28; // higher = visual follows progress faster
const WALK_DRIFT_MAX_PX = 280; // extra hold-driven drift range
const WALK_DRIFT_FOLLOW = 32; // drift easing toward target
const WALK_DRIFT_BOOST_PX = 240; // immediate kick while holding
const WALK_SCALE_BASE = 1.06;
const WALK_SCALE_FROM_PROGRESS = 3.0;
const WALK_SCALE_FROM_DRIFT = 0.12;

const TUNNEL_BG_CANDIDATES = [
  "/image/tunnel/tunnel_bg.png",
  "/assets/img/tunnel/bg.svg",
  "/images/scenes/tunnel_bg.png",
] as const;

const GLITCH_MILESTONES: { threshold: number; key: string }[] = [
  { threshold: 20, key: "tunnel.flash.walls_listening" },
  { threshold: 50, key: "tunnel.flash.fog_filter" },
  { threshold: 70, key: "tunnel.flash.system_active" },
  { threshold: 90, key: "tunnel.flash.never_trust_doors" },
  { threshold: 95, key: "tunnel.flash.initiate_trial" },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// ─────────────────────────────────────────────────────────────────────────────
// useWhisperAmbience hook — fully self-contained
// ─────────────────────────────────────────────────────────────────────────────
function useWhisperAmbience(tunnelActive: boolean, audioBusyRef: MutableRefObject<boolean>): boolean {
  const [audioReady, setAudioReady] = useState(false);
  const availableFilesRef = useRef<string[]>([]);
  const schedulerTimerRef = useRef<number | undefined>(undefined);
  const fadeOutTimerRef = useRef<number | undefined>(undefined);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentPanNodeRef = useRef<PannerNode | StereoPannerNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const unmountedRef = useRef(false);
  const activeRef = useRef(tunnelActive);
  const playOneWhisperRef = useRef<() => void>(() => {});
  const scheduleNextRef = useRef<(delayMs: number) => void>(() => {});

  useEffect(() => {
    activeRef.current = tunnelActive;
  }, [tunnelActive]);

  // Probe files once
  useEffect(() => {
    unmountedRef.current = false;
    setAudioReady(false);

    void probeWhisperFiles(WHISPER_CANDIDATES).then((found) => {
      if (unmountedRef.current) return;
      if (found.length === 0) {
        console.warn("[TunnelWhisper] No whisper files found under", WHISPER_BASE);
      }
      availableFilesRef.current = found;
      setAudioReady(true);
    });

    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const scheduleNext = useCallback((delayMs: number) => {
    window.clearTimeout(schedulerTimerRef.current);
    if (unmountedRef.current || !activeRef.current) return;

    schedulerTimerRef.current = window.setTimeout(() => {
      if (unmountedRef.current || !activeRef.current) return;
      playOneWhisperRef.current();
    }, delayMs);
  }, []);

  const playOneWhisper = useCallback(() => {
    if (unmountedRef.current || !activeRef.current || isPlayingRef.current) return;
    if (availableFilesRef.current.length === 0) return;

    if (audioBusyRef.current) {
      scheduleNextRef.current(WHISPER_BUSY_RETRY_MS);
      return;
    }

    audioBusyRef.current = true;

    const files = availableFilesRef.current;
    const src = files[Math.floor(Math.random() * files.length)];
    const targetVol = rndBetween(WHISPER_VOL_MIN, WHISPER_VOL_MAX);
    const rate = rndBetween(WHISPER_RATE_MIN, WHISPER_RATE_MAX);
    const pan = rndBetween(-WHISPER_PAN_MAX, WHISPER_PAN_MAX);
    const fadeInMs = rndBetween(WHISPER_FADE_IN_MIN, WHISPER_FADE_IN_MAX);
    const fadeOutMs = rndBetween(WHISPER_FADE_OUT_MIN, WHISPER_FADE_OUT_MAX);

    try {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.playbackRate = rate;
      audio.volume = 0;

      try {
        // @ts-expect-error - webkit prefix
        const Ctx = window.AudioContext ?? window.webkitAudioContext;
        if (Ctx && (!audioCtxRef.current || audioCtxRef.current.state === "closed")) {
          audioCtxRef.current = new Ctx() as AudioContext;
        }

        const ctx = audioCtxRef.current;
        if (ctx) {
          const source = ctx.createMediaElementSource(audio);
          let panNode: StereoPannerNode | PannerNode;

          if (typeof ctx.createStereoPanner === "function") {
            const stereo = ctx.createStereoPanner();
            stereo.pan.value = pan;
            panNode = stereo;
          } else {
            const panner = ctx.createPanner();
            panner.panningModel = "equalpower";
            panner.setPosition(pan, 0, 1 - Math.abs(pan));
            panNode = panner;
          }

          source.connect(panNode);
          panNode.connect(ctx.destination);
          currentSourceRef.current = source;
          currentPanNodeRef.current = panNode;
        }
      } catch {
        // WebAudio optional
      }

      isPlayingRef.current = true;
      currentAudioRef.current = audio;

      const releaseAudio = () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
          isPlayingRef.current = false;
          try {
            currentSourceRef.current?.disconnect();
          } catch {
            // ignore
          }
          try {
            currentPanNodeRef.current?.disconnect();
          } catch {
            // ignore
          }
          currentSourceRef.current = null;
          currentPanNodeRef.current = null;
          window.clearTimeout(fadeOutTimerRef.current);
        }
        audioBusyRef.current = false;
      };

      const startFadeIn = () => {
        const t0 = performance.now();
        const tick = (now: number) => {
          if (currentAudioRef.current !== audio) return;
          const progress = Math.min((now - t0) / fadeInMs, 1);
          audio.volume = targetVol * progress;
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      const armFadeOut = () => {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        const totalMs = (audio.duration / rate) * 1_000;
        const startAfter = Math.max(0, totalMs - fadeOutMs - 60);

        window.clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = window.setTimeout(() => {
          if (currentAudioRef.current !== audio) return;
          const startVolume = audio.volume;
          const t0 = performance.now();
          const tick = (now: number) => {
            if (currentAudioRef.current !== audio) return;
            const progress = Math.min((now - t0) / fadeOutMs, 1);
            audio.volume = startVolume * (1 - progress);
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, startAfter);
      };

      audio.addEventListener("loadedmetadata", armFadeOut, { once: true });
      if (isFinite(audio.duration) && audio.duration > 0) armFadeOut();

      audio.addEventListener(
        "ended",
        () => {
          releaseAudio();
          if (!unmountedRef.current && activeRef.current) {
            scheduleNextRef.current(rndBetween(WHISPER_INTERVAL_MIN, WHISPER_INTERVAL_MAX));
          }
        },
        { once: true }
      );

      void audio
        .play()
        .then(() => {
          startFadeIn();
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name !== "NotAllowedError") {
            console.warn("[TunnelWhisper] play() failed:", err.message);
          }
          releaseAudio();
          if (!unmountedRef.current && activeRef.current) {
            scheduleNextRef.current(rndBetween(WHISPER_INTERVAL_MIN, WHISPER_INTERVAL_MAX));
          }
        });
    } catch (err) {
      console.warn("[TunnelWhisper] Error creating Audio:", err);
      isPlayingRef.current = false;
      audioBusyRef.current = false;
      if (!unmountedRef.current && activeRef.current) {
        scheduleNextRef.current(rndBetween(WHISPER_INTERVAL_MIN, WHISPER_INTERVAL_MAX));
      }
    }
  }, [audioBusyRef, scheduleNextRef]);

  useEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  useEffect(() => {
    playOneWhisperRef.current = playOneWhisper;
  }, [playOneWhisper]);

  // Scheduler deps intentionally locked to tunnelActive + audioReady.
  useEffect(() => {
    if (!tunnelActive || !audioReady) return;
    if (availableFilesRef.current.length === 0) return;

    scheduleNextRef.current(rndBetween(WHISPER_FIRST_MIN, WHISPER_FIRST_MAX));

    return () => {
      window.clearTimeout(schedulerTimerRef.current);
      window.clearTimeout(fadeOutTimerRef.current);
      schedulerTimerRef.current = undefined;
      fadeOutTimerRef.current = undefined;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      isPlayingRef.current = false;
      try {
        currentSourceRef.current?.disconnect();
      } catch {
        // ignore
      }
      try {
        currentPanNodeRef.current?.disconnect();
      } catch {
        // ignore
      }
      currentSourceRef.current = null;
      currentPanNodeRef.current = null;
      audioBusyRef.current = false;
    };
  }, [tunnelActive, audioReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      window.clearTimeout(schedulerTimerRef.current);
      window.clearTimeout(fadeOutTimerRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      try {
        currentSourceRef.current?.disconnect();
      } catch {
        // ignore
      }
      try {
        currentPanNodeRef.current?.disconnect();
      } catch {
        // ignore
      }
      try {
        audioCtxRef.current?.close();
      } catch {
        // ignore
      }
      audioBusyRef.current = false;
    };
  }, [audioBusyRef]);

  return audioReady;
}

const IS_DEV = import.meta.env.DEV;

export function TunnelScene({
  worldShakeClass,
  onEnterDoorGame,
  devToolsEnabled = false,
  onSkipToDoorGame,
}: TunnelSceneProps) {
  const { t } = useI18n();

  const tunnelActive = true;
  const audioBusyRef = useRef(false);

  // Whisper ambience
  useWhisperAmbience(tunnelActive, audioBusyRef);

  const tunnelBgPath = usePreferredAssetPath(TUNNEL_BG_CANDIDATES);
  const [progress, setProgress] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // ── Fake-walk: refs used inside rAF (avoid stale closure) ───────────────
  const bgWrapperRef = useRef<HTMLDivElement | null>(null);
  const motionOverlayRef = useRef<HTMLDivElement | null>(null);

  const fwProgressRef = useRef(0);
  const fwHoldingRef = useRef(false);
  const fwFrameRef = useRef<number>(0);
  const fwVisualProgressRef = useRef(0);
  const fwDriftRef = useRef(0);
  const fwLastTsRef = useRef(0);

  fwProgressRef.current = progress;
  fwHoldingRef.current = isAdvancing;

  const [flashActive, setFlashActive] = useState(false);
  const [flashText, setFlashText] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef(0);

  const flashTimerRef = useRef<number | undefined>(undefined);
  const flashEndTimerRef = useRef<number | undefined>(undefined);
  const flashOffTimerRef = useRef<number | undefined>(undefined);
  const flashTextTimerRef = useRef<number | undefined>(undefined);
  const queueFlashTimerRef = useRef<number | undefined>(undefined);

  const lastFlashAtRef = useRef<number>(0);
  const queuedFlashTextRef = useRef<string | null>(null);
  const prevProgressRef = useRef(0);
  const shownMilestonesRef = useRef<Set<number>>(new Set());
  const doorRevealTriggeredRef = useRef(false);

  const keyForwardRef = useRef(false);
  const keyBackwardRef = useRef(false);
  const touchForwardRef = useRef(false);

  const syncAdvanceState = useCallback(() => {
    const next = keyForwardRef.current || touchForwardRef.current;
    setIsAdvancing((prev) => (prev === next ? prev : next));
  }, []);

  // ── Fake-walk rAF loop (NO bob, NO sway, NO reset) ───────────────────────
  useEffect(() => {
    const loop = (now: number) => {
      if (fwLastTsRef.current === 0) fwLastTsRef.current = now;

      const deltaSeconds = Math.min(0.05, (now - fwLastTsRef.current) / 1000);
      fwLastTsRef.current = now;

      const targetP = clamp(fwProgressRef.current / 100, 0, 1);
      const canWalk = fwHoldingRef.current && fwProgressRef.current < 100;

      // Smooth follow of progress (fast follow, no "milim milim")
      const followAlpha = 1 - Math.exp(-WALK_FOLLOW * deltaSeconds);
      fwVisualProgressRef.current += (targetP - fwVisualProgressRef.current) * followAlpha;

      // Extra drift while holding (freeze on release, no hard cap jump)
      if (canWalk) {
        const driftTarget = Math.min(
          WALK_DRIFT_MAX_PX,
          targetP * WALK_DRIFT_MAX_PX + WALK_DRIFT_BOOST_PX,
        );
        const driftAlpha = 1 - Math.exp(-WALK_DRIFT_FOLLOW * deltaSeconds);
        fwDriftRef.current += (driftTarget - fwDriftRef.current) * driftAlpha;
      }

      const el = bgWrapperRef.current;
      if (el) {
        const p = fwVisualProgressRef.current;

        const ty = 0;
        const sc =
          WALK_SCALE_BASE +
          p * WALK_SCALE_FROM_PROGRESS +
          (fwDriftRef.current / WALK_DRIFT_MAX_PX) * WALK_SCALE_FROM_DRIFT;

        el.style.transform = `scale(${sc.toFixed(4)}) translateY(${ty.toFixed(1)}px)`;
      }

      // Motion overlay (adds SPEED feeling without bob/jump)
      const mo = motionOverlayRef.current;
      if (mo) {
        // opacity smooth via CSS; just toggle a class-like behavior
        mo.style.opacity = canWalk ? "0.18" : "0";
        // scroll the stripes downward while holding (no jumps, purely visual)
        if (canWalk) {
          const y = (now * 1.1) % 1000; // much faster scroll
          mo.style.backgroundPosition = `0px ${y.toFixed(0)}px`;
        }
      }

      fwFrameRef.current = requestAnimationFrame(loop);
    };

    fwFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (fwFrameRef.current) cancelAnimationFrame(fwFrameRef.current);
    };
  }, []);

  // Progress loop (unchanged)
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

  // Keyboard controls
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

  const FLASH_COOLDOWN_MS = 2200;

  const triggerFlash = useCallback((text: string) => {
    const now = Date.now();
    const elapsed = now - lastFlashAtRef.current;

    if (elapsed < FLASH_COOLDOWN_MS) {
      queuedFlashTextRef.current = text;
      if (queueFlashTimerRef.current) window.clearTimeout(queueFlashTimerRef.current);
      queueFlashTimerRef.current = window.setTimeout(() => {
        const queued = queuedFlashTextRef.current;
        if (queued) {
          queuedFlashTextRef.current = null;
          lastFlashAtRef.current = Date.now();
          if (flashOffTimerRef.current) window.clearTimeout(flashOffTimerRef.current);
          if (flashTextTimerRef.current) window.clearTimeout(flashTextTimerRef.current);
          setFlashText(queued);
          setFlashOn(true);
          flashOffTimerRef.current = window.setTimeout(() => setFlashOn(false), 1100);
          flashTextTimerRef.current = window.setTimeout(() => setFlashText(null), 1400);
        }
      }, FLASH_COOLDOWN_MS - elapsed);
      return;
    }

    lastFlashAtRef.current = now;
    queuedFlashTextRef.current = null;
    if (queueFlashTimerRef.current) window.clearTimeout(queueFlashTimerRef.current);
    if (flashOffTimerRef.current) window.clearTimeout(flashOffTimerRef.current);
    if (flashTextTimerRef.current) window.clearTimeout(flashTextTimerRef.current);
    setFlashText(text);
    setFlashOn(true);
    flashOffTimerRef.current = window.setTimeout(() => setFlashOn(false), 1100);
    flashTextTimerRef.current = window.setTimeout(() => setFlashText(null), 1400);
  }, []);

  // Milestone detection — single-shot
  useEffect(() => {
    const prev = prevProgressRef.current;

    GLITCH_MILESTONES.forEach((milestone, index) => {
      if (prev < milestone.threshold && progress >= milestone.threshold && !shownMilestonesRef.current.has(index)) {
        shownMilestonesRef.current.add(index);
        triggerFlash(t(milestone.key));
      }
    });

    if (progress >= 90 && !doorRevealTriggeredRef.current) {
      doorRevealTriggeredRef.current = true;
    }

    prevProgressRef.current = progress;
  }, [progress, triggerFlash, t]);

  // Auto-advance when progress hits 100
  useEffect(() => {
    if (progress >= 100) {
      onEnterDoorGame();
    }
  }, [progress, onEnterDoorGame]);

  // Flash effect at high progress
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (flashEndTimerRef.current) window.clearTimeout(flashEndTimerRef.current);
      if (flashOffTimerRef.current) window.clearTimeout(flashOffTimerRef.current);
      if (flashTextTimerRef.current) window.clearTimeout(flashTextTimerRef.current);
      if (queueFlashTimerRef.current) window.clearTimeout(queueFlashTimerRef.current);
    };
  }, []);

  const handleAdvanceStart = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      touchForwardRef.current = true;
      syncAdvanceState();
    },
    [syncAdvanceState]
  );

  const handleAdvanceEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      touchForwardRef.current = false;
      syncAdvanceState();
    },
    [syncAdvanceState]
  );

  const canContinue = progress >= 95;

  const hintText = useMemo(() => {
    if (progress < 20) return t("tunnel.hint.1");
    if (progress < 50) return t("tunnel.hint.2");
    if (progress < 70) return t("tunnel.hint.3");
    if (progress < 90) return t("tunnel.hint.4");
    if (progress < 95) return t("tunnel.hint.5");
    return t("tunnel.hint.6");
  }, [progress, t]);

  return (
    <div className="screen tunnelScreen" style={{ position: "relative", overflow: "hidden" }}>
      {/* Fake-walk background wrapper — transform applied by rAF */}
      <div
        ref={bgWrapperRef}
        style={{
          position: "absolute",
          inset: "-22% -22%", // more overscan to prevent edge leaks with faster motion
          willChange: "transform",
          transition: "none",
          transformOrigin: "center center",
          ...(tunnelBgPath
            ? {
                backgroundImage: `url("${tunnelBgPath}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
        }}
      />

      {/* Motion overlay (adds speed feel while holding, no bob/jump) */}
      <div
        ref={motionOverlayRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
          opacity: 0,
          transition: "opacity 180ms ease",
          backgroundImage: `
            radial-gradient(circle at 50% 40%, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.35) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.00) 0px,
              rgba(255,255,255,0.00) 10px,
              rgba(255,255,255,0.06) 12px,
              rgba(255,255,255,0.00) 18px
            )
          `,
          mixBlendMode: "overlay",
        }}
      />

      {/* Glitch keyframes + flash overlay CSS — injected once */}
      <style>{`
        @keyframes tunnelGlitch {
          0%   { transform: translateY(0) translateX(0);    filter: none; }
          35%  { transform: translateY(0) translateX(-2px); opacity: .85; }
          70%  { transform: translateY(0) translateX(2px);  opacity: 1;   }
          100% { transform: translateY(0) translateX(0);    opacity: 1;   }
        }
        .tunnelFlashWrap {
          position: fixed;
          inset: 0;
          pointer-events: none;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 18vh;
          z-index: 9999;
        }
        .tunnelFlash {
          position: relative;
          pointer-events: none;
          max-width: 80vw;
          text-align: center;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: clamp(14px, 2.4vw, 22px);
          color: #e8e8e8;
          text-shadow: 0 0 8px rgba(200,20,20,0.9), 0 0 2px rgba(255,255,255,0.6);
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(2px);
          border: 1px solid rgba(180,30,30,0.5);
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.12s, transform 0.12s;
        }
        .tunnelFlash.on {
          opacity: 1;
          transform: translateY(0);
          animation: tunnelGlitch 280ms steps(2,end) 2;
        }
      `}</style>

      {/* DEV-only test panel — never shown in production */}
      {IS_DEV && devToolsEnabled && onSkipToDoorGame && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 9999,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid #f00",
            borderRadius: 6,
            padding: "6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          aria-label="Test Paneli"
        >
          <span style={{ color: "#f55", fontSize: 10, fontFamily: "monospace", letterSpacing: 1 }}>
            TEST PANELİ
          </span>
          <button
            className="btn ghost"
            type="button"
            onClick={onSkipToDoorGame}
            style={{ minWidth: 116, padding: "6px 10px", fontSize: 12 }}
          >
            {t("tunnel.skipDoors")}
          </button>
        </div>
      )}

      {/* World / scene container */}
      <main
        className={`world ${worldShakeClass}`}
        style={{ position: "relative", width: "100%", height: "100%" }}
        aria-label={t("tunnel.worldAria")}
      >
        {/* Flash overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "white",
            opacity: flashActive ? 0.18 : 0,
            transition: "opacity 0.06s",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* Bottom-right advance button */}
        <div
          style={{
            position: "absolute",
            bottom: 72,
            right: 24,
            zIndex: 20,
          }}
        >
          <button
            className={`tunnelAdvanceBtn ${isAdvancing ? "active" : ""}`}
            type="button"
            aria-label={t("tunnel.advanceHoldAria")}
            onPointerDown={handleAdvanceStart}
            onPointerUp={handleAdvanceEnd}
            onPointerCancel={handleAdvanceEnd}
            onPointerLeave={handleAdvanceEnd}
            style={{ userSelect: "none", touchAction: "none" }}
          >
            {t("tunnel.advanceHold")}
          </button>
        </div>

        {/* When 95%+ — show continue button */}
        {canContinue && (
          <div
            style={{
              position: "absolute",
              bottom: 72,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
            }}
          >
            <button className="btn danger" type="button" onClick={onEnterDoorGame}>
              {t("common.continue")}
            </button>
          </div>
        )}
      </main>

      {/* Threshold message overlay — fixed, above everything */}
      <div className="tunnelFlashWrap" aria-live="assertive">
        {flashText && <div className={"tunnelFlash" + (flashOn ? " on" : "")}>{flashText}</div>}
      </div>

      {/* İç Ses footer — single line */}
      <footer
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 15,
          padding: "10px 20px",
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "none",
          outline: "none",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "#888",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {t("tunnel.hintLabel")}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "#ccc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hintText}
        </span>
      </footer>
    </div>
  );
}
