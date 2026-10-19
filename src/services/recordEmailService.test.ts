import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { recordEmailService } from './recordEmailService';

beforeEach(() => vi.clearAllMocks());

describe('recordEmailService.list', () => {
  it('reads the record-keyed conversation and whether replies are captured', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, enabled: true, messages: [{ id: 'm1', direction: 'out', body: 'Hello' }] },
    });

    const thread = await recordEmailService.list('rec-1');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/records/rec-1/emails');
    expect(thread.enabled).toBe(true);
    expect(thread.messages).toHaveLength(1);
  });

  it('treats a missing or null message list as empty and a missing flag as disabled', async () => {
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true, messages: null } });
    await expect(recordEmailService.list('rec-1')).resolves.toEqual({ enabled: false, messages: [] });

    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true } });
    await expect(recordEmailService.list('rec-1')).resolves.toEqual({ enabled: false, messages: [] });
  });
});
