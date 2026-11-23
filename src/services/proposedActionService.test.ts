import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('@/api/tenantClient', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return { ...actual, tenantClient: { get: vi.fn(), post: vi.fn() } };
});

import { proposedActionService } from './proposedActionService';
import { apiErrorMessage, tenantClient } from '@/api/tenantClient';
import { makeProposedAction } from '@/test/proposedActionFixtures';

const mockGet = vi.mocked(tenantClient.get);
const mockPost = vi.mocked(tenantClient.post);
const action = makeProposedAction();

beforeEach(() => vi.clearAllMocks());

describe('proposedActionService', () => {
  it('list: GET /tenant/actions with limit and cursor params', async () => {
    mockGet.mockResolvedValue({ data: { success: true, actions: [action], nextCursor: 'c2' } } as never);
    const res = await proposedActionService.list({ limit: 10, cursor: 'c1' });
    expect(mockGet).toHaveBeenCalledWith('/tenant/actions', { params: { limit: '10', cursor: 'c1' } });
    expect(res).toEqual({ actions: [action], nextCursor: 'c2' });
  });

  it('list: omits params and defaults missing fields', async () => {
    mockGet.mockResolvedValue({ data: { success: true } } as never);
    const res = await proposedActionService.list();
    expect(mockGet).toHaveBeenCalledWith('/tenant/actions', { params: {} });
    expect(res).toEqual({ actions: [], nextCursor: '' });
  });

  it('get: GET /tenant/actions/{id}', async () => {
    mockGet.mockResolvedValue({ data: { success: true, action } } as never);
    expect(await proposedActionService.get('pa-1')).toEqual(action);
    expect(mockGet).toHaveBeenCalledWith('/tenant/actions/pa-1');
  });

  it('confirm: POST /tenant/actions/{id}/confirm and returns replayed + message', async () => {
    mockPost.mockResolvedValue({ data: { success: true, action, replayed: true, message: 'ok' } } as never);
    const res = await proposedActionService.confirm('pa-1');
    expect(mockPost).toHaveBeenCalledWith('/tenant/actions/pa-1/confirm');
    expect(res).toEqual({ action, replayed: true, message: 'ok' });
  });

  it('cancel: POST /tenant/actions/{id}/cancel', async () => {
    mockPost.mockResolvedValue({ data: { success: true, action } } as never);
    expect(await proposedActionService.cancel('pa-1')).toEqual(action);
    expect(mockPost).toHaveBeenCalledWith('/tenant/actions/pa-1/cancel');
  });

  it('encodes ids in the path', async () => {
    mockGet.mockResolvedValue({ data: { success: true, action } } as never);
    await proposedActionService.get('a/b');
    expect(mockGet).toHaveBeenCalledWith('/tenant/actions/a%2Fb');
  });

  it.each([400, 403, 404, 409, 410, 422])('propagates a %i error with the server message', async (status) => {
    const err = new AxiosError('Request failed');
    err.response = { status, data: { success: false, message: `msg-${status}` } } as never;
    mockPost.mockRejectedValue(err);
    const caught = await proposedActionService.confirm('pa-1').catch((e: unknown) => e);
    expect(caught).toBe(err);
    expect((caught as AxiosError).response?.status).toBe(status);
    expect(apiErrorMessage(caught)).toBe(`msg-${status}`);
  });
});
