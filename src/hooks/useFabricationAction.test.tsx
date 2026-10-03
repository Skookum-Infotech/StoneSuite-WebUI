import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { useFabricationAction } from './useFabricationAction';

describe('useFabricationAction', () => {
 it('retries with the same request identity and version even after a background refresh', async () => {
  const execute = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue({ ok: true });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(({ version }) => useFabricationAction({ version, execute }), { wrapper, initialProps: { version: 1 } });
  act(() => result.current.run({ approve: true }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  rerender({ version: 2 });
  act(() => result.current.run({ approve: true }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(execute.mock.calls[0][0]).toEqual(execute.mock.calls[1][0]);
  expect(execute.mock.calls[1][0].expectedVersion).toBe(1);
 });
});
