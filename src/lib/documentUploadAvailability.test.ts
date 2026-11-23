import { describe, expect, it } from 'vitest';
import { uploadDisabledReason } from './documentUploadAvailability';

const on = { platformEnabled: true, tenantEnabled: true, available: true, documentExtraction: true };

describe('uploadDisabledReason', () => {
  it.each([
    ['loading', undefined, true, false, undefined],
    ['status request failed', undefined, false, true, /Couldn't check/],
    ['platform switch off (the E2E case: tenant on, platform off)', { ...on, platformEnabled: false, available: false }, false, false, /for the platform/],
    ['workspace switch off', { ...on, tenantEnabled: false, available: false }, false, false, /for your workspace/],
    ['assistant unavailable', { ...on, available: false }, false, false, /unavailable right now/],
    ['rollout flag off', { ...on, documentExtraction: false }, false, false, /isn't enabled/],
    ['everything on', on, false, false, ''],
  ])('%s', (_n, status, loading, failed, want) => {
    const got = uploadDisabledReason(status, loading, failed);
    if (want instanceof RegExp) expect(got).toMatch(want);
    else expect(got).toBe(want);
  });
});
