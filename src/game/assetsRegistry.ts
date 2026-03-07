/**
 * Asset Registry - Centralized asset path management
 *
 * All paths use the CANONICAL /assets/ prefix
 */

export const assetRegistry = {
  beachBg: {
    webp: "/assets/img/beach/bg.webp",
    svg: "/assets/img/beach/bg.svg",
  },
  tunnelBg: {
    webp: "/assets/img/tunnel/bg.webp",
    svg: "/assets/img/tunnel/bg.svg",
  },
  roomBg: {
    webp: "/assets/img/rooms/bg.webp",
    svg: "/assets/img/rooms/bg.svg",
  },
  elevatorBg: {
    webp: "/assets/img/elevator/bg.webp",
    svg: "/assets/img/elevator/bg.svg",
  },
  girlOverlay: {
    webp: "/assets/img/elevator/girl_overlay.webp",
    svg: "/assets/img/elevator/girl_overlay.svg",
  },
} as const;

/**
 * Tamay Character Sprites - CANONICAL paths
 * 
 * All Tamay sprites are located at: /assets/img/characters/tamay/
 * 
 * Usage:
 * - idle.png: Character standing still
 * - inspect.png: Character examining something
 * - walk_01.png through walk_04.png: Walking animation frames
 * - tamay_cutout2.png: Fallback/cutout sprite
 */
const TAMAY_CUTOUT = "/assets/img/characters/tamay/tamay_cutout2.png";

export const TAMAY_SPRITES = {
  // Beach ve demo tarafında tek gerçekçi karakter görselini zorunlu kullan.
  idle: TAMAY_CUTOUT,
  inspect: TAMAY_CUTOUT,
  walk: [TAMAY_CUTOUT, TAMAY_CUTOUT, TAMAY_CUTOUT, TAMAY_CUTOUT] as const,
  fallback: TAMAY_CUTOUT,
} as const;

export const TAMAY_BACK_WALK_SPRITES = {
  idle: "/assets/img/characters/tamay_back_walk/tamay_back_walk_01.png",
  walk: [
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_01.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_02.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_03.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_04.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_05.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_06.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_07.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_08.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_09.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_10.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_11.png",
    "/assets/img/characters/tamay_back_walk/tamay_back_walk_12.png",
  ] as const,
  fallback: TAMAY_CUTOUT,
} as const;

/**
 * Required Tamay sprite files for validation
 * Used to check if all required assets exist during development
 */
const TAMAY_REQUIRED_FILES: readonly (keyof typeof TAMAY_SPRITES | "walk")[] = [
  "idle",
  "inspect",
  "walk",
  "fallback",
] as const;

// Export for use in validation
export { TAMAY_REQUIRED_FILES };

/**
 * Validates Tamay sprite availability and logs warnings for missing files
 * Only runs during development (import.meta.env.DEV)
 *
 * @returns true if all sprites are accessible, false otherwise
 */
export function validateTamaySprites(): boolean {
  if (import.meta.env.PROD) return true;

  const missing: string[] = [];

  // Check each required sprite
  const checkSprite = async (path: string, name: string): Promise<void> => {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      if (!response.ok) {
        missing.push(`${name} (${path})`);
      }
    } catch {
      missing.push(`${name} (${path})`);
    }
  };

  // Validate in browser environment only
  if (typeof window !== 'undefined') {
    (async () => {
      await checkSprite(TAMAY_SPRITES.idle, "idle.png");
      await checkSprite(TAMAY_SPRITES.inspect, "inspect.png");
      await checkSprite(TAMAY_SPRITES.fallback, "tamay_cutout2.png");
      
      for (let i = 0; i < TAMAY_SPRITES.walk.length; i++) {
        await checkSprite(TAMAY_SPRITES.walk[i], `walk_0${i + 1}.png`);
      }

      if (missing.length > 0) {
        console.warn(
          `[Asset Registry] Missing Tamay sprite files:\n  - ${missing.join('\n  - ')}\n` +
          `Expected location: /public/assets/img/characters/tamay/\n` +
          `Required files: idle.png, inspect.png, walk_01..walk_04.png, tamay_cutout2.png`
        );
      } else {
        console.info('[Asset Registry] All Tamay sprites loaded successfully ✓');
      }
    })();
  }

  return missing.length === 0;
}

// Auto-validate on module load during development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  validateTamaySprites();
}
