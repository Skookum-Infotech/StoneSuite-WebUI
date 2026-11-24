import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { router } from './index';
import { SUPPORT_PATH } from '@/lib/feedback';
import { sidebarNav } from '@/config/sidebarNav';
import { CUSTOMER_ALLOWED_PATH_PREFIXES } from '@/config/customerPortal';

const MODULE_PREFIXES = ['/sales/', '/purchases/', '/inventory/'];
const NOT_FOUND_PATH = '*';

/** Every string `path` value anywhere in the sidebar config, however deeply nested. */
function collectPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectPaths);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'path' && typeof child === 'string' ? [child] : collectPaths(child),
  );
}

/** Module URLs the app links to: the sidebar plus the customer-portal allowlist. */
const MODULE_LINKS = [...new Set([...collectPaths(sidebarNav), ...CUSTOMER_ALLOWED_PATH_PREFIXES])]
  .filter((path) => MODULE_PREFIXES.some((prefix) => path.startsWith(prefix)))
  .sort();

/** The deepest route a URL resolves to, or undefined when nothing matches. */
function leafPath(url: string): string | undefined {
  const matches = matchRoutes(router.routes, url);
  return matches?.[matches.length - 1]?.route.path;
}

describe('router', () => {
  // The sidebar link and the Help menu shortcut both point here; an
  // unregistered path would land them on the bare 404 route, outside the shell.
  it('registers the Support page inside the app shell', () => {
    const matches = matchRoutes(router.routes, SUPPORT_PATH);

    // Pathless layout routes (the error-boundary wrapper inside the shell) have
    // no `path`, so they are not part of what this asserts.
    const paths = matches?.map((match) => match.route.path).filter(Boolean);
    expect(paths).toEqual(['/', 'support']);
  });

  it('registers Configure > Automation inside the app shell', () => {
    const matches = matchRoutes(router.routes, '/config/automation');
    const paths = matches?.map((match) => match.route.path).filter(Boolean);
    expect(paths).toEqual(['/', 'config/automation']);
  });

  // The backend's portal emails link to <app>/portal; it must land somewhere real
  // (inside the shell, so signed-out visitors are sent to sign in first).
  it('registers /portal inside the app shell', () => {
    const matches = matchRoutes(router.routes, '/portal');
    const paths = matches?.map((match) => match.route.path).filter(Boolean);
    expect(paths).toEqual(['/', 'portal']);
  });

  // These module routes were once "coming soon" placeholders behind a :moduleKey
  // param. Every module has its own page now, so a mistyped one must be a real
  // 404, not a silent redirect to the dashboard.
  it.each(['/sales/not-a-module', '/purchases/not-a-module', '/inventory/not-a-module'])(
    'does not treat %s as a placeholder module',
    (path) => {
      const matches = matchRoutes(router.routes, path);
      const paths = matches?.map((match) => match.route.path).filter(Boolean);
      expect(paths).toEqual(['*']);
    },
  );

  it.each(['/sales/quote', '/sales/invoice', '/purchases/vendor_bill', '/inventory/count'])(
    'still registers the real module page %s',
    (path) => {
      const matches = matchRoutes(router.routes, path);
      const paths = matches?.map((match) => match.route.path).filter(Boolean);
      expect(paths).toEqual(['/', path.slice(1)]);
    },
  );

  it('registers the Approvals inbox inside the app shell', () => {
    const matches = matchRoutes(router.routes, '/approvals');
    const paths = matches?.map((match) => match.route.path).filter(Boolean);
    expect(paths).toEqual(['/', 'approvals']);
  });

  // The old "Coming Soon" wildcards (sales/:moduleKey and friends) were dead:
  // every module link already had its own route. This keeps it that way — a
  // link that lost its route would otherwise fall into a wildcard, or the 404.
  it('has a module link to check', () => {
    expect(MODULE_LINKS.length).toBeGreaterThan(20);
  });

  it.each(MODULE_LINKS)('opens a real page for %s, not a wildcard', (link) => {
    const leaf = leafPath(link);
    expect(leaf).toBe(link.slice(1));
    expect(leaf).not.toContain(':');
    expect(leaf).not.toBe(NOT_FOUND_PATH);
  });

  it.each(['/sales/nope', '/purchases/nope', '/inventory/nope', '/sales/estimate/nope/nope'])(
    'shows the not-found page for the unknown URL %s',
    (url) => {
      expect(leafPath(url)).toBe(NOT_FOUND_PATH);
    },
  );
});
