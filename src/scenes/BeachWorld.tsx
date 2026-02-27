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
const INTERACT_RADIUS = 22; // Tuned for tighter, less "magnet" interactions
const GATE_INTERACT_RADIUS = 24; // Slightly more forgiving for the tunnel gate
const PLAYER_SPEED = 0.12; // World units per ms
const JOYSTICK_MAX_DISTANCE = 60;
const JOYSTICK_DEADZONE = 8;
const TUNNEL_PASSWORD = "31425";
const CAMERA_LERP = 0.12;
const CAMERA_ANCHOR_X_RATIO = 0.5;
const CAMERA_ANCHOR_Y_RATIO = 0.72;
const CAMERA_DEADZONE_WIDTH = 120;
const CAMERA_DEADZONE_HEIGHT = 80;
const PLAYER_BOB_HEIGHT = 3.2;
const PLAYER_SWAY_DEGREES = 1.3;
const PLAYER_WALK_FREQUENCY = 0.013;
const OBJECT_INTERACT_Y_OFFSET = -6;

// World boundaries
const WORLD_X_MIN = -120; // Left edge of path
const WORLD_X_MAX = 120;  // Right edge of path
const WORLD_Y_MIN = 0;    // Start
const WORLD_Y_MAX = 1400; // Tunnel gate at the end

// Starting position for Tamay
const START_POSITION: Vector2D = { x: 0, y: 0 };

// Tunnel Gate position (at the end of the world - 1400m)
const TUNNEL_GATE: Vector2D = { x: 0, y: WORLD_Y_MAX };

// 5 objects positioned at EXACT 250m intervals along the path
// Hints are now mysterious/implied rather than direct
const INITIAL_OBJECTS: WorldObject[] = [
  {
    id: "lore1",
    type: "lore",
    worldX: 0,
    worldY: 250,
    label: "Sisli Kayalar",
    description: "Denizden sÃ¼zÃ¼len sisle kaplÄ± kayalÄ±klar. Ãœzerinde eski bir denek numarasÄ± gÃ¶rÃ¼nÃ¼yor: B-17",
    icon: "ğŸª¨",
    collected: false,
  },
  {
    id: "hint1",
    type: "hint",
    worldX: -60,
    worldY: 500,
    label: "PaslÄ± KapÄ± Kolu",
    description: "Rust bir kapÄ± kolu. Ãœzerindeki Ã§izikler dikkatini Ã§ekiyor. ÃœÃ§ Ã§izik var... biri derin. AralarÄ±nda kÄ±sa bir boÅŸluk var. Sanki 3-1-4 gibi bir ritim...",
    icon: "ğŸšª",
    collected: false,
  },
  {
    id: "lore2",
    type: "lore",
    worldX: 40,
    worldY: 750,
    label: "KÄ±yÄ± Kemeri",
    description: "Eski bir iskele kalÄ±ntÄ±sÄ±. Kemer Ã¼zerine yazÄ±lmÄ±ÅŸ: 'AÅŸaÄŸÄ± inmek, yukarÄ± Ã§Ä±kmaktan daha hÄ±zlÄ±'",
    icon: "ğŸŒ‰",
    collected: false,
  },
  {
    id: "hint2",
    type: "hint",
    worldX: -30,
    worldY: 1000,
    label: "KÄ±rÄ±k Fener",
    description: "Bozuk bir deniz feneri. CamÄ±n iÃ§ yÃ¼zeyinde iki iz kalmÄ±ÅŸ: 2 ve 5. Ama sÄ±ra ters mi, dÃ¼z mÃ¼... Kimbilir?",
    icon: "ğŸ’¡",
    collected: false,
  },
  {
    id: "lore3",
    type: "lore",
    worldX: 70,
    worldY: 1250,
    label: "Kum Tepesi",
    description: "RÃ¼zgarÄ±n ÅŸekillendirdiÄŸi kum tepeciÄŸi. Ãœzerinde yarÄ± gÃ¶mÃ¼lÃ¼ bir defter sayfasÄ±: 'Zaman geri sayÄ±yor'",
    icon: "ğŸ“–",
    collected: false,
  },
];

// ==================== COMPONENT ====================

type BeachWorldProps = {
  onBack?: () => void;
  onEnterTunnel?: () => void;
  devToolsEnabled?: boolean;
  onSkipToDoorGame?: () => void;
};

export function BeachWorld({ onBack, onEnterTunnel, devToolsEnabled = false, onSkipToDoorGame }: BeachWorldProps) {
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
  const isWorldInputLocked = showPasswordPanel;
  
  // Movement state
  const keysPressedRef = useRef<Set<string>>(new Set());
  const moveDirectionRef = useRef<Vector2D>({ x: 0, y: 0 });
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const walkPhaseRef = useRef<number>(0);
  const walkingRef = useRef(false);
  const facingRef = useRef<1 | -1>(1);
  
  // Camera and viewport state
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 720 });
  const camXRef = useRef<number>(START_POSITION.x);
  const camYRef = useRef<number>(START_POSITION.y);
  const [cameraPos, setCameraPos] = useState<Vector2D>(START_POSITION);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walkPhase, setWalkPhase] = useState(0);
  
  // Joystick state
  const joystickActiveRef = useRef(false);
  const joystickStartRef = useRef<Vector2D>({ x: 0, y: 0 });
  const joystickCurrentRef = useRef<Vector2D>({ x: 0, y: 0 });
  const joystickElementRef = useRef<HTMLDivElement | null>(null);
  
  // INTERACT REF - Ref-based tracking to avoid stale closures
  // This ref is updated on every render to track the nearest interactable target
  const interactRef = useRef<InteractTarget | null>(null);
  
  // Refs to current state values for use in event handlers
  const worldObjectsRef = useRef(worldObjects);
  const playerPosRef = useRef(playerPos);
  
  // Keep refs in sync with state
  useEffect(() => { worldObjectsRef.current = worldObjects; }, [worldObjects]);
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  
  useEffect(() => {
    const updateViewportSize = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      
      setViewportSize((prev) => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };
    
    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    
    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);
  
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
      // Already unlocked, enter tunnel
      if (onEnterTunnel) {
        setShowPasswordPanel(false);
        onEnterTunnel();
      }
      return;
    }
    
    // Check if player has enough items
    if (!canUnlockPanel()) {
      const loreCount = inventory.filter(item => item.type === "lore").length;
      const hintCount = inventory.filter(item => item.type === "hint").length;
      setPasswordFeedback(`Eksik parÃ§alar var. Lore: ${loreCount}/3, Ä°pucu: ${hintCount}/2`);
      return;
    }
    
    if (passwordInput.length !== 5) {
      setPasswordFeedback("5 haneli ÅŸifre gerekli.");
      return;
    }
    
    if (passwordInput !== TUNNEL_PASSWORD) {
      setPasswordFeedback("YanlÄ±ÅŸ ÅŸifre. Sistem seni kaydediyor...");
      setPasswordInput("");
      return;
    }
    
    // Correct password
    setPasswordFeedback("Kilit aÃ§Ä±ldÄ±.");
    setPasswordUnlocked(true);
    
    // Auto-enter tunnel after delay
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
  
  // ==================== UTILITY FUNCTIONS ====================
  
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  
  const getDistance = useCallback((a: Vector2D, b: Vector2D): number => {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }, []);
  
  const getObjectInteractPoint = useCallback((obj: WorldObject): Vector2D => {
    return {
      x: obj.worldX,
      y: obj.worldY + OBJECT_INTERACT_Y_OFFSET,
    };
  }, []);
  
  const xPixelsPerMeter = Math.max(0.0001, (viewportSize.width * 0.2) / 100);
  const yPixelsPerMeter = Math.max(0.0001, (viewportSize.height * 0.08) / 100);
  
  const worldToScreen = useCallback((world: Vector2D, cam: Vector2D) => {
    const anchorX = viewportSize.width * CAMERA_ANCHOR_X_RATIO;
    const anchorY = viewportSize.height * CAMERA_ANCHOR_Y_RATIO;
    
    return {
      x: anchorX + (world.x - cam.x) * xPixelsPerMeter,
      y: anchorY - (world.y - cam.y) * yPixelsPerMeter,
    };
  }, [viewportSize.width, viewportSize.height, xPixelsPerMeter, yPixelsPerMeter]);
  
  const getDeadzoneCameraTarget = useCallback((player: Vector2D): Vector2D => {
    const anchorX = viewportSize.width * CAMERA_ANCHOR_X_RATIO;
    const anchorY = viewportSize.height * CAMERA_ANCHOR_Y_RATIO;
    const halfDeadzoneX = CAMERA_DEADZONE_WIDTH / 2;
    const halfDeadzoneY = CAMERA_DEADZONE_HEIGHT / 2;
    
    const minX = anchorX - halfDeadzoneX;
    const maxX = anchorX + halfDeadzoneX;
    const minY = anchorY - halfDeadzoneY;
    const maxY = anchorY + halfDeadzoneY;
    
    const playerScreenX = anchorX + (player.x - camXRef.current) * xPixelsPerMeter;
    const playerScreenY = anchorY - (player.y - camYRef.current) * yPixelsPerMeter;
    
    let targetCamX = camXRef.current;
    let targetCamY = camYRef.current;
    
    if (playerScreenX < minX) {
      targetCamX = player.x - (minX - anchorX) / xPixelsPerMeter;
    } else if (playerScreenX > maxX) {
      targetCamX = player.x - (maxX - anchorX) / xPixelsPerMeter;
    }
    
    if (playerScreenY < minY) {
      targetCamY = player.y - (anchorY - minY) / yPixelsPerMeter;
    } else if (playerScreenY > maxY) {
      targetCamY = player.y - (anchorY - maxY) / yPixelsPerMeter;
    }
    
    return {
      x: clamp(targetCamX, WORLD_X_MIN, WORLD_X_MAX),
      y: clamp(targetCamY, WORLD_Y_MIN, WORLD_Y_MAX),
    };
  }, [viewportSize.width, viewportSize.height, xPixelsPerMeter, yPixelsPerMeter]);
  
  // ==================== MOVEMENT SYSTEM ====================
  
  const getNextPlayerPosition = useCallback((currentPos: Vector2D, deltaTime: number): Vector2D => {
    const moveDir = moveDirectionRef.current;
    const magnitude = Math.hypot(moveDir.x, moveDir.y);
    
    if (magnitude < 0.01) return currentPos;
    
    const normalizedX = moveDir.x / magnitude;
    const normalizedY = moveDir.y / magnitude;
    
    return {
      x: clamp(currentPos.x + normalizedX * PLAYER_SPEED * deltaTime, WORLD_X_MIN, WORLD_X_MAX),
      y: clamp(currentPos.y + normalizedY * PLAYER_SPEED * deltaTime, WORLD_Y_MIN, WORLD_Y_MAX),
    };
  }, []);
  
  // Game loop
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }
      
      const rawDeltaTime = timestamp - lastFrameTimeRef.current;
      const deltaTime = Math.min(50, rawDeltaTime);
      lastFrameTimeRef.current = timestamp;
      
      const moveDir = moveDirectionRef.current;
      const magnitude = Math.hypot(moveDir.x, moveDir.y);
      const walkingNow = magnitude > 0.01;
      
      if (moveDir.x > 0.01 && facingRef.current !== 1) {
        facingRef.current = 1;
        setFacing(1);
      } else if (moveDir.x < -0.01 && facingRef.current !== -1) {
        facingRef.current = -1;
        setFacing(-1);
      }
      
      if (walkingNow) {
        walkPhaseRef.current += deltaTime * PLAYER_WALK_FREQUENCY;
      } else {
        walkPhaseRef.current *= Math.max(0, 1 - deltaTime * 0.02);
      }
      
      setWalkPhase((prev) => {
        const next = walkPhaseRef.current;
        if (Math.abs(next - prev) < 0.0001) {
          return prev;
        }
        return next;
      });
      
      if (walkingRef.current !== walkingNow) {
        walkingRef.current = walkingNow;
        setWalking(walkingNow);
      }
      
      const currentPlayerPos = playerPosRef.current;
      const nextPlayerPos = getNextPlayerPosition(currentPlayerPos, deltaTime);
      const playerMoved =
        Math.abs(nextPlayerPos.x - currentPlayerPos.x) > 0.0001 ||
        Math.abs(nextPlayerPos.y - currentPlayerPos.y) > 0.0001;
      
      if (playerMoved) {
        playerPosRef.current = nextPlayerPos;
        setPlayerPos(nextPlayerPos);
      }
      
      const targetCam = getDeadzoneCameraTarget(nextPlayerPos);
      const nextCamX = camXRef.current + (targetCam.x - camXRef.current) * CAMERA_LERP;
      const nextCamY = camYRef.current + (targetCam.y - camYRef.current) * CAMERA_LERP;
      const cameraMoved =
        Math.abs(nextCamX - camXRef.current) > 0.0001 ||
        Math.abs(nextCamY - camYRef.current) > 0.0001;
      
      if (cameraMoved) {
        camXRef.current = nextCamX;
        camYRef.current = nextCamY;
        setCameraPos((prev) => {
          if (Math.abs(prev.x - nextCamX) < 0.0001 && Math.abs(prev.y - nextCamY) < 0.0001) {
            return prev;
          }
          return { x: nextCamX, y: nextCamY };
        });
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getDeadzoneCameraTarget, getNextPlayerPosition]);
  
  // Function to open the current interact target (called from E key and mobile button)
  const openInteractTarget = useCallback(() => {
    if (isWorldInputLocked) return;
    
    const target = interactRef.current;
    
    if (!target) return;
    
    if (target.type === "gate") {
      // Open tunnel gate panel
      setShowPasswordPanel(true);
      setPasswordFeedback("");
    } else if (target.type === "obj" && target.id) {
      // Find and open object
      const objects = worldObjectsRef.current;
      const obj = objects.find(o => o.id === target.id);
      if (obj && !obj.collected) {
        setSelectedObject(obj);
        setShowModal(true);
      }
    }
  }, [isWorldInputLocked]);
  
  // ==================== KEYBOARD CONTROLS ====================
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle movement keys if password panel is open
      if (isWorldInputLocked) return;
      
      const key = e.key.toLowerCase();
      keysPressedRef.current.add(key);
      updateMoveDirection();
      
      // E key for interaction - use the interactRef to determine target
      if (e.code === "KeyE") {
        openInteractTarget();
        e.preventDefault(); // Prevent E from being typed into inputs
      }
      
      // Prevent default for game keys
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
      
      // Forward/Backward controls Y movement (up is negative in world)
      if (keys.has("w") || keys.has("arrowup")) y += 1;  // Forward (positive Y in our world)
      if (keys.has("s") || keys.has("arrowdown")) y -= 1; // Backward (negative Y)
      if (keys.has("a") || keys.has("arrowleft")) x -= 1;  // Left (negative X)
      if (keys.has("d") || keys.has("arrowright")) x += 1; // Right (positive X)
      
      moveDirectionRef.current = { x, y };
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isWorldInputLocked, openInteractTarget]);
  
  useEffect(() => {
    if (!isWorldInputLocked) return;
    
    keysPressedRef.current.clear();
    joystickActiveRef.current = false;
    moveDirectionRef.current = { x: 0, y: 0 };
  }, [isWorldInputLocked]);
  
  // ==================== JOYSTICK CONTROLS ====================
  
  const handleJoystickStart = useCallback((clientX: number, clientY: number) => {
    if (isWorldInputLocked) return;
    
    joystickActiveRef.current = true;
    joystickStartRef.current = { x: clientX, y: clientY };
    joystickCurrentRef.current = { x: clientX, y: clientY };
  }, [isWorldInputLocked]);
  
  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
    if (isWorldInputLocked) return;
    if (!joystickActiveRef.current) return;
    
    joystickCurrentRef.current = { x: clientX, y: clientY };
    
    const dx = clientX - joystickStartRef.current.x;
    const dy = clientY - joystickStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > JOYSTICK_DEADZONE) {
      const clampedDistance = Math.min(distance, JOYSTICK_MAX_DISTANCE);
      const normalizedDistance = (clampedDistance - JOYSTICK_DEADZONE) / (JOYSTICK_MAX_DISTANCE - JOYSTICK_DEADZONE);
      
      const angle = Math.atan2(dy, dx);
      // Joystick up (negative dy) should move forward (positive Y)
      // Joystick down (positive dy) should move backward (negative Y)
      moveDirectionRef.current = {
        x: Math.cos(angle) * normalizedDistance,
        y: -Math.sin(angle) * normalizedDistance, // Invert Y for correct forward/backward
      };
    } else {
      moveDirectionRef.current = { x: 0, y: 0 };
    }
  }, [isWorldInputLocked]);
  
  const handleJoystickEnd = useCallback(() => {
    joystickActiveRef.current = false;
    moveDirectionRef.current = { x: 0, y: 0 };
  }, []);
  
  // Touch event handlers for joystick
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
  
  // Pointer event handlers for better cross-platform support
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
  
  // Find nearest object for interaction
  const findNearestObject = useCallback((): { obj: WorldObject; distance: number } | null => {
    let nearest: { obj: WorldObject; distance: number } | null = null;
    let minDist = Infinity;
    
    for (const obj of worldObjects) {
      if (obj.collected) continue;
      const dist = getDistance(playerPos, getObjectInteractPoint(obj));
      if (dist < minDist) {
        minDist = dist;
        nearest = { obj, distance: dist };
      }
    }
    
    return nearest;
  }, [getDistance, getObjectInteractPoint, playerPos, worldObjects]);
  
  const nearestObjectData = findNearestObject();
  const nearestObject = nearestObjectData?.obj ?? null;
  const nearestObjectDistance = nearestObjectData?.distance ?? Infinity;
  const canInteractObject = Boolean(
    !isWorldInputLocked &&
      nearestObject &&
      !nearestObject.collected &&
      nearestObjectDistance <= INTERACT_RADIUS
  );
  
  // Gate interaction
  const gateDistance = getDistance(playerPos, TUNNEL_GATE);
  const canInteractGate = !isWorldInputLocked && gateDistance <= GATE_INTERACT_RADIUS;
  
  // UPDATE INTERACT REF - This runs on every render to keep the ref current
  // Priority: Gate takes precedence if in range, otherwise nearest object
  if (isWorldInputLocked) {
    interactRef.current = null;
  } else if (canInteractGate) {
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
    
    // Mark as collected
    setWorldObjects((prev) =>
      prev.map((obj) => (obj.id === selectedObject.id ? { ...obj, collected: true } : obj))
    );
    
    // Add to inventory
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
  
  // Project world coordinates to screen coordinates (2.5D effect)
  // Camera uses deadzone + smoothing, projection keeps the fake corridor feel.
  const projectToWorld = useCallback((obj: WorldObject) => {
    const distance = getDistance(playerPos, { x: obj.worldX, y: obj.worldY });
    
    const baseScale = 1;
    const depthScale = Math.max(0.2, 1 - distance / WORLD_VIEW_RANGE);
    const relativeY = obj.worldY - playerPos.y;
    const yDepthScale = Math.max(0.3, 1 - Math.abs(relativeY) / 800);
    const scale = baseScale * depthScale * yDepthScale;
    
    const screenPos = worldToScreen({ x: obj.worldX, y: obj.worldY }, cameraPos);
    const opacity = distance > WORLD_VIEW_RANGE ? 0 : Math.max(0.15, 1 - distance / WORLD_VIEW_RANGE);
    const zIndex = Math.floor(obj.worldY);
    
    return {
      screenX: screenPos.x,
      screenY: screenPos.y,
      scale,
      opacity,
      zIndex,
      distance,
    };
  }, [cameraPos, getDistance, playerPos, worldToScreen]);
  
  // Project tunnel gate
  const projectGate = useCallback(() => {
    const distance = getDistance(playerPos, TUNNEL_GATE);
    
    const baseScale = 1;
    const depthScale = Math.max(0.2, 1 - distance / WORLD_VIEW_RANGE);
    const relativeY = TUNNEL_GATE.y - playerPos.y;
    const yDepthScale = Math.max(0.3, 1 - Math.abs(relativeY) / 800);
    const scale = baseScale * depthScale * yDepthScale * 1.8; // Gate is larger
    
    const screenPos = worldToScreen(TUNNEL_GATE, cameraPos);
    const opacity = distance > WORLD_VIEW_RANGE ? 0 : Math.max(0.2, 1 - distance / WORLD_VIEW_RANGE);
    const zIndex = Math.floor(TUNNEL_GATE.y);
    
    return {
      screenX: screenPos.x,
      screenY: screenPos.y,
      scale,
      opacity,
      zIndex,
      distance,
    };
  }, [cameraPos, getDistance, playerPos, worldToScreen]);
  
  // Filter visible objects and sort by zIndex for proper layering
  const visibleObjects = worldObjects
    .filter((obj) => {
      const dist = getDistance(playerPos, { x: obj.worldX, y: obj.worldY });
      return dist < WORLD_VIEW_RANGE;
    })
    .map((obj) => ({ obj, projection: projectToWorld(obj) }))
    .sort((a, b) => a.projection.zIndex - b.projection.zIndex);
  
  // Gate projection
  const gateProjection = projectGate();
  const gateVisible = gateProjection.distance < WORLD_VIEW_RANGE;
  
  // Player projection (same worldToScreen as objects/gate)
  const playerScreenPos = worldToScreen(playerPos, cameraPos);
  const playerBobOffset = walking ? Math.sin(walkPhase * 1.2) * PLAYER_BOB_HEIGHT : 0;
  const playerSwayAngle = walking ? Math.sin(walkPhase * 0.8) * PLAYER_SWAY_DEGREES : 0;
  const walkPulse = Math.abs(Math.sin(walkPhase * 1.2));
  const playerShadowScale = walking ? 1 - walkPulse * 0.25 : 1;
  const playerShadowOpacity = walking ? 0.3 + walkPulse * 0.22 : 0.3;
  
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
          <h1>Sahil DÃ¼nyasÄ±</h1>
          <p>W/â†‘ ileri â€¢ S/â†“ geri â€¢ A/D â†â†’ â€¢ E ile etkileÅŸim</p>
        </div>
        <div className="beachWorldStats">
          <div className="stat">Ä°lerleme: %{progressPercent.toFixed(1)}</div>
          <div className="stat">Kalan: {Math.round(distanceRemaining)}m</div>
          <div className="stat">Envanter: {inventory.length}/5</div>
          <div className={`stat ${progressReady ? "good" : ""}`}>
            L{loreCount}/3 â€¢ Ä°{hintCount}/2
          </div>
        </div>
        {(onBack || (devToolsEnabled && onSkipToDoorGame)) && (
          <div style={{ display: "flex", gap: 8 }}>
            {onBack && (
              <button className="btn ghost" onClick={onBack} type="button">
                Geri
              </button>
            )}
            {devToolsEnabled && onSkipToDoorGame && (
              <button className="btn ghost" onClick={onSkipToDoorGame} type="button">
                Kapilara Atla
              </button>
            )}
          </div>
        )}
      </header>
      
      {/* World View */}
      <main className="beachWorldMain">
        <div
          ref={viewportRef}
          className="beachWorldViewport"
          style={{ pointerEvents: isWorldInputLocked ? "none" : "auto" }}
        >
          {/* Background layers for depth */}
          <div className="beachWorldSky" />
          <div className="beachWorldHorizon" />
          
          {/* Path/Road - creates the corridor effect */}
          <div className="beachWorldPath" />
          
          {/* Ground */}
          <div className="beachWorldGround" />
          
          {/* Player */}
          <div
            className="beachWorldPlayer"
            style={{
              left: `${playerScreenPos.x}px`,
              top: `${playerScreenPos.y}px`,
              transform: `translate(-50%, -50%) translateY(${playerBobOffset}px) rotate(${playerSwayAngle}deg)`,
            }}
          >
            <div className="playerSprite" style={{ transform: `scaleX(${facing})` }}>ğŸš¶</div>
            <div
              className="playerShadow"
              style={{
                transform: `scale(${playerShadowScale})`,
                opacity: playerShadowOpacity,
              }}
            />
          </div>
          
          {/* World Objects - sorted by zIndex for proper 2.5D layering */}
          {visibleObjects.map(({ obj, projection }) => {
            const interactDistance = getDistance(playerPos, getObjectInteractPoint(obj));
            const canInteractThis = !isWorldInputLocked && interactDistance <= INTERACT_RADIUS && !obj.collected;
            
            return (
              <div
                key={obj.id}
                className={`worldObject ${obj.collected ? "collected" : ""} ${canInteractThis ? "interactable" : ""}`}
                style={{
                  left: `${projection.screenX}px`,
                  top: `${projection.screenY}px`,
                  transform: `translate(-50%, -50%) scale(${projection.scale})`,
                  opacity: projection.opacity,
                  zIndex: projection.zIndex,
                }}
              >
                <div className="objectIcon">{obj.collected ? "âœ“" : obj.icon}</div>
                {canInteractThis && (
                  <div className="objectInteractionHint">
                    <span className="interactionKey">E</span>
                    <span className="interactionLabel">Ä°NCELE</span>
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
                left: `${gateProjection.screenX}px`,
                top: `${gateProjection.screenY}px`,
                transform: `translate(-50%, -50%) scale(${gateProjection.scale})`,
                opacity: gateProjection.opacity,
                zIndex: gateProjection.zIndex,
              }}
            >
              <div className="tunnelGateIcon">
                {passwordUnlocked ? "ğŸ”“" : "ğŸšª"}
              </div>
              {canInteractGate && (
                <div className="objectInteractionHint">
                  <span className="interactionKey">E</span>
                  <span className="interactionLabel">
                    {passwordUnlocked ? "TÃœNELE GÄ°R" : "Ä°NCELE"}
                  </span>
                </div>
              )}
              <div className="objectLabel tunnelGateLabel">
                TÃ¼nel KapÄ±sÄ±
              </div>
            </div>
          )}
          
          {/* Direction indicator for nearest object */}
          {nearestObject && !nearestObject.collected && nearestObjectDistance > INTERACT_RADIUS && (
            <div className="directionIndicator">
              <span>â¬†</span>
              <span className="directionLabel">
                {nearestObject.label} ({Math.round(nearestObjectDistance)}m)
              </span>
            </div>
          )}
          
          {/* Gate direction indicator when close */}
          {gateProjection.distance > INTERACT_RADIUS && gateProjection.distance < 150 && (
            <div className="directionIndicator gateDirection">
              <span>â¬†</span>
              <span className="directionLabel">
                TÃ¼nel ({Math.round(gateProjection.distance)}m)
              </span>
            </div>
          )}
          
          {/* Gate interaction hint when very close */}
          {canInteractGate && !showPasswordPanel && (
            <div className="gateInteractionHint">
              TÃ¼nel KapÄ±sÄ± â€¢ E / Ä°NCELE ile Panel
            </div>
          )}
        </div>
      </main>
      
      {/* Mobile Controls */}
      <div className="beachWorldControls" style={{ pointerEvents: isWorldInputLocked ? "none" : "auto" }}>
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
          <span className="interactButtonIcon">ğŸ”</span>
          <span className="interactButtonText">Ä°NCELE</span>
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
              <button className="closeButton" onClick={handleCloseModal} type="button">âœ•</button>
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
              <h2>ğŸšª TÃ¼nel KapÄ±sÄ±</h2>
              <button className="closeButton" onClick={handleClosePasswordPanel} type="button">âœ•</button>
            </div>
            <div className="modalBody">
              {!passwordUnlocked ? (
                <>
                  <p>5 haneli ÅŸifreyi girerek tÃ¼nel kilidini aÃ§.</p>
                  
                  {/* Progress indicator */}
                  <div className="passProgress">
                    <div className={`passProgressItem ${loreCount >= 3 ? "complete" : ""}`}>
                      <span className="passProgressIcon">ğŸ“–</span>
                      <span className="passProgressText">Lore: {loreCount}/3</span>
                    </div>
                    <div className={`passProgressItem ${hintCount >= 2 ? "complete" : ""}`}>
                      <span className="passProgressIcon">ğŸ’¡</span>
                      <span className="passProgressText">Ä°pucu: {hintCount}/2</span>
                    </div>
                  </div>
                  
                  {/* Password display */}
                  <div className="passDisplay">
                    {(passwordInput + "_____").slice(0, 5).split("").map((ch, i) => (
                      <div key={i} className="passCell">
                        {ch === "_" ? "â€¢" : ch}
                      </div>
                    ))}
                  </div>
                  
                  {/* Feedback message */}
                  {passwordFeedback && (
                    <div className={`passMsg ${passwordFeedback.includes("Eksik") ? "error" : passwordFeedback.includes("YanlÄ±ÅŸ") ? "error" : passwordFeedback.includes("aÃ§Ä±ldÄ±") ? "success" : ""}`}>
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
                      âŒ«
                    </button>
                  </div>
                  
                  {/* Submit button */}
                  <button
                    className={`btn danger passSubmit ${passwordUnlocked ? "unlocked" : ""}`}
                    onClick={handlePasswordSubmit}
                    type="button"
                  >
                    {passwordUnlocked ? "TÃœNELE GÄ°R" : "ONAYLA"}
                  </button>
                </>
              ) : (
                <div className="passUnlocked">
                  <div className="passUnlockedIcon">ğŸ”“</div>
                  <p>Kilit aÃ§Ä±ldÄ±! TÃ¼nele geÃ§iliyor...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


