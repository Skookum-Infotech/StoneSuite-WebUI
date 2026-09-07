import { describe, it, expect } from 'vitest';
import { resolveWorkflowEnabled } from './workflowEnabled';
import type { WorkflowStatus } from '@/types/tenant';

describe('resolveWorkflowEnabled', () => {
  it.each([
    ['explicit enabled: false blocks', [{ key: 'invoice', enabled: false }], 'invoice', false],
    ['explicit enabled: true passes', [{ key: 'invoice', enabled: true }], 'invoice', true],
    ['unknown key fails open', [{ key: 'invoice', enabled: false }], 'payment', true],
    ['empty list fails open', [], 'invoice', true],
    ['key match is case-insensitive', [{ key: 'Invoice', enabled: false }], 'invoice', false],
  ] satisfies [string, WorkflowStatus[], string, boolean][])(
    '%s',
    (_name, statuses, key, expected) => {
      expect(resolveWorkflowEnabled(statuses, key)).toBe(expected);
    },
  );
});
