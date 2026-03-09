import { useEffect, useRef, useState } from "react";
import type { LevelConfig } from "../game/types";
import { useI18n } from "../i18n";

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
  { left: 4, top: 25, width: 14, height: 52, doorIndex: 0, label: "1" },
  { left: 23, top: 25, width: 14, height: 52, doorIndex: 1, label: "2" },
  { left: 43, top: 25, width: 14, height: 52, doorIndex: 2, label: "3" },
  { left: 63, top: 25, width: 14, height: 52, doorIndex: 3, label: "4" },
  { left: 82, top: 25, width: 14, height: 52, doorIndex: 4, label: "5" },
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
        overflow: hidden;
      }

      .doorCorridorBg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        filter: saturate(0.94) brightness(0.82) contrast(1.05);
        pointer-events: none;
      }

      .doorCorridorShadeTop {
        position: absolute;
        inset: 0 0 46% 0;
        z-index: 8;
        pointer-events: none;
        background: linear-gradient(to bottom, rgba(4, 6, 10, .84), rgba(4, 6, 10, .18) 72%, transparent);
      }

      .doorCorridorShadeBottom {
        position: absolute;
        inset: 52% 0 0 0;
        z-index: 8;
        pointer-events: none;
        background: linear-gradient(to top, rgba(4, 6, 10, .9), rgba(4, 6, 10, .22) 52%, transparent);
      }

      .doorCeilingGlow {
        position: absolute;
        left: 50%;
        top: -6%;
        width: 52%;
        height: 34%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(ellipse at center, rgba(255, 42, 42, .12) 0%, rgba(255, 42, 42, .04) 28%, transparent 72%);
        filter: blur(22px);
        z-index: 9;
        pointer-events: none;
      }

      .doorDepthFog {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        background:
          radial-gradient(circle at 50% 56%, rgba(10, 13, 19, 0) 0%, rgba(10, 13, 19, .12) 28%, rgba(10, 13, 19, .32) 58%, rgba(10, 13, 19, .5) 100%),
          linear-gradient(to right, rgba(3, 4, 7, .6), transparent 20%, transparent 80%, rgba(3, 4, 7, .6));
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
        background: rgba(0, 0, 0, 0.62);
        animation: doorScreenFlash 260ms steps(2, end) both;
      }

      .doorVisual.is-dimmed {
        opacity: .32;
        filter: brightness(.58) saturate(.78);
        transition: opacity .18s ease, filter .18s ease;
      }

      .doorOpeningShell {
        position: absolute;
        inset: 0;
        z-index: 8;
        pointer-events: none;
      }

      .doorOpeningVoidCore {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background:
          radial-gradient(ellipse at center, rgba(0,0,0,.99) 0%, rgba(0,0,0,.95) 32%, rgba(0,0,0,.52) 64%, rgba(0,0,0,0) 100%);
        animation: doorVoidCoreIn 560ms cubic-bezier(.22,.61,.36,1) both;
      }

      .doorOpeningPanel {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        background:
          linear-gradient(to bottom, rgba(255,255,255,.04), rgba(0,0,0,.18)),
          linear-gradient(115deg, rgba(255,255,255,.03), rgba(0,0,0,.14) 42%, rgba(0,0,0,.34));
        border: 1px solid rgba(255,255,255,.05);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04), inset 0 0 24px rgba(0,0,0,.34);
      }

      .doorOpeningPanel.left {
        left: 0;
        border-radius: 16px 0 0 12px;
        animation: doorPanelLeftOpen 560ms cubic-bezier(.22,.61,.36,1) both;
      }

      .doorOpeningPanel.right {
        right: 0;
        border-radius: 0 16px 12px 0;
        animation: doorPanelRightOpen 560ms cubic-bezier(.22,.61,.36,1) both;
      }

      .doorOpeningFlash {
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        background: rgba(255,255,255,.08);
        mix-blend-mode: screen;
        animation: doorOpeningFlashFx 240ms steps(2,end) both;
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
        transition: box-shadow .18s ease, background-color .18s ease, opacity .18s ease;
      }

      .doorHotspot:disabled {
        cursor: not-allowed;
      }

      .doorHotspot:hover:not(:disabled) {
        background: transparent;
      }

      .doorHotspot.is-active {
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
        0% { opacity: .78; }
        30% { opacity: .24; }
        55% { opacity: .56; }
        100% { opacity: 0; }
      }

      @keyframes doorPanelLeftOpen {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(-92%); opacity: .96; }
      }

      @keyframes doorPanelRightOpen {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(92%); opacity: .96; }
      }

      @keyframes doorVoidCoreIn {
        0% { opacity: 0; transform: scaleX(.06) scaleY(.3); }
        35% { opacity: 1; transform: scaleX(.48) scaleY(.82); }
        100% { opacity: .96; transform: scaleX(1.04) scaleY(1.04); }
      }

      @keyframes doorOpeningFlashFx {
        0% { opacity: .72; }
        45% { opacity: .16; }
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

      .doorFloorGlow {
        position: absolute;
        left: 50%;
        bottom: 7%;
        width: 62%;
        height: 18%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(ellipse at center, rgba(255,255,255,.07) 0%, rgba(255,255,255,.018) 34%, transparent 76%);
        filter: blur(16px);
        z-index: 11;
        pointer-events: none;
        opacity: .88;
      }

      .doorSideVignetteLeft,
      .doorSideVignetteRight {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 18%;
        z-index: 12;
        pointer-events: none;
      }

      .doorSideVignetteLeft {
        left: 0;
        background: linear-gradient(to right, rgba(3,4,7,.78), rgba(3,4,7,.28) 48%, transparent);
      }

      .doorSideVignetteRight {
        right: 0;
        background: linear-gradient(to left, rgba(3,4,7,.78), rgba(3,4,7,.28) 48%, transparent);
      }

      .doorCenterDepthGlow {
        position: absolute;
        left: 50%;
        top: 18%;
        width: 18%;
        height: 50%;
        transform: translateX(-50%);
        z-index: 12;
        pointer-events: none;
        background: radial-gradient(ellipse at center, rgba(255,255,255,.05) 0%, rgba(255,255,255,.015) 36%, transparent 76%);
        filter: blur(16px);
        opacity: .78;
      }

      .doorPerspectiveLines {
        position: absolute;
        inset: 0;
        z-index: 13;
        pointer-events: none;
      }

      .doorPerspectiveLines::before,
      .doorPerspectiveLines::after {
        content: "";
        position: absolute;
        bottom: 13%;
        width: 26%;
        height: 2px;
        background: linear-gradient(to right, rgba(255,255,255,.06), rgba(255,255,255,0));
        filter: blur(1px);
        opacity: .32;
        transform-origin: center;
      }

      .doorPerspectiveLines::before {
        left: 22%;
        transform: rotate(-11deg);
      }

      .doorPerspectiveLines::after {
        right: 22%;
        transform: rotate(11deg) scaleX(-1);
      }

      /* ── Door Visual Layer ── */
      .doorVisualLayer {
        position: absolute;
        inset: 0;
        z-index: 20;
        pointer-events: none;
      }

      .doorVisual {
        position: absolute;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(
          160deg,
          rgba(42, 30, 18, .96) 0%,
          rgba(30, 20, 10, .98) 38%,
          rgba(22, 14, 6, 1) 100%
        );
        box-shadow:
          0 0 0 1px rgba(255, 200, 130, .10),
          inset 2px 0 6px rgba(0,0,0,.38),
          inset -2px 0 6px rgba(0,0,0,.38),
          inset 0 3px 8px rgba(255,210,160,.07);
        overflow: visible;
      }

      .doorVisual::before {
        content: "";
        position: absolute;
        inset: 6% 10% 12%;
        border: 1px solid rgba(255, 200, 120, .09);
        border-radius: 2px;
        background: linear-gradient(
          180deg,
          rgba(255,200,130,.04) 0%,
          rgba(255,190,110,.02) 50%,
          rgba(0,0,0,.08) 100%
        );
        pointer-events: none;
      }

      .doorVisual::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
          to right,
          rgba(255,255,255,.04) 0%,
          transparent 30%,
          transparent 70%,
          rgba(0,0,0,.14) 100%
        );
        pointer-events: none;
      }

      .doorVisualPlaque {
        position: absolute;
        left: 50%;
        top: 10%;
        transform: translateX(-50%);
        min-width: 34px;
        padding: 3px 7px;
        border-radius: 3px;
        border: 1px solid rgba(255,200,120,.22);
        background: rgba(20,13,6,.82);
        color: rgba(255,220,160,.82);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .06em;
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 4px rgba(0,0,0,.44);
      }

      .doorVisualKnob {
        position: absolute;
        right: 14%;
        top: 52%;
        width: 10%;
        height: 5%;
        border-radius: 50%;
        background: radial-gradient(
          circle at 38% 36%,
          rgba(220,180,110,.92) 0%,
          rgba(160,110,50,.88) 52%,
          rgba(80,50,18,.9) 100%
        );
        box-shadow:
          0 1px 3px rgba(0,0,0,.6),
          inset 0 1px 2px rgba(255,230,160,.28);
        pointer-events: none;
      }

      .doorVisualAura {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 120%;
        height: 110%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(
          ellipse at center,
          rgba(255, 140, 40, .07) 0%,
          rgba(255, 100, 20, .03) 40%,
          transparent 72%
        );
        filter: blur(8px);
        pointer-events: none;
        opacity: 0;
        transition: opacity .3s ease;
      }

      .doorVisual:hover .doorVisualAura,
      .doorVisual.is-hovered .doorVisualAura {
        opacity: 1;
      }

      .doorBaseShadow {
        position: absolute;
        left: 4%;
        right: 4%;
        bottom: -4%;
        height: 8%;
        border-radius: 50%;
        background: radial-gradient(
          ellipse at center,
          rgba(0,0,0,.62) 0%,
          rgba(0,0,0,.28) 48%,
          transparent 80%
        );
        filter: blur(4px);
        pointer-events: none;
      }

      .doorWallEmbed {
        position: absolute;
        inset: -3px;
        border-radius: 4px 4px 0 0;
        border: 1px solid rgba(0,0,0,.48);
        box-shadow:
          inset 0 0 12px rgba(0,0,0,.36),
          0 0 0 1px rgba(255,200,110,.05);
        pointer-events: none;
      }

      .doorSideSink {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 8%;
        background: linear-gradient(to right, rgba(0,0,0,.32), transparent);
        pointer-events: none;
      }

      .doorSideSink:last-child {
        left: auto;
        right: 0;
        background: linear-gradient(to left, rgba(0,0,0,.32), transparent);
      }

      .doorEdgeFade {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
          to bottom,
          rgba(0,0,0,.12) 0%,
          transparent 22%,
          transparent 72%,
          rgba(0,0,0,.28) 100%
        );
        pointer-events: none;
      }

      @keyframes doorVisualOpenBreathe {
        0%, 100% { box-shadow: 0 0 0 1px rgba(255,200,130,.10), inset 2px 0 6px rgba(0,0,0,.38), inset -2px 0 6px rgba(0,0,0,.38); }
        50% { box-shadow: 0 0 0 2px rgba(255,200,130,.22), inset 2px 0 6px rgba(0,0,0,.28), inset -2px 0 6px rgba(0,0,0,.28), 0 0 18px rgba(255,160,40,.12); }
      }

      .doorVisual.is-selected {
        animation: doorVisualOpenBreathe 1.6s ease-in-out infinite;
      }

      .doorVisual.is-safe {
        box-shadow:
          0 0 0 1px rgba(140, 230, 195, .26),
          inset 2px 0 6px rgba(0,0,0,.38),
          inset -2px 0 6px rgba(0,0,0,.38),
          0 0 18px rgba(100, 220, 200, .16),
          0 0 32px rgba(80, 200, 180, .07);
        filter: brightness(1.05) saturate(1.12);
      }

      .doorVisual.is-monster {
        box-shadow:
          0 0 0 1px rgba(255, 60, 60, .32),
          inset 2px 0 6px rgba(0,0,0,.38),
          inset -2px 0 6px rgba(0,0,0,.38),
          0 0 20px rgba(255, 50, 50, .20),
          0 0 36px rgba(220, 30, 30, .08);
        filter: brightness(1.03) saturate(1.18);
      }

      .doorVisual.is-curse {
        box-shadow:
          0 0 0 1px rgba(190, 110, 255, .30),
          inset 2px 0 6px rgba(0,0,0,.38),
          inset -2px 0 6px rgba(0,0,0,.38),
          0 0 20px rgba(170, 80, 255, .18),
          0 0 36px rgba(140, 60, 240, .07);
        filter: brightness(1.03) saturate(1.14) hue-rotate(6deg);
      }

      .doorResultFx {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        opacity: 0;
        z-index: 5;
      }

      .doorResultFx.safe {
        background:
          radial-gradient(circle at 50% 50%, rgba(170,235,255,.22) 0%, rgba(120,210,255,.12) 34%, transparent 72%);
        animation: doorSafePulse .48s ease-out both;
      }

      .doorResultFx.monster {
        background:
          radial-gradient(circle at 50% 50%, rgba(255,70,70,.26) 0%, rgba(255,70,70,.12) 34%, transparent 72%);
        animation: doorMonsterPulse .34s ease-out both;
      }

      .doorResultFx.curse {
        background:
          radial-gradient(circle at 50% 50%, rgba(180,118,255,.26) 0%, rgba(180,118,255,.12) 34%, transparent 72%);
        animation: doorCursePulse .46s ease-out both;
      }

      .doorResultNoise {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        opacity: 0;
        z-index: 6;
        mix-blend-mode: screen;
        background-image:
          linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0) 45%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size: 100% 100%, 180px 180px;
      }

      .doorResultNoise.monster {
        animation: doorNoiseFlash .22s steps(2,end) both;
      }

      .doorResultNoise.curse {
        animation: doorNoiseFlash .34s steps(2,end) both;
      }

      @keyframes doorSafePulse {
        0% { opacity: 0; transform: scale(.96); }
        35% { opacity: 1; transform: scale(1.01); }
        100% { opacity: 0; transform: scale(1.03); }
      }

      @keyframes doorMonsterPulse {
        0% { opacity: 0; transform: scale(1); }
        20% { opacity: 1; transform: scale(1.015); }
        55% { opacity: .42; transform: scale(1.005); }
        100% { opacity: 0; transform: scale(1.02); }
      }

      @keyframes doorCursePulse {
        0% { opacity: 0; transform: scale(.98); }
        28% { opacity: 1; transform: scale(1.01); }
        62% { opacity: .34; transform: scale(1.015); }
        100% { opacity: 0; transform: scale(1.02); }
      }

      @keyframes doorNoiseFlash {
        0% { opacity: 0; }
        25% { opacity: .34; }
        50% { opacity: .12; }
        75% { opacity: .26; }
        100% { opacity: 0; }
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
  const { t } = useI18n();
  const [hoveredDoorIndex, setHoveredDoorIndex] = useState<number | null>(null);
  const [pressedDoorIndex, setPressedDoorIndex] = useState<number | null>(null);
  const [openingDoorIndex, setOpeningDoorIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const openAnimTimeoutRef = useRef<number | null>(null);

  const { effects, colors, theme, systemMessage } = levelConfig;
  const systemMessageKey = `door.systemMessage.${level}`;
  const translatedSystemMessage = t(systemMessageKey);
  const resolvedSystemMessage =
    translatedSystemMessage === systemMessageKey ? systemMessage : translatedSystemMessage;

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
  const hintText = isAnimating ? t("door.openingHint") : doorHint;

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
          <div className="hudSub">{t("door.region")}</div>
          <div className="hudTitle">
            {t("door.floorRoom", { level, room, roomsPerFloor })}
          </div>
        </div>
        <div className="pills">
          <div className={`pill ${lives <= 2 ? "red" : ""}`}>
            {"\u2665".repeat(lives)}
            {"\u2661".repeat(maxLives - lives)}
          </div>
          {corruptionActive && <div className="pill corruptionPill">{t("door.corruption")}</div>}
          {effects.glitchAmount !== "none" && <div className="pill red">\u26a0 {t("door.anomaly")}</div>}
        </div>
      </header>

      <main className={`world ${worldShakeClass}`}>
        <div className="worldSurface">
          <div className="doorCorridorStage">
            <div className="doorCorridorBg" style={doorScreenStyle} />
            <div className="doorCorridorShadeTop" />
            <div className="doorCorridorShadeBottom" />
            <div className="doorCeilingGlow" />
            <div className="doorDepthFog" />
            <div className="doorSideVignetteLeft" />
            <div className="doorSideVignetteRight" />
            <div className="doorCenterDepthGlow" />
            <div className="doorPerspectiveLines" />
            <div className="doorFloorGlow" />

            {/* Door Visual Layer */}
            <div className="doorVisualLayer" aria-hidden="true">
              {visibleHotspots.map((hotspot) => {
                const doorState = getHotspotState(hotspot.doorIndex);
                const isSelected = doorState.selected || doorState.safe || doorState.curse || doorState.monster;
                const isHov = hoveredDoorIndex === hotspot.doorIndex;
                return (
                  <div
                    key={hotspot.doorIndex}
                    className={`doorVisual${isSelected ? " is-selected" : ""}${isHov ? " is-hovered" : ""}${doorState.safe ? " is-safe" : ""}${doorState.monster ? " is-monster" : ""}${doorState.curse ? " is-curse" : ""}${isAnimating && openingDoorIndex !== hotspot.doorIndex ? " is-dimmed" : ""}`}
                    style={{
                      left: `${hotspot.left}%`,
                      top: `${hotspot.top}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`,
                    }}
                  >
                    <div className="doorWallEmbed" />
                    <div className="doorSideSink" />
                    <div className="doorEdgeFade" />
                    <div className="doorVisualPlaque">{hotspot.label}</div>
                    <div className="doorVisualKnob" />
                    <div className="doorVisualAura" />
                    <div className="doorBaseShadow" />
                    {openingDoorIndex === hotspot.doorIndex && (
                      <span className="doorOpeningShell" aria-hidden="true">
                        <span className="doorOpeningVoidCore" />
                        <span className="doorOpeningPanel left" />
                        <span className="doorOpeningPanel right" />
                        <span className="doorOpeningFlash" />
                      </span>
                    )}
                    {doorState.safe && <span className="doorResultFx safe" aria-hidden="true" />}
                    {doorState.monster && (
                      <>
                        <span className="doorResultFx monster" aria-hidden="true" />
                        <span className="doorResultNoise monster" aria-hidden="true" />
                      </>
                    )}
                    {doorState.curse && (
                      <>
                        <span className="doorResultFx curse" aria-hidden="true" />
                        <span className="doorResultNoise curse" aria-hidden="true" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {isAnimating && <div className="doorOpenScreenFlash" aria-hidden="true" />}

            <div className="doorHotspotLayer" aria-label={t("door.selectionArea")}>
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
                  ? "rgba(84, 214, 132, .08)"
                  : doorState.curse
                    ? "rgba(180, 118, 255, .08)"
                    : doorState.monster
                      ? "rgba(255, 94, 106, .08)"
                      : "rgba(132, 188, 255, .06)";

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

            {fogStyle && <div className={`fogLayer fogLayer--${effects.fogDensity}`} style={fogStyle} />}
            {effects.scanlines && <div className="scanlinesOverlay" aria-hidden="true" />}
            {effects.redLightIntensity !== "none" && (
              <div className={`redAccentLight redAccentLight--${effects.redLightIntensity}`} aria-hidden="true" />
            )}

            <div className="levelVignette" style={vignetteStyle} aria-hidden="true" />
            <ParticleLayer type={effects.particles} />
            <GlitchOverlay amount={effects.glitchAmount} />
            <SystemMessageOverlay message={resolvedSystemMessage} level={level} />
          </div>
        </div>
      </main>

      <footer className="panel hint doorHintCompact">
        <div className="hintLabel">{t("common.status")}</div>
        <div className="hintText">{hintText}</div>
        <div className="muted">
          {t("door.rules")}
          {lastOutcome && (
            <>
              {" "}
              \u2022 {t("door.lastChoice")}{" "}
              {lastOutcome === "SAFE"
                ? `\u2714 ${t("door.outcome.safe")}`
                : lastOutcome === "CURSE"
                  ? `\u2620 ${t("door.outcome.curse")}`
                  : `\u2716 ${t("door.outcome.monster")}`}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
