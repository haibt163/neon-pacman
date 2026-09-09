import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import blinkySprite from './assets/blinky.png';
import pinkySprite from './assets/pinky.png';
import inkySprite from './assets/inky.png';
import clydeSprite from './assets/clyde.png';

const LEVEL_1_MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,4,1,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,2,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const TILE_SIZE = 24;
const MAZE_WIDTH = LEVEL_1_MAZE[0].length;
const MAZE_HEIGHT = LEVEL_1_MAZE.length;
const GHOST_PEN = { x: 9, y: 9 };
const GHOST_RENDER_HEIGHT = 38;
const MAZE_COLORS = ['#00ffff', '#00ff00', '#ff00ff', '#ffff00', '#ff0000'];
const FRUITS = ['🍒', '🍓', '🍊', '🍎', '🍈'];
const GHOST_SPRITES = {
  blinky: blinkySprite,
  pinky: pinkySprite,
  inky: inkySprite,
  clyde: clydeSprite,
};

// Pac-Man style speed progression. Values are tiles per fixed 60 Hz simulation step.
// Normal Level 1 is intentionally slower than later levels; a power pellet does not slow Pac-Man.
const PACMAN_SPEED = [0.08, 0.09, 0.09, 0.09, 0.1];
const GHOST_SPEED = [0.075, 0.085, 0.085, 0.085, 0.095];
const FRIGHTENED_GHOST_SPEED = [0.05, 0.055, 0.055, 0.055, 0.06];
const EATEN_GHOST_SPEED = 0.2;

const speedFor = (table, level) => table[Math.min(level - 1, table.length - 1)];
const copyMaze = () => LEVEL_1_MAZE.map(row => [...row]);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const GHOST_IMAGES = Object.fromEntries(
  Object.entries(GHOST_SPRITES).map(([id, src]) => {
    const image = new Image();
    image.src = src;
    return [id, image];
  }),
);

let audioCtx = null;
const ensureAudio = () => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

const playSound = (type) => {
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;

  if (type === 'eat') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'power') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'eat_ghost') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'die') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc.start(now);
    osc.stop(now + 0.8);
  }
};

export default function App() {
  const canvasRef = useRef(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const gameStateRef = useRef('START');
  const deathTimerRef = useRef(null);
  const levelTimerRef = useRef(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('pacman-highscore')) || 0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState('START');

  const gameData = useRef({
    maze: copyMaze(),
    pacman: { x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0, frame: 0 },
    ghosts: [],
    pelletsCount: 0,
    frightenedTimer: 0,
    ghostMultiplier: 200,
    animationId: 0,
    fruitActive: false,
    fruitTimer: 0,
    levelClearing: false,
    deathPending: false,
  });

  const syncRefs = useCallback(() => {
    scoreRef.current = score;
    livesRef.current = lives;
    levelRef.current = level;
    gameStateRef.current = gameState;
  }, [score, lives, level, gameState]);

  useEffect(() => {
    syncRefs();
  }, [syncRefs]);

  const resetPositions = useCallback(() => {
    const data = gameData.current;
    data.pacman = {
      ...data.pacman,
      x: 9,
      y: 15,
      dx: 0,
      dy: 0,
      nextDx: 0,
      nextDy: 0,
      frame: 0,
    };
    data.ghosts = [
      { id: 'blinky', x: 9, y: 7, dx: -1, dy: 0, color: '#ff0000', mode: 'normal' },
      { id: 'pinky', x: 9, y: 9, dx: 0, dy: -1, color: '#ffb8ff', mode: 'normal' },
      { id: 'inky', x: 8, y: 9, dx: 1, dy: 0, color: '#00ffff', mode: 'normal' },
      { id: 'clyde', x: 10, y: 9, dx: -1, dy: 0, color: '#ffb852', mode: 'normal' },
    ];
    data.frightenedTimer = 0;
    data.ghostMultiplier = 200;
    data.deathPending = false;
  }, []);

  const initLevel = useCallback((nextLevel, currentScore = 0, currentLives = 3) => {
    const data = gameData.current;
    data.maze = copyMaze();
    resetPositions();

    let pellets = 0;
    data.maze.forEach(row => row.forEach(cell => {
      if (cell === 2 || cell === 3) pellets += 1;
    }));

    data.pelletsCount = pellets;
    data.fruitActive = false;
    data.fruitTimer = 0;
    data.levelClearing = false;
    data.pacman.nextDx = 0;
    data.pacman.nextDy = 0;
    levelRef.current = nextLevel;
    scoreRef.current = currentScore;
    livesRef.current = currentLives;

    setLevel(nextLevel);
    setScore(currentScore);
    setLives(currentLives);
  }, [resetPositions]);

  const startGame = useCallback(() => {
    if (deathTimerRef.current) {
      clearTimeout(deathTimerRef.current);
      deathTimerRef.current = null;
    }
    if (levelTimerRef.current) {
      clearTimeout(levelTimerRef.current);
      levelTimerRef.current = null;
    }

    ensureAudio();
    initLevel(1, 0, 3);
    gameData.current.deathPending = false;
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
  }, [initLevel]);

  const addScore = useCallback((points) => {
    scoreRef.current += points;
    setScore(scoreRef.current);
  }, []);

  const queueDirection = useCallback((dx, dy) => {
    if (gameStateRef.current !== 'PLAYING') return;
    const p = gameData.current.pacman;
    p.nextDx = dx;
    p.nextDy = dy;
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (gameStateRef.current !== 'PLAYING') startGame();
        return;
      }
      if (gameStateRef.current !== 'PLAYING') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
      }
      if (event.key === 'ArrowUp') queueDirection(0, -1);
      if (event.key === 'ArrowDown') queueDirection(0, 1);
      if (event.key === 'ArrowLeft') queueDirection(-1, 0);
      if (event.key === 'ArrowRight') queueDirection(1, 0);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [queueDirection, startGame]);

  // iOS / mobile input: touch-action is disabled on the canvas and each swipe is
  // converted immediately into the same direction buffer used by keyboard controls.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const SWIPE_THRESHOLD = 6;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const handleTouchStart = (event) => {
      if (gameStateRef.current !== 'PLAYING' || !event.touches.length) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      if (!tracking || gameStateRef.current !== 'PLAYING' || !event.touches.length) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      event.preventDefault();

      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        queueDirection(dx > 0 ? 1 : -1, 0);
      } else {
        queueDirection(0, dy > 0 ? 1 : -1);
      }

      // Re-base the gesture so small follow-up finger movements can request the next turn.
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchEnd = (event) => {
      event.preventDefault();
      tracking = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [queueDirection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = MAZE_WIDTH * TILE_SIZE;
    canvas.height = MAZE_HEIGHT * TILE_SIZE;
    canvas.style.touchAction = 'none';
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('pacman-highscore', String(score));
    }
  }, [score, highScore]);

  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'DIED') return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const data = gameData.current;
    const FIXED_STEP_MS = 1000 / 60;
    const TURN_BUFFER = 0.28;
    let accumulator = 0;
    let previousTime = performance.now();

    const isWall = (x, y, isGhost = false) => {
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (cy === 9 && (cx < 0 || cx >= MAZE_WIDTH)) return false;
      const cell = data.maze[cy]?.[cx];
      if (cell === undefined || cell === 1) return true;
      if (cell === 4 && !isGhost) return true;
      return false;
    };

    const canMove = (x, y, dx, dy, isGhost = false) => !isWall(x + dx, y + dy, isGhost);

    const tryPacmanTurn = () => {
      const p = data.pacman;
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      const horizontal = p.nextDx !== 0;
      const nearHorizontalCenter = Math.abs(p.y - cy) <= TURN_BUFFER;
      const nearVerticalCenter = Math.abs(p.x - cx) <= TURN_BUFFER;

      if (horizontal && nearHorizontalCenter && canMove(p.x, cy, p.nextDx, 0)) {
        p.y = cy;
        p.dx = p.nextDx;
        p.dy = 0;
        return;
      }

      if (!horizontal && p.nextDy !== 0 && nearVerticalCenter && canMove(cx, p.y, 0, p.nextDy)) {
        p.x = cx;
        p.dx = 0;
        p.dy = p.nextDy;
      }
    };

    const chooseGhostDirection = (ghost, targetX, targetY, frightened) => {
      const moves = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ].filter(move => {
        if (move.dx === -ghost.dx && move.dy === -ghost.dy && (ghost.dx !== 0 || ghost.dy !== 0)) return false;
        const nx = Math.round(ghost.x + move.dx);
        const ny = Math.round(ghost.y + move.dy);
        if (ny === 9 && (nx < 0 || nx >= MAZE_WIDTH)) return true;
        const cell = data.maze[ny]?.[nx];
        if (cell === undefined || cell === 1) return false;
        const inPen = nx >= 8 && nx <= 10 && ny >= 8 && ny <= 10;
        if (cell === 4 && ghost.mode !== 'eaten' && !inPen) return false;
        return true;
      });

      if (!moves.length) {
        ghost.dx *= -1;
        ghost.dy *= -1;
        return;
      }

      if (frightened) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        ghost.dx = pick.dx;
        ghost.dy = pick.dy;
        return;
      }

      moves.sort((a, b) => {
        const da = Math.hypot((ghost.x + a.dx) - targetX, (ghost.y + a.dy) - targetY);
        const db = Math.hypot((ghost.x + b.dx) - targetX, (ghost.y + b.dy) - targetY);
        return da - db;
      });

      ghost.dx = moves[0].dx;
      ghost.dy = moves[0].dy;
    };

    const die = () => {
      if (data.deathPending || gameStateRef.current !== 'PLAYING') return;

      data.deathPending = true;
      gameStateRef.current = 'DIED';
      setGameState('DIED');
      playSound('die');

      if (deathTimerRef.current) clearTimeout(deathTimerRef.current);
      deathTimerRef.current = window.setTimeout(() => {
        deathTimerRef.current = null;
        const nextLives = Math.max(0, livesRef.current - 1);
        livesRef.current = nextLives;
        setLives(nextLives);
        data.deathPending = false;

        if (nextLives > 0) {
          resetPositions();
          gameStateRef.current = 'PLAYING';
          setGameState('PLAYING');
        } else {
          gameStateRef.current = 'GAMEOVER';
          setGameState('GAMEOVER');
        }
      }, 900);
    };

    const update = () => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (data.levelClearing) return;

      const p = data.pacman;
      const currentLevel = levelRef.current;
      const pacmanSpeed = speedFor(PACMAN_SPEED, currentLevel);
      const ghostNormalSpeed = speedFor(GHOST_SPEED, currentLevel);
      const frightenedSpeed = speedFor(FRIGHTENED_GHOST_SPEED, currentLevel);

      tryPacmanTurn();

      if (isWall(p.x + p.dx * pacmanSpeed, p.y + p.dy * pacmanSpeed)) {
        p.dx = 0;
        p.dy = 0;
        tryPacmanTurn();
      }

      p.x += p.dx * pacmanSpeed;
      p.y += p.dy * pacmanSpeed;

      if (p.x < -0.5) p.x = MAZE_WIDTH - 0.5;
      if (p.x > MAZE_WIDTH - 0.5) p.x = -0.5;
      p.frame += 0.2;

      if (data.frightenedTimer > 0) {
        data.frightenedTimer -= 1;
        if (data.frightenedTimer === 0) {
          data.ghosts.forEach(ghost => {
            if (ghost.mode === 'frightened') ghost.mode = 'normal';
          });
        }
      }

      if (data.fruitActive) {
        data.fruitTimer -= 1;
        if (distance(p, { x: 9, y: 11 }) < 1.15) {
          addScore(currentLevel * 100);
          data.fruitActive = false;
          playSound('eat');
        } else if (data.fruitTimer <= 0) {
          data.fruitActive = false;
        }
      }

      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      const cell = data.maze[cy]?.[cx];

      if (cell === 2 || cell === 3) {
        data.maze[cy][cx] = 0;
        data.pelletsCount -= 1;

        if (cell === 3) {
          addScore(50);
          // Power pellet changes ghost state only; Pac-Man itself does not suddenly slow down.
          data.frightenedTimer = currentLevel <= 1 ? 360 : currentLevel <= 4 ? 300 : 240;
          data.ghostMultiplier = 200;
          data.ghosts.forEach(ghost => {
            if (ghost.mode === 'normal') {
              ghost.mode = 'frightened';
              ghost.dx *= -1;
              ghost.dy *= -1;
            }
          });
          playSound('power');
        } else {
          addScore(10);
          playSound('eat');
        }

        if (data.pelletsCount === 100 || data.pelletsCount === 40) {
          data.fruitActive = true;
          data.fruitTimer = 500;
        }

        if (data.pelletsCount <= 0 && !data.levelClearing) {
          data.levelClearing = true;
          const nextLevel = currentLevel + 1;
          levelTimerRef.current = window.setTimeout(() => {
            levelTimerRef.current = null;
            initLevel(nextLevel, scoreRef.current, livesRef.current);
            gameStateRef.current = 'PLAYING';
            setGameState('PLAYING');
          }, 350);
          return;
        }
      }

      data.ghosts.forEach(ghost => {
        const activeSpeed = ghost.mode === 'frightened'
          ? frightenedSpeed
          : ghost.mode === 'eaten'
            ? EATEN_GHOST_SPEED
            : ghostNormalSpeed;

        const gx = Math.round(ghost.x);
        const gy = Math.round(ghost.y);

        if (Math.abs(ghost.x - gx) <= activeSpeed / 2 && Math.abs(ghost.y - gy) <= activeSpeed / 2) {
          ghost.x = gx;
          ghost.y = gy;

          if (ghost.mode === 'eaten') {
            chooseGhostDirection(ghost, GHOST_PEN.x, GHOST_PEN.y, false);
            if (ghost.x === GHOST_PEN.x && ghost.y === GHOST_PEN.y) ghost.mode = 'normal';
          } else if (ghost.mode === 'frightened') {
            chooseGhostDirection(ghost, p.x, p.y, true);
          } else {
            let targetX = p.x;
            let targetY = p.y;

            if (ghost.id === 'pinky') {
              targetX = p.x + p.dx * 4;
              targetY = p.y + p.dy * 4;
            } else if (ghost.id === 'inky') {
              const blinky = data.ghosts[0];
              targetX = p.x + (p.x - blinky.x);
              targetY = p.y + (p.y - blinky.y);
            } else if (ghost.id === 'clyde' && distance(ghost, p) <= 8) {
              targetX = 0;
              targetY = MAZE_HEIGHT - 1;
            }

            chooseGhostDirection(ghost, targetX, targetY, false);
          }
        }

        if (isWall(ghost.x + ghost.dx * activeSpeed, ghost.y + ghost.dy * activeSpeed, true)) {
          ghost.dx = 0;
          ghost.dy = 0;
        } else {
          ghost.x += ghost.dx * activeSpeed;
          ghost.y += ghost.dy * activeSpeed;
        }

        if (ghost.x < -0.5) ghost.x = MAZE_WIDTH - 0.5;
        if (ghost.x > MAZE_WIDTH - 0.5) ghost.x = -0.5;

        if (distance(ghost, p) < 0.65) {
          if (ghost.mode === 'frightened') {
            ghost.mode = 'eaten';
            addScore(data.ghostMultiplier);
            data.ghostMultiplier *= 2;
            playSound('eat_ghost');
          } else if (ghost.mode === 'normal') {
            die();
          }
        }
      });
    };

    const drawGhost = (ghost) => {
      const image = GHOST_IMAGES[ghost.id];
      const gx = ghost.x * TILE_SIZE + TILE_SIZE / 2;
      const gy = ghost.y * TILE_SIZE + TILE_SIZE / 2;

      if (ghost.mode === 'eaten') {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(gx - 3, gy, 3, 0, Math.PI * 2);
        ctx.arc(gx + 3, gy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return;
      }

      const scale = image?.naturalHeight ? GHOST_RENDER_HEIGHT / image.naturalHeight : 1;
      const width = image?.naturalWidth ? image.naturalWidth * scale : 24;
      const height = image?.naturalHeight ? GHOST_RENDER_HEIGHT : 28;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      if (ghost.mode === 'frightened') {
        const flashing = data.frightenedTimer < 150 && Math.floor(data.frightenedTimer / 15) % 2 === 0;
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = flashing ? '#ffffff' : '#174dff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = flashing ? '#ffffff' : '#174dff';
        ctx.beginPath();
        ctx.arc(gx, gy + 2, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = ghost.color;
        ctx.shadowBlur = 14;
      }

      if (image?.complete && image.naturalWidth) {
        ctx.drawImage(image, gx - width / 2, gy - height / 2, width, height);
      } else {
        ctx.fillStyle = ghost.mode === 'frightened' ? '#174dff' : ghost.color;
        ctx.beginPath();
        ctx.arc(gx, gy, TILE_SIZE / 2.2, Math.PI, 0);
        ctx.lineTo(gx + TILE_SIZE / 2.2, gy + TILE_SIZE / 2.2);
        ctx.lineTo(gx, gy + TILE_SIZE / 2);
        ctx.lineTo(gx - TILE_SIZE / 2.2, gy + TILE_SIZE / 2.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const wallColor = MAZE_COLORS[(levelRef.current - 1) % MAZE_COLORS.length];

      data.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          if (cell === 1) {
            ctx.strokeStyle = wallColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = wallColor;
            ctx.shadowBlur = 8;
            ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.shadowBlur = 0;
          } else if (cell === 2) {
            ctx.fillStyle = '#ffcc99';
            ctx.shadowColor = '#ffcc99';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (cell === 3) {
            const pulse = 6 + Math.sin(Date.now() / 150) * 2;
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (cell === 4) {
            ctx.fillStyle = '#ffb8ff';
            ctx.shadowColor = '#ffb8ff';
            ctx.shadowBlur = 8;
            ctx.fillRect(px, py + 10, TILE_SIZE, 4);
            ctx.shadowBlur = 0;
          }
        });
      });

      if (data.fruitActive && levelRef.current < 20) {
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.fillText(FRUITS[Math.min(levelRef.current - 1, FRUITS.length - 1)], 9 * TILE_SIZE + 2, 11 * TILE_SIZE + 18);
        ctx.shadowBlur = 0;
      }

      data.ghosts.forEach(drawGhost);

      const p = data.pacman;
      const pacmanX = p.x * TILE_SIZE + TILE_SIZE / 2;
      const pacmanY = p.y * TILE_SIZE + TILE_SIZE / 2;
      const angle = p.dx === 1 ? 0 : p.dx === -1 ? Math.PI : p.dy === 1 ? Math.PI / 2 : p.dy === -1 ? -Math.PI / 2 : 0;
      const mouthOpen = gameStateRef.current === 'DIED' ? Math.PI / 1.2 : Math.abs(Math.sin(p.frame)) * 0.5;

      if (gameStateRef.current !== 'DIED' || Math.floor(Date.now() / 200) % 2 === 0) {
        ctx.save();
        ctx.translate(pacmanX, pacmanY);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, TILE_SIZE / 2.2, mouthOpen, Math.PI * 2 - mouthOpen);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
      }
    };

    const loop = (timestamp) => {
      const elapsed = Math.min(100, Math.max(0, timestamp - previousTime));
      previousTime = timestamp;
      accumulator += elapsed;

      while (accumulator >= FIXED_STEP_MS) {
        update();
        accumulator -= FIXED_STEP_MS;
      }

      draw();
      data.animationId = requestAnimationFrame(loop);
    };

    if (gameState === 'PLAYING' && !data.maze.length) {
      initLevel(levelRef.current, scoreRef.current, livesRef.current);
    }

    data.animationId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(data.animationId);
  }, [gameState, initLevel, resetPositions, addScore]);

  useEffect(() => () => {
    if (deathTimerRef.current) clearTimeout(deathTimerRef.current);
    if (levelTimerRef.current) clearTimeout(levelTimerRef.current);
    if (gameData.current.animationId) cancelAnimationFrame(gameData.current.animationId);
  }, []);

  return (
    <div className="app-container">
      <div className="game-header">
        <div className="stat-box"><span>SCORE</span><span className="stat-value">{score}</span></div>
        <div className="stat-box"><span>LEVEL</span><span className="stat-value">{level}</span></div>
        <div className="stat-box"><span>LIVES</span><span className="stat-value">{lives}</span></div>
        <div className="stat-box"><span>HIGH SCORE</span><span className="stat-value">{highScore}</span></div>
      </div>

      <div className="game-wrapper">
        <canvas ref={canvasRef} className="game-canvas" aria-label="Neon Pacman game" />

        {gameState === 'START' && (
          <div className="overlay">
            <div className="landing-art">
              <div className="css-pacman"></div>
              <div className="css-ghost blinky"></div>
              <div className="css-ghost pinky"></div>
              <div className="css-ghost inky"></div>
              <div className="css-ghost clyde"></div>
            </div>
            <h1>NEON PACMAN</h1>
            <button onClick={startGame}>INSERT COIN</button>
          </div>
        )}

        {gameState === 'DIED' && (
          <div className="overlay"><h1>READY!</h1></div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="overlay"><h1>GAME OVER</h1><button onClick={startGame}>PLAY AGAIN</button></div>
        )}
      </div>
    </div>
  );
}
