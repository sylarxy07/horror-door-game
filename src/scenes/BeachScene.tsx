import React from "react";
import { pathObjects } from "../game/data";
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
  selectedClue: ClueKey | null;
  moveDir: -1 | 0 | 1;
  tamayX: number;
  tamayLift: number;
  bob: number;
  tamayScale: number;
  stride: number;
  onMoveDir: (dir: -1 | 0 | 1) => void;
  onOpenClue: (key: ClueKey) => void;
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
  interactableObject,
  targetHint,
  canInspect,
  canEnterTunnel,
  selectedClue,
  moveDir,
  tamayX,
  tamayLift,
  bob,
  tamayScale,
  stride,
  onMoveDir,
  onOpenClue,
  onEnterTunnel,
  beachHint,
  beachObjectsSolvedList,
  journalOpen,
  onToggleJournal,
}: BeachSceneProps) {
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

            {pathObjects.map((obj) => {
              const p = relToScreen(obj.pos, obj.lane);
              if (!p.visible) return null;

              const isSolved = clues[obj.key];
              const isCurrent = interactableObject?.key === obj.key;
              const size = 18 * p.scale;

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
                </React.Fragment>
              );
            })}
          </div>

          <div className="fogLayer" style={{ transform: `translateX(${cameraPos * 0.03}px)` }} />

          <div className="beachOverlay">
            <div className="goalBeacon">
              <span className="goalDot" />
              <span className="goalArrow">↑</span>
              <span>{targetHint}</span>
            </div>

            {canInspect && interactableObject && (
              <div className="interactPop">
                {interactableObject.label} yakınında — <b>E</b> / İncele
              </div>
            )}

            {canEnterTunnel && (
              <div className="interactPop" style={{ bottom: 138, borderColor: "rgba(255,60,70,.20)" }}>
                Kırmızı ışık aktif — <b>E</b> / Tünele Gir
              </div>
            )}
          </div>

          <div
            className={`tamayRig ${moveDir !== 0 && !selectedClue ? "walking" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${tamayX.toFixed(2)}px), calc(${tamayLift + bob}px)) scale(${tamayScale})`,
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
                title="İleri"
                onPointerDown={() => !selectedClue && onMoveDir(1)}
                onPointerUp={() => onMoveDir(0)}
                onPointerLeave={() => onMoveDir(0)}
                onPointerCancel={() => onMoveDir(0)}
              >
                ↑
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
                ↓
              </button>
            </div>

            <div className="beachActionCol">
              <div className="miniBadge">Klavye: W/S veya ↑/↓ • E: İncele / Tünel</div>
              <div className="miniBadge">Mobil: ↑↓ tuşları veya yukarı/aşağı kaydır</div>

              {canInspect && interactableObject && (
                <button className="btn" type="button" onClick={() => onOpenClue(interactableObject.key)}>
                  İncele ({interactableObject.label})
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
