import React, { useCallback, useEffect, useRef, useState } from "react";

// ==================== TYPES ====================

type Vector2D = { x: number; y: number };

type WorldObjectType = "lore" | "hint";

type WorldObject = {
  id: string;
  type: WorldObjectType;
  worldX: number;
  worldY: number;
  label: string;
  description: string;
  icon: string;
  collected: boolean;
};

type InventoryItem = {
  id: string;
  label: string;
  description: string;
  icon: string;
  type: WorldObjectType;
};

type InteractTarget = {
  type: "obj" | "gate";
  id?: string;
};

// ==================== CONSTANTS ====================

const WORLD_VIEW_RANGE = 250; // 250m visibility range
const INTERACT_RADIUS = 18; // 18m interaction range
const GATE_INTERACT_RADIUS = 20; // 20m for gate interaction
const PLAYER_SPEED = 0.12; // World units per ms
const JOYSTICK_MAX_DISTANCE = 60;
const JOYSTICK_DEADZONE = 8;
const TUNNEL_PASSWORD = "31425";

// World boundaries
const WORLD_X_MIN = -120; // Left edge of path
const WORLD_X_MAX = 120;  // Right edge of path
const WORLD_Y_MIN = 0;    // Start
const WORLD_Y_MAX = 1400; // Tunnel gate at the end

// Starting position for Tamay
const START_POSITION: Vector2D = { x: 0, y: 0 };

// Tunnel Gate position (at the end of the world - 1400m)
const TUNNEL_GATE: Vector2D = { x: 0, y: WORLD_Y_MAX };

// Camera anchor: player appears at ~72% from top (lower-middle area)
const CAM_ANCHOR_Y_RATIO = 0.72;
// Camera anchor X: player appears at ~50% horizontally
const CAM_ANCHOR_X_RATIO = 0.50;
// Camera lerp factor (0.10 = smooth follow)
const CAM_LERP = 0.10;

// Pixels per world unit (for screen projection)
const WORLD_TO_PX = 2.8;

// 5 objects positioned at EXACT 250m intervals along the path
const INITIAL_OBJECTS: WorldObject[] = [
  {
    id: "lore1",
    type: "lore",
    worldX: 0,
    worldY: 250,
    label: "Sisli Kayalar",
    description: "Denizden süzülen sisle kaplı kayalıklar. Üzerinde eski bir denek numarası görünüyor: B-17",
    icon: "🪨",
    collected: false,
  },
  {
    id: "hint1",
    type: "hint",
    worldX: -60,
    worldY: 500,
    label: "Paslı Kapı Kolu",
    description: "Rust bir kapı kolu. Üzerindeki çizikler dikkatini çekiyor. Üç çizik var... biri derin. Aralarında kısa bir boşluk var. Sanki 3-1-4 gibi bir ritim...",
    icon: "🚪",
    collected: false,
  },
  {
    id: "lore2",
    type: "lore",
    worldX: 40,
    worldY: 750,
    label: "Kıyı Kemeri",
    description: "Eski bir iskele kalıntısı. Kemer üzerine yazılmış: 'Aşağı inmek, yukarı çıkmaktan daha hızlı'",
    icon: "🌉",
    collected: false,
  },
  {
    id: "hint2",
    type: "hint",
    worldX: -30,
    worldY: 1000,
    label: "Kırık Fener",
    description: "Bozuk bir deniz feneri. Camın iç yüzeyinde iki iz kalmış: 2 ve 5. Ama sıra ters mi, düz mü... Kimbilir?",
    icon: "💡",
    collected: false,
  },
  {
    id: "lore3",
    type: "lore",
    worldX: 70,
    worldY: 1250,
    label: "Kum Tepesi",
    description: "Rüzgarın şekillendirdiği kum tepeciği. Üzerinde yarı gömülü bir defter sayfası: 'Zaman geri sayıyor'",
    icon: "📖",
    collected: false,
  },
];

// ==================== LERP ====================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ==================== COMPONENT ====================

type BeachWorldProps = {
  onBack?: () => void;
  onEnterTunnel?: () => void;
};

export function BeachWorld({ onBack, onEnterTunnel }: BeachWorldProps) {
  // Player state
  const [playerPos, setPlayerPos] = useState<Vector2D>(START_POSITION);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [worldObjects, setWorldObjects] = useState<WorldObject[]>(INITIAL_OBJECTS);

  // Interaction state
  const [selectedObject, setSelectedObject] = useState<WorldObject | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Password panel state
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  // Walking animation state
  const [walking, setWalking] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const walkTimeRef = useRef(0);

  // Movement state
  const keysPressedRef = useRef<Set<string>>(new Set());
  const moveDirectionRef = useRef<Vector2D>({ x: 0, y: 0 });
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Camera state - smooth follow using lerp
  // camX/camY = current camera world position (what world point is at screen anchor)
  const camXRef = useRef<number>(START_POSITION.x);
  const camYRef = useRef<number>(START_POSITION.y);
  // Rendered camera position (state, updated from ref each frame for re-render)
  const [camPos, setCamPos] = useState<Vector2D>({ x: START_POSITION.x, y: START_POSITION.y });

  // Joystick state
  const joystickActiveRef = useRef(false);
  const joystickStartRef = useRef<Vector2D>({ x: 0, y: 0 });
  const joystickCurrentRef = useRef<Vector2D>({ x: 0, y: 0 });
  const joystickElementRef = useRef<HTMLDivElement | null>(null);

  // INTERACT REF - Ref-based tracking to avoid stale closures
  const interactRef = useRef<InteractTarget | null>(null);

  // Refs to current state values for use in event handlers
  const worldObjectsRef = useRef(worldObjects);
  const playerPosRef = useRef(playerPos);
  const passwordUnlockedRef = useRef(passwordUnlocked);

  // Keep refs in sync with state
  useEffect(() => { worldObjectsRef.current = worldObjects; }, [worldObjects]);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { passwordUnlockedRef.current = passwordUnlocked; }, [passwordUnlocked]);

  // ==================== PASSWORD PANEL LOGIC ====================

  const canUnlockPanel = useCallback(() => {
    const loreCount = inventory.filter(item => item.type === "lore").length;
    const hintCount = inventory.filter(item => item.type === "hint").length;
    return loreCount >= 3 && hintCount >= 2;
  }, [inventory]);

  const handlePasswordDigit = useCallback((digit: string) => {
    if (passwordUnlocked) return;
    if (passwordInput.length < 5) {
      setPasswordInput(prev => prev + digit);
      setPasswordFeedback("");
    }
  }, [passwordInput.length, passwordUnlocked]);

  const handlePasswordBackspace = useCallback(() => {
    if (passwordUnlocked) return;
    setPasswordInput(prev => prev.slice(0, -1));
    setPasswordFeedback("");
  }, [passwordUnlocked]);

  const handlePasswordClear = useCallback(() => {
    if (passwordUnlocked) return;
    setPasswordInput("");
    setPasswordFeedback("");
  }, [passwordUnlocked]);

  const handlePasswordSubmit = useCallback(() => {
    if (passwordUnlocked) {
      if (onEnterTunnel) {
        setShowPasswordPanel(false);
        onEnterTunnel();
      }
      return;
    }

    if (!canUnlockPanel()) {
      const loreCount = inventory.filter(item => item.type === "lore").length;
      const hintCount = inventory.filter(item => item.type === "hint").length;
      setPasswordFeedback(`Eksik parçalar var. Lore: ${loreCount}/3, İpucu: ${hintCount}/2`);
      return;
    }

    if (passwordInput.length !== 5) {
      setPasswordFeedback("5 haneli şifre gerekli.");
      return;
    }

    if (passwordInput !== TUNNEL_PASSWORD) {
      setPasswordFeedback("Yanlış şifre. Sistem seni kaydediyor...");
      setPasswordInput("");
      return;
    }

    setPasswordFeedback("Kilit açıldı.");
    setPasswordUnlocked(true);

    setTimeout(() => {
      setShowPasswordPanel(false);
      if (onEnterTunnel) {
        onEnterTunnel();
      }
    }, 600);
  }, [passwordInput, passwordUnlocked, canUnlockPanel, inventory, onEnterTunnel]);

  // Keyboard support for password panel
  useEffect(() => {
    if (!showPasswordPanel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (passwordUnlocked) return;

      const key = e.key;

      if (key >= "0" && key <= "9") {
        handlePasswordDigit(key);
        e.preventDefault();
      } else if (key === "Backspace") {
        handlePasswordBackspace();
        e.preventDefault();
      } else if (key === "Enter") {
        handlePasswordSubmit();
        e.preventDefault();
      } else if (key === "Escape") {
        setShowPasswordPanel(false);
        setPasswordFeedback("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPasswordPanel, passwordUnlocked, handlePasswordDigit, handlePasswordBackspace, handlePasswordSubmit]);

  // ==================== MOVEMENT SYSTEM ====================

  const updatePlayerPosition = useCallback((deltaTime: number) => {
    const moveDir = moveDirectionRef.current;
    const magnitude = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);

    if (magnitude < 0.01) {
      setWalking(false);
      return;
    }

    setWalking(true);

    // Update facing direction based on X movement
    if (moveDir.x < -0.1) setFacingLeft(true);
    else if (moveDir.x > 0.1) setFacingLeft(false);

    // Normalize
    const normalized = {
      x: moveDir.x / magnitude,
      y: moveDir.y / magnitude,
    };

    setPlayerPos((prev) => {
      const newX = prev.x + normalized.x * PLAYER_SPEED * deltaTime;
      const newY = prev.y + normalized.y * PLAYER_SPEED * deltaTime;

      return {
        x: Math.max(WORLD_X_MIN, Math.min(WORLD_X_MAX, newX)),
        y: Math.max(WORLD_Y_MIN, Math.min(WORLD_Y_MAX, newY)),
      };
    });
  }, []);

  // Game loop: movement + camera lerp
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaTime = Math.min(timestamp - lastFrameTimeRef.current, 64); // cap at ~15fps min
      lastFrameTimeRef.current = timestamp;

      // Accumulate walk time for bobbing animation
      const moveDir = moveDirectionRef.current;
      const mag = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
      if (mag > 0.01) {
        walkTimeRef.current += deltaTime;
      }

      updatePlayerPosition(deltaTime);

      // Camera lerp: smooth follow player
      const px = playerPosRef.current;
      camXRef.current = lerp(camXRef.current, px.x, CAM_LERP);
      camYRef.current = lerp(camYRef.current, px.y, CAM_LERP);

      setCamPos({ x: camXRef.current, y: camYRef.current });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePlayerPosition]);

  // ==================== UTILITY FUNCTIONS ====================

  const getDistance = (a: Vector2D, b: Vector2D): number => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  };

  const openInteractTarget = useCallback(() => {
    const target = interactRef.current;

    if (!target) return;

    if (target.type === "gate") {
      setShowPasswordPanel(true);
      setPasswordFeedback("");
    } else if (target.type === "obj" && target.id) {
      const objects = worldObjectsRef.current;
      const obj = objects.find(o => o.id === target.id);
      if (obj && !obj.collected) {
        setSelectedObject(obj);
        setShowModal(true);
      }
    }
  }, []);

  // ==================== KEYBOARD CONTROLS ====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPasswordPanel) return;

      const key = e.key.toLowerCase();
      keysPressedRef.current.add(key);
      updateMoveDirection();

      if (e.code === "KeyE") {
        openInteractTarget();
        e.preventDefault();
      }

      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressedRef.current.delete(key);
      updateMoveDirection();
    };

    const updateMoveDirection = () => {
      const keys = keysPressedRef.current;
      let x = 0;
      let y = 0;

      if (keys.has("w") || keys.has("arrowup")) y += 1;
      if (keys.has("s") || keys.has("arrowdown")) y -= 1;
      if (keys.has("a") || keys.has("arrowleft")) x -= 1;
      if (keys.has("d") || keys.has("arrowright")) x += 1;

      moveDirectionRef.current = { x, y };
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showPasswordPanel, openInteractTarget]);

  // ==================== JOYSTICK CONTROLS ====================

  const handleJoystickStart = useCallback((clientX: number, clientY: number) => {
    joystickActiveRef.current = true;
    joystickStartRef.current = { x: clientX, y: clientY };
    joystickCurrentRef.current = { x: clientX, y: clientY };
  }, []);

  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
    if (!joystickActiveRef.current) return;

    joystickCurrentRef.current = { x: clientX, y: clientY };

    const dx = clientX - joystickStartRef.current.x;
    const dy = clientY - joystickStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > JOYSTICK_DEADZONE) {
      const clampedDistance = Math.min(distance, JOYSTICK_MAX_DISTANCE);
      const normalizedDistance = (clampedDistance - JOYSTICK_DEADZONE) / (JOYSTICK_MAX_DISTANCE - JOYSTICK_DEADZONE);

      const angle = Math.atan2(dy, dx);
      moveDirectionRef.current = {
        x: Math.cos(angle) * normalizedDistance,
        y: -Math.sin(angle) * normalizedDistance,
      };
    } else {
      moveDirectionRef.current = { x: 0, y: 0 };
    }
  }, []);

  const handleJoystickEnd = useCallback(() => {
    joystickActiveRef.current = false;
    moveDirectionRef.current = { x: 0, y: 0 };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      handleJoystickStart(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      handleJoystickMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    handleJoystickEnd();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleJoystickStart(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    handleJoystickMove(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    handleJoystickEnd();
  };

  // ==================== INTERACTION SYSTEM ====================

  const findNearestObject = useCallback((): { obj: WorldObject; distance: number } | null => {
    let nearest: { obj: WorldObject; distance: number } | null = null;
    let minDist = Infinity;

    for (const obj of worldObjects) {
      if (obj.collected) continue;
      const dist = getDistance(playerPos, { x: obj.worldX, y: obj.worldY });
      if (dist < minDist) {
        minDist = dist;
        nearest = { obj, distance: dist };
      }
    }

    return nearest;
  }, [playerPos, worldObjects]);

  const nearestObjectData = findNearestObject();
  const nearestObject = nearestObjectData?.obj ?? null;
  const nearestObjectDistance = nearestObjectData?.distance ?? Infinity;
  const canInteractObject = nearestObject && !nearestObject.collected &&
    nearestObjectDistance <= INTERACT_RADIUS;

  const gateDistance = getDistance(playerPos, TUNNEL_GATE);
  const canInteractGate = gateDistance <= GATE_INTERACT_RADIUS;

  // UPDATE INTERACT REF
  if (canInteractGate) {
    interactRef.current = { type: "gate", id: undefined };
  } else if (canInteractObject && nearestObject) {
    interactRef.current = { type: "obj", id: nearestObject.id };
  } else {
    interactRef.current = null;
  }

  const handleInteract = () => {
    openInteractTarget();
  };

  const handleCollectObject = () => {
    if (!selectedObject) return;

    setWorldObjects((prev) =>
      prev.map((obj) => (obj.id === selectedObject.id ? { ...obj, collected: true } : obj))
    );

    setInventory((prev) => [
      ...prev,
      {
        id: selectedObject.id,
        label: selectedObject.label,
        description: selectedObject.description,
        icon: selectedObject.icon,
        type: selectedObject.type,
      },
    ]);

    setShowModal(false);
    setSelectedObject(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedObject(null);
  };

  const handleClosePasswordPanel = () => {
    setShowPasswordPanel(false);
    setPasswordFeedback("");
  };

  // ==================== RENDER HELPERS ====================

  const getJoystickPosition = (): { x: number; y: number } => {
    if (!joystickActiveRef.current) return { x: 0, y: 0 };

    const dx = joystickCurrentRef.current.x - joystickStartRef.current.x;
    const dy = joystickCurrentRef.current.y - joystickStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDistance = Math.min(distance, JOYSTICK_MAX_DISTANCE);
    const angle = Math.atan2(dy, dx);

    return {
      x: Math.cos(angle) * clampedDistance,
      y: Math.sin(angle) * clampedDistance,
    };
  };

  // ==================== CAMERA + WORLD PROJECTION ====================
  //
  // camPos = world coordinate the camera is currently centered on.
  // Screen anchor for player = (CAM_ANCHOR_X_RATIO * viewW, CAM_ANCHOR_Y_RATIO * viewH)
  //
  // worldToScreen(worldPt):
  //   screenX = anchorX + (worldPt.x - camPos.x) * WORLD_TO_PX
  //   screenY = anchorY - (worldPt.y - camPos.y) * WORLD_TO_PX  (Y inverted: higher world Y = higher on screen = smaller screenY)
  //
  // For percentage-based layout (viewport is 100% x 100%):
  //   screenXPct = CAM_ANCHOR_X_RATIO * 100 + (worldPt.x - camPos.x) * WORLD_TO_PX_PCT
  //   screenYPct = CAM_ANCHOR_Y_RATIO * 100 - (worldPt.y - camPos.y) * WORLD_TO_PX_PCT
  //
  // WORLD_TO_PX_PCT converts world units to % of viewport.
  // We'll use a fixed viewport-relative scale factor.
  const WORLD_TO_PCT_X = 0.20; // horizontal spread (world unit -> % of viewport width)
  const WORLD_TO_PCT_Y = 0.08; // vertical spread (world unit -> % of viewport height)

  const worldToScreen = (wx: number, wy: number): { sx: number; sy: number } => {
    const sx = CAM_ANCHOR_X_RATIO * 100 + (wx - camPos.x) * WORLD_TO_PCT_X * 100;
    const sy = CAM_ANCHOR_Y_RATIO * 100 - (wy - camPos.y) * WORLD_TO_PCT_Y * 100;
    return { sx, sy };
  };

  // Player screen position (always at cam anchor + offset from cam)
  const playerScreen = worldToScreen(playerPos.x, playerPos.y);

  // Bobbing + tilt for walking feel
  const walkT = walkTimeRef.current;
  const bobY = walking ? Math.sin(walkT * 0.008) * 4 : 0; // px vertical bob
  const tiltDeg = walking ? Math.sin(walkT * 0.008) * 1.5 : 0; // degrees tilt

  const playerSpriteStyle: React.CSSProperties = {
    transform: [
      `scaleX(${facingLeft ? -1 : 1})`,
      `translateY(${bobY}px)`,
      `rotate(${tiltDeg}deg)`,
    ].join(" "),
    display: "inline-block",
    transformOrigin: "bottom center",
    transition: "transform 0.05s linear",
    fontSize: "2.2rem",
    lineHeight: 1,
  };

  // Project a world object using camera position
  const projectWorldObject = (wx: number, wy: number, baseScaleMultiplier = 1) => {
    const dx = wx - playerPos.x;
    const dy = wy - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const depthScale = Math.max(0.2, 1 - distance / WORLD_VIEW_RANGE);
    const relativeY = wy - playerPos.y;
    const yDepthScale = Math.max(0.3, 1 - Math.abs(relativeY) / 800);
    const scale = depthScale * yDepthScale * baseScaleMultiplier;

    const { sx, sy } = worldToScreen(wx, wy);

    const opacity = distance > WORLD_VIEW_RANGE ? 0 : Math.max(0.15, 1 - distance / WORLD_VIEW_RANGE);
    const zIndex = Math.floor(wy);

    return { screenX: sx, screenY: sy, scale, opacity, zIndex, distance };
  };

  // Filter visible objects and sort by zIndex for proper layering
  const visibleObjects = worldObjects
    .filter((obj) => {
      const dist = getDistance(playerPos, { x: obj.worldX, y: obj.worldY });
      return dist < WORLD_VIEW_RANGE;
    })
    .map((obj) => ({ obj, projection: projectWorldObject(obj.worldX, obj.worldY) }))
    .sort((a, b) => a.projection.zIndex - b.projection.zIndex);

  // Gate projection
  const gateProjection = projectWorldObject(TUNNEL_GATE.x, TUNNEL_GATE.y, 1.8);
  const gateVisible = gateProjection.distance < WORLD_VIEW_RANGE;

  // Progress calculation
  const progressPercent = Math.min(100, (playerPos.y / WORLD_Y_MAX) * 100);
  const distanceRemaining = Math.max(0, WORLD_Y_MAX - playerPos.y);

  // ==================== RENDER ====================

  const loreCount = inventory.filter(item => item.type === "lore").length;
  const hintCount = inventory.filter(item => item.type === "hint").length;
  const progressReady = loreCount >= 3 && hintCount >= 2;

  return (
    <div className="beachWorldScreen">
      {/* HUD */}
      <header className="beachWorldHeader">
        <div className="beachWorldTitle">
          <h1>Sahil Dünyası</h1>
          <p>W/↑ ileri • S/↓ geri • A/D ←→ • E ile etkileşim</p>
        </div>
        <div className="beachWorldStats">
          <div className="stat">İlerleme: %{progressPercent.toFixed(1)}</div>
          <div className="stat">Kalan: {Math.round(distanceRemaining)}m</div>
          <div className="stat">Envanter: {inventory.length}/5</div>
          <div className={`stat ${progressReady ? "good" : ""}`}>
            L{loreCount}/3 • İ{hintCount}/2
          </div>
        </div>
        {onBack && (
          <button className="btn ghost" onClick={onBack} type="button">
            ← Geri
          </button>
        )}
      </header>

      {/* World View */}
      <main className="beachWorldMain">
        <div className="beachWorldViewport">
          {/* Background layers for depth */}
          <div className="beachWorldSky" />
          <div className="beachWorldHorizon" />

          {/* Path/Road - creates the corridor effect */}
          <div className="beachWorldPath" />

          {/* Ground */}
          <div className="beachWorldGround" />

          {/* World Objects - sorted by zIndex for proper 2.5D layering */}
          {visibleObjects.map(({ obj, projection }) => {
            const isNear = projection.distance <= INTERACT_RADIUS;
            const canInteractThis = isNear && !obj.collected;

            return (
              <div
                key={obj.id}
                className={`worldObject ${obj.collected ? "collected" : ""} ${canInteractThis ? "interactable" : ""}`}
                style={{
                  left: `${projection.screenX}%`,
                  top: `${projection.screenY}%`,
                  transform: `translate(-50%, -50%) scale(${projection.scale})`,
                  opacity: projection.opacity,
                  zIndex: projection.zIndex,
                }}
              >
                <div className="objectIcon">{obj.collected ? "✓" : obj.icon}</div>
                {canInteractThis && (
                  <div className="objectInteractionHint">
                    <span className="interactionKey">E</span>
                    <span className="interactionLabel">İNCELE</span>
                  </div>
                )}
                {!obj.collected && (
                  <div className="objectLabel">{obj.label}</div>
                )}
              </div>
            );
          })}

          {/* Tunnel Gate */}
          {gateVisible && (
            <div
              className={`tunnelGate ${canInteractGate ? "interactable" : ""} ${passwordUnlocked ? "unlocked" : ""}`}
              style={{
                left: `${gateProjection.screenX}%`,
                top: `${gateProjection.screenY}%`,
                transform: `translate(-50%, -50%) scale(${gateProjection.scale})`,
                opacity: gateProjection.opacity,
                zIndex: gateProjection.zIndex,
              }}
            >
              <div className="tunnelGateIcon">
                {passwordUnlocked ? "🔓" : "🚪"}
              </div>
              {canInteractGate && (
                <div className="objectInteractionHint">
                  <span className="interactionKey">E</span>
                  <span className="interactionLabel">
                    {passwordUnlocked ? "TÜNELE GİR" : "İNCELE"}
                  </span>
                </div>
              )}
              <div className="objectLabel tunnelGateLabel">
                Tünel Kapısı
              </div>
            </div>
          )}

          {/* Player - world-positioned with camera offset */}
          <div
            className="beachWorldPlayer"
            style={{
              left: `${playerScreen.sx}%`,
              top: `${playerScreen.sy}%`,
              zIndex: Math.floor(playerPos.y) + 1,
            }}
          >
            <div className="playerSprite" style={playerSpriteStyle}>🚶</div>
            <div className="playerShadow" />
          </div>

          {/* Direction indicator for nearest object */}
          {nearestObject && !nearestObject.collected && nearestObjectDistance > INTERACT_RADIUS && (
            <div className="directionIndicator">
              <span>⬆</span>
              <span className="directionLabel">
                {nearestObject.label} ({Math.round(nearestObjectDistance)}m)
              </span>
            </div>
          )}

          {/* Gate direction indicator when close */}
          {gateProjection.distance > INTERACT_RADIUS && gateProjection.distance < 150 && (
            <div className="directionIndicator gateDirection">
              <span>⬆</span>
              <span className="directionLabel">
                Tünel ({Math.round(gateProjection.distance)}m)
              </span>
            </div>
          )}

          {/* Gate interaction hint when very close */}
          {canInteractGate && !showPasswordPanel && (
            <div className="gateInteractionHint">
              Tünel Kapısı • E / İNCELE ile Panel
            </div>
          )}
        </div>
      </main>

      {/* Mobile Controls */}
      <div className="beachWorldControls">
        {/* Joystick - Bottom Left */}
        <div
          ref={joystickElementRef}
          className="joystickContainer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          <div className="joystickBase">
            <div
              className="joystickKnob"
              style={{
                transform: `translate(${getJoystickPosition().x}px, ${getJoystickPosition().y}px)`,
              }}
            />
          </div>
        </div>

        {/* Interact Button - Bottom Right */}
        <button
          className={`interactButton ${(canInteractObject || canInteractGate) ? "active" : "disabled"}`}
          onClick={handleInteract}
          disabled={!canInteractObject && !canInteractGate}
          type="button"
        >
          <span className="interactButtonIcon">🔍</span>
          <span className="interactButtonText">İNCELE</span>
        </button>
      </div>

      {/* Inventory Panel */}
      {inventory.length > 0 && (
        <div className="inventoryPanel">
          <h3>Envanter</h3>
          <div className="inventoryGrid">
            {inventory.map((item) => (
              <div key={item.id} className={`inventoryItem ${item.type === "hint" ? "hint" : "lore"}`}>
                <span className="inventoryIcon">{item.icon}</span>
                <span className="inventoryLabel">{item.label}</span>
              </div>
            ))}
            {Array.from({ length: 5 - inventory.length }).map((_, i) => (
              <div key={`empty-${i}`} className="inventoryItem empty" />
            ))}
          </div>
        </div>
      )}

      {/* Object Modal */}
      {showModal && selectedObject && (
        <div className="modalOverlay" onClick={handleCloseModal}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2>{selectedObject.icon} {selectedObject.label}</h2>
              <button className="closeButton" onClick={handleCloseModal} type="button">✕</button>
            </div>
            <div className="modalBody">
              <p>{selectedObject.description}</p>
              <div className="modalActions">
                <button className="btn ghost" onClick={handleCloseModal} type="button">
                  Kapat
                </button>
                <button className="btn danger" onClick={handleCollectObject} type="button">
                  Topla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Panel Modal */}
      {showPasswordPanel && (
        <div className="modalOverlay" onClick={handleClosePasswordPanel}>
          <div className="modalContent passPanelContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2>🚪 Tünel Kapısı</h2>
              <button className="closeButton" onClick={handleClosePasswordPanel} type="button">✕</button>
            </div>
            <div className="modalBody">
              {!passwordUnlocked ? (
                <>
                  <p>5 haneli şifreyi girerek tünel kilidini aç.</p>

                  {/* Progress indicator */}
                  <div className="passProgress">
                    <div className={`passProgressItem ${loreCount >= 3 ? "complete" : ""}`}>
                      <span className="passProgressIcon">📖</span>
                      <span className="passProgressText">Lore: {loreCount}/3</span>
                    </div>
                    <div className={`passProgressItem ${hintCount >= 2 ? "complete" : ""}`}>
                      <span className="passProgressIcon">💡</span>
                      <span className="passProgressText">İpucu: {hintCount}/2</span>
                    </div>
                  </div>

                  {/* Password display */}
                  <div className="passDisplay">
                    {(passwordInput + "_____").slice(0, 5).split("").map((ch, i) => (
                      <div key={i} className="passCell">
                        {ch === "_" ? "•" : ch}
                      </div>
                    ))}
                  </div>

                  {/* Feedback message */}
                  {passwordFeedback && (
                    <div className={`passMsg ${passwordFeedback.includes("Eksik") ? "error" : passwordFeedback.includes("Yanlış") ? "error" : passwordFeedback.includes("açıldı") ? "success" : ""}`}>
                      {passwordFeedback}
                    </div>
                  )}

                  {/* Mobile keypad */}
                  <div className="passKeypad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        className="passKey"
                        onClick={() => handlePasswordDigit(String(num))}
                        type="button"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      className="passKey passKeyAction"
                      onClick={handlePasswordClear}
                      type="button"
                    >
                      Temizle
                    </button>
                    <button
                      className="passKey"
                      onClick={() => handlePasswordDigit("0")}
                      type="button"
                    >
                      0
                    </button>
                    <button
                      className="passKey passKeyAction"
                      onClick={handlePasswordBackspace}
                      type="button"
                    >
                      ⌫
                    </button>
                  </div>

                  {/* Submit button */}
                  <button
                    className={`btn danger passSubmit ${passwordUnlocked ? "unlocked" : ""}`}
                    onClick={handlePasswordSubmit}
                    type="button"
                  >
                    {passwordUnlocked ? "TÜNELE GİR" : "ONAYLA"}
                  </button>
                </>
              ) : (
                <div className="passUnlocked">
                  <div className="passUnlockedIcon">🔓</div>
                  <p>Kilit açıldı! Tünele geçiliyor...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
