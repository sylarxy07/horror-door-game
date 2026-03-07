import { useState, useEffect, useCallback } from "react";
import { TAMAY_SPRITES } from "../game/assetsRegistry";

/**
 * WalkingTamayDemo - A demonstration of the walking Tamay character
 * 
 * Uses proper sprite animation from /assets/img/characters/tamay/:
 * - idle.png when not walking
 * - walk_01.png - walk_04.png for walking animation
 * - inspect.png when inspecting
 * 
 * Shows the character with interactive controls for testing
 */
export function WalkingTamayDemo() {
  const [isWalking, setIsWalking] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [scale, setScale] = useState(1);
  const [worldX, setWorldX] = useState(0);
  const [walkPhase, setWalkPhase] = useState(0);
  const [currentWalkFrame, setCurrentWalkFrame] = useState(0);

  // Auto-walk animation for demo
  useEffect(() => {
    if (!isWalking || isInspecting) {
      setWalkPhase(0);
      setCurrentWalkFrame(0);
      return;
    }

    let phase = 0;
    let frame = 0;
    let lastTime = performance.now();
    
    const animate = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      
      phase += dt * 0.005;
      if (phase > Math.PI * 2) phase -= Math.PI * 2;
      setWalkPhase(phase);
      
      // Update sprite frame every 150ms
      if (Math.floor(time / 150) !== Math.floor((time - dt) / 150)) {
        frame = (frame + 1) % TAMAY_SPRITES.walk.length;
        setCurrentWalkFrame(frame);
      }
      
      setWorldX((prev) => {
        const newX = prev + facing * 2;
        if (newX > 200) return -200;
        if (newX < -200) return 200;
        return newX;
      });
      
      requestAnimationFrame(animate);
    };
    
    const raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isWalking, isInspecting, facing]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isInspecting) return;
    
    switch (e.key) {
      case "ArrowLeft":
      case "a":
        setFacing(-1);
        setIsWalking(true);
        break;
      case "ArrowRight":
      case "d":
        setFacing(1);
        setIsWalking(true);
        break;
      case " ":
        setIsWalking((prev) => !prev);
        break;
      case "+":
      case "=":
        setScale((s) => Math.min(2, s + 0.1));
        break;
      case "-":
      case "_":
        setScale((s) => Math.max(0.5, s - 0.1));
        break;
      case "e":
      case "E":
        setIsInspecting((prev) => !prev);
        setIsWalking(false);
        break;
    }
  }, [isInspecting]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "ArrowRight" || e.key === "d") {
      setIsWalking(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Calculate animation values for manual control
  const bob = isWalking && !isInspecting ? Math.sin(walkPhase * 2) * 8 : 0;
  const breathe = Math.sin(Date.now() * 0.002) * 2;
  const totalBob = bob + breathe;

  // Determine which sprite to show
  const currentSprite = isInspecting 
    ? TAMAY_SPRITES.inspect
    : isWalking 
      ? TAMAY_SPRITES.walk[currentWalkFrame]
      : TAMAY_SPRITES.idle;

  return (
    <div
      className="walking-tamay-demo"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: "600px",
        overflow: "hidden",
        background: `
          radial-gradient(circle at 84% 15%, rgba(255,42,42,.07), transparent 18%),
          radial-gradient(circle at 14% 18%, rgba(120,150,180,.14), transparent 28%),
          linear-gradient(to bottom, #263548 0%, #172130 48%, #101722 70%, #0d121a 100%)
        `,
      }}
    >
      {/* Beach background elements */}
      <div
        className="beach-bg-sea"
        style={{
          position: "absolute",
          inset: "auto 0 0 0",
          height: "40%",
          opacity: 0.7,
          background: `
            linear-gradient(to top, rgba(14,19,28,.95), rgba(16,22,30,.75) 40%, rgba(20,30,40,.35) 75%, transparent),
            repeating-linear-gradient(to top, rgba(120,150,170,.04) 0 2px, rgba(0,0,0,0) 2px 10px)
          `,
        }}
      />
      <div
        className="beach-bg-fog"
        style={{
          position: "absolute",
          inset: "-10%",
          filter: "blur(14px)",
          pointerEvents: "none",
          zIndex: 12,
          background: `
            radial-gradient(circle at 20% 25%, rgba(230,235,245,.10), transparent 34%),
            radial-gradient(circle at 70% 40%, rgba(230,235,245,.06), transparent 30%),
            radial-gradient(circle at 40% 80%, rgba(230,235,245,.05), transparent 28%)
          `,
          animation: "fogMove 12s ease-in-out infinite alternate",
        }}
      />

      {/* Walking Tamay Character */}
      <div
        className="tamay-character-wrapper"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "15%",
          transform: `translateX(calc(-50% + ${worldX}px))`,
          zIndex: 1000,
        }}
      >
        {/* Character container - anchored at bottom */}
        <div
          className="tamay-character"
          style={{
            position: "relative",
            width: `${140 * scale}px`,
            height: `${280 * scale}px`,
            transform: `translateY(${-totalBob}px)`,
            transformOrigin: "center bottom", // Anchor at feet
          }}
        >
          {/* Shadow */}
          <div
            className="tamay-shadow"
            style={{
              position: "absolute",
              left: "50%",
              bottom: "-10px",
              transform: "translateX(-50%)",
              width: `${90 - (isWalking && !isInspecting ? Math.abs(Math.sin(walkPhase)) * 15 : 0)}px`,
              height: "20px",
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "50%",
              filter: "blur(5px)",
            }}
          />

          {/* Main sprite - anchored at bottom */}
          <img
            src={currentSprite}
            alt="Tamay"
            className="tamay-sprite"
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center bottom", // Anchor at feet
              filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))",
              transform: `scaleX(${facing})`,
            }}
            draggable={false}
          />

          {/* Walking dust particles */}
          {isWalking && !isInspecting && (
            <div
              className="tamay-dust-container"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "0",
                transform: "translateX(-50%)",
                width: "100%",
                height: "30px",
                pointerEvents: "none",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="tamay-dust-particle"
                  style={{
                    position: "absolute",
                    left: `${30 + Math.sin(walkPhase + i * 2) * 20}%`,
                    bottom: "0",
                    width: "12px",
                    height: "12px",
                    background: "rgba(220, 200, 170, 0.4)",
                    borderRadius: "50%",
                    filter: "blur(3px)",
                    animation: `dustRise 0.6s ease-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div
        className="demo-controls"
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "20px",
          background: "rgba(10, 13, 19, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          backdropFilter: "blur(10px)",
          zIndex: 2000,
          maxWidth: "300px",
        }}
      >
        <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "800" }}>
          Walking Tamay Demo
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(238,242,251,.7)" }}>State:</span>
            <span style={{ fontWeight: "700", color: isInspecting ? "#ffbe42" : isWalking ? "#46be6e" : "#eef2fb" }}>
              {isInspecting ? "İncele" : isWalking ? "Walking" : "Idle"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(238,242,251,.7)" }}>Facing:</span>
            <span style={{ fontWeight: "700" }}>{facing === 1 ? "Right →" : "← Left"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(238,242,251,.7)" }}>Scale:</span>
            <span style={{ fontWeight: "700" }}>{scale.toFixed(1)}x</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(238,242,251,.7)" }}>Position X:</span>
            <span style={{ fontWeight: "700" }}>{Math.round(worldX)}px</span>
          </div>
        </div>

        <div
          style={{
            marginTop: "15px",
            padding: "12px",
            background: "rgba(255,255,255,.03)",
            borderRadius: "10px",
            fontSize: "11px",
            lineHeight: "1.6",
          }}
        >
          <div style={{ fontWeight: "700", marginBottom: "8px" }}>Controls:</div>
          <div>• <strong>A / ←</strong> - Walk left</div>
          <div>• <strong>D / →</strong> - Walk right</div>
          <div>• <strong>Space</strong> - Toggle walking</div>
          <div>• <strong>E</strong> - Toggle inspect</div>
          <div>• <strong>+/-</strong> - Adjust scale</div>
        </div>

        {/* Mobile-friendly buttons */}
        <div
          style={{
            marginTop: "15px",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onMouseDown={() => { if (!isInspecting) { setFacing(-1); setIsWalking(true); } }}
            onMouseUp={() => setIsWalking(false)}
            onMouseLeave={() => setIsWalking(false)}
            onTouchStart={() => { if (!isInspecting) { setFacing(-1); setIsWalking(true); } }}
            onTouchEnd={() => setIsWalking(false)}
            disabled={isInspecting}
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "14px",
              fontWeight: "700",
              cursor: isInspecting ? "not-allowed" : "pointer",
              opacity: isInspecting ? 0.5 : 1,
            }}
            type="button"
          >
            ← Left
          </button>
          <button
            onMouseDown={() => { if (!isInspecting) { setFacing(1); setIsWalking(true); } }}
            onMouseUp={() => setIsWalking(false)}
            onMouseLeave={() => setIsWalking(false)}
            onTouchStart={() => { if (!isInspecting) { setFacing(1); setIsWalking(true); } }}
            onTouchEnd={() => setIsWalking(false)}
            disabled={isInspecting}
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "14px",
              fontWeight: "700",
              cursor: isInspecting ? "not-allowed" : "pointer",
              opacity: isInspecting ? 0.5 : 1,
            }}
            type="button"
          >
            Right →
          </button>
          <button
            onClick={() => {
              setIsInspecting(false);
              setIsWalking((prev) => !prev);
            }}
            disabled={isInspecting}
            style={{
              padding: "10px 16px",
              background: isWalking ? "rgba(70,190,110,.2)" : "rgba(255,255,255,.08)",
              border: isWalking ? "1px solid rgba(70,190,110,.3)" : "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "14px",
              fontWeight: "700",
              cursor: isInspecting ? "not-allowed" : "pointer",
              opacity: isInspecting ? 0.5 : 1,
            }}
            type="button"
          >
            {isWalking ? "Stop" : "Walk"}
          </button>
          <button
            onClick={() => {
              setIsInspecting((prev) => !prev);
              setIsWalking(false);
            }}
            style={{
              padding: "10px 16px",
              background: isInspecting ? "rgba(255,190,70,.2)" : "rgba(255,255,255,.08)",
              border: isInspecting ? "1px solid rgba(255,190,70,.3)" : "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
            }}
            type="button"
          >
            {isInspecting ? "🔍" : "İncele"}
          </button>
        </div>
      </div>

      {/* Info badge */}
      <div
        className="demo-info"
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          padding: "12px 16px",
          background: "rgba(10, 13, 19, 0.7)",
          border: "1px solid rgba(255, 42, 42, 0.3)",
          borderRadius: "12px",
          fontSize: "12px",
          color: "rgba(238,242,251,.8)",
          zIndex: 2000,
        }}
      >
        <div>Assets: <strong>/assets/img/characters/tamay/</strong></div>
        <div>Sprites: idle.png, inspect.png, walk_01-04.png</div>
      </div>
    </div>
  );
}

/**
 * BeachSceneWithTamay - Integration component for the BeachScene
 * 
 * Uses proper sprite animation from /assets/img/characters/tamay/
 */
export function BeachSceneWithTamay({
  tamayX = 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tamayLift: _tamayLift = 0,
  bob = 0,
  tamayScale = 0.5, // Smaller scale for beach
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stride: _stride = 0,
  moveDir = 0,
  isInspecting = false,
}: {
  tamayX?: number;
  tamayLift?: number;
  bob?: number;
  tamayScale?: number;
  stride?: number;
  moveDir?: -1 | 0 | 1;
  isInspecting?: boolean;
}) {
  const [walkPhase, setWalkPhase] = useState(0);
  const [currentWalkFrame, setCurrentWalkFrame] = useState(0);
  const facing: 1 | -1 = moveDir < 0 ? -1 : moveDir > 0 ? 1 : 1;
  const isWalking = moveDir !== 0;

  // Update walk phase for smooth animation when walking
  useEffect(() => {
    if (moveDir === 0 || isInspecting) {
      setWalkPhase(0);
      setCurrentWalkFrame(0);
      return;
    }
    
    const interval = setInterval(() => {
      setWalkPhase((prev) => (prev + 0.12) % (Math.PI * 2));
      setCurrentWalkFrame((prev) => (prev + 1) % TAMAY_SPRITES.walk.length);
    }, 150);
    
    return () => clearInterval(interval);
  }, [moveDir, isInspecting]);
  
  // Calculate animation values
  const walkBob = isWalking && !isInspecting ? Math.sin(walkPhase * 2) * 4 : 0;
  const breathe = Math.sin(Date.now() * 0.0015) * 1.5;
  const totalBob = bob + walkBob + breathe;
  const bodySway = isWalking && !isInspecting ? Math.sin(walkPhase * 2) * 1.5 : 0;

  // Determine which sprite to show
  const currentSprite = isInspecting
    ? TAMAY_SPRITES.inspect
    : isWalking
      ? TAMAY_SPRITES.walk[currentWalkFrame]
      : TAMAY_SPRITES.idle;

  return (
    <div
      className="beach-scene-tamay"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "8%",
        transform: `translateX(calc(-50% + ${tamayX}px))`,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        className="beach-scene-tamay__rig"
        style={{
          position: "relative",
          width: "140px",
          height: "280px",
          transform: `translateY(${-totalBob}px) scale(${tamayScale}) rotate(${bodySway}deg)`,
          transformOrigin: "center bottom", // Anchor at feet
          willChange: "transform",
        }}
      >
        {/* Dynamic shadow that changes when walking */}
        <div
          className="beach-scene-tamay__shadow"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "12px",
            transform: "translateX(-50%)",
            width: `${90 - (isWalking && !isInspecting ? Math.abs(Math.sin(walkPhase)) * 12 : 0)}px`,
            height: "20px",
            borderRadius: "999px",
            filter: "blur(5px)",
            background: "rgba(0,0,0,.5)",
            opacity: isWalking ? 0.5 + Math.sin(walkPhase * 2) * 0.12 : 0.5,
            transition: isWalking ? "none" : "all 0.3s ease",
          }}
        />

        {/* Main character sprite - anchored at bottom */}
        <img
          src={currentSprite}
          alt="Tamay"
          className="beach-scene-tamay__sprite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: `translateX(-50%) scaleX(${facing})`,
            width: "128px",
            height: "256px",
            objectFit: "contain",
            objectPosition: "center bottom", // Anchor at feet
            filter: "drop-shadow(0 10px 20px rgba(0,0,0,.5))",
            transition: isWalking ? "none" : "transform 0.2s ease",
          }}
          draggable={false}
        />

        {/* Dust particles when walking - adds atmosphere */}
        {isWalking && !isInspecting && (
          <div
            className="beach-scene-tamay__dust"
            style={{
              position: "absolute",
              left: "50%",
              bottom: "0",
              transform: "translateX(-50%)",
              width: "80px",
              height: "30px",
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="dust-particle"
                style={{
                  position: "absolute",
                  left: `${20 + Math.sin(walkPhase + i * 1.5) * 25}%`,
                  bottom: "0",
                  width: `${8 + Math.random() * 6}px`,
                  height: `${8 + Math.random() * 6}px`,
                  background: "rgba(220, 200, 170, 0.5)",
                  borderRadius: "50%",
                  filter: "blur(2px)",
                  animation: `dustRise ${0.5 + Math.random() * 0.3}s ease-out ${i * 0.12}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WalkingTamayDemo;
