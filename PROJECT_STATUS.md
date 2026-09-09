# Neon Pacman — Project Status

**Status:** Stable / playable baseline restored and iOS gameplay pass completed  
**Last updated:** 2026-09-09  
**Current commit:** `c7ad6328bc50136e92574070914c8fe8872cafdc`

## Executive status

The project is currently considered **feature-complete for the present gameplay scope** and has passed the user's final functional check on both PC and iOS.

The important rule going forward is: **do not patch gameplay through Vite/build transforms or make unnecessary visual changes.** The existing neon visual design is considered approved. Future work should preserve the visual baseline and modify gameplay deliberately and directly in `src/App.jsx`.

## Completed work

### Visual / presentation

- Preserved the neon arcade visual identity.
- Preserved the original maze and gameplay presentation.
- Preserved the landing screen / INSERT COIN experience.
- Preserved the imported Blinky, Pinky, Inky and Clyde artwork.
- Preserved pulsing power pellets, fruit, neon walls and Pac-Man animation.
- Fixed the desktop/mobile layout so the board remains inside the viewport.

### Gameplay engine

- Replaced display-refresh-dependent movement with a fixed 60 Hz simulation.
- `requestAnimationFrame` is now used for rendering rather than determining gameplay speed.
- Introduced explicit Pac-Man level speed progression.
- Introduced separate normal-ghost, frightened-ghost and eaten-ghost speeds.
- Power pellets now affect ghost state/speed without unexpectedly slowing Pac-Man.
- Frightened mode has an explicit timer and returns ghosts to normal when the timer expires.
- Added tile-aware buffered turning so Pac-Man can accept a direction slightly before an intersection.
- Kept tunnel/maze collision handling and ghost targeting behavior intact while stabilizing movement.

### iOS / touch

- Rebuilt mobile input around native touch events.
- `touch-action: none` is applied to the game board to prevent browser gesture interference.
- Touch listeners use `passive: false` and preventDefault where appropriate.
- Reduced swipe threshold for easier directional input.
- Direction is queued immediately into the same input buffer used by keyboard controls.
- Touch movement is re-based after a detected direction so successive small movements can request further turns.
- No on-screen D-pad was introduced; the approved interaction remains swipe-on-board.

### Lives / state management

- Removed the stale React-closure dependency from the death/lives flow.
- Added authoritative refs for score, lives, level and game state.
- Added a `deathPending` guard so one collision cannot schedule multiple life-loss events.
- Death sequence is deterministic: `3 → 2 → 1 → GAME OVER`.
- Respawn resets Pac-Man and ghosts without resetting the player's score or remaining lives.
- Level transitions preserve score and remaining lives.

### Performance / rendering hygiene

- Ghost sprite images are cached instead of creating a new `Image()` object every render frame.
- Removed the previous Vite source-rewriting workaround.
- `vite.config.js` is back to a normal Vite + React configuration.
- Frightened ghosts use direct canvas rendering/alpha treatment rather than relying on the previous CSS/canvas filter workaround that was less reliable on iOS Safari.

## Important historical problems and lessons

### Do not use build-time source transforms for gameplay tuning

An earlier implementation modified `App.jsx` through `vite.config.js` string transforms. This made the source and runtime behavior diverge and contributed to repeated regressions. This approach has been removed.

**Rule:** gameplay constants and logic belong directly in `src/App.jsx` (or a dedicated gameplay module if the project is later refactored).

### Do not use raw requestAnimationFrame frequency as the game clock

The earlier game moved Pac-Man and ghosts once per animation frame. This caused high-refresh devices such as iPhones/iPads to run the game faster than 60 Hz desktop displays.

**Rule:** simulation time must remain fixed/deterministic; rendering may follow the device refresh rate.

### Do not solve iOS controls only by changing swipe thresholds

The previous pointer-up-only swipe implementation could feel unresponsive around corners even when the threshold was reduced.

**Rule:** input should be captured promptly, queued, and consumed by tile-aware steering.

### Avoid React state closures inside the core game loop

The original death handling used `lives` captured by the effect closure and scheduled delayed state changes. Combined with effect dependencies, this could leave lives visually stuck or cause repeated timers.

**Rule:** the real-time simulation should use refs/game state, with React state used for UI presentation.

## Current approved gameplay model

| Area | Current behavior |
|---|---|
| Simulation | Fixed 60 Hz |
| Rendering | `requestAnimationFrame` |
| Pac-Man Level 1 | Slower baseline; no artificial power-pill slowdown |
| Pac-Man progression | Increases through early/mid levels, then stabilizes |
| Ghost normal speed | Separate level-based progression |
| Ghost frightened speed | Slower than normal and level-based |
| Ghost eaten speed | Fast return-to-pen behavior |
| Power pellet | Frightens ghosts; does not make Pac-Man crawl |
| Turning | Buffered / early intersection turn |
| iOS input | Native touch swipe + queued direction |
| Desktop input | Arrow keys + same direction buffer |
| Lives | 3 → 2 → 1 → Game Over |
| Respawn | Preserves score and remaining lives |
| Visual style | Approved neon arcade design |
| Vite config | Standard React/Vite config; no gameplay transforms |

## Files of particular importance

- `src/App.jsx` — authoritative gameplay engine, state management, controls and canvas rendering.
- `src/App.css` — approved responsive neon presentation and viewport sizing.
- `src/assets/blinky.png` — Blinky sprite.
- `src/assets/pinky.png` — Pinky sprite.
- `src/assets/inky.png` — Inky sprite.
- `src/assets/clyde.png` — Clyde sprite.
- `vite.config.js` — standard Vite configuration only.

## Verification status

The user has confirmed that the current game is working correctly on **both PC and iOS** after the final gameplay rebuild.

The final source audit specifically addressed the previously reported:

1. Level-1 movement being too fast.
2. iOS running faster than PC.
3. Power-pellet slowdown / frightened-mode behavior.
4. Difficult iOS swipe response.
5. Poor corner turning.
6. Frame-rate-dependent movement.
7. Pac-Man lives remaining stuck at 2.
8. Repeated regressions caused by patching the same systems in different layers.
9. Vite deployment/build errors caused by the experimental `vite.config.js` transform.

## Future development policy

Before changing gameplay again:

1. Start from the current `main` branch, not an older commit.
2. Preserve the current approved visual design.
3. Make gameplay changes directly in source code.
4. Keep the fixed-step simulation intact.
5. Keep keyboard and touch input feeding the same direction queue.
6. Do not reintroduce frame-based movement.
7. Do not reintroduce Vite source transforms.
8. Keep lives/death transitions guarded and ref-driven.
9. Audit PC and iOS implications before committing.
10. Prefer one coherent change over a chain of emergency patches.

## Baseline / rollback reference

The original known-good gameplay baseline is commit:

`6f20d1a7f88c7a85cf34a595f849ab5b00287858`

It is retained as a historical reference only. The current approved implementation is the later stabilized source at:

`c7ad6328bc50136e92574070914c8fe8872cafdc`

Do not roll back blindly to the original baseline because it predates the sprite, responsive-layout and mobile improvements.

---

**Project conclusion:** The current Neon Pacman implementation is approved as the stable working baseline. Future changes should be incremental, audited, and regression-conscious rather than experimental patches.
