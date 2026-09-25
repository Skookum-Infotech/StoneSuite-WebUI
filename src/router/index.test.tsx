import { describe, it, expect } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { router } from './index';
import { SUPPORT_PATH } from '@/lib/feedback';

describe('router', () => {
  // The sidebar link and the Help menu shortcut both point here; an
  // unregistered path would land them on the bare 404 route, outside the shell.
  it('registers the Support page inside the app shell', () => {
    const matches = matchRoutes(router.routes, SUPPORT_PATH);

    expect(matches?.map((match) => match.route.path)).toEqual(['/', 'support']);
  });
});
