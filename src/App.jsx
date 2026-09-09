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
const GHOST_RENDER_HEIGHT = 38;
const GHOST_PEN = { x: 9, y: 9 };
const FRUITS = ['🍒', '🍓', '🍊', '🍎', '🍈'];
const GHOST_SPRITES = { blinky: blinkySprite, pinky: pinkySprite, inky: inkySprite, clyde: clydeSprite };

const SPEED = {
  pacman: [0.8, 0.9, 0.9, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9],
  ghost: [0.75, 0.85, 0.85, 0.85, 0.95],
  frightenedGhost: [0.5, 0.55, 0.55, 0.55, 0.6],
  frightenedPacman: [0.9, 0.95, 0.95, 0.95, 1.0],
};

const copyMaze = () => LEVEL_1_MAZE.map(row => [...row]);
const levelSpeed = (level) => SPEED.pacman[Math.min(level - 1, 20)] ?? 0.9;
const ghostSpeed = (level) => SPEED.ghost[Math.min(level - 1, 4)] ?? 0.95;
const frightenedGhostSpeed = (level) => SPEED.frightenedGhost[Math.min(level - 1, 4)] ?? 0.6;
const frightenedPacmanSpeed = (level) => SPEED.frightenedPacman[Math.min(level - 1, 4)] ?? 1;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (type === 'eat') {
    osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain.gain.setValueAtTime(0.02, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); osc.start(now); osc.stop(now + 0.05);
  } else if (type === 'power') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.25);
    gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.25); osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'eat_ghost') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    gain.gain.setValueAtTime(0.08, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'die') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.65);
    gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65); osc.start(now); osc.stop(now + 0.65);
  }
};

export default function App() {
  const canvasRef = useRef(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const gameStateRef = useRef('START');
  const touchRef = useRef(null);
  const deathTimerRef = useRef(null);

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

  const syncStateRefs = useCallback(() => {
    scoreRef.current = score;
    livesRef.current = lives;
    levelRef.current = level;
    gameStateRef.current = gameState;
  }, [score, lives, level, gameState]);

  useEffect(() => { syncStateRefs(); }, [syncStateRefs]);

  const resetPositions = useCallback(() => {
    const data = gameData.current;
    data.pacman = { ...data.pacman, x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0, frame: 0 };
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

  const initLevel = useCallback((lvl, currentScore = 0, currentLives = 3) => {
    const data = gameData.current;
    data.maze = copyMaze();
    resetPositions();
    let pellets = 0;
    data.maze.forEach(row => row.forEach(cell => { if (cell === 2 || cell === 3) pellets += 1; }));
    data.pelletsCount = pellets;
    data.fruitActive = false;
    data.fruitTimer = 0;
    data.levelClearing = false;
    data.pacman.nextDx = 0;
    data.pacman.nextDy = 0;
    levelRef.current = lvl;
    scoreRef.current = currentScore;
    livesRef.current = currentLives;
    setLevel(lvl);
    setScore(currentScore);
    setLives(currentLives);
  }, [resetPositions]);

  const startGame = useCallback(() => {
    ensureAudio();
    initLevel(1, 0, 3);
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
  }, [initLevel]);

  const setDirection = useCallback((dx, dy) => {
    if (gameStateRef.current !== 'PLAYING') return;
    const p = gameData.current.pacman;
    p.nextDx = dx;
    p.nextDy = dy;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
      if (e.key === 'ArrowUp') setDirection(0, -1);
      if (e.key === 'ArrowDown') setDirection(0, 1);
      if (e.key === 'ArrowLeft') setDirection(-1, 0);
      if (e.key === 'ArrowRight') setDirection(1, 0);
      if (e.code === 'Space') startGame();
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [setDirection, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const threshold = 7;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const start = (e) => {
      if (gameStateRef.current !== 'PLAYING' || !e.touches?.length) return;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; tracking = true;
      e.preventDefault();
    };
    const move = (e) => {
      if (!tracking || !e.touches?.length) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      e.preventDefault();
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
      else setDirection(0, dy > 0 ? 1 : -1);
      tracking = false;
    };
    const end = (e) => { e.preventDefault(); tracking = false; };

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    };
  }, [setDirection]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('pacman-highscore', String(score));
    }
  }, [score, highScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = MAZE_WIDTH * TILE_SIZE;
    canvas.height = MAZE_HEIGHT * TILE_SIZE;
    canvas.style.touchAction = 'none';
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'DIED') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const data = gameData.current;
    const FIXED_STEP = 1000 / 60;
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

    const tryPacmanTurn = (p) => {
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      const onHorizontal = Math.abs(p.y - cy) <= 0.34;
      const onVertical = Math.abs(p.x - cx) <= 0.34;
      const wantsHorizontal = p.nextDx !== 0;
      const canTry = (wantsHorizontal && onHorizontal) || (!wantsHorizontal && p.nextDy !== 0 && onVertical);
      if (!canTry) return;
      const targetX = wantsHorizontal ? p.x : cx;
      const targetY = wantsHorizontal ? cy : p.y;
      if (!isWall(targetX + p.nextDx, targetY + p.nextDy)) {
        if (!wantsHorizontal) p.y = cy;
        if (wantsHorizontal) p.x = p.x;
        p.dx = p.nextDx;
        p.dy = p.nextDy;
        return;
      }
      if (isWall(cx + p.dx, cy + p.dy)) {
        p.dx = 0; p.dy = 0;
      }
    };

    const chooseGhostDirection = (g, targetX, targetY, frightened) => {
      const moves = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      ].filter(m => {
        if (m.dx === -g.dx && m.dy === -g.dy && (g.dx !== 0 || g.dy !== 0)) return false;
        const nx = Math.round(g.x + m.dx);
        const ny = Math.round(g.y + m.dy);
        if (ny === 9 && (nx < 0 || nx >= MAZE_WIDTH)) return true;
        const cell = data.maze[ny]?.[nx];
        if (cell === undefined || cell === 1) return false;
        const inPen = nx >= 8 && nx <= 10 && ny >= 8 && ny <= 10;
        if (cell === 4 && g.mode !== 'eaten' && !inPen) return false;
        return true;
      });
      if (!moves.length) { g.dx *= -1; g.dy *= -1; return; }
      if (frightened) {
        const pick = moves[Math.floor(Math.random() * moves.length)];
        g.dx = pick.dx; g.dy = pick.dy;
        return;
      }
      moves.sort((a, b) => {
        const da = Math.hypot((g.x + a.dx) - targetX, (g.y + a.dy) - targetY);
        const db = Math.hypot((g.x + b.dx) - targetX, (g.y + b.dy) - targetY);
        return da - db;
      });
      g.dx = moves[0].dx; g.dy = moves[0].dy;
    };

    const die = () => {
      if (data.deathPending || gameStateRef.current !== 'PLAYING') return;
      data.deathPending = true;
      playSound('die');
      gameStateRef.current = 'DIED';
      setGameState('DIED');
      deathTimerRef.current = window.setTimeout(() => {
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
      const p = data.pacman;
      const currentLevel = levelRef.current;
      const pacSpeed = 0.042088 * levelSpeed(currentLevel) * (data.frightenedTimer > 0 ? frightenedPacmanSpeed(currentLevel) : 1);

      tryPacmanTurn(p);
      if (isWall(p.x + p.dx * pacSpeed, p.y + p.dy * pacSpeed)) {
        p.dx = 0; p.dy = 0;
        tryPacmanTurn(p);
      }
      p.x += p.dx * pacSpeed;
      p.y += p.dy * pacSpeed;
      if (p.x < -0.5) p.x = MAZE_WIDTH - 0.5;
      if (p.x > MAZE_WIDTH - 0.5) p.x = -0.5;
      p.frame += 0.25;

      if (data.frightenedTimer > 0) data.frightenedTimer -= 1;
      if (data.fruitActive) {
        data.fruitTimer -= 1;
        if (data.fruitTimer <= 0) data.fruitActive = false;
        else if (distance(p, { x: 9, y: 11 }) < 1.1) {
          scoreRef.current += currentLevel * 100;
          setScore(scoreRef.current);
          data.fruitActive = false;
          playSound('eat');
        }
      }

      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      const cell = data.maze[cy]?.[cx];
      if (cell === 2 || cell === 3) {
        data.maze[cy][cx] = 0;
        data.pelletsCount -= 1;
        if (cell === 3) {
          scoreRef.current += 50;
          setScore(scoreRef.current);
          data.frightenedTimer = [360,300,240,180][Math.min(currentLevel - 1, 3)] || 120;
          data.ghostMultiplier = 200;
          data.ghosts.forEach(g => { if (g.mode === 'normal') { g.mode = 'frightened'; g.dx *= -1; g.dy *= -1; } });
          playSound('power');
        } else {
          scoreRef.current += 10;
          setScore(scoreRef.current);
          playSound('eat');
        }
        if (data.pelletsCount === 100 || data.pelletsCount === 40) {
          data.fruitActive = true;
          data.fruitTimer = 500;
        }
        if (data.pelletsCount <= 0 && !data.levelClearing) {
          data.levelClearing = true;
          const next = currentLevel + 1;
          window.setTimeout(() => {
            initLevel(next, scoreRef.current, livesRef.current);
            gameStateRef.current = 'PLAYING';
            setGameState('PLAYING');
          }, 350);
          return;
        }
      }

      const normalGhostSpeed = 0.039465 * ghostSpeed(currentLevel);
      const scaredGhostSpeed = 0.039465 * frightenedGhostSpeed(currentLevel);
      data.ghosts.forEach(g => {
        const activeSpeed = g.mode === 'frightened' ? scaredGhostSpeed : g.mode === 'eaten' ? 0.08 : normalGhostSpeed;
        const gx = Math.round(g.x);
        const gy = Math.round(g.y);
        if (Math.abs(g.x - gx) <= activeSpeed && Math.abs(g.y - gy) <= activeSpeed) {
          g.x = gx; g.y = gy;
          if (g.mode === 'eaten') {
            chooseGhostDirection(g, GHOST_PEN.x, GHOST_PEN.y, false);
            if (Math.abs(g.x - GHOST_PEN.x) < 0.1 && Math.abs(g.y - GHOST_PEN.y) < 0.1) g.mode = 'normal';
          } else if (g.mode === 'frightened') {
            chooseGhostDirection(g, p.x, p.y, true);
          } else {
            let targetX = p.x, targetY = p.y;
            if (g.id === 'pinky') { targetX = p.x + p.dx * 4; targetY = p.y + p.dy * 4; }
            if (g.id === 'inky') { targetX = p.x + p.dx * 2; targetY = p.y + p.dy * 2; }
            if (g.id === 'clyde' && distance(g, p) < 8) { targetX = 0; targetY = MAZE_HEIGHT - 1; }
            chooseGhostDirection(g, targetX, targetY, false);
          }
        }
        if (!isWall(g.x + g.dx * activeSpeed, g.y + g.dy * activeSpeed, true)) {
          g.x += g.dx * activeSpeed;
          g.y += g.dy * activeSpeed;
        } else {
          g.dx = 0; g.dy = 0;
        }
        if (g.x < -0.5) g.x = MAZE_WIDTH - 0.5;
        if (g.x > MAZE_WIDTH - 0.5) g.x = -0.5;

        if (distance(g, p) < 0.62) {
          if (g.mode === 'frightened') {
            g.mode = 'eaten';
            scoreRef.current += data.ghostMultiplier;
            data.ghostMultiplier *= 2;
            setScore(scoreRef.current);
            playSound('eat_ghost');
          } else if (g.mode === 'normal') {
            die();
          }
        }
      });
    };

    const drawGhost = (g) => {
      const image = new Image();
      image.src = GHOST_SPRITES[g.id];
      const gx = g.x * TILE_SIZE + TILE_SIZE / 2;
      const gy = g.y * TILE_SIZE + TILE_SIZE / 2;
      const w = image.naturalWidth ? image.naturalWidth * (GHOST_RENDER_HEIGHT / image.naturalHeight) : 28;
      const h = image.naturalHeight ? GHOST_RENDER_HEIGHT : 28;
      if (g.mode === 'eaten') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(gx, gy - 2, 5, 0, Math.PI * 2); ctx.fill();
        return;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (g.mode === 'frightened') {
        ctx.fillStyle = '#174dff'; ctx.shadowColor = '#174dff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(gx, gy, 10, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.78;
      } else {
        ctx.shadowColor = g.color; ctx.shadowBlur = 10;
      }
      if (image.complete && image.naturalWidth) ctx.drawImage(image, gx - w / 2, gy - h / 2, w, h);
      else { ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(gx, gy, 9, Math.PI, 0); ctx.fill(); }
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const wallColor = MAZE_COLORS[(levelRef.current - 1) % MAZE_COLORS.length];
      data.maze.forEach((row, y) => row.forEach((cell, x) => {
        const px = x * TILE_SIZE; const py = y * TILE_SIZE;
        if (cell === 1) {
          ctx.strokeStyle = wallColor; ctx.lineWidth = 2; ctx.shadowColor = wallColor; ctx.shadowBlur = 7;
          ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2); ctx.shadowBlur = 0;
        } else if (cell === 2 || cell === 3) {
          ctx.fillStyle = cell === 3 ? '#ffffff' : '#ffe8b0';
          ctx.shadowColor = cell === 3 ? '#ffffff' : '#ffd166'; ctx.shadowBlur = cell === 3 ? 8 : 3;
          ctx.beginPath(); ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, cell === 3 ? 4 : 1.8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        } else if (cell === 4) {
          ctx.fillStyle = '#ffb8ff'; ctx.fillRect(px + 2, py + 10, TILE_SIZE - 4, 4);
        }
      }));

      data.ghosts.forEach(drawGhost);
      const p = data.pacman;
      const px = p.x * TILE_SIZE + TILE_SIZE / 2; const py = p.y * TILE_SIZE + TILE_SIZE / 2;
      const mouth = Math.abs(Math.sin(p.frame)) * 0.35;
      const angle = p.dx === 1 ? 0 : p.dx === -1 ? Math.PI : p.dy === 1 ? Math.PI / 2 : p.dy === -1 ? -Math.PI / 2 : 0;
      ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
      ctx.fillStyle = '#ffff00'; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,TILE_SIZE/2.2,mouth,Math.PI*2-mouth); ctx.closePath(); ctx.fill(); ctx.restore();
      if (data.fruitActive && levelRef.current < 20) {
        ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(FRUITS[Math.min(levelRef.current - 1, FRUITS.length - 1)], 9*TILE_SIZE+TILE_SIZE/2, 11*TILE_SIZE+TILE_SIZE/2);
      }
    };

    const loop = (time) => {
      const elapsed = Math.min(100, time - previousTime);
      previousTime = time;
      accumulator += elapsed;
      while (accumulator >= FIXED_STEP) { update(); accumulator -= FIXED_STEP; }
      draw();
      data.animationId = requestAnimationFrame(loop);
    };

    if (gameState === 'PLAYING' && !data.maze.length) initLevel(levelRef.current, scoreRef.current, livesRef.current);
    if (gameState === 'PLAYING' || gameState === 'DIED') data.animationId = requestAnimationFrame(loop);
    else draw();

    return () => cancelAnimationFrame(data.animationId);
  }, [gameState, initLevel, resetPositions]);

  useEffect(() => () => {
    if (deathTimerRef.current) clearTimeout(deathTimerRef.current);
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
