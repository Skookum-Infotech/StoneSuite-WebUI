import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, type RouteObject } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs';

// /finance is only a sidebar group (no page); the other two prefixes are pages.
const ROUTES: RouteObject[] = [
  { path: '/', element: null },
  { path: '/finance/journal-entries', element: null },
  { path: '/finance/journal-entries/:id', element: null },
  { path: '*', element: null },
];

function renderCrumbs(segments: string[], labels: Record<string, string> = {}) {
  render(
    <MemoryRouter>
      <Breadcrumbs segments={segments} labels={labels} routes={ROUTES} />
    </MemoryRouter>,
  );
  return within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
}

describe('Breadcrumbs', () => {
  it('is an ordered list so assistive tech announces the depth', () => {
    const nav = renderCrumbs(['finance', 'journal-entries', '9']);

    expect(nav.getByRole('list')).toBeInTheDocument();
    expect(nav.getAllByRole('listitem').length).toBeGreaterThan(3);
  });

  it('links Home and every parent that has a page, so each opens in a new tab', () => {
    const nav = renderCrumbs(['finance', 'journal-entries', '9']);

    expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(nav.getByRole('link', { name: 'Journal Entries' })).toHaveAttribute('href', '/finance/journal-entries');
  });

  it('leaves a group prefix with no page of its own as plain text', () => {
    const nav = renderCrumbs(['finance', 'journal-entries', '9']);

    expect(nav.getByText('Finance')).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Finance' })).not.toBeInTheDocument();
  });

  it('marks the current page, and does not link it', () => {
    const nav = renderCrumbs(['finance', 'journal-entries', '9'], { 9: 'JE-0009' });

    const current = nav.getByText('JE-0009');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(nav.queryByRole('link', { name: 'JE-0009' })).not.toBeInTheDocument();
  });
});
