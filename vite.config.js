import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep the existing game source intact while applying the final gameplay fixes at build/dev time.
// The simulation is fixed at 60 Hz, matching classic Pac-Man timing on every display refresh rate.
const gameTuning = {
  name: 'game-tuning',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/App.jsx')) return null

    const tunedCode = code
      // Classic-style Pac-Man level progression.
      .replace(/speed: 0\.16/g, 'speed: 0.1')
      .replace(
        /setLevel\(lvl\);/g,
        "setLevel(lvl);\n    gameData.current.pacman.speed = lvl <= 1 ? 0.1 : lvl <= 4 ? 0.1125 : lvl <= 20 ? 0.125 : 0.1125;"
      )

      // Power-pellet behavior: Pac-Man speeds up slightly; frightened ghosts slow down.
      .replace(
        /p\.x \+= p\.dx \* p\.speed;/g,
        "const pacmanSpeed = data.frightenedTimer > 0 && level <= 4 ? p.speed * (level === 1 ? 1.125 : 1.0555556) : p.speed;\n      p.x += p.dx * pacmanSpeed;"
      )
      .replace(/p\.y \+= p\.dy \* p\.speed;/g, '      p.y += p.dy * pacmanSpeed;')
      .replace(
        /let activeSpeed = g\.mode === 'frightened' \? 0\.085 : \(g\.mode === 'eaten' \? 0\.22 : 0\.105 \+ \(level \* 0\.006\)\);/,
        "let activeSpeed = g.mode === 'frightened' ? (level <= 1 ? 0.05 : level <= 4 ? 0.055 : 0.06) : (g.mode === 'eaten' ? 0.2 : (level <= 1 ? 0.075 : level <= 4 ? 0.085 : 0.095));"
      )

      // Stop restarting the entire game loop every time score/lives React state changes.
      .replace(
        '  }, [gameState, level, lives, score, initLevel, resetPositions]);',
        '  }, [gameState, level, initLevel, resetPositions]);'
      )

      // Keep current score/lives available to the stable game loop without stale closures.
      .replace(
        "  const [gameState, setGameState] = useState('START'); \n",
        "  const [gameState, setGameState] = useState('START');\n  const scoreRef = useRef(0);\n  const livesRef = useRef(3);\n"
      )
      .replace(
        "  const startGame = () => {",
        "  useEffect(() => {\n    scoreRef.current = score;\n    livesRef.current = lives;\n  }, [score, lives]);\n\n  const startGame = () => {"
      )
      .replace(
        '    setLevel(lvl);\n    setScore(currentScore);\n    setLives(currentLives);',
        '    setLevel(lvl);\n    scoreRef.current = currentScore;\n    livesRef.current = currentLives;\n    setScore(currentScore);\n    setLives(currentLives);'
      )
      .replace(
        '          initLevel(level + 1, score, lives);',
        '          initLevel(level + 1, scoreRef.current, livesRef.current);'
      )

      // One death can no longer queue multiple timers. Lives now decrement reliably: 3 -> 2 -> 1 -> GAME OVER.
      .replace(
        /            setGameState\('DIED'\);\n            setTimeout\(\(\) => \{\n              if \(lives > 1\) \{\n                setLives\(l => l - 1\);\n                resetPositions\(\);\n                setGameState\('PLAYING'\);\n              \} else \{\n                setGameState\('GAMEOVER'\);\n              \}\n            \}, 1000\);/,
        "            if (!gameData.current.deathPending) {\n              gameData.current.deathPending = true;\n              setGameState('DIED');\n              setTimeout(() => {\n                const nextLives = Math.max(0, livesRef.current - 1);\n                livesRef.current = nextLives;\n                gameData.current.deathPending = false;\n                setLives(nextLives);\n                if (nextLives > 0) {\n                  resetPositions();\n                  setGameState('PLAYING');\n                } else {\n                  setGameState('GAMEOVER');\n                }\n              }, 1000);\n            }"
      )
      .replace(
        '    fruitTimer: 0\n  });',
        '    fruitTimer: 0,\n    deathPending: false\n  });'
      )

      // iOS Safari: use native touch events on the canvas, prevent browser gestures early,
      // and buffer the direction directly into the game state for immediate cornering.
      .replace(
        /  \/\/ Mobile\/tablet control:[\s\S]*?  \}, \[gameState, setDirection\]\);/,
        `  // Mobile/tablet control: native touch input directly on the canvas for reliable iOS swipes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'PLAYING') return;

    const SWIPE_THRESHOLD = 8;
    let startX = 0;
    let startY = 0;
    let activeTouch = false;

    const queueDirection = (dx, dy) => {
      const p = gameData.current.pacman;
      p.nextDx = dx;
      p.nextDy = dy;
    };

    const handleTouchStart = (e) => {
      if (!e.touches.length) return;
      e.preventDefault();
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      activeTouch = true;
    };

    const handleTouchMove = (e) => {
      if (!activeTouch || !e.touches.length) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        queueDirection(dx > 0 ? 1 : -1, 0);
      } else {
        queueDirection(0, dy > 0 ? 1 : -1);
      }
      activeTouch = false;
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      activeTouch = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState]);`
      )

      // Pac-Man cornering: accept buffered turns before the exact tile center.
      .replace(
        /      if \(Math\.abs\(p\.x - Math\.round\(p\.x\)\) <= p\.speed\/2 && Math\.abs\(p\.y - Math\.round\(p\.y\)\) <= p\.speed\/2\) \{[\s\S]*?      \}\n\n      const cx = Math\.round\(p\.x\); const cy = Math\.round\(p\.y\);/,
        `      const turnBuffer = 0.32;
      const centerX = Math.round(p.x);
      const centerY = Math.round(p.y);
      const nearVerticalCenter = Math.abs(p.x - centerX) <= turnBuffer;
      const nearHorizontalCenter = Math.abs(p.y - centerY) <= turnBuffer;

      if ((p.nextDx !== 0 || p.nextDy !== 0) &&
          ((p.nextDx !== 0 && nearHorizontalCenter) || (p.nextDy !== 0 && nearVerticalCenter))) {
        const turnX = p.nextDx !== 0 ? centerX : p.x;
        const turnY = p.nextDy !== 0 ? centerY : p.y;
        if (!isWall(turnX + p.nextDx, turnY + p.nextDy)) {
          p.x = p.nextDx !== 0 ? p.x : centerX;
          p.y = p.nextDy !== 0 ? p.y : centerY;
          p.dx = p.nextDx;
          p.dy = p.nextDy;
        }
      }

      if (Math.abs(p.x - Math.round(p.x)) <= p.speed / 2 && Math.abs(p.y - Math.round(p.y)) <= p.speed / 2) {
        p.x = Math.round(p.x);
        p.y = Math.round(p.y);
        if (isWall(p.x + p.dx, p.y + p.dy)) {
          p.dx = 0;
          p.dy = 0;
        }
      }

      const cx = Math.round(p.x); const cy = Math.round(p.y);`
      )

      // Avoid CanvasRenderingContext2D.filter for frightened sprites. It is not a reliable
      // iOS Safari feature and can be an expensive render path. Opacity keeps the effect lightweight.
      .replace(
        /      if \(g\.mode === 'frightened'\) \{[\s\S]*?      \}\n      ctx\.drawImage\(image,/,
        "      if (g.mode === 'frightened') {\n        ctx.globalAlpha = 0.82;\n      }\n      ctx.drawImage(image,"
      )

      // Fixed 60 Hz simulation; rAF only controls rendering cadence.
      .replace(
        /    const loop = \(\) => \{\n      update\(\);\n      draw\(\);\n      data\.animationId = requestAnimationFrame\(loop\);\n    \};/,
        `    const STEP_MS = 1000 / 60;
    let lastTime = performance.now();
    let accumulator = 0;
    const loop = (timestamp) => {
      const elapsed = Math.min(50, timestamp - lastTime);
      lastTime = timestamp;
      accumulator += elapsed;
      while (accumulator >= STEP_MS) {
        update();
        accumulator -= STEP_MS;
      }
      draw();
      data.animationId = requestAnimationFrame(loop);
    };`
      )
      .replace('      loop();', '      loop(performance.now());')

    return {
      code: tunedCode,
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [gameTuning, react()],
})
