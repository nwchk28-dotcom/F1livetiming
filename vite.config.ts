import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/F1livetiming/' : '/',
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
}))
