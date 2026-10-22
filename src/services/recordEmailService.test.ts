import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { recordEmailService } from './recordEmailService';

beforeEach(() => vi.clearAllMocks());

describe('recordEmailService.list', () => {
  it('reads the record-keyed conversation, whether replies are captured and who a reply goes to', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true, enabled: true, replyTo: 'priya@gmail.com',
        messages: [{ id: 'm1', direction: 'out', body: 'Hello' }],
      },
    });

    const thread = await recordEmailService.list('rec-1');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/records/rec-1/emails');
    expect(thread.enabled).toBe(true);
    expect(thread.replyTo).toBe('priya@gmail.com');
    expect(thread.messages).toHaveLength(1);
  });

  it('treats a missing or null message list as empty and a missing flag as disabled', async () => {
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true, messages: null } });
    await expect(recordEmailService.list('rec-1')).resolves.toEqual({ enabled: false, replyTo: '', messages: [] });

    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true } });
    await expect(recordEmailService.list('rec-1')).resolves.toEqual({ enabled: false, replyTo: '', messages: [] });
  });
});

describe('recordEmailService.reply', () => {
  it('posts an emailed reply to the record-keyed route and reports the delivery outcome', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, emailSent: false, emailError: 'Bounced.' } });

    const result = await recordEmailService.reply('rec-1', { message: 'On our way', internalOnly: false });

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/records/rec-1/emails', {
      message: 'On our way', internalOnly: false,
    });
    expect(result).toEqual({ emailSent: false, emailError: 'Bounced.' });
  });

  it('posts an internal note with the flag set, which sends nothing and so reports no outcome', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });

    const result = await recordEmailService.reply('rec-1', { message: 'Called the customer', internalOnly: true });

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/records/rec-1/emails', {
      message: 'Called the customer', internalOnly: true,
    });
    expect(result).toEqual({ emailSent: undefined, emailError: undefined });
  });
});
