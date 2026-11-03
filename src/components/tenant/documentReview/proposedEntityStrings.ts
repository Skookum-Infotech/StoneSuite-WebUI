// All user-visible copy for the proposed-record chips (no i18n library in the repo).
import type { FieldConfidence, ProposedEntityKind } from '@/types/documentExtraction';

export const KIND_LABEL: Record<ProposedEntityKind, string> = {
  customer: 'customer',
  vendor: 'vendor',
  item: 'item',
};

export const CONFIDENCE_LABEL: Record<FieldConfidence, string> = {
  high: 'High confidence',
  check: 'Check this',
  not_found: 'Not found',
};

export const PROPOSED_ENTITY_STRINGS = {
  groupLabel: 'Proposed new records',
  create: 'Create',
  proposeAgain: 'Propose again',
  working: 'Working…',
  createdPrefix: 'Created',
  emailLabel: 'Contact email',
  emailInvalid: 'Enter a valid email address.',
  skuLabel: 'SKU',
  skuInvalid: 'Enter a SKU.',
  failed: 'could not be created — it may already exist',
  unavailable: 'This proposed record is no longer available.',
  noPermission: 'You do not have permission to create this record.',
  notReady: 'The document can no longer be changed, so this record cannot be created.',
  genericError: 'Could not propose this record. Please try again.',
  expiredNote: 'The earlier proposal expired.',
  cancelledNote: 'The earlier proposal was cancelled.',
  address: 'Address',
  taxId: 'Tax ID',
  sku: 'SKU',
  description: 'Description',
  uom: 'Unit',
  unitPrice: 'Unit price',
  page: 'page',
  row: 'row',
} as const;
