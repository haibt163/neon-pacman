import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0], // Warp Tunnel Row
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,2,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const TILE_SIZE = 24;
// Larger than Pac-Man's diameter so the imported character art reads as the main actors.
const GHOST_RENDER_HEIGHT = 38;
const GHOST_PEN = { x: 9, y: 9 };
const MAZE_WIDTH = LEVEL_1_MAZE[0].length;
const MAZE_COLORS = ['#00ffff', '#00ff00', '#ff00ff', '#ffff00', '#ff0000'];
const FRUITS = ['🍒', '🍓', '🍊', '🍎', '🍈'];
const GHOST_SPRITES = {
  blinky: blinkySprite,
  pinky: pinkySprite,
  inky: inkySprite,
  clyde: clydeSprite
};
const GHOST_IMAGES = Object.fromEntries(
  Object.entries(GHOST_SPRITES).map(([id, src]) => {
    const image = new Image();
    image.src = src;
    return [id, image];
  })
);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = (type) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'eat') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
  } else if (type === 'power') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'eat_ghost') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  } else if (type === 'die') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
    osc.start(); osc.stop(audioCtx.currentTime + 0.8);
  }
};

export default function App() {
  const canvasRef = useRef(null);
  const touchStartRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('pacman-highscore')) || 0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState('START'); 

  const gameData = useRef({
    maze: [],
    pacman: { x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0, frame: 0, speed: 0.1 }, 
    ghosts: [],
    pelletsCount: 0,
    frightenedTimer: 0,
    ghostMultiplier: 200,
    animationId: null,
    fruitActive: false,
    fruitTimer: 0
  });

  const getDist = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  const setDirection = useCallback((dx, dy) => {
    if (gameState !== 'PLAYING') return;
    const p = gameData.current.pacman;
    p.nextDx = dx;
    p.nextDy = dy;
  }, [gameState]);

  const resetPositions = useCallback(() => {
    gameData.current.pacman = { ...gameData.current.pacman, x: 9, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0 };
    gameData.current.ghosts = [
      { id: 'blinky', x: 9, y: 7, dx: -1, dy: 0, color: '#ff0000', mode: 'normal' },
      { id: 'pinky',  x: 9, y: 9, dx: 0, dy: -1, color: '#ffb8ff', mode: 'normal' },
      { id: 'inky',   x: 8, y: 9, dx: 1, dy: 0, color: '#00ffff', mode: 'normal' },
      { id: 'clyde',  x: 10,y: 9, dx: -1, dy: 0, color: '#ffb852', mode: 'normal' }
    ];
    gameData.current.frightenedTimer = 0;
  }, []);

  const initLevel = useCallback((lvl, currentScore = 0, currentLives = 3) => {
    gameData.current.maze = JSON.parse(JSON.stringify(LEVEL_1_MAZE));
    resetPositions();
    
    let count = 0;
    gameData.current.maze.forEach(row => row.forEach(cell => {
      if (cell === 2 || cell === 3) count++;
    }));
    gameData.current.pelletsCount = count;
    gameData.current.fruitActive = false;
    
    setLevel(lvl);
    setScore(currentScore);
    setLives(currentLives);
  }, [resetPositions]);

  const startGame = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    initLevel(1, 0, 3);
    setGameState('PLAYING');
  };

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('pacman-highscore', score);
    }
  }, [score, highScore]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'PLAYING') return;
      if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) e.preventDefault();
      
      if (e.key === 'ArrowUp') setDirection(0, -1);
      if (e.key === 'ArrowDown') setDirection(0, 1);
      if (e.key === 'ArrowLeft') setDirection(-1, 0);
      if (e.key === 'ArrowRight') setDirection(1, 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, setDirection]);

  // Mobile/tablet control: swipe anywhere on the game board. No on-screen D-pad/buttons.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'PLAYING') return;

    const SWIPE_THRESHOLD = 18;
    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      touchStartRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    };

    const handlePointerUp = (e) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || e.pointerType === 'mouse') return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        setDirection(dx > 0 ? 1 : -1, 0);
      } else {
        setDirection(0, dy > 0 ? 1 : -1);
      }
    };

    const handlePointerCancel = () => {
      touchStartRef.current = null;
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: true });
    canvas.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [gameState, setDirection]);

  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'DIED') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const isWall = (x, y, isGhost = false) => {
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (cy === 9 && (cx < 0 || cx >= MAZE_WIDTH)) return false; 
      const cell = gameData.current.maze[cy]?.[cx];
      if (cell === undefined || cell === 1) return true;
      if (cell === 4 && !isGhost) return true; 
      return false;
    };

    const update = () => {
      if (gameState === 'DIED') return; 
      
      const data = gameData.current;
      const p = data.pacman;

      if (Math.abs(p.x - Math.round(p.x)) <= p.speed/2 && Math.abs(p.y - Math.round(p.y)) <= p.speed/2) {
        p.x = Math.round(p.x); 
        p.y = Math.round(p.y);
        
        if (p.nextDx !== 0 || p.nextDy !== 0) {
          if (!isWall(p.x + p.nextDx, p.y + p.nextDy)) {
            p.dx = p.nextDx; p.dy = p.nextDy;
          }
        }
        if (isWall(p.x + p.dx, p.y + p.dy)) {
          p.dx = 0; p.dy = 0;
        }
      }

      p.x += p.dx * p.speed;
      p.y += p.dy * p.speed;

      if (p.x < -0.5) p.x = MAZE_WIDTH - 0.5;
      if (p.x > MAZE_WIDTH - 0.5) p.x = -0.5;

      const cx = Math.round(p.x); const cy = Math.round(p.y);
      if (data.maze[cy] && data.maze[cy][cx] > 1 && data.maze[cy][cx] !== 4) {
        const val = data.maze[cy][cx];
        data.maze[cy][cx] = 0;
        data.pelletsCount--;
        
        if (val === 3) {
          playSound('power');
          setScore(s => s + 50);
          data.frightenedTimer = Math.max(0, 600 - (level * 30)); 
          data.ghostMultiplier = 200;
          data.ghosts.forEach(g => {
            if (g.mode === 'normal') {
              g.mode = 'frightened';
              g.dx *= -1; g.dy *= -1;
            }
          });
        } else {
          playSound('eat');
          setScore(s => s + 10);
        }

        if (data.pelletsCount === 100 || data.pelletsCount === 40) {
          data.fruitActive = true;
          data.fruitTimer = 500;
        }

        if (data.pelletsCount <= 0) {
          initLevel(level + 1, score, lives);
        }
      }

      if (data.fruitActive) {
        data.fruitTimer--;
        if (getDist(p.x, p.y, 9, 11) < 1.2) { 
          setScore(s => s + (level * 100));
          playSound('power');
          data.fruitActive = false;
        }
        if (data.fruitTimer <= 0) data.fruitActive = false;
      }

      if (data.frightenedTimer > 0) {
        data.frightenedTimer--;
        if (data.frightenedTimer === 0) {
          data.ghosts.forEach(g => { if (g.mode === 'frightened') g.mode = 'normal'; });
        }
      }

      data.ghosts.forEach(g => {
        let activeSpeed = g.mode === 'frightened' ? 0.05 : (g.mode === 'eaten' ? 0.2 : 0.0625 + (level * 0.005));
        
        if (Math.round(g.y) === 9 && (g.x <= 3 || g.x >= 15)) activeSpeed *= 0.4;

        if (Math.abs(g.x - Math.round(g.x)) <= activeSpeed/2 && Math.abs(g.y - Math.round(g.y)) <= activeSpeed/2) {
          g.x = Math.round(g.x); g.y = Math.round(g.y);
          
          let targetX = 9, targetY = 9; 

          if (g.mode === 'eaten') {
            targetX = GHOST_PEN.x; targetY = GHOST_PEN.y;
            if (g.x === GHOST_PEN.x && g.y === GHOST_PEN.y) g.mode = 'normal';
          } else if (g.mode === 'frightened') {
            targetX = Math.random() * 20; targetY = Math.random() * 20;
          } else {
            if (g.id === 'blinky') {
              targetX = p.x; targetY = p.y;
            } else if (g.id === 'pinky') {
              targetX = p.x + (p.dx * 4); targetY = p.y + (p.dy * 4);
            } else if (g.id === 'inky') {
              const blinky = data.ghosts[0];
              targetX = p.x + (p.x - blinky.x); targetY = p.y + (p.y - blinky.y);
            } else if (g.id === 'clyde') {
              if (getDist(g.x, g.y, p.x, p.y) > 8) {
                targetX = p.x; targetY = p.y;
              } else {
                targetX = 0; targetY = 19; 
              }
            }
          }

          const possibleMoves = [
            {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}
          ].filter(m => {
            if (m.dx === -g.dx && m.dy === -g.dy && (g.dx !== 0 || g.dy !== 0)) return false;
            
            const mcx = Math.round(g.x + m.dx);
            const mcy = Math.round(g.y + m.dy);
            if (mcy === 9 && (mcx < 0 || mcx >= MAZE_WIDTH)) return true;
            
            const cell = data.maze[mcy]?.[mcx];
            if (cell === undefined || cell === 1) return false;
            
            const inPen = Math.round(g.x) >= 8 && Math.round(g.x) <= 10 && Math.round(g.y) >= 8 && Math.round(g.y) <= 10;
            if (cell === 4 && g.mode !== 'eaten' && !inPen) return false; 
            
            return true;
          });

          if (possibleMoves.length > 0) {
            let bestMove = possibleMoves[0];
            let minTargetDist = Infinity;

            possibleMoves.forEach(m => {
              const d = getDist(g.x + m.dx, g.y + m.dy, targetX, targetY);
              if (d < minTargetDist) {
                minTargetDist = d; bestMove = m;
              }
            });

            if (g.mode === 'frightened') {
              bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            }
            g.dx = bestMove.dx; g.dy = bestMove.dy;
          } else {
            g.dx *= -1;
            g.dy *= -1;
            if (g.dx === 0 && g.dy === 0) g.dx = 1; 
          }
        }

        g.x += g.dx * activeSpeed;
        g.y += g.dy * activeSpeed;

        if (g.x < -0.5) g.x = MAZE_WIDTH - 0.5;
        if (g.x > MAZE_WIDTH - 0.5) g.x = -0.5;

        if (Math.abs(g.x - p.x) < 0.8 && Math.abs(g.y - p.y) < 0.8) {
          if (g.mode === 'frightened') {
            playSound('eat_ghost');
            g.mode = 'eaten';
            setScore(s => s + data.ghostMultiplier);
            data.ghostMultiplier *= 2;
          } else if (g.mode === 'normal') {
            playSound('die');
            setGameState('DIED');
            setTimeout(() => {
              if (lives > 1) {
                setLives(l => l - 1);
                resetPositions();
                setGameState('PLAYING');
              } else {
                setGameState('GAMEOVER');
              }
            }, 1500);
          }
        }
      });

      p.frame += 0.2;
    };

    const drawGhostSprite = (g) => {
      const gx = g.x * TILE_SIZE + TILE_SIZE / 2;
      const gy = g.y * TILE_SIZE + TILE_SIZE / 2;
      const data = gameData.current;

      if (g.mode === 'eaten') {
        // Preserve the original eaten state: only the eyes remain visible while returning to the pen.
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx - TILE_SIZE/6, gy - TILE_SIZE/6, TILE_SIZE/6, 0, Math.PI * 2);
        ctx.arc(gx + TILE_SIZE/6, gy - TILE_SIZE/6, TILE_SIZE/6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        const pDx = g.dx * 2; const pDy = g.dy * 2;
        ctx.arc(gx - TILE_SIZE/6 + pDx, gy - TILE_SIZE/6 + pDy, TILE_SIZE/12, 0, Math.PI * 2);
        ctx.arc(gx + TILE_SIZE/6 + pDx, gy - TILE_SIZE/6 + pDy, TILE_SIZE/12, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      const image = GHOST_IMAGES[g.id];
      if (!image || !image.complete || !image.naturalWidth) return;

      const renderScale = GHOST_RENDER_HEIGHT / image.naturalHeight;
      const renderWidth = image.naturalWidth * renderScale;
      const renderHeight = image.naturalHeight * renderScale;
      const ghostColor = g.color;

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // Give the darker character art a visible neon aura without changing gameplay sprites.
      const glow = ctx.createRadialGradient(gx, gy, 3, gx, gy, Math.max(renderWidth, renderHeight) * 0.8);
      glow.addColorStop(0, `${ghostColor}55`);
      glow.addColorStop(0.45, `${ghostColor}22`);
      glow.addColorStop(1, `${ghostColor}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(renderWidth, renderHeight) * 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = g.mode === 'frightened' ? '#ffffff' : ghostColor;
      ctx.shadowBlur = 14;
      if (g.mode === 'frightened') {
        const flashing = data.frightenedTimer < 150 && Math.floor(data.frightenedTimer / 15) % 2 === 0;
        ctx.filter = flashing
          ? 'grayscale(1) brightness(1.9) contrast(1.15)'
          : 'grayscale(1) sepia(1) hue-rotate(170deg) saturate(6) brightness(1.15) contrast(1.08)';
      } else {
        // Lift the darkest pixels enough to remain readable against the black maze.
        ctx.filter = 'brightness(1.22) contrast(1.12)';
      }
      ctx.drawImage(image, gx - renderWidth / 2, gy - renderHeight / 2, renderWidth, renderHeight);
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const data = gameData.current;
      const wallColor = MAZE_COLORS[(level - 1) % MAZE_COLORS.length];

      data.maze.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (level >= 20 && x > 9) {
            ctx.fillStyle = ['#ff00ff', '#00ffff', '#ffff00', '#ff0000'][Math.floor(Math.random()*4)];
            if(Math.random() > 0.5) ctx.fillText(String.fromCharCode(Math.random() * 50 + 65), x * TILE_SIZE, y * TILE_SIZE + 15);
            return; 
          }

          if (cell === 1) {
            ctx.strokeStyle = wallColor; 
            ctx.lineWidth = 2;
            ctx.shadowColor = wallColor; 
            ctx.shadowBlur = 8;
            ctx.strokeRect(x * TILE_SIZE + 3, y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.shadowBlur = 0;
          } else if (cell === 2) {
            ctx.fillStyle = '#ffcc99';
            ctx.shadowColor = '#ffcc99';
            ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (cell === 3) {
            const pulse = 6 + Math.sin(Date.now() / 150) * 2;
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff'; 
            ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, pulse, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (cell === 4) {
            ctx.fillStyle = '#ffb8ff'; 
            ctx.shadowColor = '#ffb8ff';
            ctx.shadowBlur = 8;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE + 10, TILE_SIZE, 4);
            ctx.shadowBlur = 0;
          }
        });
      });

      if (data.fruitActive && level < 20) {
        ctx.font = '18px Arial';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        const fruitIcon = FRUITS[Math.min(level - 1, FRUITS.length - 1)];
        ctx.fillText(fruitIcon, 9 * TILE_SIZE + 2, 11 * TILE_SIZE + 18);
        ctx.shadowBlur = 0;
      }

      if (gameState !== 'DIED' || Math.floor(Date.now() / 200) % 2 === 0) {
        const p = data.pacman;
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        let angle = 0;
        if (p.dx === 1) angle = 0;
        else if (p.dx === -1) angle = Math.PI;
        else if (p.dy === 1) angle = Math.PI / 2;
        else if (p.dy === -1) angle = -Math.PI / 2;
        
        const mouthOpen = gameState === 'DIED' ? Math.PI/1.2 : Math.abs(Math.sin(p.frame)) * 0.5;
        const px = p.x * TILE_SIZE + TILE_SIZE/2;
        const py = p.y * TILE_SIZE + TILE_SIZE/2;
        
        ctx.arc(px, py, TILE_SIZE/2.2, angle + mouthOpen, angle + 2*Math.PI - mouthOpen);
        ctx.lineTo(px, py);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      data.ghosts.forEach(g => drawGhostSprite(g));
    };

    const loop = () => {
      update();
      draw();
      if (gameState === 'PLAYING' || gameState === 'DIED') {
        gameData.current.animationId = requestAnimationFrame(loop);
      }
    };
    
    loop();
    return () => cancelAnimationFrame(gameData.current.animationId);
  }, [gameState, level, lives, score, initLevel, resetPositions]);

  return (
    <div className="game-container">
      {gameState !== 'START' && (
        <iframe
          width="0" height="0" frameBorder="0" allow="autoplay"
          src="https://www.youtube.com/embed/qtZ0hl-unM4?autoplay=1&loop=1&playlist=qtZ0hl-unM4"
          style={{ display: 'none' }} title="bg-music"
        />
      )}

      <div className="header">
        <div className="stat-box"><span>SCORE</span><span className="stat-value">{score}</span></div>
        <div className="stat-box"><span>LEVEL</span><span className="stat-value">{level}</span></div>
        <div className="stat-box"><span>LIVES</span><span className="stat-value">{'❤️'.repeat(lives)}</span></div>
        <div className="stat-box"><span>HIGH SCORE</span><span className="stat-value">{highScore}</span></div>
      </div>

      <div className="canvas-wrapper">
        <canvas 
          ref={canvasRef} 
          width={MAZE_WIDTH * TILE_SIZE} 
          height={LEVEL_1_MAZE.length * TILE_SIZE} 
        />
        
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

        {gameState === 'GAMEOVER' && (
          <div className="overlay">
            <h1>GAME OVER</h1>
            <button onClick={startGame}>TRY AGAIN</button>
          </div>
        )}
      </div>
    </div>
  );
}
