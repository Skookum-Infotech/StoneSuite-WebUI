import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadServerDocPdf } from './serverDocPdf';
import { tenantClient } from '@/api/tenantClient';

vi.mock('@/api/tenantClient', () => ({ tenantClient: { get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

describe('downloadServerDocPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('requests the server-rendered PDF for the record and saves it under the document name', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: new Blob(['%PDF']) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadServerDocPdf({ recordId: 'rec 1', docType: 'invoice', recordNumber: 'INV-7' });
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/records/rec%201/document/pdf', { responseType: 'blob' });
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('propagates a failed request so the page can show its error', async () => {
    vi.mocked(tenantClient.get).mockRejectedValue(new Error('boom'));
    await expect(downloadServerDocPdf({ recordId: 'r', docType: 'quote', recordNumber: 'Q-1' })).rejects.toThrow('boom');
  });
});
