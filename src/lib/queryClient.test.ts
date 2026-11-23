import { afterEach, describe, expect, it } from 'vitest';
import { queryClient, WORKFLOW_DETAIL_QUERY_KEYS } from './queryClient';

describe('queryClient workflow refresh', () => {
  afterEach(() => queryClient.clear());

  it('marks cached workflow records stale after any successful mutation, and leaves other queries alone', async () => {
    queryClient.setQueryData(['sales-order', 'so-1'], { id: 'so-1' });
    queryClient.setQueryData(['invoice', 'inv-1'], { id: 'inv-1' });
    queryClient.setQueryData(['crm-lookups'], {});

    await queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'ok' }).execute(undefined);

    expect(queryClient.getQueryState(['sales-order', 'so-1'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['invoice', 'inv-1'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['crm-lookups'])?.isInvalidated).toBe(false);
  });

  it('covers every detail page that shows the card', () => {
    ['quote', 'sales-order', 'fabrication-job', 'invoice', 'payment', 'refund', 'requisition', 'purchase-order', 'item-receipt', 'vendor-bill', 'vendor-payment']
      .forEach((key) => expect(WORKFLOW_DETAIL_QUERY_KEYS.has(key)).toBe(true));
  });
});
