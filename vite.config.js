import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep movement close to classic Pac-Man pacing: level 1 starts deliberately slower,
// levels 2-4 step up, and level 5+ reaches the top normal speed.
// The source file is transformed so the tuning applies consistently in dev and production.
const gameTuning = {
  name: 'game-tuning',
  transform(code, id) {
    if (!id.endsWith('/src/App.jsx')) return null

    const tunedCode = code
      // Level 1 starts at 80% speed; initLevel below updates Pac-Man as levels advance.
      .replace(/speed: 0\.16/g, 'speed: 0.1')
      .replace(
        /setLevel\(lvl\);/g,
        "setLevel(lvl);\n    gameData.current.pacman.speed = lvl <= 1 ? 0.1 : lvl <= 4 ? 0.1125 : lvl <= 20 ? 0.125 : 0.1125;"
      )
      // Ghosts stay slightly behind Pac-Man, with the classic level-based increases.
      .replace(
        /let activeSpeed = g\.mode === 'frightened' \? 0\.085 : \(g\.mode === 'eaten' \? 0\.22 : 0\.105 \+ \(level \* 0\.006\)\);/,
        "let activeSpeed = g.mode === 'frightened' ? (level <= 1 ? 0.05 : level <= 4 ? 0.055 : 0.06) : (g.mode === 'eaten' ? 0.2 : (level <= 1 ? 0.075 : level <= 4 ? 0.085 : 0.095));"
      )
      // Recognize the swipe as soon as it crosses a small threshold instead of waiting
      // for pointerup. This makes direction changes feel much more immediate on iOS.
      .replace('const SWIPE_THRESHOLD = 18;', 'const SWIPE_THRESHOLD = 10;')
      .replace(
        "    const handlePointerCancel = () => {\n      touchStartRef.current = null;\n    };",
        "    const handlePointerMove = (e) => {\n      const start = touchStartRef.current;\n      if (!start || e.pointerType === 'mouse') return;\n\n      const dx = e.clientX - start.x;\n      const dy = e.clientY - start.y;\n      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;\n\n      if (Math.abs(dx) > Math.abs(dy)) {\n        setDirection(dx > 0 ? 1 : -1, 0);\n      } else {\n        setDirection(0, dy > 0 ? 1 : -1);\n      }\n      touchStartRef.current = null;\n    };\n\n    const handlePointerCancel = () => {\n      touchStartRef.current = null;\n    };"
      )
      .replace(
        "    canvas.addEventListener('pointerup', handlePointerUp, { passive: true });",
        "    canvas.addEventListener('pointermove', handlePointerMove, { passive: true });\n    canvas.addEventListener('pointerup', handlePointerUp, { passive: true });"
      )
      .replace(
        "      canvas.removeEventListener('pointerup', handlePointerUp);",
        "      canvas.removeEventListener('pointermove', handlePointerMove);\n      canvas.removeEventListener('pointerup', handlePointerUp);"
      )

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
