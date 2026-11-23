import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type * as React from 'react';

vi.mock('@/services/documentExtractionService', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/services/documentExtractionService')),
  documentExtractionService: { proposeEntity: vi.fn() },
}));
vi.mock('@/services/proposedActionService', () => ({
  proposedActionService: { list: vi.fn(), get: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/services/inventoryService', () => ({ inventoryService: { getItem: vi.fn() } }));
vi.mock('@/hooks/useItemUnitCode', () => ({ useItemUnitCode: () => () => 'EA' }));
vi.mock('@/pages/sales/components/InventoryItemPicker', () => ({
  InventoryItemPicker: () => <div>item picker</div>,
}));

import { ProposedEntityChips } from './ProposedEntityChips';
import { ReviewFieldsPanel } from './ReviewFieldsPanel';
import { DocumentLinesPanel } from './DocumentLinesPanel';
import { documentExtractionService } from '@/services/documentExtractionService';
import { proposedActionService } from '@/services/proposedActionService';
import { inventoryService } from '@/services/inventoryService';
import { makeProposedAction } from '@/test/proposedActionFixtures';
import { makeProposedEntity } from '@/test/proposedEntityFixtures';
import type { DocumentReviewView } from '@/hooks/documentReviewView';
import type { InventoryItem } from '@/types/inventory';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>,
  );
}

const pending = (resource: string) => makeProposedAction({ resource, source: 'docextract' });

beforeEach(() => vi.clearAllMocks());

describe('ProposedEntityChips', () => {
  it('renders nothing when the feature is off (no entities)', () => {
    const { container } = wrap(<ProposedEntityChips extractionId="e" entities={undefined} onCreated={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    wrap(<ProposedEntityChips extractionId="e" entities={[]} onCreated={vi.fn()} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps a Created note after the entity disappears from the extraction', async () => {
    const ref = { resource: 'vendor', recordId: 'v1', label: 'Acme' };
    vi.mocked(proposedActionService.confirm).mockResolvedValue({
      action: { ...pending('vendor'), status: 'confirmed', resultRef: ref }, replayed: false, message: '',
    });
    const entity = makeProposedEntity({ action: pending('vendor') });
    const { rerender } = wrap(<ProposedEntityChips extractionId="e" entities={[entity]} onCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await screen.findByText(/Created Acme/);
    rerender(
      <QueryClientProvider client={new QueryClient()}><MemoryRouter>
        <ProposedEntityChips extractionId="e" entities={[]} onCreated={vi.fn()} />
      </MemoryRouter></QueryClientProvider>,
    );
    expect(screen.getByText(/Created Acme/)).toBeInTheDocument();
  });
});

function makeReview(over: Partial<DocumentReviewView>): DocumentReviewView {
  return {
    docType: 'purchase_order',
    extractionId: 'ext-1',
    proposedEntities: [],
    formPartyId: undefined,
    party: { candidates: [], extractedText: 'Acme Stone' },
    handoff: { provenance: {}, lines: [], reviewItems: [] },
    lineItems: [],
    pending: [],
    reviewed: new Set<string>(),
    fieldValue: () => '',
    focusField: vi.fn(),
    showInDocument: vi.fn(),
    toggleReviewed: vi.fn(),
    pickParty: vi.fn(),
    updateLine: vi.fn(),
    calcLine: () => ({ amount: '0', total: '0' }),
    ...over,
  } as unknown as DocumentReviewView;
}

describe('ReviewFieldsPanel integration', () => {
  const fields = { order: ['vendor'], labels: { vendor: 'Vendor' }, partyKey: 'vendor', partySearchSelector: '#v' };

  it('creating a proposed vendor selects it in the form via pickParty', async () => {
    const review = makeReview({ proposedEntities: [makeProposedEntity()] });
    vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(pending('vendor'));
    vi.mocked(proposedActionService.confirm).mockResolvedValue({
      action: { ...pending('vendor'), status: 'confirmed', resultRef: { resource: 'vendor', recordId: 'v-7', label: 'Acme Stone' } },
      replayed: false, message: '',
    });
    wrap(<ReviewFieldsPanel review={review} fields={fields} />);
    await userEvent.click(screen.getByRole('button', { name: /Create vendor/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Confirm/ }));
    await screen.findByText(/Created Acme Stone/);
    expect(review.pickParty).toHaveBeenCalledWith({ id: 'v-7', name: 'Acme Stone' });
  });

  it('ignores item entities and renders no group without proposals', () => {
    wrap(<ReviewFieldsPanel review={makeReview({ proposedEntities: [makeProposedEntity({ kind: 'item', key: 'i' })] })} fields={fields} />);
    expect(screen.queryByRole('list', { name: 'Proposed new records' })).not.toBeInTheDocument();
  });
});

describe('DocumentLinesPanel integration', () => {
  const line = (id: string) => ({
    id, itemName: '', quantity: '2', unitPrice: '10', discount: '0', units: '', inventoryItemUuid: undefined,
  });
  const meta = (id: string, docIndex: number, lineNo: number) => ({
    id, docIndex, lineNo, docSku: '', docDescription: 'Slab', docText: 'Slab text', docAmount: null,
    docUom: '', docQty: 2, pills: [], requiresItem: true,
  });

  it('creating a proposed item selects it on the line (and other covered lines)', async () => {
    const item = { id: 'i-5', name: 'Slab Gold', sku: 'SG', unitPrice: 10, unitId: 1 } as unknown as InventoryItem;
    vi.mocked(inventoryService.getItem).mockResolvedValue(item);
    vi.mocked(documentExtractionService.proposeEntity).mockResolvedValue(pending('inventory_item'));
    vi.mocked(proposedActionService.confirm).mockResolvedValue({
      action: { ...pending('inventory_item'), status: 'confirmed', resultRef: { resource: 'inventory_item', recordId: 'i-5', label: 'Slab Gold' } },
      replayed: false, message: '',
    });
    const updateLine = vi.fn();
    const review = makeReview({
      updateLine,
      lineItems: [line('l1'), line('l2')],
      handoff: { provenance: {}, lines: [meta('l1', 2, 1), meta('l2', 0, 2)], reviewItems: [] } as never,
      proposedEntities: [makeProposedEntity({ kind: 'item', key: 'item:slab', name: 'Slab Gold', source: { field: 'lines', lines: [0, 2] } })],
    });
    wrap(<DocumentLinesPanel review={review} />);
    // Display order differs from docIndex: the chip anchors on docIndex 0, which
    // is the second displayed line (Line 2), not on the first row.
    const buttons = screen.getAllByRole('button', { name: /Create item/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('[data-review-row]')).toHaveAttribute('data-review-row', 'line:2');
    await userEvent.click(screen.getByRole('button', { name: /Create item/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Confirm/ }));
    await screen.findByText(/Created Slab Gold/);
    await vi.waitFor(() => expect(updateLine).toHaveBeenCalledTimes(2));
    expect(inventoryService.getItem).toHaveBeenCalledWith('i-5');
    expect(updateLine).toHaveBeenCalledWith('l1', expect.objectContaining({ inventoryItemUuid: 'i-5', itemName: 'Slab Gold' }));
    expect(updateLine).toHaveBeenCalledWith('l2', expect.objectContaining({ inventoryItemUuid: 'i-5', itemName: 'Slab Gold', units: 'EA' }));
  });

  it('an item covering only lines that have no form line is shown above the lines', () => {
    const review = makeReview({
      lineItems: [line('l1')],
      handoff: { provenance: {}, lines: [meta('l1', 0, 1)], reviewItems: [] } as never,
      proposedEntities: [makeProposedEntity({ kind: 'item', key: 'item:x', name: 'Orphan', source: { field: 'lines', lines: [7] } })],
    });
    wrap(<DocumentLinesPanel review={review} />);
    expect(screen.getByRole('button', { name: /Create item/ }).closest('[data-review-row]')).toBeNull();
  });

  it('shows no chips when there are no proposals', () => {
    const review = makeReview({
      lineItems: [line('l1')],
      handoff: { provenance: {}, lines: [meta('l1', 0, 1)], reviewItems: [] } as never,
    });
    wrap(<DocumentLinesPanel review={review} />);
    expect(screen.queryByRole('list', { name: 'Proposed new records' })).not.toBeInTheDocument();
  });
});
