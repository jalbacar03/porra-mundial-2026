import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries into their own chunks. Browsers cache them
        // separately so a release that only changes app code doesn't force
        // users to re-download react/supabase/sentry.
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          if (id.includes('node_modules/@sentry/')) return 'sentry'
          if (id.match(/node_modules\/(react|react-dom|react-router-dom|scheduler)\//)) return 'react'
          return undefined
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
