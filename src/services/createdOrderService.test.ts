import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('@/api/tenantClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { createdOrderService, createOrderErrorMessage } from './createdOrderService';
import type { CreatedOrderInput } from '@/types/createdOrder';

const INPUT: CreatedOrderInput = {
  builder: 'Highland Homes',
  community: 'Sandbrock Ranch',
  plan: '214',
  phone: '+1 480 209 5330',
  email: 'brandon@highlandhomes.com',
  installAddress: '741 Bridle Path',
  city: 'Aubrey',
  zip: '76227',
  measureDate: '2026-10-10',
  installDate: '2026-10-20',
  specialInstructions: '',
  areas: [],
};

function httpError(status: number, message: string): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status, data: { success: false, message } } as AxiosError['response'];
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createdOrderService.list', () => {
  it('asks the portal endpoint for a page and returns it', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, orders: [{ id: 'o1' }], nextCursor: 'NEXT', hasMore: true },
    });

    const page = await createdOrderService.list('CUR', 10);

    expect(tenantClient.get).toHaveBeenCalledWith('/portal/created-orders', {
      params: { cursor: 'CUR', limit: 10 },
    });
    expect(page).toEqual({ orders: [{ id: 'o1' }], nextCursor: 'NEXT' });
  });

  it('sends no cursor for the first page and tolerates missing fields', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true } });

    const page = await createdOrderService.list();

    expect(tenantClient.get).toHaveBeenCalledWith('/portal/created-orders', {
      params: { cursor: undefined, limit: undefined },
    });
    expect(page).toEqual({ orders: [], nextCursor: '' });
  });

  it('no longer hides a missing endpoint as an empty list', async () => {
    vi.mocked(tenantClient.get).mockRejectedValue(httpError(404, 'Not found'));

    await expect(createdOrderService.list()).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('createdOrderService.create', () => {
  it('posts the order and returns the stored one', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: { success: true, order: { id: 'o1', status: 'submitted' } },
    });

    const order = await createdOrderService.create(INPUT);

    expect(tenantClient.post).toHaveBeenCalledWith('/portal/created-orders', INPUT);
    expect(order).toMatchObject({ id: 'o1', status: 'submitted' });
  });
});

describe('createdOrderService.update', () => {
  it('puts the whole order to its own url and returns the saved one', async () => {
    vi.mocked(tenantClient.put).mockResolvedValue({
      data: { success: true, order: { id: 'o 1', status: 'submitted', editable: true } },
    });

    const order = await createdOrderService.update('o 1', INPUT);

    expect(tenantClient.put).toHaveBeenCalledWith('/portal/created-orders/o%201', INPUT);
    expect(order).toMatchObject({ id: 'o 1', editable: true });
  });

  it('lets a refusal from the server through untouched', async () => {
    vi.mocked(tenantClient.put).mockRejectedValue(httpError(409, 'This order is now being processed.'));

    await expect(createdOrderService.update('o1', INPUT)).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('createOrderErrorMessage', () => {
  it.each([
    ['a validation message', httpError(400, 'Builder is required.'), 'Builder is required.'],
    ['an account on hold', httpError(409, "Your account can't place new orders right now."), "Your account can't place new orders right now."],
  ])('shows the server\'s words for %s', (_label, err, expected) => {
    expect(createOrderErrorMessage(err)).toBe(expected);
  });

  it('falls back to a retry hint for something that is not an Error', () => {
    expect(createOrderErrorMessage('boom')).toBe('We could not submit your order. Please try again.');
  });

  it('words the fallback for a change as saving, not submitting', () => {
    expect(createOrderErrorMessage('boom', true)).toBe('We could not save your changes. Please try again.');
  });
});
