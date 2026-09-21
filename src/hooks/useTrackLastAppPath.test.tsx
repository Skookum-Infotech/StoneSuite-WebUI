import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTrackLastAppPath } from './useTrackLastAppPath';
import { useLastAppPathStore } from '@/store/useLastAppPathStore';

function renderAt(initialEntry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      useTrackLastAppPath();
      return useNavigate();
    },
    { wrapper },
  );
}

// The store is a module-level singleton, so it outlives any one render().
beforeEach(() => useLastAppPathStore.setState({ path: '' }));

describe('useTrackLastAppPath', () => {
  it('records the current route, query string included', () => {
    renderAt('/sales/invoice/9?tab=lines');

    expect(useLastAppPathStore.getState().path).toBe('/sales/invoice/9?tab=lines');
  });

  it('follows the user from page to page', () => {
    const { result } = renderAt('/crm/lead');

    act(() => {
      result.current('/purchases/vendor');
    });

    expect(useLastAppPathStore.getState().path).toBe('/purchases/vendor');
  });

  // The reason this exists: a ticket should describe the page the reporter was
  // on, not the Support page they had to open in order to file it.
  it('keeps the previous route while the user is on the Support page', () => {
    const { result } = renderAt('/sales/invoice/9');

    act(() => {
      result.current('/support?tab=submit');
    });

    expect(useLastAppPathStore.getState().path).toBe('/sales/invoice/9');
  });

  it('records nothing when the session starts on the Support page', () => {
    renderAt('/support');

    expect(useLastAppPathStore.getState().path).toBe('');
  });
});
