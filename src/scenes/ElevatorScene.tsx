import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

const ELEVATOR_ASSETS = {
  frame: "/images/elevator/elevator_frame_empty.png",
  doorLeft: "/images/elevator/elevator_door_left.png",
  doorRight: "/images/elevator/elevator_door_right.png",
} as const;

const ELEVATOR_AUDIO = {
  open: "/audio/elevator/elevator-open.mp3",
} as const;

const ELEVATOR_OPENING = {
  left: 24.8,
  top: 15.8,
  width: 50.6,
  height: 72.2,
} as const;

const DOOR_ANIMATION_DURATION = 1200;
const AUTO_TRANSITION_DELAY = 400;

type ElevatorSceneProps = {
  onTransitionComplete: () => void;
};

type DoorAssetState = {
  leftLoaded: boolean;
  rightLoaded: boolean;
  leftError: boolean;
  rightError: boolean;
};

export function ElevatorScene({ onTransitionComplete }: ElevatorSceneProps) {
  const { t } = useI18n();

  const [doorOpening, setDoorOpening] = useState(false);
  const [transitioned, setTransitioned] = useState(false);
  const [doorState, setDoorState] = useState<DoorAssetState>({
    leftLoaded: false,
    rightLoaded: false,
    leftError: false,
    rightError: false,
  });

  const openTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);

  const panelHint = useMemo(() => {
    const raw = t("elevator.panelHint");
    return raw && raw !== "elevator.panelHint" ? raw : "Panelye dokun";
  }, [t]);

  const clearTimers = useCallback(() => {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (completeTimeoutRef.current !== null) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio(ELEVATOR_AUDIO.open);
    audio.preload = "auto";
    audio.volume = 0.85;
    openAudioRef.current = audio;

    return () => {
      clearTimers();
      if (openAudioRef.current) {
        openAudioRef.current.pause();
        openAudioRef.current.src = "";
        openAudioRef.current = null;
      }
    };
  }, [clearTimers]);

  const handlePanelClick = useCallback(() => {
    if (doorOpening || transitioned) return;

    setDoorOpening(true);
    clearTimers();

    const openAudio = openAudioRef.current;
    if (openAudio) {
      openAudio.currentTime = 0;
      openAudio.play().catch((err) => {
        console.warn("[ELEVATOR] Open sound play failed:", err);
      });
    }

    openTimeoutRef.current = window.setTimeout(() => {
      setTransitioned(true);

      completeTimeoutRef.current = window.setTimeout(() => {
        onTransitionComplete();
      }, AUTO_TRANSITION_DELAY);
    }, DOOR_ANIMATION_DURATION);
  }, [clearTimers, doorOpening, transitioned, onTransitionComplete]);

  return (
    <div className="screen elevatorScreen">
      <style>{`
        .elevatorScreen {
          gap: 0;
          padding: 0;
          background: #0a0d12;
        }

        .elevatorScreen .world {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-radius: 0;
          min-height: 0;
        }

        .elevatorContainer {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 20%, rgba(18, 28, 44, 0.7), transparent 40%),
            linear-gradient(to bottom, #09111b 0%, #060a10 100%);
        }

        .elevatorInterior {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 60%, rgba(30, 35, 45, 0.4) 0%, rgba(5, 7, 10, 0.95) 100%);
          pointer-events: none;
        }

        .elevatorStage {
          position: relative;
          width: min(90vw, 600px);
          aspect-ratio: 0.75;
          max-height: 85vh;
        }

        .elevatorFrame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          z-index: 20;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
        }

        .elevatorDoorViewport {
          position: absolute;
          left: ${ELEVATOR_OPENING.left}%;
          top: ${ELEVATOR_OPENING.top}%;
          width: ${ELEVATOR_OPENING.width}%;
          height: ${ELEVATOR_OPENING.height}%;
          overflow: hidden;
          z-index: 25;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 12%, rgba(18, 18, 18, 0.18), rgba(0, 0, 0, 0) 28%),
            linear-gradient(to bottom, rgba(10, 10, 10, 0.95) 0%, rgba(0, 0, 0, 1) 100%);
        }

        .elevatorInnerDarkness {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 14%, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 22%),
            linear-gradient(to bottom, rgba(12, 12, 12, 0.95) 0%, rgba(0, 0, 0, 1) 100%);
          z-index: 1;
        }

        .elevatorDoorLeaf {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          overflow: hidden;
          z-index: 2;
          will-change: transform;
          transition: transform ${DOOR_ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .elevatorDoorLeaf.left {
          left: 0;
          transform: translateX(0%);
        }

        .elevatorDoorLeaf.right {
          right: 0;
          transform: translateX(0%);
        }

        .elevatorDoorLeaf.left.open {
          transform: translateX(-100%);
        }

        .elevatorDoorLeaf.right.open {
          transform: translateX(100%);
        }

        .elevatorDoorFallback {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to bottom, rgba(74, 53, 36, 0.96) 0%, rgba(43, 28, 16, 0.98) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(255, 180, 120, 0.08),
            inset 0 0 20px rgba(0, 0, 0, 0.55);
        }

        .elevatorDoorFallback.left {
          border-right: 1px solid rgba(255, 210, 150, 0.08);
        }

        .elevatorDoorFallback.right {
          border-left: 1px solid rgba(255, 210, 150, 0.08);
        }

        .elevatorDoorImage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: fill;
          opacity: 1;
          visibility: visible;
          user-select: none;
          -webkit-user-drag: none;
        }

        .elevatorDoorSeam {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 2px;
          transform: translateX(-50%);
          z-index: 3;
          background:
            linear-gradient(to bottom, rgba(255, 220, 180, 0.16), rgba(0, 0, 0, 0.15), rgba(255, 220, 180, 0.08));
          opacity: ${doorOpening ? 0 : 1};
          transition: opacity 0.25s ease;
          pointer-events: none;
        }

        .elevatorPanelHotspot {
          position: absolute;
          left: 7.5%;
          top: 34%;
          width: 18%;
          height: 30%;
          cursor: pointer;
          z-index: 30;
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          outline: none;
          box-shadow: none;
          -webkit-tap-highlight-color: transparent;
        }

        .elevatorPanelHotspot:hover {
          background: transparent;
        }

        .elevatorPanelHotspot::before {
          display: none;
        }

        .elevatorHint {
          position: absolute;
          bottom: 8%;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(255, 255, 255, 0.66);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          z-index: 40;
          pointer-events: none;
          opacity: ${doorOpening || transitioned ? 0 : 1};
          transition: opacity 0.3s ease;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        }

        @media (max-width: 760px) {
          .elevatorStage {
            width: min(95vw, 400px);
            aspect-ratio: 0.8;
          }

          .elevatorPanelHotspot {
            left: 4.5%;
            width: 22%;
          }

          .elevatorHint {
            font-size: 11px;
            bottom: 6%;
          }
        }
      `}</style>

      <div className="elevatorContainer">
        <div className="elevatorInterior" />

        <div className="elevatorStage">
          <div className="elevatorDoorViewport" aria-hidden="true">
            <div className="elevatorInnerDarkness" />

            <div className={`elevatorDoorLeaf left ${doorOpening ? "open" : ""}`}>
              <div className="elevatorDoorFallback left" />
              <img
                className="elevatorDoorImage"
                src={ELEVATOR_ASSETS.doorLeft}
                alt="Elevator left door"
                onLoad={() => {
                  console.log("[ELEVATOR] LEFT DOOR LOADED", ELEVATOR_ASSETS.doorLeft);
                  setDoorState((prev) => ({
                    ...prev,
                    leftLoaded: true,
                    leftError: false,
                  }));
                }}
                onError={() => {
                  console.error("[ELEVATOR] LEFT DOOR FAILED", ELEVATOR_ASSETS.doorLeft);
                  setDoorState((prev) => ({
                    ...prev,
                    leftLoaded: false,
                    leftError: true,
                  }));
                }}
              />
            </div>

            <div className={`elevatorDoorLeaf right ${doorOpening ? "open" : ""}`}>
              <div className="elevatorDoorFallback right" />
              <img
                className="elevatorDoorImage"
                src={ELEVATOR_ASSETS.doorRight}
                alt="Elevator right door"
                onLoad={() => {
                  console.log("[ELEVATOR] RIGHT DOOR LOADED", ELEVATOR_ASSETS.doorRight);
                  setDoorState((prev) => ({
                    ...prev,
                    rightLoaded: true,
                    rightError: false,
                  }));
                }}
                onError={() => {
                  console.error("[ELEVATOR] RIGHT DOOR FAILED", ELEVATOR_ASSETS.doorRight);
                  setDoorState((prev) => ({
                    ...prev,
                    rightLoaded: false,
                    rightError: true,
                  }));
                }}
              />
            </div>

            <div className="elevatorDoorSeam" />
          </div>

          <img
            src={ELEVATOR_ASSETS.frame}
            alt="Elevator frame"
            className="elevatorFrame"
          />

          <button
            type="button"
            className="elevatorPanelHotspot"
            onClick={handlePanelClick}
            disabled={doorOpening || transitioned}
            aria-label="Call elevator"
          />
        </div>

        <div className="elevatorHint">{panelHint}</div>

        {(doorState.leftError || doorState.rightError) && (
          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              zIndex: 50,
              fontSize: 12,
              color: "rgba(255,255,255,0.6)",
              pointerEvents: "none",
            }}
          >
            Door asset load failed. Console’a bak.
          </div>
        )}
      </div>
    </div>
  );
}