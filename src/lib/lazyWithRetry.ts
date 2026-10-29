import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'chunk_reload_attempted';

// Wraps lazy() so that a ChunkLoadError (stale CDN chunk after a new deploy)
// triggers a one-time hard reload instead of showing a crash screen.
// Generic over the props `P` so components that take props (e.g. the AI
// assistant panel) keep their own prop types.
export function lazyWithRetry<P>(
  factory: () => Promise<{ default: React.ComponentType<P> }>,
): React.LazyExoticComponent<React.ComponentType<P>> {
  return lazy(() =>
    factory()
      .then((module) => {
        // A chunk loaded fine: re-arm the one-time reload for the next deploy.
        try {
          sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        } catch {
          // storage unavailable — nothing to re-arm
        }
        return module;
      })
      .catch((err: unknown) => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          // Return a never-resolving promise — reload takes over.
          return new Promise<never>(() => {});
        }
        return Promise.reject(err);
      }),
  );
}
