import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Test config kept separate from vite.config.ts so the dev/build pipeline and
// the test runner evolve independently. Run with `npm test`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Starting a jsdom window per test file is about a third of the suite's
    // total CPU time (and most of it for the plain `.test.ts` files). Plain `.test.ts` files (lib helpers, services, stores) don't render
    // anything, so they run in Node; `.test.tsx` files render components and
    // keep jsdom. A `.test.ts` that needs the DOM (hooks via renderHook,
    // cookies, localStorage, matchMedia, history) opts back in with a
    // `// @vitest-environment jsdom` docblock on its first line.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
          // Hook tests drive React through renderHook, which needs a DOM, so
          // every file under hooks/ runs in the jsdom project below.
          exclude: [...configDefaults.exclude, 'src/hooks/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.tsx', 'src/hooks/**/*.{test,spec}.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
