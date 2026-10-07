import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { invoiceService } from './invoiceService';

const post = vi.mocked(tenantClient.post);

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ data: { success: true, invoice: { id: 'inv-1' } } });
});

// A recorded payment carries an Idempotency-Key header so a retry cannot book it twice.
describe('invoiceService.recordPayment request contract', () => {
  it('sends the Idempotency-Key header when a key is given', async () => {
    await invoiceService.recordPayment('inv-1', 25, 'key-1');
    expect(post).toHaveBeenCalledWith('/tenant/invoices/inv-1/payment', { amount: 25 }, {
      headers: { 'Idempotency-Key': 'key-1' },
    });
  });

  it('sends no extra headers without a key', async () => {
    await invoiceService.recordPayment('inv-1', 25);
    expect(post).toHaveBeenCalledWith('/tenant/invoices/inv-1/payment', { amount: 25 }, undefined);
  });
});
