/**
 * Walking Tamay Component Library
 *
 * Animated character components for the horror door game beach scene.
 *
 * All Tamay sprites use the CANONICAL path: /assets/img/characters/tamay/
 * - idle.png: Character standing still
 * - inspect.png: Character examining something
 * - walk_01.png through walk_04.png: Walking animation frames
 * - tamay_cutout2.png: Fallback/cutout sprite
 *
 * Sprites are imported from src/game/assetsRegistry.ts (TAMAY_SPRITES)
 *
 * @example
 * ```tsx
 * import { WalkingTamay, BeachWalkingTamay } from './components/WalkingTamay';
 *
 * // Basic usage
 * <WalkingTamay isWalking facing={1} scale={1} />
 *
 * // Beach scene integration
 * <BeachWalkingTamay
 *   x={0}
 *   isWalking={true}
 *   moveDir={1}
 *   facing={1}
 *   stride={stride}
 *   bob={bob}
 *   lift={lift}
 *   scale={scale}
 * />
 * ```
 */

export { WalkingTamay, BeachWalkingTamay } from '../WalkingTamay';
export { WalkingTamayDemo, BeachSceneWithTamay } from '../WalkingTamayDemo';
