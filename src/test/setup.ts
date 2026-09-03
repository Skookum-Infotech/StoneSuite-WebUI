// Vitest global setup: registers jest-dom matchers (toBeInTheDocument, etc.)
// and clears the DOM between tests. Referenced from vitest.config.ts setupFiles.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 22+ exposes Web Storage (`localStorage`/`sessionStorage`) as own properties
// of globalThis. Without `--localstorage-file` they evaluate to `undefined`, and
// because they are own properties they shadow the working implementations jsdom
// installs on its window. Any module that reads storage during evaluation — the
// zustand store in src/store/useAuthStore.ts does — then throws at import time and
// takes the whole test file down before it collects.
//
// Restored here rather than guarded at the call sites: the tests assert real
// browser persistence (AuthLayout.test.tsx calls localStorage.clear() and expects
// setAuth/logout to round-trip), so a no-op stub would make them pass for the wrong
// reason. Vitest isolates each test file, so no state leaks between files.
function createStorage(): Storage {
  let entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    key(index: number): string | null {
      return Array.from(entries.keys())[index] ?? null
    },
    getItem(key: string): string | null {
      return entries.get(String(key)) ?? null
    },
    setItem(key: string, value: string): void {
      entries.set(String(key), String(value))
    },
    removeItem(key: string): void {
      entries.delete(String(key))
    },
    clear(): void {
      entries = new Map()
    },
  }
}

// No-op where the environment already supplies a real Storage (Node 20 and the
// GitHub Actions runners), so this only engages on Node builds that shadow it.
function isUsableStorage(candidate: Storage | undefined): boolean {
  return typeof candidate?.getItem === 'function'
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!isUsableStorage(globalThis[name])) {
    Object.defineProperty(globalThis, name, {
      value: createStorage(),
      configurable: true,
      writable: true,
    })
  }
}

// jsdom ships no `matchMedia`. Provide a minimal stand-in so hooks that gate on
// media queries run deterministically: `(prefers-reduced-motion: reduce)` reports
// **true**, so animation hooks (useReducedMotion and everything built on it —
// useCountUp, the sparkline draw-in, the dashboard card entrance) resolve to
// their final state synchronously and assertions read steady values instead of
// waiting out a tween. Hook-level tests that need the animating branch override
// `window.matchMedia` themselves (see useCountUp.test.ts).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  })
}

afterEach(() => {
  cleanup()
})
