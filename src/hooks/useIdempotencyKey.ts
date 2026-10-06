import { useCallback, useRef } from 'react';

/**
 * Holds one idempotency key for as long as the request being retried is the
 * same. Pass a fingerprint of the payload to `keyFor`: an unchanged payload
 * (the user retrying after a timeout or dropped connection) gets the key the
 * first attempt used, so the server can recognise it and return the record it
 * already made; a changed payload is a new request and gets a fresh key. Call
 * `reset` once a request succeeds so the next one starts clean.
 */
export function useIdempotencyKey() {
  const current = useRef<{ fingerprint: string; key: string } | null>(null);
  const keyFor = useCallback((fingerprint: string): string => {
    if (!current.current || current.current.fingerprint !== fingerprint) {
      current.current = { fingerprint, key: crypto.randomUUID() };
    }
    return current.current.key;
  }, []);
  const reset = useCallback(() => { current.current = null; }, []);
  return { keyFor, reset };
}
