import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { CommandMeta } from '@/types/fabricationActions';

/** Retains a command identity across ambiguous network failures and background refreshes. */
export function useFabricationAction<T extends object, R>({ version, execute, onSuccess }: {
  version: number;
  execute: (meta: CommandMeta, input: T) => Promise<R>;
  onSuccess?: (result: R) => void;
}) {
  const request = useRef<{ fingerprint: string; meta: CommandMeta } | null>(null);
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ meta, input }: { meta: CommandMeta; input: T }) => execute(meta, input),
    onSuccess: (result) => { request.current = null; onSuccess?.(result); },
    onSettled: () => { busy.current = false; },
    retry: false,
  });
  return {
    ...mutation,
    run: (input: T) => {
      if (busy.current) return;
      const fingerprint = JSON.stringify(input);
      if (!request.current || request.current.fingerprint !== fingerprint) {
        request.current = { fingerprint, meta: { requestId: crypto.randomUUID(), expectedVersion: version } };
      }
      busy.current = true;
      mutation.mutate({ meta: request.current.meta, input });
    },
    /** Use only after an explicit conflict/refresh, never after an ambiguous network error. */
    resetForLatest: () => { if (!busy.current) { request.current = null; mutation.reset(); } },
  };
}
