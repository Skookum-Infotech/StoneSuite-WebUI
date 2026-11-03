import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/documentExtractionService', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService')),
  documentExtractionService: { proposeEntity: vi.fn() },
}));
vi.mock('@/services/proposedActionService', () => ({
  proposedActionService: { list: vi.fn(), get: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}));

import { ProposedEntityChip } from './ProposedEntityChip';
import { ExtractionApiError, documentExtractionService } from '@/services/documentExtractionService';
import { proposedActionService } from '@/services/proposedActionService';
import { makeProposedAction } from '@/test/proposedActionFixtures';
import { makeProposedEntity } from '@/test/proposedEntityFixtures';
import type { ProposedEntityView } from '@/types/documentExtraction';

function renderChip(entity: ProposedEntityView, onCreated = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ul>
          <ProposedEntityChip extractionId="ext-1" entity={entity} onCreated={onCreated} />
        </ul>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onCreated, spy };
}

const pending = (over = {}) => makeProposedAction({ resource: 'vendor', source: 'docextract', ...over });

beforeEach(() => vi.clearAllMocks());

describe('ProposedEntityChip', () => {
  it('shows kind, name, confidence word, fields and source as text', () => {
    renderChip(makeProposedEntity({ source: { field: 'vendorName', page: 2, row: 4 } }));
    expect(screen.getByText('vendor: Acme Stone')).toBeInTheDocument();
    expect(screen.getByText('Check this')).toBeInTheDocument();
    expect(screen.getByText('1 Quarry Rd')).toBeInTheDocument();
    expect(screen.getByText('12-3456789')).toBeInTheDocument();
    expect(screen.getByText('page 2, row 4')).toBeInTheDocument();
  });

  it('renders untrusted names as text, never markup', () => {
    renderChip(makeProposedEntity({ name: '<img src=x onerror=alert(1)>' }));
    expect(screen.getByText('vendor: <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('(a) canCreate=false: disabled with the server reason', () => {
    renderChip(makeProposedEntity({ canCreate: false, reason: 'Requires vendor create access' }));
    const btn = screen.getByRole('button', { name: /Create vendor/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Requires vendor create access');
  });

  it('(c) no action: Create proposes, shows busy, then embeds the confirm card', async () => {
    let resolve!: (v: never) => void;
    vi.mocked(documentExtractionService.proposeEntity).mockReturnValue(new Promise((r) => (resolve = r as never)));
    const { spy } = renderChip(makeProposedEntity());
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    expect(documentExtractionService.proposeEntity).toHaveBeenCalledWith('ext-1', 'vendor:acme-stone', undefined);
    await waitFor(() => expect(screen.getByRole('button', { name: /Working/ })).toBeDisabled());
    resolve(pending() as never);
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
    expect(spy).toHaveBeenCalledWith({ queryKey: ['document-extraction', 'ext-1'] });
  });

  it('(d) pending action: embedded card; confirm shows busy state', async () => {
    let resolve!: (v: never) => void;
    vi.mocked(proposedActionService.confirm).mockReturnValue(new Promise((r) => (resolve = r as never)));
    renderChip(makeProposedEntity({ action: pending() }));
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled());
    expect(screen.getAllByText('Working…').length).toBeGreaterThan(0);
    resolve({ action: pending({ status: 'cancelled' }), replayed: false, message: '' } as never);
  });

  it('(e) confirm creates the record: shows Created, calls onCreated with the ref, refetches', async () => {
    const ref = { resource: 'vendor', recordId: 'v-9', label: 'Acme Stone LLC' };
    vi.mocked(proposedActionService.confirm).mockResolvedValue({
      action: pending({ status: 'confirmed', resultRef: ref }), replayed: false, message: '',
    });
    const entity = makeProposedEntity({ action: pending() });
    const { onCreated, spy } = renderChip(entity);
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(await screen.findByText(/Created Acme Stone LLC/)).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledWith(entity, ref);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ queryKey: ['document-extraction', 'ext-1'] });
  });

  it('(e) an already confirmed action from the server shows Created without re-selecting', () => {
    const { onCreated } = renderChip(makeProposedEntity({
      action: pending({ status: 'confirmed', resultRef: { resource: 'vendor', recordId: 'v1', label: 'Acme' } }),
    }));
    expect(screen.getByText(/Created Acme/)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('(f) failed action: shows the may-already-exist message, no buttons', () => {
    renderChip(makeProposedEntity({ action: pending({ status: 'failed', errorMessage: 'dup' }) }));
    expect(screen.getByText(/Acme Stone.*could not be created — it may already exist/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('(f) a 422 on confirm refetches the extraction', async () => {
    const { AxiosError } = await import('axios');
    const ax = new AxiosError('bad');
    ax.response = { status: 422, data: { message: 'Duplicate' } } as never;
    vi.mocked(proposedActionService.confirm).mockRejectedValue(ax);
    const { spy } = renderChip(makeProposedEntity({ action: pending() }));
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['document-extraction', 'ext-1'] }));
  });

  it.each(['expired', 'cancelled'] as const)('(g) %s action: Propose again re-calls propose', async (status) => {
    vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(pending({ id: 'pa-2' }));
    renderChip(makeProposedEntity({ action: pending({ status }) }));
    expect(screen.getByText(new RegExp(`earlier proposal ${status === 'expired' ? 'expired' : 'was cancelled'}`))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Propose again/ }));
    expect(documentExtractionService.proposeEntity).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  it('(h) 404 on propose: no longer available, no buttons', async () => {
    vi.mocked(documentExtractionService.proposeEntity).mockRejectedValue(new ExtractionApiError(404, 'gone'));
    renderChip(makeProposedEntity());
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('(i) 403 on propose: disabled with the permission reason', async () => {
    vi.mocked(documentExtractionService.proposeEntity).mockRejectedValue(new ExtractionApiError(403, 'no'));
    renderChip(makeProposedEntity());
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Create vendor/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /Create vendor/ })).toHaveAccessibleDescription(/do not have permission/);
  });

  it('(i) 403 on confirm: confirm is disabled with the permission reason', async () => {
    const { AxiosError } = await import('axios');
    const ax = new AxiosError('forbidden');
    ax.response = { status: 403, data: { message: 'no' } } as never;
    vi.mocked(proposedActionService.confirm).mockRejectedValue(ax);
    renderChip(makeProposedEntity({ action: pending() }));
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /Confirm/ })).toHaveAccessibleDescription(/do not have permission/);
  });

  it('409 and 422 on propose show an inline alert and keep the form usable', async () => {
    vi.mocked(documentExtractionService.proposeEntity).mockRejectedValueOnce(new ExtractionApiError(409, 'used'));
    renderChip(makeProposedEntity());
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/can no longer be changed/);
    vi.mocked(documentExtractionService.proposeEntity).mockRejectedValueOnce(new ExtractionApiError(422, 'Email already used'));
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email already used'));
  });

  describe('needs input', () => {
    it('contactEmail: button disabled until a valid email, validation shown, value sent', async () => {
      vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(pending());
      renderChip(makeProposedEntity({ needs: ['contactEmail'] }));
      const btn = screen.getByRole('button', { name: /Create vendor/ });
      const input = screen.getByLabelText('Contact email');
      expect(btn).toBeDisabled();
      await userEvent.type(input, 'not-an-email');
      expect(btn).toBeDisabled();
      await userEvent.clear(input);
      await userEvent.type(input, ' buyer@acme.test ');
      expect(btn).toBeEnabled();
      await userEvent.click(btn);
      expect(documentExtractionService.proposeEntity).toHaveBeenCalledWith(
        'ext-1', 'vendor:acme-stone', { contactEmail: 'buyer@acme.test' },
      );
    });

    it('sku: prefilled from the document, must be non-empty, sent trimmed', async () => {
      vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(pending());
      renderChip(makeProposedEntity({ kind: 'item', key: 'item:1', name: 'Slab', needs: ['sku'], fields: { sku: 'SL-1' } }));
      const input = screen.getByLabelText('SKU');
      expect(input).toHaveValue('SL-1');
      await userEvent.clear(input);
      expect(screen.getByRole('button', { name: /Create item/ })).toBeDisabled();
      await userEvent.type(input, ' SL-2 ');
      await userEvent.click(screen.getByRole('button', { name: /Create item/ }));
      expect(documentExtractionService.proposeEntity).toHaveBeenCalledWith('ext-1', 'item:1', { sku: 'SL-2' });
    });

    it('inputs are disabled when the caller cannot create', () => {
      renderChip(makeProposedEntity({ needs: ['contactEmail'], canCreate: false, reason: 'nope' }));
      expect(screen.getByLabelText('Contact email')).toBeDisabled();
    });
  });
});
