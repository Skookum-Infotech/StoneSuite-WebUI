import { describe, it, expect } from 'vitest';

import { assertNotifyBaseUrl, assertSameOriginApiBase } from '../../vite.config';

// assertSameOriginApiBase guards the build against an accidental cross-origin
// API base (see vite.config.ts for why that silently breaks CSRF/cookie
// auth). VITE_CROSS_ORIGIN_API=true is the escape hatch for the Azure dev
// pipeline, which intentionally calls dev-stonesuite-api.fly.dev directly.
describe('assertSameOriginApiBase', () => {
  const cases: {
    name: string;
    apiBaseUrl: string | undefined;
    crossOriginOptIn: boolean;
    expectThrow: boolean;
  }[] = [
    { name: 'relative path, no opt-in: passes', apiBaseUrl: '/api', crossOriginOptIn: false, expectThrow: false },
    { name: 'unset, no opt-in: passes', apiBaseUrl: undefined, crossOriginOptIn: false, expectThrow: false },
    {
      name: 'absolute https URL, no opt-in: throws',
      apiBaseUrl: 'https://dev-stonesuite-api.fly.dev/api',
      crossOriginOptIn: false,
      expectThrow: true,
    },
    {
      name: 'protocol-relative URL, no opt-in: throws',
      apiBaseUrl: '//dev-stonesuite-api.fly.dev/api',
      crossOriginOptIn: false,
      expectThrow: true,
    },
    {
      name: 'absolute https URL, opt-in: passes',
      apiBaseUrl: 'https://dev-stonesuite-api.fly.dev/api',
      crossOriginOptIn: true,
      expectThrow: false,
    },
    {
      name: 'relative path, opt-in: throws (opt-in with nothing cross-origin to opt into)',
      apiBaseUrl: '/api',
      crossOriginOptIn: true,
      expectThrow: true,
    },
    {
      name: 'unset, opt-in: throws',
      apiBaseUrl: undefined,
      crossOriginOptIn: true,
      expectThrow: true,
    },
    {
      name: 'malformed URL, opt-in: throws',
      apiBaseUrl: 'not-a-url',
      crossOriginOptIn: true,
      expectThrow: true,
    },
    {
      name: 'non-https absolute URL, opt-in: throws',
      apiBaseUrl: 'http://dev-stonesuite-api.fly.dev/api',
      crossOriginOptIn: true,
      expectThrow: true,
    },
  ];

  for (const { name, apiBaseUrl, crossOriginOptIn, expectThrow } of cases) {
    it(name, () => {
      const run = () => assertSameOriginApiBase(apiBaseUrl, crossOriginOptIn);
      if (expectThrow) {
        expect(run).toThrow();
      } else {
        expect(run).not.toThrow();
      }
    });
  }
});

// assertNotifyBaseUrl guards the build against a missing or same-origin
// VITE_NOTIFY_BASE_URL. stonesuite-notify is always a separate origin, so an
// unset value leaves notifyClient's baseURL undefined, axios falls back to
// relative URLs, and every /api/notifications/* call lands on the app's own
// host (Cloudflare Pages) — where the Pages Function proxies it to the main
// backend, which has no such routes. That failed silently until this guard.
// http:// is allowed only for loopback so `npm run ci` still works against the
// local notify service in .env.example.
describe('assertNotifyBaseUrl', () => {
  const cases: { name: string; notifyBaseUrl: string | undefined; expectThrow: boolean }[] = [
    { name: 'absolute https URL: passes', notifyBaseUrl: 'https://stonesuite-notify.fly.dev', expectThrow: false },
    {
      name: 'absolute https URL with path: passes',
      notifyBaseUrl: 'https://dev-stonesuite-notify.fly.dev/',
      expectThrow: false,
    },
    { name: 'http loopback host: passes', notifyBaseUrl: 'http://localhost:8090', expectThrow: false },
    { name: 'http 127.0.0.1: passes', notifyBaseUrl: 'http://127.0.0.1:8090', expectThrow: false },
    { name: 'unset: throws', notifyBaseUrl: undefined, expectThrow: true },
    { name: 'empty string: throws', notifyBaseUrl: '', expectThrow: true },
    { name: 'whitespace only: throws', notifyBaseUrl: '   ', expectThrow: true },
    { name: 'relative path: throws (this is the same-origin bug)', notifyBaseUrl: '/api', expectThrow: true },
    { name: 'protocol-relative URL: throws', notifyBaseUrl: '//stonesuite-notify.fly.dev', expectThrow: true },
    {
      name: 'non-loopback http URL: throws',
      notifyBaseUrl: 'http://dev-stonesuite-notify.fly.dev',
      expectThrow: true,
    },
    { name: 'malformed URL: throws', notifyBaseUrl: 'not-a-url', expectThrow: true },
  ];

  for (const { name, notifyBaseUrl, expectThrow } of cases) {
    it(name, () => {
      const run = () => assertNotifyBaseUrl(notifyBaseUrl);
      if (expectThrow) {
        expect(run).toThrow();
      } else {
        expect(run).not.toThrow();
      }
    });
  }
});
