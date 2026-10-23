import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { recordEmailService } from './recordEmailService';

const pdf = (name = 'plan.pdf') => new File(['%PDF-1.7'], name, { type: 'application/pdf' });

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
    const empty = { enabled: false, attachmentsEnabled: false, replyTo: '', messages: [] };
    await expect(recordEmailService.list('rec-1')).resolves.toEqual(empty);

    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true } });
    await expect(recordEmailService.list('rec-1')).resolves.toEqual(empty);
  });

  it('reads whether files can be attached, and gives every message a list of files', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true, enabled: true, attachmentsEnabled: true, replyTo: 'p@x.com',
        messages: [
          { id: 'm1', direction: 'in', body: 'See attached', attachmentCount: 1, attachments: [{ id: 'a1', fileName: 'plan.pdf', status: 'stored' }] },
          { id: 'm2', direction: 'out', body: 'Thanks', attachmentCount: 0 },
          { id: 'm3', direction: 'out', body: 'Later', attachments: null },
        ],
      },
    });

    const thread = await recordEmailService.list('rec-1');

    expect(thread.attachmentsEnabled).toBe(true);
    expect(thread.messages[0].attachments).toEqual([{ id: 'a1', fileName: 'plan.pdf', status: 'stored' }]);
    expect(thread.messages[1].attachments).toEqual([]);
    expect(thread.messages[2].attachments).toEqual([]);
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

  it('keeps the plain JSON request when there are no files, even with an empty list', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });

    await recordEmailService.reply('rec-1', { message: 'Hi', internalOnly: false, files: [] });

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/records/rec-1/emails', { message: 'Hi', internalOnly: false });
  });

  it('sends files as multipart form data, overriding the JSON content type', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, emailSent: true } });

    const result = await recordEmailService.reply('rec-1', {
      message: 'See attached', internalOnly: false, files: [pdf('a.pdf'), pdf('b.pdf')],
    });

    expect(tenantClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(tenantClient.post).mock.calls[0];
    expect(url).toBe('/tenant/records/rec-1/emails');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('message')).toBe('See attached');
    expect(form.get('internalOnly')).toBe('false');
    expect(form.getAll('files').map((f) => (f as File).name)).toEqual(['a.pdf', 'b.pdf']);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(result).toEqual({ emailSent: true, emailError: undefined });
  });

  it('sends a note with files the same way, with the flag set', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });

    await recordEmailService.reply('rec-1', { message: 'Site photo', internalOnly: true, files: [pdf('site.pdf')] });

    const form = vi.mocked(tenantClient.post).mock.calls[0][1] as FormData;
    expect(form.get('internalOnly')).toBe('true');
    expect(form.getAll('files')).toHaveLength(1);
  });
});

describe('recordEmailService.downloadAttachment', () => {
  it("asks for a link to one file of the record's conversation", async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, downloadUrl: 'https://files.test/x?sig=1', fileName: 'plan.pdf', expiresIn: 60 },
    });

    const result = await recordEmailService.downloadAttachment('rec-1', 'att-9');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/records/rec-1/emails/attachments/att-9/download');
    expect(result).toEqual({ downloadUrl: 'https://files.test/x?sig=1', fileName: 'plan.pdf' });
  });
});
