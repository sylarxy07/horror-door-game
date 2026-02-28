import { useEffect, useRef, useState } from "react";
import { TAMAY_SPRITES } from "../game/assetsRegistry";

type BeachSceneCharacterProps = {
  worldX?: number;
  depth?: number;
  isWalking?: boolean;
  moveDir?: -1 | 0 | 1;
  isInspecting?: boolean;
};

export function BeachSceneCharacter({
  worldX = 0,
  depth = 0,
  isWalking = false,
  moveDir = 0,
  isInspecting = false,
}: BeachSceneCharacterProps) {
  const [bobOffset, setBobOffset] = useState(0);
  const [currentWalkFrame, setCurrentWalkFrame] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const facingRef = useRef<1 | -1>(1);
  const bobPhaseRef = useRef(0);

  useEffect(() => {
    if (moveDir < 0) facingRef.current = -1;
    if (moveDir > 0) facingRef.current = 1;
  }, [moveDir]);

  useEffect(() => {
    if (!isWalking || isInspecting) {
      setCurrentWalkFrame(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentWalkFrame((prev) => (prev + 1) % TAMAY_SPRITES.walk.length);
    }, 110);

    return () => window.clearInterval(intervalId);
  }, [isWalking, isInspecting]);

  useEffect(() => {
    if (!isWalking) {
      setBobOffset(0);
      return;
    }

    let rafId = 0;
    const animate = () => {
      bobPhaseRef.current += 0.16;
      setBobOffset(Math.sin(bobPhaseRef.current) * 3);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isWalking]);

  const spriteBase = isInspecting
    ? TAMAY_SPRITES.inspect
    : isWalking
      ? TAMAY_SPRITES.walk[currentWalkFrame]
      : TAMAY_SPRITES.idle;
  const spriteSrc = useFallback ? TAMAY_SPRITES.fallback : spriteBase;
  const backFacing = isWalking && moveDir === 0;

  useEffect(() => {
    setUseFallback(false);
  }, [spriteBase]);

  const depthFactor = 1 - depth / 150;
  const scale = 0.5 + depthFactor * 0.45;
  const screenY = 60 - depth * 0.3;

  const safeWorldX = Number.isFinite(worldX) ? worldX : 0;
  const safeScreenY = Number.isFinite(screenY) ? screenY : 50;
  const safeScale = Number.isFinite(scale) ? Math.max(0.1, scale) : 0.5;

  return (
    <div
      className="beach-scene-character"
      style={{
        position: "absolute",
        left: `calc(50% + ${safeWorldX}px)`,
        bottom: `${safeScreenY}%`,
        transform: `translate(-50%, 0) scale(${safeScale})`,
        zIndex: 2000,
        pointerEvents: "none",
        opacity: 1,
      }}
    >
      <div
        className="beach-scene-character__wrapper"
        style={{
          position: "relative",
          width: "128px",
          height: "240px",
          overflow: "visible",
        }}
      >
        <img
          src={spriteSrc}
          alt="Tamay"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom",
            transform: `translateY(${-bobOffset}px) scaleX(${backFacing ? -facingRef.current : facingRef.current})`,
            transition: isWalking ? "none" : "transform 0.15s ease-out",
            opacity: 1,
            pointerEvents: "none",
          }}
          onError={() => setUseFallback(true)}
          draggable={false}
        />
      </div>
    </div>
  );
}

export default BeachSceneCharacter;
