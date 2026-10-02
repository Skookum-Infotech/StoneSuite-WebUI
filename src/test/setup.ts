// Vitest global setup: registers jest-dom matchers (toBeInTheDocument, etc.)
// and clears the DOM between tests. Referenced from vitest.config.ts setupFiles.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 22+ exposes Web Storage (`localStorage`/`sessionStorage`, and the
// `Storage` constructor itself) as own properties of globalThis. Without
// `--localstorage-file` the instances evaluate to `undefined`, and because
// they are own properties they shadow the working implementations jsdom
// installs on its window. Any module that reads storage during evaluation —
// the zustand store in src/store/useAuthStore.ts does — then throws at import
// time and takes the whole test file down before it collects.
//
// Restored here rather than guarded at the call sites: the tests assert real
// browser persistence (AuthLayout.test.tsx calls localStorage.clear() and expects
// setAuth/logout to round-trip), so a no-op stub would make them pass for the wrong
// reason. Vitest isolates each test file, so no state leaks between files.
//
// MemoryStorage's methods live on the PROTOTYPE, not as own properties on each
// instance (an earlier version returned a `{ getItem() {...}, ... }` object
// literal, whose own `setItem`/`getItem` always shadow the prototype no
// matter what it is). requisitionPrefill.test.ts's "copes with storage being
// unavailable" case does `vi.spyOn(Storage.prototype, 'setItem')` — for that
// to actually intercept a call to `window.localStorage.setItem(...)`, this
// instance must inherit setItem rather than own it, and the global `Storage`
// binding the test reads must be the same class this instance was built
// from. Both are handled below: methods are on MemoryStorage.prototype, and
// globalThis.Storage is replaced with MemoryStorage whenever the native one
// isn't usable, so `Storage` in a test file resolves to this class.
//
// The fallback is all-or-nothing. Node 25+ enables Web Storage by default:
// without `--localstorage-file` its `localStorage` is unusable but its
// `sessionStorage` is a working, native in-memory Storage. Swapping `Storage`
// while keeping that native `sessionStorage` leaves it an instance of a class
// the tests cannot see, so `vi.spyOn(Storage.prototype, ...)` silently misses
// every sessionStorage call (authNotice.test.ts's "storage is unavailable"
// case). Replacing both instances together keeps `Storage` and the instances
// one class.
class MemoryStorage implements Storage {
  #entries = new Map<string, string>()

  get length(): number {
    return this.#entries.size
  }
  key(index: number): string | null {
    return Array.from(this.#entries.keys())[index] ?? null
  }
  getItem(key: string): string | null {
    return this.#entries.get(String(key)) ?? null
  }
  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value))
  }
  removeItem(key: string): void {
    this.#entries.delete(String(key))
  }
  clear(): void {
    this.#entries.clear()
  }
}

// No-op where the environment already supplies a real Storage (older Node,
// or a future Node/jsdom pairing that stops colliding), so this only engages
// on runtimes that shadow it.
function isUsableStorage(candidate: Storage | undefined): boolean {
  return typeof candidate?.getItem === 'function'
}

const needsFallback =
  !isUsableStorage(globalThis.localStorage) || !isUsableStorage(globalThis.sessionStorage)

if (needsFallback) {
  Object.defineProperty(globalThis, 'Storage', {
    value: MemoryStorage,
    configurable: true,
    writable: true,
  })
}

if (needsFallback) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
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
