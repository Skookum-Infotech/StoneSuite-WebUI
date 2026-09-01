import { describe, it, expect } from 'vitest';

import { assertSameOriginApiBase } from '../../vite.config';

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
