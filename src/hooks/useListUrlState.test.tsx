import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListUrlState } from './useListUrlState';

type Field = 'createdAt' | 'name' | 'total';
const SORT_FIELDS: readonly Field[] = ['createdAt', 'name', 'total'];
const DEFAULT_SORT = { field: 'createdAt', dir: 'desc' } as const;

function setup(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      list: useListUrlState<Field>({ sortFields: SORT_FIELDS, defaultSort: DEFAULT_SORT }),
      location: useLocation(),
    }),
    { wrapper },
  );
}

describe('useListUrlState', () => {
  it('falls back to the default sort and an empty search on a clean URL', () => {
    const { result } = setup('/quotes');
    expect(result.current.list).toMatchObject({ search: '', sortBy: 'createdAt', sortDir: 'desc' });
  });

  it.each([
    ['reads search, sort and dir from the URL', '/quotes?q=acme&sort=name&dir=asc', 'acme', 'name', 'asc'],
    ['ignores a sort field the list does not have', '/quotes?sort=hacked&dir=asc', '', 'createdAt', 'asc'],
    ['ignores an invalid direction', '/quotes?sort=total&dir=sideways', '', 'total', 'desc'],
  ])('%s', (_label, url, search, sortBy, sortDir) => {
    const { result } = setup(url);
    expect(result.current.list).toMatchObject({ search, sortBy, sortDir });
  });

  it('writes an applied search and clears it when emptied', () => {
    const { result } = setup('/quotes');
    act(() => result.current.list.setSearch('granite'));
    expect(result.current.location.search).toBe('?q=granite');
    expect(result.current.list.search).toBe('granite');
    act(() => result.current.list.setSearch(''));
    expect(result.current.location.search).toBe('');
  });

  it('writes a non-default sort and drops it again when back at the default', () => {
    const { result } = setup('/quotes');
    act(() => result.current.list.setSort('total', 'asc'));
    expect(result.current.location.search).toBe('?sort=total&dir=asc');
    expect(result.current.list).toMatchObject({ sortBy: 'total', sortDir: 'asc' });
    act(() => result.current.list.setSort('createdAt', 'desc'));
    expect(result.current.location.search).toBe('');
  });

  it('keeps the same field in the URL when only its direction differs from the default', () => {
    const { result } = setup('/quotes');
    act(() => result.current.list.setSort('createdAt', 'asc'));
    expect(result.current.location.search).toBe('?sort=createdAt&dir=asc');
  });

  it('preserves unrelated query params', () => {
    const { result } = setup('/quotes?tab=open');
    act(() => result.current.list.setSearch('acme'));
    act(() => result.current.list.setSort('name', 'asc'));
    const params = new URLSearchParams(result.current.location.search);
    expect(Object.fromEntries(params)).toEqual({ tab: 'open', q: 'acme', sort: 'name', dir: 'asc' });
  });

  it('does not navigate when the search is unchanged, so location.state survives', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[{ pathname: '/quotes', search: '?q=acme', state: { highlightId: 'abc' } }]}>
        {children}
      </MemoryRouter>
    );
    const { result } = renderHook(
      () => ({
        list: useListUrlState<Field>({ sortFields: SORT_FIELDS, defaultSort: DEFAULT_SORT }),
        location: useLocation(),
      }),
      { wrapper },
    );
    act(() => result.current.list.setSearch('acme'));
    act(() => result.current.list.setSort('createdAt', 'desc'));
    expect(result.current.location.state).toEqual({ highlightId: 'abc' });
  });
});
