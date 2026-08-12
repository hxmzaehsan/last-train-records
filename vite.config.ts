import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /*
   * Relative asset paths, so one build works unchanged at a domain root, in a
   * local preview, and under a GitHub Pages project path such as
   * /last-train-records/. Nothing here needs to know the repository name.
   * Runtime fetches (the audio files) resolve through import.meta.env.BASE_URL
   * for the same reason — see src/audio/manifest.ts.
   */
  base: './',
  server: {
    port: 5185,
    strictPort: true,
  },
  preview: {
    port: 5186,
    strictPort: true,
  },
})
