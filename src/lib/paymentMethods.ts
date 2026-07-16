// Frontend-only constant for lkp_payment_method — the backend has no lookup
// endpoint for payment methods yet (/tenant/crm/lookups doesn't include
// them, and there's no dedicated route). Coupled to the seed order in
// StoneSuite-Backend's database/migrations/tenant/schema.sql
// (lkp_payment_method INSERT block, spec §5.1 of
// docs/superpowers/specs/2026-07-13-payments-module-design.md). If a tenant
// ever needs custom/reordered methods, this becomes a real backend lookup —
// see AD-1 of docs/superpowers/specs/2026-07-15-payment-module-integration-design.md.
export interface PaymentMethodOption {
  id: number;
  code: string;
  name: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 1, code: 'CHK_', name: 'Check' },
  { id: 2, code: 'CASH', name: 'Cash' },
  { id: 3, code: 'CC__', name: 'Credit Card' },
  { id: 4, code: 'ACH_', name: 'ACH' },
  { id: 5, code: 'WIRE', name: 'Wire' },
  { id: 6, code: 'OTHR', name: 'Other' },
];
