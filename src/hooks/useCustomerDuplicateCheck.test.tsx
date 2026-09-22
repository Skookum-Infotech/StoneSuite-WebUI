import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/services/crmService', () => ({
  crmService: { searchRecords: vi.fn(), getWorkflowStatuses: vi.fn(), transitionRecord: vi.fn() },
}));

import { useCustomerDuplicateCheck } from './useCustomerDuplicateCheck';
import { crmService } from '@/services/crmService';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function statusInfo(stateId: string, stateKey: string, statusLabel: string): StatusInfo {
  return {
    stateId, stateKey, statusLabel, workflowKey: 'customer', workflowName: 'Customer',
    isInitial: false, isTerminal: false, sortOrder: 0, color: '#000',
  };
}

const STATUSES: StatusInfo[] = [
  statusInfo('s-draft', 'CDRF', 'Draft'),
  statusInfo('s-active', 'CACT', 'Active'),
];

function record(id: string, name: string, currentStateId: string): WorkflowRecord {
  return {
    id, workflowId: 'wf-customer', currentStateId, coreFields: { customer_name: name },
    customFields: {}, createdAt: '', updatedAt: '',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({ workflow: { id: 'wf-customer', key: 'customer', name: 'Customer' } as never, statuses: STATUSES });
});

describe('useCustomerDuplicateCheck', () => {
  it('finds no duplicate for a name nothing matches', async () => {
    vi.mocked(crmService.searchRecords).mockResolvedValue({ records: [], nextCursor: '', hasMore: false, scope: '' });
    const onActivated = vi.fn();
    const { result } = renderHook(() => useCustomerDuplicateCheck({ onActivated }), { wrapper });

    let proceed: boolean | undefined;
    await act(async () => { proceed = await result.current.check('Brand New Co'); });

    expect(proceed).toBe(true);
    expect(result.current.duplicate).toBeNull();
  });

  it('flags an already-Active match and blocks creating', async () => {
    vi.mocked(crmService.searchRecords).mockResolvedValue({
      records: [record('c-1', 'Acme Corp', 's-active')], nextCursor: '', hasMore: false, scope: '',
    });
    const { result } = renderHook(() => useCustomerDuplicateCheck({ onActivated: vi.fn() }), { wrapper });

    let proceed: boolean | undefined;
    await act(async () => { proceed = await result.current.check('Acme Corp'); });

    expect(proceed).toBe(false);
    expect(result.current.duplicate).toMatchObject({ id: 'c-1', name: 'Acme Corp', status: 'active', statusLabel: 'Active' });
  });

  it('flags a Draft match as reactivatable, with the stateId to activate it', async () => {
    vi.mocked(crmService.searchRecords).mockResolvedValue({
      records: [record('c-2', 'Acme Corp', 's-draft')], nextCursor: '', hasMore: false, scope: '',
    });
    const { result } = renderHook(() => useCustomerDuplicateCheck({ onActivated: vi.fn() }), { wrapper });

    await act(async () => { await result.current.check('Acme Corp'); });

    expect(result.current.duplicate).toMatchObject({
      id: 'c-2', name: 'Acme Corp', status: 'reactivatable', statusLabel: 'Draft', activeStateId: 's-active',
    });
  });

  it('surfaces a search failure instead of silently allowing creation', async () => {
    vi.mocked(crmService.searchRecords).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCustomerDuplicateCheck({ onActivated: vi.fn() }), { wrapper });

    let proceed: boolean | undefined;
    await act(async () => { proceed = await result.current.check('Acme Corp'); });

    expect(proceed).toBe(false);
    expect(result.current.checkError).toBeTruthy();
  });

  it('activates the flagged duplicate and hands the updated record to onActivated', async () => {
    vi.mocked(crmService.searchRecords).mockResolvedValue({
      records: [record('c-2', 'Acme Corp', 's-draft')], nextCursor: '', hasMore: false, scope: '',
    });
    const activated = record('c-2', 'Acme Corp', 's-active');
    vi.mocked(crmService.transitionRecord).mockResolvedValue(activated);
    const onActivated = vi.fn();
    const { result } = renderHook(() => useCustomerDuplicateCheck({ onActivated }), { wrapper });

    await act(async () => { await result.current.check('Acme Corp'); });
    await act(async () => { result.current.activateDuplicate(); });

    await waitFor(() => expect(onActivated).toHaveBeenCalledWith(activated));
    expect(crmService.transitionRecord).toHaveBeenCalledWith('c-2', 's-active', 'customer');
    expect(result.current.duplicate).toBeNull();
  });
});
