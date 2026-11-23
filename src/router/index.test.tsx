import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { router } from './index';
import { SUPPORT_PATH } from '@/lib/feedback';

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
});
