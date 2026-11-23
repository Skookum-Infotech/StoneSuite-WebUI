import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { documentService } from './documentService';

describe('documentService.listSends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the record-keyed send history, including the email status fields', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        sends: [
          {
            id: 's1', recordId: 'rec-1', workflowKey: 'invoice', sentTo: 'a@acme.com', sentAt: '2026-10-01T12:00:00Z',
            emailStatus: 'bounced', emailStatusMessage: 'The recipient rejected this email.',
            emailRecipients: [{ email: 'a@acme.com', status: 'bounced' }],
          },
        ],
      },
    });

    const sends = await documentService.listSends('rec-1');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/records/rec-1/document/sends');
    expect(sends).toHaveLength(1);
    expect(sends[0].emailStatus).toBe('bounced');
    expect(sends[0].emailRecipients?.[0].email).toBe('a@acme.com');
  });

  it('returns an empty list when the backend sends null or omits the key', async () => {
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true, sends: null } });
    await expect(documentService.listSends('rec-1')).resolves.toEqual([]);

    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true } });
    await expect(documentService.listSends('rec-1')).resolves.toEqual([]);
  });
});
