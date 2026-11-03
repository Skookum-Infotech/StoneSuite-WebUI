import type { ProposedAction } from '@/types/proposedAction';

/** Builds a pending ProposedAction fixture; override any field. */
export function makeProposedAction(over: Partial<ProposedAction> = {}): ProposedAction {
  return {
    id: 'pa-1',
    kind: 'create',
    resource: 'customer',
    preview: {
      title: 'Create customer Acme',
      summary: 'Adds a new customer record',
      fields: [
        { label: 'Name', value: 'Acme' },
        { label: 'Email', value: 'a@acme.test' },
      ],
    },
    source: 'agent',
    status: 'pending',
    expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...over,
  };
}
