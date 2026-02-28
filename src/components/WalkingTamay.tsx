import { useRef, useEffect, useState } from "react";
import { TAMAY_SPRITES } from "../game/assetsRegistry";

type WalkingTamayProps = {
  /**
   * World X position in pixels (relative to viewport center)
   */
  worldX?: number;
  /**
   * World Y position in pixels (relative to viewport bottom)
   */
  worldY?: number;
  /**
   * Scale of the character (0.5 to 2.0)
   */
  scale?: number;
  /**
   * Whether the character is walking
   */
  isWalking?: boolean;
  /**
   * Facing direction: 1 for right, -1 for left
   */
  facing?: 1 | -1;
  /**
   * Walking animation speed multiplier
   */
  walkSpeed?: number;
  /**
   * Optional custom class name
   */
  className?: string;
  /**
   * Click handler for interaction
   */
  onClick?: () => void;
  /**
   * Whether the character is interactive
   */
  interactive?: boolean;
  /**
   * Whether character is in inspect state
   */
  isInspecting?: boolean;
};

/**
 * WalkingTamay - A walking character component using sprite animation
 * 
 * Uses proper sprite animation with:
 * - idle.png when not moving
 * - walk_01.png through walk_04.png for walking animation loop
 * - inspect.png when inspecting
 * - tamay_cutout2.png as fallback
 * 
 * Sprite is anchored at bottom (foot level) to prevent sliding on ground
 */
export function WalkingTamay({
  worldX = 0,
  worldY = 0,
  scale = 1,
  isWalking = false,
  facing = 1,
  walkSpeed = 1,
  className = "",
  onClick,
  interactive = false,
  isInspecting = false,
}: WalkingTamayProps) {
  const walkPhaseRef = useRef(0);
  const [currentWalkFrame, setCurrentWalkFrame] = useState(0);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameTimeRef = useRef<number>(0);

  // Walking animation loop for sprite frames
  useEffect(() => {
    if (!isWalking) {
      walkPhaseRef.current = 0;
      setCurrentWalkFrame(0);
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        frameTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Frame timing: change sprite frame every 150ms divided by walkSpeed
      const frameInterval = 150 / walkSpeed;
      if (timestamp - frameTimeRef.current >= frameInterval) {
        setCurrentWalkFrame((prev) => (prev + 1) % TAMAY_SPRITES.walk.length);
        frameTimeRef.current = timestamp;
      }

      // Update walk phase for bob/sway animations
      walkPhaseRef.current += (deltaTime * 0.008 * walkSpeed);
      if (walkPhaseRef.current > Math.PI * 2) {
        walkPhaseRef.current -= Math.PI * 2;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isWalking, walkSpeed]);

  const walkPhase = walkPhaseRef.current;

  // Calculate animation values
  const bobAmount = isWalking ? Math.sin(walkPhase * 2) * 4 : 0;
  const swayAmount = isWalking ? Math.sin(walkPhase) * 2 : 0;
  const breatheAmount = Math.sin(Date.now() * 0.002) * 1;

  const totalBob = bobAmount + breatheAmount;

  // Determine which sprite to show
  const currentSprite = isInspecting 
    ? TAMAY_SPRITES.inspect 
    : isWalking 
      ? TAMAY_SPRITES.walk[currentWalkFrame]
      : TAMAY_SPRITES.idle;

  return (
    <div
      className={`walking-tamay ${interactive ? "interactive" : ""} ${className}`}
      style={{
        position: "absolute",
        left: `calc(50% + ${worldX}px)`,
        bottom: `${worldY}px`,
        transform: `translateX(-50%) scale(${scale})`,
        zIndex: 1000,
        pointerEvents: interactive ? "auto" : "none",
        cursor: interactive ? "pointer" : "default",
      }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {/* Character container with animation */}
      <div
        className="walking-tamay__character"
        style={{
          position: "relative",
          width: "128px",
          height: "256px",
          transform: `translateY(${totalBob}px) rotate(${swayAmount}deg)`,
          transformOrigin: "center bottom", // Anchor at feet
        }}
      >
        {/* Shadow */}
        <div
          className="walking-tamay__shadow"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-8px",
            transform: "translateX(-50%)",
            width: "80px",
            height: "20px",
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "50%",
            filter: "blur(4px)",
            opacity: isWalking ? 0.5 + Math.sin(walkPhase * 2) * 0.1 : 0.4,
          }}
        />

        {/* Main character sprite - anchored to bottom */}
        <img
          src={currentSprite}
          alt="Tamay"
          className="walking-tamay__sprite"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom", // Anchor at feet
            filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))",
            transform: `scaleX(${facing})`,
            transition: isWalking ? "none" : "transform 0.2s ease-out",
          }}
          draggable={false}
        />

        {/* Walking animation overlay - subtle movement hints */}
        {isWalking && (
          <>
            {/* Dust particles when walking */}
            <div
              className="walking-tamay__dust"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "0",
                transform: "translateX(-50%)",
                width: "60px",
                height: "20px",
                background: "radial-gradient(ellipse, rgba(200, 180, 140, 0.3), transparent 70%)",
                borderRadius: "50%",
                opacity: Math.sin(walkPhase * 2) * 0.5 + 0.5,
                animation: "dustPulse 0.5s ease-in-out infinite",
              }}
            />
          </>
        )}
      </div>

      {/* Interaction indicator */}
      {interactive && (
        <div
          className="walking-tamay__indicator"
          style={{
            position: "absolute",
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 8px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            fontSize: "11px",
            whiteSpace: "nowrap",
            opacity: 0,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
        >
          Click to interact
        </div>
      )}
    </div>
  );
}

/**
 * BeachWalkingTamay - A variant specifically for the beach scene
 * with automatic walking controls
 */
type BeachWalkingTamayProps = {
  /** Current X position on the beach (-100 to 100) */
  x?: number;
  /** Current depth position (0 to 100) */
  depth?: number;
  /** Walking state from parent */
  isWalking?: boolean;
  /** Movement direction from parent */
  moveDir?: -1 | 0 | 1;
  /** Facing direction */
  facing?: 1 | -1;
  /** Walk cycle phase for animation sync */
  stride?: number;
  /** Bob offset for idle animation */
  bob?: number;
  /** Lift offset */
  lift?: number;
  /** Character scale based on depth - small scale for beach perspective */
  scale?: number;
  /** Optional click handler */
  onInteract?: () => void;
  /** Inspect state */
  isInspecting?: boolean;
};

/**
 * Beach-optimized version of WalkingTamay that integrates with
 * the existing BeachScene animation system
 * 
 * Uses smaller scale for beach perspective and proper sprite animation
 */
export function BeachWalkingTamay({
  x = 0,
  depth = 0,
  isWalking = false,
  moveDir = 0,
  facing = 1,
  stride = 0,
  bob = 0,
  lift = 0,
  scale = 0.5, // Smaller scale for beach
  onInteract,
  isInspecting = false,
}: BeachWalkingTamayProps) {
  const [hovered, setHovered] = useState(false);
  const [currentWalkFrame, setCurrentWalkFrame] = useState(0);
  const frameTimeRef = useRef(0);

  // Animate walk frames
  useEffect(() => {
    if (!isWalking || moveDir === 0) {
      setCurrentWalkFrame(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentWalkFrame((prev) => (prev + 1) % TAMAY_SPRITES.walk.length);
    }, 150);

    return () => clearInterval(interval);
  }, [isWalking, moveDir]);

  // Calculate walking animation values
  const walkCycle = stride / 10;
  const bodyBob = isWalking ? Math.abs(Math.sin(walkCycle)) * 4 : 0;
  const breathe = Math.sin(Date.now() * 0.0015) * 1.5;

  const totalBob = bob + bodyBob + breathe;
  const totalLift = lift;

  // Determine which sprite to show
  const currentSprite = isInspecting
    ? TAMAY_SPRITES.inspect
    : isWalking && moveDir !== 0
      ? TAMAY_SPRITES.walk[currentWalkFrame]
      : TAMAY_SPRITES.idle;

  return (
    <div
      className="beach-walking-tamay"
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        bottom: `${totalLift}px`,
        transform: `translateX(-50%) scale(${scale})`,
        zIndex: 1000 + Math.floor(depth),
        cursor: onInteract ? "pointer" : "default",
        pointerEvents: onInteract ? "auto" : "none",
      }}
      onClick={onInteract}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Character container - anchored at bottom */}
      <div
        className="beach-walking-tamay__rig"
        style={{
          position: "relative",
          width: "140px",
          height: "280px",
          transform: `translateY(${-totalBob}px)`,
          transformOrigin: "center bottom", // Anchor at feet
        }}
      >
        {/* Shadow that shrinks when walking */}
        <div
          className="beach-walking-tamay__shadow"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-10px",
            transform: "translateX(-50%)",
            width: `${90 - (isWalking && moveDir !== 0 ? Math.abs(Math.sin(walkCycle)) * 15 : 0)}px`,
            height: "20px",
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: "50%",
            filter: "blur(5px)",
          }}
        />

        {/* Main sprite with proper animation - anchored at bottom */}
        <img
          src={currentSprite}
          alt="Tamay"
          className="beach-walking-tamay__sprite"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom", // Anchor at feet
            filter: `
              drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))
              ${hovered ? "brightness(1.1)" : ""}
            `,
            transform: `scaleX(${facing})`,
            transition: "filter 0.2s ease",
          }}
          draggable={false}
        />

        {/* Walking dust effect */}
        {isWalking && moveDir !== 0 && (
          <div
            className="beach-walking-tamay__dust-container"
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
                className="beach-walking-tamay__dust"
                style={{
                  position: "absolute",
                  left: `${30 + Math.sin(walkCycle + i * 2) * 20}%`,
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

        {/* Interaction hint */}
        {hovered && onInteract && (
          <div
            className="beach-walking-tamay__hint"
            style={{
              position: "absolute",
              top: "-30px",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "6px 12px",
              background: "rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(255, 42, 42, 0.5)",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "700",
              color: "#fff",
              whiteSpace: "nowrap",
              animation: "hintPulse 1s ease-in-out infinite",
            }}
          >
            E - İncele
          </div>
        )}
      </div>
    </div>
  );
}

export default WalkingTamay;
