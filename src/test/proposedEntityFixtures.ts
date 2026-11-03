import type { ProposedEntityView } from '@/types/documentExtraction';

/** Builds a vendor ProposedEntityView fixture; override any field. */
export function makeProposedEntity(over: Partial<ProposedEntityView> = {}): ProposedEntityView {
  return {
    key: 'vendor:acme-stone',
    kind: 'vendor',
    name: 'Acme Stone',
    docType: 'purchase_order',
    fields: { address: '1 Quarry Rd', taxId: '12-3456789' },
    confidence: 'check',
    source: { field: 'vendorName', page: 1, row: 4 },
    unresolvedReason: 'no_match',
    canCreate: true,
    ...over,
  };
}
