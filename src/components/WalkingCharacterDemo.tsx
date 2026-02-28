import { useState, useEffect } from "react";
import { TAMAY_SPRITES } from "../game/assetsRegistry";

/**
 * WalkingCharacterDemo - Gerçek yürüme animasyonu demosu
 * 
 * Uses proper sprite animation:
 * - idle.png when not walking
 * - walk_01.png - walk_04.png for walking animation loop
 * - inspect.png for inspect state
 * 
 * All sprites from CANONICAL path: /assets/img/characters/tamay/
 */
export function WalkingCharacterDemo() {
  const [isWalking, setIsWalking] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);
  const [walkSpeed, setWalkSpeed] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [showShadow, setShowShadow] = useState(true);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [bobOffset, setBobOffset] = useState(0);

  // Animation loop
  useEffect(() => {
    if (!isWalking || isInspecting) {
      setCurrentFrame(0);
      setBobOffset(0);
      return;
    }

    let frame = 0;
    let bobPhase = 0;
    
    const interval = setInterval(() => {
      frame = (frame + 1) % TAMAY_SPRITES.walk.length;
      setCurrentFrame(frame);
      
      bobPhase += 0.15 * walkSpeed;
      const bob = Math.sin(bobPhase) * 4;
      setBobOffset(bob);
    }, 140 / walkSpeed);

    return () => clearInterval(interval);
  }, [isWalking, isInspecting, walkSpeed]);

  const currentSprite = isInspecting 
    ? TAMAY_SPRITES.inspect
    : isWalking 
      ? TAMAY_SPRITES.walk[currentFrame]
      : TAMAY_SPRITES.idle;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: `
          radial-gradient(circle at 84% 15%, rgba(255,42,42,.07), transparent 18%),
          radial-gradient(circle at 14% 18%, rgba(120,150,180,.14), transparent 28%),
          linear-gradient(to bottom, #263548 0%, #172130 48%, #101722 70%, #0d121a 100%)
        `,
      }}
    >
      {/* Background elements */}
      <div
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

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          zIndex: 100,
        }}
      >
        <h1
          style={{
            margin: "0",
            fontSize: "28px",
            fontWeight: "900",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#eef2fb",
            textShadow: "0 0 20px rgba(255,42,42,.3)",
          }}
        >
          Walking Tamay
        </h1>
        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: "14px",
            color: "rgba(238,242,251,.7)",
          }}
        >
          Gerçek yürüme animasyonu - walk_01.png to walk_04.png
        </p>
      </div>

      {/* Character */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Shadow */}
        {showShadow && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "-10px",
              transform: "translateX(-50%)",
              width: `${80 * scale}px`,
              height: `${16 * scale}px`,
              background: "rgba(0, 0, 0, 0.4)",
              borderRadius: "50%",
              filter: "blur(4px)",
            }}
          />
        )}

        {/* Sprite - anchored at bottom */}
        <img
          src={currentSprite}
          alt="Tamay"
          style={{
            width: `${128 * scale}px`,
            height: `${256 * scale}px`,
            objectFit: "contain",
            objectPosition: "center bottom", // Anchor at feet
            filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))",
            transform: `translateY(${-bobOffset}px)`,
            display: "block",
          }}
          draggable={false}
        />

        {/* Dust particles */}
        {isWalking && !isInspecting && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "-15px",
              transform: "translateX(-50%)",
              width: "100%",
              height: "30px",
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${35 + Math.sin(Date.now() / 100 + i * 2) * 20}%`,
                  bottom: "0",
                  width: `${8 + Math.random() * 4}px`,
                  height: `${8 + Math.random() * 4}px`,
                  background: "rgba(200, 180, 140, 0.5)",
                  borderRadius: "50%",
                  filter: "blur(2px)",
                  animation: "dustRise 0.6s ease-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div
        style={{
          position: "absolute",
          top: "120px",
          right: "20px",
          padding: "20px",
          background: "rgba(10, 13, 19, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          backdropFilter: "blur(10px)",
          zIndex: 100,
          minWidth: "220px",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px 0",
            fontSize: "14px",
            fontWeight: "800",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Kontroller
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Walking Toggle */}
          <button
            onClick={() => {
              setIsWalking((prev) => !prev);
              setIsInspecting(false);
            }}
            disabled={isInspecting}
            style={{
              padding: "12px 16px",
              background: isWalking ? "rgba(70,190,110,.2)" : "rgba(255,255,255,.08)",
              border: isWalking ? "1px solid rgba(70,190,110,.3)" : "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "13px",
              fontWeight: "700",
              cursor: isInspecting ? "not-allowed" : "pointer",
              opacity: isInspecting ? 0.5 : 1,
            }}
            type="button"
          >
            {isWalking ? "⏸ Durdur" : "▶ Yürüt"}
          </button>

          {/* Inspect Toggle */}
          <button
            onClick={() => {
              setIsInspecting((prev) => !prev);
              setIsWalking(false);
            }}
            style={{
              padding: "12px 16px",
              background: isInspecting ? "rgba(255,190,70,.2)" : "rgba(255,255,255,.08)",
              border: isInspecting ? "1px solid rgba(255,190,70,.3)" : "1px solid rgba(255,255,255,.15)",
              borderRadius: "10px",
              color: "#eef2fb",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
            }}
            type="button"
          >
            {isInspecting ? "🔍 İncelemeyi Bitir" : "🔍 İncele"}
          </button>

          {/* Speed Control */}
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(238,242,251,.7)",
                marginBottom: "8px",
              }}
            >
              Hız: {walkSpeed.toFixed(1)}x
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={walkSpeed}
              onChange={(e) => setWalkSpeed(parseFloat(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Scale Control */}
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "rgba(238,242,251,.7)",
                marginBottom: "8px",
              }}
            >
              Ölçek: {scale.toFixed(1)}x
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Shadow Toggle */}
          <button
            onClick={() => setShowShadow((prev) => !prev)}
            style={{
              padding: "10px 16px",
              background: showShadow ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
              border: showShadow ? "1px solid rgba(255,255,255,.15)" : "1px solid rgba(255,255,255,.05)",
              borderRadius: "8px",
              color: showShadow ? "#eef2fb" : "rgba(238,242,251,.5)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
            type="button"
          >
            {showShadow ? "✓" : "✗"} Gölge
          </button>
        </div>

        {/* Frame indicator */}
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            background: "rgba(255,255,255,.03)",
            borderRadius: "8px",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          {isInspecting ? (
            <>
              Durum: <strong>İncele</strong>
              <br />
              <span style={{ color: "rgba(238,242,251,.5)" }}>
                inspect.png
              </span>
            </>
          ) : isWalking ? (
            <>
              Çerçeve: <strong>{currentFrame + 1}/4</strong>
              <br />
              <span style={{ color: "rgba(238,242,251,.5)" }}>
                {TAMAY_SPRITES.walk[currentFrame].split("/").pop()}
              </span>
            </>
          ) : (
            <>
              Durum: <strong>Idle</strong>
              <br />
              <span style={{ color: "rgba(238,242,251,.5)" }}>
                idle.png
              </span>
            </>
          )}
        </div>
      </div>

      {/* Frames Preview */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "10px",
          padding: "15px 20px",
          background: "rgba(10, 13, 19, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          backdropFilter: "blur(10px)",
          zIndex: 100,
        }}
      >
        {TAMAY_SPRITES.walk.map((frame, index) => (
          <div
            key={frame}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <img
              src={frame}
              alt={`Frame ${index + 1}`}
              style={{
                width: "40px",
                height: "80px",
                objectFit: "contain",
                objectPosition: "center bottom",
                opacity: isWalking && !isInspecting && currentFrame === index ? 1 : 0.4,
                filter: isWalking && !isInspecting && currentFrame === index 
                  ? "drop-shadow(0 0 10px rgba(255,42,42,.5))" 
                  : "none",
                transition: "all 0.15s ease",
              }}
              draggable={false}
            />
            <span
              style={{
                fontSize: "10px",
                color: isWalking && !isInspecting && currentFrame === index ? "#ff2a2a" : "rgba(238,242,251,.5)",
                fontWeight: isWalking && !isInspecting && currentFrame === index ? "700" : "400",
              }}
            >
              {index + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          padding: "12px 16px",
          background: "rgba(10, 13, 19, 0.7)",
          border: "1px solid rgba(255, 42, 42, 0.3)",
          borderRadius: "12px",
          fontSize: "11px",
          color: "rgba(238,242,251,.8)",
          zIndex: 100,
        }}
      >
        <div><strong>Sprite Kaynakları:</strong></div>
        <div style={{ marginTop: "5px", opacity: 0.7 }}>
          • Idle: /assets/img/characters/tamay/idle.png
        </div>
        <div style={{ opacity: 0.7 }}>
          • Walk: /assets/img/characters/tamay/walk_01-04.png
        </div>
        <div style={{ opacity: 0.7 }}>
          • İncele: /assets/img/characters/tamay/inspect.png
        </div>
      </div>
    </div>
  );
}

export default WalkingCharacterDemo;
