import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep movement consistent across 60 Hz desktop screens and 120 Hz iPhone/iPad screens.
// The game logic is frame-based, so normalize each frame to a 60 FPS time step.
// Also keep the classic level progression and make frightened mode only slightly slower.
const gameTuning = {
  name: 'game-tuning',
  transform(code, id) {
    if (!id.endsWith('/src/App.jsx')) return null

    const tunedCode = code
      // Level progression: deliberately slower level 1, then gradually faster.
      .replace(/speed: 0\.16/g, 'speed: 0.1')
      .replace(
        /setLevel\(lvl\);/g,
        "setLevel(lvl);\n    gameData.current.pacman.speed = lvl <= 1 ? 0.1 : lvl <= 4 ? 0.1125 : lvl <= 20 ? 0.125 : 0.1125;"
      )
      // Frightened Pac-Man gameplay should not suddenly crawl after a power pill.
      .replace(
        /let activeSpeed = g\.mode === 'frightened' \? 0\.085 : \(g\.mode === 'eaten' \? 0\.22 : 0\.105 \+ \(level \* 0\.006\)\);/,
        "let activeSpeed = g.mode === 'frightened' ? (level <= 1 ? 0.075 : level <= 4 ? 0.08 : 0.085) : (g.mode === 'eaten' ? 0.2 : (level <= 1 ? 0.075 : level <= 4 ? 0.085 : 0.095));"
      )
      // Normalize movement to elapsed frame time so 120 Hz iOS does not run twice as fast as 60 Hz PC.
      .replace('const update = () => {', 'const update = (frameScale = 1) => {')
      .replace(/p\.x \+= p\.dx \* p\.speed;/g, 'p.x += p.dx * p.speed * frameScale;')
      .replace(/p\.y \+= p\.dy \* p\.speed;/g, 'p.y += p.dy * p.speed * frameScale;')
      .replace(/g\.x \+= g\.dx \* activeSpeed;/g, 'g.x += g.dx * activeSpeed * frameScale;')
      .replace(/g\.y \+= g\.dy \* activeSpeed;/g, 'g.y += g.dy * activeSpeed * frameScale;')
      // Recognize swipes earlier for a more responsive iOS control feel.
      .replace('const SWIPE_THRESHOLD = 10;', 'const SWIPE_THRESHOLD = 8;')
      .replace(
        '    const loop = () => {\n      update();\n      draw();\n      data.animationId = requestAnimationFrame(loop);\n    };',
        "    let lastFrameTime = performance.now();\n    const loop = (timestamp) => {\n      const elapsed = Math.min(32, Math.max(8, timestamp - lastFrameTime));\n      lastFrameTime = timestamp;\n      const frameScale = elapsed / 16.6667;\n      update(frameScale);\n      draw();\n      data.animationId = requestAnimationFrame(loop);\n    };"
      )
      .replace('      loop();', '      loop(performance.now());')

    return {
      code: tunedCode,
      map: null,
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [gameTuning, react()],
})
