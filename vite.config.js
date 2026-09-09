import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep the gameplay speed between the original slow setting and the recent overly-fast tuning.
// This applies consistently in both Vite dev mode and production builds without changing game logic.
const gameSpeedTuning = {
  name: 'game-speed-tuning',
  transform(code, id) {
    if (!id.endsWith('/src/App.jsx')) return null

    return {
      code: code
        .replace(/speed: 0\.16/g, 'speed: 0.125')
        .replace(/0\.105 \+ \(level \* 0\.006\)/g, '0.08 + (level * 0.005)')
        .replace(/\? 0\.085 : \(g\.mode === 'eaten' \? 0\.22/g, "? 0.065 : (g.mode === 'eaten' ? 0.2"),
      map: null,
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [gameSpeedTuning, react()],
})
