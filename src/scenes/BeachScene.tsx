import React, { useEffect, useRef, useState } from "react";
import { pathObjects } from "../game/data";
import { TUNNEL_POS } from "../game/constants";
import type { ClueKey, CluesState, PathObject } from "../game/types";

type WorldProjection = {
  rel: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  visible: boolean;
  dist: number;
  t: number;
};

type SidePost = {
  pos: number;
  lane: -2 | 2;
  heightBias: number;
};

type BeachClueLayout = {
  xOffset: number;
  yProgress: number;
};

const BEACH_CLUE_LAYOUT: Record<ClueKey, BeachClueLayout> = {
  band: { xOffset: -0.34, yProgress: 0.02 },
  recorder: { xOffset: 0.28, yProgress: 0.27 },
  note: { xOffset: -0.22, yProgress: 0.52 },
  phone: { xOffset: 0.33, yProgress: 0.78 },
  tag: { xOffset: -0.24, yProgress: 0.96 },
};

const BEACH_CLUE_PATH_START = Math.min(...pathObjects.map((obj) => obj.pos));
const BEACH_CLUE_PATH_END = Math.max(...pathObjects.map((obj) => obj.pos));
const BEACH_CLUE_PATH_SPAN = Math.max(1, BEACH_CLUE_PATH_END - BEACH_CLUE_PATH_START);
const BEACH_CLUE_RENDER_LANE_SCALE = 10.5;
const BEACH_CLUE_PICKUP_RADIUS = 13.5;
const BEACH_CLUE_PICKUP_X_RADIUS = 0.08;
const BEACH_CLUE_PICKUP_Y_RADIUS = 13.5;
const BEACH_TAMAY_X_MIN = -0.45;
const BEACH_TAMAY_X_MAX = 0.45;
const BEACH_TAMAY_X_SPEED = 0.00085;
const BEACH_TAMAY_WORLD_TO_SCREEN_X = 120;

type BeachSceneProps = {
  worldShakeClass: string;
  inspectedCount: number;
  pathProgressPercent: number;
  redLightPhase: "IDLE" | "SHOW_TEXT" | "READY";
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  camSwayX: number;
  camSwayY: number;
  cameraPos: number;
  moveStrength: number;
  redLightUnlocked: boolean;
  sidePosts: SidePost[];
  relToScreen: (worldPos: number, lane: number) => WorldProjection;
  tunnelProj: WorldProjection;
  redLampProj: WorldProjection;
  clues: CluesState;
  interactableObject: PathObject | null;
  targetHint: string;
  canInspect: boolean;
  canEnterTunnel: boolean;
  canOpenBeachPuzzle: boolean;
  beachPuzzleStatusLabel: string;
  selectedClue: ClueKey | null;
  moveDir: -1 | 0 | 1;
  tamayX: number;
  tamayLift: number;
  bob: number;
  tamayScale: number;
  stride: number;
  onMoveDir: (dir: -1 | 0 | 1) => void;
  onOpenClue: (key: ClueKey) => void;
  onOpenBeachPuzzle: () => void;
  onEnterTunnel: () => void;
  beachHint: string;
  beachObjectsSolvedList: string[];
  journalOpen: boolean;
  onToggleJournal: () => void;
};

export function BeachScene({
  worldShakeClass,
  inspectedCount,
  pathProgressPercent,
  redLightPhase,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  camSwayX,
  camSwayY,
  cameraPos,
  moveStrength,
  redLightUnlocked,
  sidePosts,
  relToScreen,
  tunnelProj,
  redLampProj,
  clues,
  targetHint,
  canEnterTunnel,
  canOpenBeachPuzzle,
  beachPuzzleStatusLabel,
  selectedClue,
  moveDir,
  tamayX,
  tamayLift,
  bob,
  tamayScale,
  stride,
  onMoveDir,
  onOpenClue,
  onOpenBeachPuzzle,
  onEnterTunnel,
  beachHint,
  beachObjectsSolvedList,
  journalOpen,
  onToggleJournal,
}: BeachSceneProps) {
  const [tamayWorldX, setTamayWorldX] = useState(0);
  const [xMoveDir, setXMoveDir] = useState<-1 | 0 | 1>(0);
  const xKeyStateRef = useRef({ left: false, right: false });

  const clampTamayWorldX = (value: number) => Math.max(BEACH_TAMAY_X_MIN, Math.min(BEACH_TAMAY_X_MAX, value));

  useEffect(() => {
    if (!selectedClue) return;
    xKeyStateRef.current = { left: false, right: false };
    setXMoveDir(0);
  }, [selectedClue]);

  useEffect(() => {
    if (xMoveDir === 0 || selectedClue) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;
      setTamayWorldX((prev) => clampTamayWorldX(prev + xMoveDir * dt * BEACH_TAMAY_X_SPEED));
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [xMoveDir, selectedClue]);

  useEffect(() => {
    const syncXDir = () => {
      const { left, right } = xKeyStateRef.current;
      if (left === right) {
        setXMoveDir(0);
      } else {
        setXMoveDir(right ? 1 : -1);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedClue) return;
      const key = e.key.toLowerCase();
      if (key === "a" || e.key === "ArrowLeft") {
        xKeyStateRef.current.left = true;
        syncXDir();
        e.preventDefault();
      } else if (key === "d" || e.key === "ArrowRight") {
        xKeyStateRef.current.right = true;
        syncXDir();
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "a" || e.key === "ArrowLeft") {
        xKeyStateRef.current.left = false;
        syncXDir();
      } else if (key === "d" || e.key === "ArrowRight") {
        xKeyStateRef.current.right = false;
        syncXDir();
      }
    };

    const onBlur = () => {
      xKeyStateRef.current = { left: false, right: false };
      setXMoveDir(0);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [selectedClue]);

  const startStrafe = (dir: -1 | 1) => {
    if (selectedClue) return;
    setXMoveDir(dir);
  };

  const stopStrafe = () => setXMoveDir(0);

  const tamayWorldY = (Math.min(pathProgressPercent, 100) / 100) * TUNNEL_POS;

  const worldClues = pathObjects.map((obj) => {
    const layout = BEACH_CLUE_LAYOUT[obj.key];
    const objX = layout.xOffset;
    const objY = BEACH_CLUE_PATH_START + layout.yProgress * BEACH_CLUE_PATH_SPAN;
    return { obj, objX, objY };
  });

  const clueWorldData = worldClues.map((clue) => {
    const { obj, objX, objY } = clue;
    const lane = objX * BEACH_CLUE_RENDER_LANE_SCALE;
    const projection = relToScreen(objY, lane);
    const dx = tamayWorldX - objX;
    const dy = tamayWorldY - objY;
    const worldDistance = Math.hypot(dx, dy);
    return { obj, projection, dx, dy, worldDistance };
  });

  let nearestUnsolved: (typeof clueWorldData)[number] | null = null;

  for (const item of clueWorldData) {
    if (clues[item.obj.key]) continue;
    if (!nearestUnsolved || item.worldDistance < nearestUnsolved.worldDistance) {
      nearestUnsolved = item;
    }
  }

  const nearestIsPickable =
    !!nearestUnsolved &&
    nearestUnsolved.worldDistance < BEACH_CLUE_PICKUP_RADIUS &&
    Math.abs(nearestUnsolved.dx) < BEACH_CLUE_PICKUP_X_RADIUS &&
    Math.abs(nearestUnsolved.dy) < BEACH_CLUE_PICKUP_Y_RADIUS;

  const pickupTargetKey: ClueKey | null = nearestIsPickable && nearestUnsolved ? nearestUnsolved.obj.key : null;

  const beachTargetHint = (() => {
    if (nearestUnsolved && nearestIsPickable) return `Yakin: ${nearestUnsolved.obj.label} (AL)`;
    if (nearestUnsolved) {
      const dir = nearestUnsolved.dy > 0 ? "ileride" : "geride";
      return `Sonraki hedef: ${nearestUnsolved.obj.label} (${Math.round(Math.abs(nearestUnsolved.dy))}m, ${dir})`;
    }
    return targetHint;
  })();

  return (
    <div className="screen">
      <header className="panel hud">
        <div>
          <div className="hudSub">Sahil Yolu</div>
          <div className="hudTitle">Arkadan Kamera Keşif</div>
        </div>
        <div className="pills">
          <div className="pill">{inspectedCount}/5 İpucu</div>
          <div className={`pill ${pathProgressPercent >= 100 ? "good" : ""}`}>Yol %{pathProgressPercent}</div>
          <div className={`pill ${canOpenBeachPuzzle ? "good" : ""}`}>{beachPuzzleStatusLabel}</div>
          <div className={`pill ${redLightPhase === "READY" ? "red" : ""}`}>
            {redLightPhase === "READY" ? "Kırmızı Işık Aktif" : "Işık Pasif"}
          </div>
        </div>
      </header>

      <main
        className={`world ${worldShakeClass}`}
        aria-label="Arkadan kamera sahil yürüyüş yolu"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="worldSurface"
          style={{
            transform: `translate(${camSwayX}px, ${camSwayY}px)`,
          }}
        >
          <div className="beachSky" style={{ transform: `translateY(${cameraPos * 0.02}px)` }} />
          <div className="beachHorizonGlow" style={{ transform: `translateY(${cameraPos * 0.015}px)` }} />
          <div className="seaBands" style={{ transform: `translateY(${cameraPos * 0.06}px)` }} />

          <div className="beachPerspective">
            <div
              className="walkway"
              style={{ transform: `translateX(-50%) rotateX(63deg) translateY(${moveStrength * 2}px)` }}
            />
            <div className="walkwayEdgeL" />
            <div className="walkwayEdgeR" />

            <div
              className="horizonRedDot"
              style={{
                opacity: redLightUnlocked ? 1 : 0.45,
                transform: `translateX(-50%) scale(${redLightUnlocked ? 1.1 : 0.9})`,
              }}
            />

            {sidePosts.map((post, idx) => {
              const p = relToScreen(post.pos, post.lane);
              if (!p.visible || p.t < 0.1) return null;
              const w = Math.max(3, 5 * p.scale);
              const h = Math.max(8, (18 + post.heightBias * 5) * p.scale);
              const shadowW = Math.max(10, 18 * p.scale);

              return (
                <React.Fragment key={`post-${idx}`}>
                  <div
                    className="sidePostShadow"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y + 2.2}%`,
                      width: `${shadowW}px`,
                      height: `${Math.max(4, 7 * p.scale)}px`,
                      transform: "translate(-50%,-50%)",
                      opacity: p.opacity * 0.6,
                    }}
                  />
                  <div
                    className="sidePost"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: `${w}px`,
                      height: `${h}px`,
                      transform: "translate(-50%,-100%)",
                      opacity: p.opacity * 0.85,
                    }}
                  >
                    <div
                      className="sidePostCap"
                      style={{
                        top: `${Math.max(-2, -1 * p.scale)}px`,
                        width: `${Math.max(5, w * 1.8)}px`,
                        height: `${Math.max(2, 2.2 * p.scale)}px`,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            })}

            {tunnelProj.visible && (
              <div
                className={`tunnelPortalWorld ${redLightUnlocked ? "active" : ""}`}
                style={{
                  left: `${tunnelProj.x}%`,
                  top: `${tunnelProj.y}%`,
                  width: `${32 * tunnelProj.scale}px`,
                  height: `${42 * tunnelProj.scale}px`,
                  transform: "translate(-50%,-50%)",
                  opacity: tunnelProj.opacity,
                }}
              />
            )}

            {redLampProj.visible && redLightUnlocked && (
              <div
                style={{
                  position: "absolute",
                  left: `${redLampProj.x}%`,
                  top: `${Math.max(12, redLampProj.y - 4)}%`,
                  width: `${8 * redLampProj.scale}px`,
                  height: `${8 * redLampProj.scale}px`,
                  borderRadius: "50%",
                  background: "#ff2a2a",
                  boxShadow: "0 0 14px rgba(255,42,42,.45)",
                  transform: "translate(-50%,-50%)",
                  zIndex: 9,
                  opacity: redLampProj.opacity,
                  animation: "blink 1.1s infinite",
                }}
              />
            )}

            {clueWorldData.map(({ obj, projection: p }) => {
              if (!p.visible) return null;

              const isSolved = clues[obj.key];
              const isCurrent = !isSolved && nearestUnsolved?.obj.key === obj.key;
              const canShowPickup = !isSolved && !selectedClue && pickupTargetKey === obj.key;
              const size = 18 * p.scale;
              const pickupLeft = Math.max(7, Math.min(93, p.x + (p.x < 50 ? 4.6 : -4.6)));
              const pickupTop = Math.max(8, p.y - 4.8);

              return (
                <React.Fragment key={obj.key}>
                  <div
                    className={`worldMarker ${isSolved ? "solved" : ""} ${isCurrent ? "current" : ""}`}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      transform: "translate(-50%,-50%)",
                      opacity: p.opacity,
                      fontSize: `${Math.max(9, 9 * p.scale)}px`,
                    }}
                  >
                    {isSolved ? "✓" : obj.icon}
                  </div>
                  <div
                    className="worldMarkerLabel"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y - 1.2}%`,
                      opacity: p.opacity,
                      fontSize: `${Math.max(9, 9.5 * p.scale)}px`,
                    }}
                  >
                    {obj.label}
                  </div>
                  {canShowPickup && (
                    <button
                      className="worldPickBtn"
                      type="button"
                      onClick={() => onOpenClue(obj.key)}
                      style={{
                        left: `${pickupLeft}%`,
                        top: `${pickupTop}%`,
                        opacity: p.opacity,
                        fontSize: `${Math.max(12, 10.5 * p.scale)}px`,
                      }}
                    >
                      AL
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="fogLayer" style={{ transform: `translateX(${cameraPos * 0.03}px)` }} />

          <div className="beachOverlay">
            <div className="goalBeacon">
              <span className="goalDot" />
              <span className="goalArrow">↑</span>
              <span>{beachTargetHint}</span>
            </div>

            {canEnterTunnel && (
              <div className="interactPop" style={{ bottom: 138, borderColor: "rgba(255,60,70,.20)" }}>
                Kırmızı ışık aktif — <b>E</b> / Tünele Gir
              </div>
            )}
          </div>

          <div
            className={`tamayRig ${moveDir !== 0 && !selectedClue ? "walking" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${(tamayX + tamayWorldX * BEACH_TAMAY_WORLD_TO_SCREEN_X).toFixed(2)}px), calc(${tamayLift + bob}px)) scale(${tamayScale})`,
            }}
          >
            <div
              className="shadow"
              style={{
                width: `${92 + Math.abs(stride) * 4}px`,
                opacity: 0.65 - moveStrength * 0.08,
              }}
            />
            <div className="legL" />
            <div className="legR" />
            <div className="torso" />
            <div className="shoulderL" />
            <div className="shoulderR" />
            <div className="armL" />
            <div className="armR" />
            <div className="hood" />
            <div className="hair" />
          </div>

          <div className="beachControls">
            <div className="pad">
              <button
                className="moveBtn"
                type="button"
                title="Ileri"
                onPointerDown={() => !selectedClue && onMoveDir(1)}
                onPointerUp={() => onMoveDir(0)}
                onPointerLeave={() => onMoveDir(0)}
                onPointerCancel={() => onMoveDir(0)}
              >
                &uarr;
              </button>
              <button
                className="moveBtn"
                type="button"
                title="Geri"
                onPointerDown={() => !selectedClue && onMoveDir(-1)}
                onPointerUp={() => onMoveDir(0)}
                onPointerLeave={() => onMoveDir(0)}
                onPointerCancel={() => onMoveDir(0)}
              >
                &darr;
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="moveBtn"
                  type="button"
                  title="Sol"
                  onPointerDown={() => startStrafe(-1)}
                  onPointerUp={stopStrafe}
                  onPointerLeave={stopStrafe}
                  onPointerCancel={stopStrafe}
                >
                  &#9664;
                </button>
                <button
                  className="moveBtn"
                  type="button"
                  title="Sag"
                  onPointerDown={() => startStrafe(1)}
                  onPointerUp={stopStrafe}
                  onPointerLeave={stopStrafe}
                  onPointerCancel={stopStrafe}
                >
                  &#9654;
                </button>
              </div>
            </div>

            <div className="beachActionCol">
              <div className="miniBadge">Klavye: W/S veya Yukari/Asagi | A/D veya Sol/Sag Ok | E: Incele / Tunel</div>
              <div className="miniBadge">Mobil: Yukari/Asagi ve Sol/Sag tuslari veya yukari/asagi kaydir</div>

              {canOpenBeachPuzzle && (
                <button className="btn" type="button" onClick={onOpenBeachPuzzle}>
                  Sifre Paneli
                </button>
              )}

              {canEnterTunnel && (
                <button className="btn danger" type="button" onClick={onEnterTunnel}>
                  Tünele Gir
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="panel hint">
        <div className="hintLabel">İç Ses</div>
        <div className="hintText">{beachHint}</div>

        <div className="journalBtnRow">
          <div className="muted">
            Toplanan kayıtlar: {beachObjectsSolvedList.length ? beachObjectsSolvedList.join(" • ") : "Henüz yok"}
          </div>
          <button className="btn ghost" type="button" onClick={onToggleJournal}>
            {journalOpen ? "Günlüğü Gizle" : "Günlüğü Aç"}
          </button>
        </div>

        {journalOpen && (
          <>
            <div className="divider" />
            <div className="journalGrid">
              {pathObjects.map((o) => (
                <div className={`journalItem ${clues[o.key] ? "done" : ""}`} key={o.key}>
                  <div className="journalLabel">
                    {o.icon} {o.label}
                  </div>
                  <div className="journalState">{clues[o.key] ? "Çözüldü" : "Bulunmadı / Çözülmedi"}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </footer>
    </div>
  );
}
