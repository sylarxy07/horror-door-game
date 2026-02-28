# Walking Tamay Component

A walking character component for the horror door game beach scene, using the Tamay sprite set.

## Features

- **Smooth Walking Animation**: Bobbing motion, leg swing, and arm swing
- **Directional Movement**: Face left or right
- **Dynamic Scaling**: Scale based on depth/position
- **Dust Particles**: Subtle dust effect when walking
- **Breathing Animation**: Idle breathing motion
- **Shadow Effect**: Dynamic shadow that responds to movement
- **Interactive Mode**: Click-to-interact with visual feedback

## Asset Location

```
/public/assets/img/characters/tamay/
```

## Components

### WalkingTamay

Basic walking character component with full control.

```tsx
import { WalkingTamay } from './components/WalkingTamay';

<WalkingTamay
  worldX={0}           // X position in pixels
  worldY={0}           // Y position from bottom
  scale={1}            // Character scale (0.5-2.0)
  isWalking={false}    // Walking state
  facing={1}           // 1 = right, -1 = left
  walkSpeed={1}        // Animation speed
  className=""         // Custom CSS class
  onClick={() => {}}   // Click handler
  interactive={false}  // Enable interaction
/>
```

### BeachWalkingTamay

Optimized for the beach scene, integrates with existing animation system.

```tsx
import { BeachWalkingTamay } from './components/WalkingTamay';

<BeachWalkingTamay
  x={0}              // X position on beach (-100 to 100)
  depth={0}          // Depth position (0 to 100)
  isWalking={false}  // Walking state
  moveDir={0}        // -1, 0, or 1 for movement direction
  facing={1}         // 1 = right, -1 = left
  stride={0}         // Walk cycle phase from parent
  bob={0}            // Bob offset for idle
  lift={0}           // Vertical lift offset
  scale={1}          // Character scale
  onInteract={() => {}} // Click handler
/>
```

### BeachSceneWithTamay

Direct integration for BeachScene component.

```tsx
import { BeachSceneWithTamay } from './components/WalkingTamay';

<BeachSceneWithTamay
  tamayX={tamayX}
  tamayLift={tamayLift}
  bob={bob}
  tamayScale={tamayScale}
  stride={stride}
  moveDir={moveDir}
/>
```

## Integration with BeachScene

Replace the existing `tamayRig` div in `BeachScene.tsx`:

```tsx
// Old code (lines 501-523 in BeachScene.tsx):
<div
  className={`tamayRig ${moveDir !== 0 && !selectedClue ? "walking" : ""}`}
  style={{
    transform: `translate(calc(-50% + ${(tamayX + tamayWorldX * BEACH_TAMAY_WORLD_TO_SCREEN_X).toFixed(2)}px), calc(${tamayLift + bob}px)) scale(${tamayScale})`,
  }}
>
  {/* CSS-based character parts */}
</div>

// New replacement:
<BeachSceneWithTamay
  tamayX={tamayX + tamayWorldX * BEACH_TAMAY_WORLD_TO_SCREEN_X}
  tamayLift={tamayLift}
  bob={bob}
  tamayScale={tamayScale}
  stride={stride}
  moveDir={xMoveDir}
/>
```

## CSS Animations

The component uses these CSS animations (defined in `game.css`):

- `dustPulse` - Dust particle pulsing effect
- `dustRise` - Dust particle rising animation
- `hintPulse` - Interaction hint pulsing
- `fogMove` - Background fog movement (inherited)

## Controls (Demo Component)

| Key/Button | Action |
|------------|--------|
| A / ← | Walk left |
| D / → | Walk right |
| Space | Toggle walking |
| +/- | Adjust scale |

## Animation System

The walking animation uses a phase-based system:

```
walkPhase: 0 → 2π (complete cycle)

- sin(walkPhase)     - Body sway
- sin(walkPhase * 2) - Leg/arm swing, body bob
- sin(walkPhase * 4) - Subtle details
```

## Customization

### Adjust Walking Speed

```tsx
// In WalkingTamay component
walkSpeed={1.5}  // Faster
walkSpeed={0.5}  // Slower
```

### Adjust Scale Based on Depth

```tsx
// Automatic scale calculation
const playerNearFactor = 1 - playerPos.y / WORLD_Y_MAX;
const playerScale = PLAYER_MIN_SCALE + (PLAYER_MAX_SCALE - PLAYER_MIN_SCALE) * playerNearFactor;
```

### Custom Dust Effect

Modify the dust particles in the component:

```tsx
<div
  className="tamay-dust-particle"
  style={{
    background: "rgba(200, 180, 140, 0.5)",  // Color
    width: "16px",                           // Size
    animation: "dustRise 0.8s ease-out",     // Speed
  }}
/>
```

## Performance Notes

- Uses `requestAnimationFrame` for smooth 60fps animation
- `will-change` CSS property for GPU acceleration
- Conditional rendering (dust only when walking)
- Transform-based animations (better than position)

## Browser Compatibility

- Modern browsers with ES6 support
- CSS Grid and Flexbox
- CSS Custom Properties
- `requestAnimationFrame`
