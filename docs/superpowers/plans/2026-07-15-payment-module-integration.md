# Payment Module Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire the existing Payments frontend (list/create scaffold posting through the generic JSONB CRM router) onto the real dedicated backend Payment module at `/api/tenant/payments*`, and build the missing detail/edit/apply/unapply/audit UI, mirroring the Invoice module's frontend pattern file-for-file.

**Architecture:** New `types/payment.ts` + `services/paymentService.ts` wrap the backend contract exactly (see `docs/superpowers/specs/2026-07-13-payments-module-design.md` in StoneSuite-Backend). `lib/paymentMethods.ts` + `lib/paymentForm.ts` hold the frontend-only method constant and pure field/payload mapping logic (unit tested). Page components (`PaymentTable`, `AddPaymentPage`, `PaymentDetailPage`, `EditPaymentPage`) and small shared components (`InvoicePicker`, `PaymentFormFields`, `PaymentStatusControl`, `PaymentAuditTab`, `DeletePaymentDialog`) mirror their exact Invoice-module counterparts.

**Tech Stack:** React + TypeScript, TanStack React Query, React Router v7, Tailwind, Vitest. No new dependencies.

## Global Constraints

- No `@typescript-eslint/no-explicit-any` — type everything properly.
- Styling: Tailwind `className=` only. No inline `style={}` except the existing hex-color-driven `style={{backgroundColor:...}}` pattern already used for status badges (matches `InvoiceTable`/`InvoiceDetailPage`).
- Exports: named everywhere except page-level route components (default export).
- All API calls go through `services/*Service.ts`. Never direct `fetch()`/`axios.*()` in pages.
- Async data fetching: TanStack React Query only — no bare `useEffect` for fetches.
- Never mutate state directly — always return new objects/arrays.
- Never show a raw record UUID in the UI breadcrumb — call `useBreadcrumbStore().setLabel(id, humanLabel)` in a `useEffect` once the record loads, and `clearLabel(id)` on cleanup.
- No magic strings/numbers beyond 1 — status codes, field keys etc. are named constants.
- Errors are wrapped with context via `apiErrorMessage(err, fallback)`, never swallowed.
- New pure functions get table-driven Vitest tests; page/component-level UI is not unit tested (matches the existing Invoice/Sales Order convention in this codebase).
- Commits: Conventional Commits (`feat:`, `fix:`, etc.), specific to the affected component.

---

## Task 1: Payment types & service layer

**Files:**
- Create: `src/types/payment.ts`
- Create: `src/services/paymentService.ts`

**Interfaces:**
- Produces: `Payment`, `PaymentSummary`, `PaymentCustomerRef`, `PaymentApplication`, `ApplicationInput`, `PaymentCreatePayload`, `PaymentUpdatePayload`, `PaymentSearchRequest`, `PaymentPage` (all from `src/types/payment.ts`); `paymentService.{searchPayments, getPayment, createPayment, updatePayment, deletePayment, transition, apply, unapply, getAudit}` (from `src/services/paymentService.ts`). Every later task imports from these two files.

- [ ] **Step 1: Write `src/types/payment.ts`**

```ts
// Payment module — frontend contract types.
//
// Mirrors the dedicated relational Payment backend module
// (StoneSuite-Backend/payment/*.go,
// docs/superpowers/specs/2026-07-13-payments-module-design.md). Payment is a
// sibling of Invoice — a money ledger with cross-invoice application — served
// from /api/tenant/payments*, distinct from the generic WorkflowRecord JSONB
// CRM router.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

export interface ApplicationInput {
  invoiceUuid: string;
  amount: number;
}

export interface PaymentCreatePayload {
  customerUuid: string;
  methodId: number;
  referenceNumber?: string;
  paymentDate?: string;        // RFC3339 timestamp string — see lib/paymentForm.ts's date-handling note
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  amount: number;
  memo?: string;
  internalNotes?: string;
  customFields?: Record<string, unknown>;
  applications?: ApplicationInput[];
}

/** Update mirrors create minus customerUuid/amount/applications — a
 *  payment's customer and amount are fixed after creation (backend AD-10:
 *  amount is immutable), and applications are managed through /apply and
 *  /unapply, not PATCH. */
export type PaymentUpdatePayload = Omit<
  PaymentCreatePayload,
  'customerUuid' | 'amount' | 'applications'
>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface PaymentCustomerRef {
  id: string;
  name: string;
}

export interface PaymentApplication {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  status: string;              // human label, e.g. "Pending"
  statusCode: string;          // lkp_record_status code, e.g. "PEND" — drives transitions
  customer: PaymentCustomerRef;
  ownerEmployeeId?: number | null;
  methodId: number;
  method: string;
  referenceNumber: string;
  paymentDate: string;
  currencyId?: number | null;
  memo: string;
  internalNotes: string;
  amount: number;
  appliedTotal: number;
  unappliedAmount: number;
  customFields?: Record<string, unknown>;
  applications: PaymentApplication[];
  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `Payment` records server-side — this type only
 *  names the subset the table actually renders. */
export type PaymentSummary = Pick<
  Payment,
  | 'id' | 'paymentNumber' | 'status' | 'statusCode' | 'customer'
  | 'paymentDate' | 'amount' | 'unappliedAmount' | 'createdAt' | 'updatedAt'
>;

export interface PaymentSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface PaymentPage {
  records: PaymentSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
```

- [ ] **Step 2: Write `src/services/paymentService.ts`**

```ts
import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Payment,
  PaymentCreatePayload,
  PaymentUpdatePayload,
  PaymentSearchRequest,
  PaymentPage,
} from '@/types/payment';

// Payment API wrapper. Talks to the dedicated relational module under
// `/api/tenant/payments*` (NOT the generic `/api/tenant/crm/*` JSONB
// router). Every call carries the tenant Bearer JWT via `tenantClient`; the
// server enforces tenancy, RBAC (`payment:*`), scope, and IDOR.
const BASE = '/tenant/payments';

export const paymentService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchPayments: (req: PaymentSearchRequest): Promise<PaymentPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: PaymentPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getPayment: (uuid: string): Promise<Payment> =>
    tenantClient
      .get<{ success: boolean; payment: Payment }>(`${BASE}/${uuid}`)
      .then((r) => r.data.payment),

  createPayment: (payload: PaymentCreatePayload): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(BASE, payload)
      .then((r) => r.data.payment),

  updatePayment: (uuid: string, payload: PaymentUpdatePayload): Promise<Payment> =>
    tenantClient
      .patch<{ success: boolean; payment: Payment }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.payment),

  deletePayment: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.payment),

  // Applies part of the payment's unapplied balance to an invoice. Rejected
  // (400) if amount exceeds min(unappliedAmount, invoice.balanceDue); never
  // silently clamped.
  apply: (uuid: string, invoiceUuid: string, amount: number): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/apply`,
        { invoiceUuid, amount },
      )
      .then((r) => r.data.payment),

  unapply: (uuid: string, invoiceUuid: string): Promise<Payment> =>
    tenantClient
      .post<{ success: boolean; payment: Payment }>(
        `${BASE}/${uuid}/unapply`,
        { invoiceUuid },
      )
      .then((r) => r.data.payment),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `src/types/payment.ts` or `src/services/paymentService.ts`. (Pre-existing unrelated errors, if any, are not this task's concern.)

- [ ] **Step 4: Commit**

```bash
git add src/types/payment.ts src/services/paymentService.ts
git commit -m "feat: add payment module types and service layer"
```

---

## Task 2: Payment method constant & form field/payload mapping library

**Files:**
- Create: `src/lib/paymentMethods.ts`
- Create: `src/lib/paymentForm.ts`
- Test: `src/lib/paymentForm.test.ts`

**Interfaces:**
- Consumes: `Payment`, `PaymentCreatePayload`, `PaymentUpdatePayload` from `src/types/payment.ts` (Task 1); `CrmLookups` from `src/services/lookupService.ts`.
- Produces: `PAYMENT_METHODS: {id,code,name}[]` (`paymentMethods.ts`); `PaymentFormField` type, `PRIMARY_INFO_FIELDS`, `EDIT_FIELDS`, `PAGE_TABS`/`PageTab`, `PAYMENT_STATUS_CODES`, `PAYMENT_STATUS_COLORS`, `PAYMENT_ALLOWED_TRANSITIONS: Record<string,string[]>`, `PAYMENT_BLOCKS_APPLY: Set<string>`, `paymentDefaults()`, `toRFC3339OrUndefined(dateStr:string): string|undefined`, `fromRFC3339DateOnly(iso?:string): string`, `toCreatePayload(data, customerUuid): Omit<PaymentCreatePayload,'applications'>`, `toUpdatePayload(data): PaymentUpdatePayload`, `fromPayment(payment): {data, customer}` (all from `paymentForm.ts`). Tasks 3, 5–10 import from both files.

- [ ] **Step 1: Write `src/lib/paymentMethods.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test file `src/lib/paymentForm.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  toCreatePayload, toUpdatePayload, fromPayment, toRFC3339OrUndefined, fromRFC3339DateOnly,
  PAYMENT_ALLOWED_TRANSITIONS,
} from './paymentForm'
import type { Payment } from '@/types/payment'

describe('toRFC3339OrUndefined', () => {
  it.each([
    ['2026-07-15', '2026-07-15T00:00:00Z'],
    ['', undefined],
  ])('toRFC3339OrUndefined(%p) -> %p', (input, expected) => {
    expect(toRFC3339OrUndefined(input)).toBe(expected)
  })
})

describe('fromRFC3339DateOnly', () => {
  it.each([
    ['2026-07-15T00:00:00Z', '2026-07-15'],
    [undefined, ''],
  ])('fromRFC3339DateOnly(%p) -> %p', (input, expected) => {
    expect(fromRFC3339DateOnly(input)).toBe(expected)
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    payment_method: '3',
    reference_num: 'Check #1042',
    payment_date: '2026-07-15',
    currency_id: '1',
    amount: '1500.5',
    memo: 'July payment',
    internal_notes: 'internal only',
  }

  it('maps form fields to the create payload, converting the date to RFC3339', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1')
    expect(payload).toEqual({
      customerUuid: 'cust-uuid-1',
      methodId: 3,
      referenceNumber: 'Check #1042',
      paymentDate: '2026-07-15T00:00:00Z',
      currencyId: 1,
      amount: 1500.5,
      memo: 'July payment',
      internalNotes: 'internal only',
      customFields: {},
    })
  })

  it('defaults an unset method to 0 (rejected server-side as "unknown method")', () => {
    const payload = toCreatePayload({ ...baseData, payment_method: '' }, 'cust-uuid-1')
    expect(payload.methodId).toBe(0)
  })

  it('sends a null currencyId when unset', () => {
    const payload = toCreatePayload({ ...baseData, currency_id: '' }, 'cust-uuid-1')
    expect(payload.currencyId).toBeNull()
  })
})

describe('toUpdatePayload', () => {
  it('omits amount/customerUuid/applications and converts the date', () => {
    const payload = toUpdatePayload({
      payment_method: '2', reference_num: 'REF-2', payment_date: '2026-08-01',
      currency_id: '', memo: 'note', internal_notes: '',
    })
    expect(payload).toEqual({
      methodId: 2,
      referenceNumber: 'REF-2',
      paymentDate: '2026-08-01T00:00:00Z',
      currencyId: null,
      memo: 'note',
      internalNotes: '',
      customFields: {},
    })
    expect(payload).not.toHaveProperty('customerUuid')
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('applications')
  })
})

describe('fromPayment', () => {
  const payment: Payment = {
    id: 'pay-1',
    paymentNumber: 'PYMT-000001',
    status: 'Pending',
    statusCode: 'PEND',
    customer: { id: 'cust-1', name: 'Acme Co' },
    methodId: 3,
    method: 'Credit Card',
    referenceNumber: 'REF-9',
    paymentDate: '2026-07-15T00:00:00Z',
    currencyId: 1,
    memo: 'Memo text',
    internalNotes: 'Notes text',
    amount: 1500.5,
    appliedTotal: 500,
    unappliedAmount: 1000.5,
    customFields: {},
    applications: [],
  }

  it('maps a loaded payment back to editable form state', () => {
    const { data, customer } = fromPayment(payment)
    expect(data).toEqual({
      payment_method: '3',
      reference_num: 'REF-9',
      payment_date: '2026-07-15',
      currency_id: '1',
      memo: 'Memo text',
      internal_notes: 'Notes text',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Co' })
  })

  it('renders a null currencyId as an empty string, not "null"', () => {
    const { data } = fromPayment({ ...payment, currencyId: null })
    expect(data.currency_id).toBe('')
  })
})

describe('PAYMENT_ALLOWED_TRANSITIONS', () => {
  it('allows PEND to move to APPV or VOID', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.PEND).toEqual(['APPV', 'VOID'])
  })

  it('allows APPV to move to DEPO or VOID', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.APPV).toEqual(['DEPO', 'VOID'])
  })

  it('has no moves out of DEPO or VOID (terminal)', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.DEPO).toEqual([])
    expect(PAYMENT_ALLOWED_TRANSITIONS.VOID).toEqual([])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/paymentForm.test.ts`
Expected: FAIL — `src/lib/paymentForm.ts` does not exist yet (module not found).

- [ ] **Step 4: Write `src/lib/paymentForm.ts`**

```ts
// Payment form field definitions & payload mappers — mirrors invoiceForm.ts's
// shape, adapted to the Payment backend contract (types/payment.ts).

import type { CrmLookups } from '@/services/lookupService';
import type { Payment, PaymentCreatePayload, PaymentUpdatePayload } from '@/types/payment';
import { PAYMENT_METHODS } from './paymentMethods';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface PaymentFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  /** Static options for a plain select — value === label. */
  options?: string[];
  /** id/name options for a select bound to a numeric id (e.g. payment method). */
  idOptions?: { id: number; name: string }[];
  /** Sources options from CrmLookups[lookupKey] (id/name pairs) at render time. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

/** Create-page fields. Status and payment # are server-assigned (no picker on
 *  create — every new payment starts PEND); customer is handled by
 *  CustomerPicker, not this grid. */
export const PRIMARY_INFO_FIELDS: PaymentFormField[] = [
  { key: 'payment_method', label: 'Payment Method', type: 'select', required: true, idOptions: PAYMENT_METHODS },
  { key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
  { key: 'reference_num', label: 'Reference / Check #', type: 'text', placeholder: 'Enter reference or check number' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'currency_id', label: 'Currency', type: 'select', lookupKey: 'currencies' },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this payment…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Internal-only notes…', colSpanFull: true },
];

/** Edit-page fields — excludes `amount` (immutable post-creation, backend
 *  AD-10) and the customer (fixed after creation, shown read-only instead). */
export const EDIT_FIELDS: PaymentFormField[] = PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'amount');

// ── Status catalog (backend spec §7 — fixed, branching state machine) ────────

export const PAYMENT_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'PEND', label: 'Pending' },
  { code: 'APPV', label: 'Approved' },
  { code: 'DEPO', label: 'Deposited' },
  { code: 'VOID', label: 'Void' },
];

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Deposited: '#10b981',
  Void: '#78716c',
};

/** Legal next-moves from a given status code (backend spec §7's
 *  allowedPaymentTransitions) — drives which options PaymentStatusControl
 *  offers. The backend remains authoritative; an illegal pick is rejected
 *  with 409. */
export const PAYMENT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PEND: ['APPV', 'VOID'],
  APPV: ['DEPO', 'VOID'],
  DEPO: [],
  VOID: [],
};

/** Statuses that block apply/unapply (backend AD-7: applying is allowed at
 *  PEND/APPV/DEPO, blocked only at VOID — looser than Invoice's payable-
 *  status gate since this module records money in, not out). */
export const PAYMENT_BLOCKS_APPLY = new Set(['VOID']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function paymentDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    payment_date: today,
  };
}

// ── Date handling ─────────────────────────────────────────────────────────────
//
// payment.CreatePaymentInput/UpdatePaymentInput's PaymentDate field is a Go
// *time.Time (unlike Invoice's plain "yyyy-mm-dd" string field) — its default
// JSON unmarshaling requires a full RFC3339 timestamp, so a bare
// `<input type="date">` value like "2026-07-15" fails to decode server-side
// (json.Decode returns an error, surfaced as a 400 "Invalid request body").
// toRFC3339OrUndefined appends a UTC-midnight time component before sending;
// fromRFC3339DateOnly strips it back off when loading a payment into the form.

export function toRFC3339OrUndefined(dateStr: string): string | undefined {
  return dateStr ? `${dateStr}T00:00:00Z` : undefined;
}

export function fromRFC3339DateOnly(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

// ── Payload mapping (UI form state -> backend contracts) ─────────────────────

function toNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toIntOrZero(v: unknown): number {
  return toIntOrNull(v) ?? 0;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Maps the AddPaymentPage form state to the backend's `PaymentCreatePayload`,
 *  minus `applications` (tracked separately by the page as a local array and
 *  spread in at submit time — see AddPaymentPage). */
export function toCreatePayload(
  data: Record<string, unknown>,
  customerUuid: string,
): Omit<PaymentCreatePayload, 'applications'> {
  return {
    customerUuid,
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    currencyId: toIntOrNull(data.currency_id),
    amount: toNum(data.amount),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields: {},
  };
}

/** Maps the EditPaymentPage form state to the backend's `PaymentUpdatePayload`
 *  (no amount — immutable post-creation). */
export function toUpdatePayload(data: Record<string, unknown>): PaymentUpdatePayload {
  return {
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    currencyId: toIntOrNull(data.currency_id),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields: {},
  };
}

/** id-or-empty for a lookupKey/idOptions <select>'s bound value: null/
 *  undefined must render as "— Select —" (empty string), never "0" or
 *  "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded Payment (GET response) back to the Edit form's state — the
 *  inverse of toUpdatePayload. Customer is returned separately since Edit
 *  displays it read-only, not through this field grid. */
export function fromPayment(payment: Payment): {
  data: Record<string, unknown>;
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    payment_method: String(payment.methodId),
    reference_num: payment.referenceNumber ?? '',
    payment_date: fromRFC3339DateOnly(payment.paymentDate),
    currency_id: idOrEmpty(payment.currencyId),
    memo: payment.memo ?? '',
    internal_notes: payment.internalNotes ?? '',
  };
  return { data, customer: { id: payment.customer.id, name: payment.customer.name } };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/paymentForm.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/paymentMethods.ts src/lib/paymentForm.ts src/lib/paymentForm.test.ts
git commit -m "feat: add payment form field definitions and payload mappers"
```

---

## Task 3: Shared payment field renderer

**Files:**
- Create: `src/pages/sales/components/PaymentFormFields.tsx`

**Interfaces:**
- Consumes: `PaymentFormField` from `src/lib/paymentForm.ts` (Task 2); `CrmLookups` from `src/services/lookupService.ts`; `ModernFieldShell` from `src/components/crm/FormPrimitives`; `fieldCls, textareaCls, readonlyCls` from `src/components/crm/formUtils`.
- Produces: `PaymentField`, `PaymentSectionGrid` components. Consumed by Task 6 (`AddPaymentPage`) and Task 9 (`EditPaymentPage`).

- [ ] **Step 1: Write `src/pages/sales/components/PaymentFormFields.tsx`**

```tsx
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { PaymentFormField } from '@/lib/paymentForm';

// Renders one PaymentFormField — shared by the Add and Edit Payment forms.
// Mirrors InvoiceFormFields' InvoiceField/InvoiceSectionGrid, extended with
// `idOptions` (a plain id/name array, e.g. PAYMENT_METHODS) alongside the
// existing `lookupKey` (CrmLookups-sourced) and static `options` (string[])
// select sources — Payment methods aren't part of CrmLookups (see AD-1 of
// docs/superpowers/specs/2026-07-15-payment-module-integration-design.md).
export function PaymentField({ field, value, set, lookups }: {
  field: PaymentFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

  if (field.type === 'readonly') {
    return (
      <ModernFieldShell label={field.label}>
        <div className={`${readonlyCls} cursor-not-allowed select-none`}>
          {str || <span className="text-stone-400">—</span>}
        </div>
      </ModernFieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={field.rows ?? 3}
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={textareaCls}
            placeholder={field.placeholder}
            aria-label={field.label}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'select') {
    const idRows = field.idOptions
      ?? (field.lookupKey && lookups ? (lookups[field.lookupKey] as Array<{ id: number; name: string }>) : null);

    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            <option value="">— Select —</option>
            {idRows
              ? idRows.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))
              : field.options?.filter(Boolean).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

export function PaymentSectionGrid({ fields, data, set, lookups }: {
  fields: PaymentFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <PaymentField key={f.key} field={f} value={data[f.key]} set={set} lookups={lookups} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/components/PaymentFormFields.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/components/PaymentFormFields.tsx
git commit -m "feat: add shared payment form field renderer"
```

---

## Task 4: InvoicePicker component

**Files:**
- Create: `src/pages/sales/components/InvoicePicker.tsx`

**Interfaces:**
- Consumes: `invoiceService.searchInvoices` from `src/services/invoiceService.ts`; `fieldCls` from `src/components/crm/formUtils`.
- Produces: `InvoicePicker` component, `InvoiceRef` type (`{id, number, balanceDue}`). Consumed by Task 6 (`AddPaymentPage`) and Task 8 (`PaymentDetailPage`'s apply dialog).

- [ ] **Step 1: Write `src/pages/sales/components/InvoicePicker.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Receipt } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 50;

export interface InvoiceRef {
  id: string;
  number: string;
  balanceDue: number;
}

// Invoice picker for applying a payment's balance — scoped to one customer
// (a payment can only be applied to invoices belonging to its own customer;
// the backend rejects a mismatch with 400). Mirrors CustomerPicker's
// debounced-search dropdown pattern.
//
// The invoice resolver's `customer_id` filter field resolves to the
// customer's internal serial id (i.invoice_customer_id::text), not its UUID
// (StoneSuite-Backend invoice/resolver.go) — there is no filter field that
// accepts the customer UUID CustomerPicker deals in. So instead of filtering
// server-side by id, this narrows server-side by the customer's *name* (via
// the existing global `search` term, which already matches customer_name per
// the invoice SearchPredicate) and then filters the results client-side to
// an exact `customer.id` match, which every InvoiceSummary row already
// carries.
//
// Disabled until a customer is chosen. Fully-paid invoices (balanceDue <= 0)
// and ids in `excludeIds` (already added to this payment's applications)
// are filtered out of the results.
export function InvoicePicker({
  customer, value, onChange, excludeIds = [], disabled,
}: {
  customer: { id: string; name: string } | null;
  value: InvoiceRef | null;
  onChange: (invoice: InvoiceRef | null) => void;
  excludeIds?: string[];
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const enabled = open && Boolean(customer) && !disabled;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['invoice-picker', customer?.id, debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<InvoiceRef[]> => {
      const page = await invoiceService.searchInvoices({
        search: customer!.name,
        sort: [{ field: 'invoice_date', dir: 'desc' }],
        limit: RESULT_LIMIT,
      });
      const scoped = page.records.filter((r) => r.customer.id === customer!.id);
      const narrowed = debounced
        ? scoped.filter((r) => r.invoiceNumber.toLowerCase().includes(debounced.toLowerCase()))
        : scoped;
      return narrowed.map((r) => ({ id: r.id, number: r.invoiceNumber, balanceDue: r.balanceDue }));
    },
  });

  const filtered = results.filter((r) => r.balanceDue > 0 && !excludeIds.includes(r.id));

  function select(invoice: InvoiceRef) {
    onChange(invoice);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
        <Receipt className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium text-stone-800">{value.number}</span>
        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {value.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} due
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change invoice"
          className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
        <input
          type="text"
          disabled={disabled || !customer}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={customer ? 'Click to browse, or search by invoice #…' : 'Select a customer first…'}
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search invoice"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && enabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {filtered.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">
              {debounced ? 'No matching invoices with a balance due.' : 'No open invoices for this customer.'}
            </p>
          )}
          {filtered.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => select(inv)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-stone-700 hover:bg-accent/10 transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Receipt className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="truncate">{inv.number}</span>
              </span>
              <span className="shrink-0 tabular-nums text-stone-400">
                {inv.balanceDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/components/InvoicePicker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/components/InvoicePicker.tsx
git commit -m "feat: add customer-scoped invoice picker for payment application"
```

---

## Task 5: Payment list table

**Files:**
- Modify (full rewrite): `src/pages/sales/components/PaymentTable.tsx`

**Interfaces:**
- Consumes: `paymentService.searchPayments` (Task 1); `PAYMENT_STATUS_COLORS` (Task 2); `PaymentSearchRequest` (Task 1); `useUserPermissions` from `src/hooks/useUserPermissions.ts`.
- Produces: `PaymentTable` component (named export, unchanged signature) — still consumed as-is by `src/pages/sales/PaymentListPage.tsx` (no changes needed there).

- [ ] **Step 1: Read the current file**

Read `src/pages/sales/components/PaymentTable.tsx` (confirms current content before full replacement).

- [ ] **Step 2: Replace its contents**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { paymentService } from '@/services/paymentService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PAYMENT_STATUS_COLORS } from '@/lib/paymentForm';
import type { PaymentSearchRequest } from '@/types/payment';

// Payments are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — like Invoice — this table talks to paymentService
// (/api/tenant/payments*) directly rather than reusing CrmRecordTable/
// crmService. Mirrors InvoiceTable's search/sort/cursor-pagination UX.

type SortField = 'payment_date' | 'amount' | 'unapplied_amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  payment_date: 'Payment Date',
  amount: 'Amount',
  unapplied_amount: 'Unapplied',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function PaymentTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('payment', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('payment_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const req: PaymentSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: sortBy, dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payments', req],
    queryFn: () => paymentService.searchPayments(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goNext() {
    if (!data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(data.nextCursor);
    scrollToTop();
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
    scrollToTop();
  }

  const hasFilters = Boolean(term);

  function clearFilters() {
    setTerm('');
    setCursor('');
    setPrevCursors([]);
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setCursor('');
    setPrevCursors([]);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="size-2.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />;
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search payment #, customer, reference…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400 pr-0.5">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold transition-colors',
                sortBy === field
                  ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20'
                  : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700',
              )}
            >
              {label}
              <SortIcon field={field} />
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <X className="size-3" />
            Clear
          </button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-red-500">Failed to load payments. Please try again.</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Payment #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Payment Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Unapplied</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    {canEdit && <td className="px-4 py-3" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((p) => {
                  const color = PAYMENT_STATUS_COLORS[p.status] ?? '#a8a29e';
                  return (
                    <tr key={p.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/payment/${p.id}`)}
                          className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {p.paymentNumber || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[200px]">
                        {p.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {p.paymentDate
                          ? new Date(p.paymentDate).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 tabular-nums text-right whitespace-nowrap">
                        {currency(p.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-stone-600 tabular-nums text-right whitespace-nowrap">
                        {currency(p.unappliedAmount)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/payment/${p.id}/edit`)}
                            aria-label={`Edit payment ${p.paymentNumber}`}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No payments recorded yet.</p>
                        <p className="text-xs text-stone-400">Record your first payment to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No payments match the current search.</p>
                        <p className="text-xs text-stone-400">Try adjusting your search terms.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="text-xs text-stone-500 tabular-nums">
              Page {pageNum}{hasMore ? '' : ' · last page'}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                onClick={goNext}
                disabled={!hasMore}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/components/PaymentTable.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/sales/components/PaymentTable.tsx
git commit -m "feat: rewire payment list table to the dedicated payment API"
```

---

## Task 6: Add Payment page

**Files:**
- Modify (full rewrite): `src/pages/sales/AddPaymentPage.tsx`

**Interfaces:**
- Consumes: `paymentService.createPayment` (Task 1); `PRIMARY_INFO_FIELDS, paymentDefaults, toCreatePayload, PAGE_TABS, PageTab` (Task 2); `PaymentSectionGrid` (Task 3); `InvoicePicker, InvoiceRef` (Task 4); `CustomerPicker, CustomerRef` from `src/pages/sales/components/CustomerPicker.tsx` (existing, unmodified); `ApplicationInput` (Task 1).
- Produces: default export `AddPaymentPage`, unchanged route usage.

- [ ] **Step 1: Read the current file**

Read `src/pages/sales/AddPaymentPage.tsx` (confirms current content before full replacement).

- [ ] **Step 2: Replace its contents**

```tsx
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save, Plus, X } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { CustomerPicker } from './components/CustomerPicker';
import type { CustomerRef } from './components/CustomerPicker';
import { InvoicePicker } from './components/InvoicePicker';
import type { InvoiceRef } from './components/InvoicePicker';
import { PaymentSectionGrid } from './components/PaymentFormFields';
import {
  PRIMARY_INFO_FIELDS, paymentDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/paymentForm';
import type { ApplicationInput } from '@/types/payment';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function AddPaymentPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(paymentDefaults);
  const [customer, setCustomer]   = useState<CustomerRef | null>(null);

  const [applications, setApplications] = useState<ApplicationInput[]>([]);
  const [appliedInvoiceNumbers, setAppliedInvoiceNumbers] = useState<Record<string, string>>({});
  const [pendingInvoice, setPendingInvoice] = useState<InvoiceRef | null>(null);
  const [pendingAmount, setPendingAmount] = useState('');

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  function addApplication() {
    if (!pendingInvoice) return;
    const amount = parseFloat(pendingAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setApplications((a) => [...a, { invoiceUuid: pendingInvoice.id, amount }]);
    setAppliedInvoiceNumbers((m) => ({ ...m, [pendingInvoice.id]: pendingInvoice.number }));
    setPendingInvoice(null);
    setPendingAmount('');
  }

  function removeApplication(invoiceUuid: string) {
    setApplications((a) => a.filter((row) => row.invoiceUuid !== invoiceUuid));
    setAppliedInvoiceNumbers((m) => {
      const next = { ...m };
      delete next[invoiceUuid];
      return next;
    });
  }

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A customer is required.');
      const payload = { ...toCreatePayload(data, customer.id), applications };
      return paymentService.createPayment(payload);
    },
    onSuccess: async (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(payment.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/payment');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Payments"
          onBack={() => navigate('/sales/payment')}
          icon={CreditCard}
          title="New Payment"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Payment'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save payment.')}
            </p>
          </div>
        )}

        {/* ── Page-level tab bar ── */}
        <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

            {activeTab === 'details' && (
              <>
                <ModernSection title="Customer" index={0}>
                  <CustomerPicker value={customer} onChange={setCustomer} required />
                </ModernSection>

                <ModernSection title="Payment Details" index={1}>
                  <PaymentSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} lookups={lookups} />
                </ModernSection>

                <ModernSection title="Apply to Invoices (optional)" index={2}>
                  <div className="space-y-3">
                    {applications.length > 0 && (
                      <div className="space-y-1.5">
                        {applications.map((app) => (
                          <div key={app.invoiceUuid} className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                            <span className="font-medium text-stone-700">{appliedInvoiceNumbers[app.invoiceUuid]}</span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-stone-600">{currency(app.amount)}</span>
                              <button
                                type="button"
                                onClick={() => removeApplication(app.invoiceUuid)}
                                aria-label={`Remove application to ${appliedInvoiceNumbers[app.invoiceUuid]}`}
                                className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <InvoicePicker
                          customer={customer}
                          value={pendingInvoice}
                          onChange={setPendingInvoice}
                          excludeIds={applications.map((a) => a.invoiceUuid)}
                        />
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={pendingAmount}
                        onChange={(e) => setPendingAmount(e.target.value)}
                        placeholder="Amount"
                        aria-label="Application amount"
                        className={`${fieldCls} sm:w-32`}
                      />
                      <button
                        type="button"
                        onClick={addApplication}
                        disabled={!pendingInvoice || !(parseFloat(pendingAmount) > 0)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <Plus className="size-3.5" />
                        Add
                      </button>
                    </div>
                    {!customer && (
                      <p className="text-2xs text-stone-400">Select a customer above to apply this payment to their invoices.</p>
                    )}
                  </div>
                </ModernSection>
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the payment.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/sales/payment')}
          isPending={isPending}
          submitLabel="Save Payment"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/AddPaymentPage.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/sales/AddPaymentPage.tsx
git commit -m "feat: rebuild Add Payment page against the dedicated payment API"
```

---

## Task 7: Small payment detail components

**Files:**
- Create: `src/pages/sales/components/PaymentStatusControl.tsx`
- Create: `src/pages/sales/components/PaymentAuditTab.tsx`
- Create: `src/pages/sales/components/DeletePaymentDialog.tsx`

**Interfaces:**
- Consumes: `PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS` (Task 2); `paymentService.getAudit, paymentService.deletePayment` (Task 1); `fieldCls` from `formUtils`; `Spinner` from `src/components/tenant/ui.tsx`; `AuditEntry` from `src/services/crmService.ts`.
- Produces: `PaymentStatusControl`, `PaymentAuditTab`, `DeletePaymentDialog` components. Consumed by Task 8 (`PaymentDetailPage`) and Task 9 (`EditPaymentPage`).

- [ ] **Step 1: Write `src/pages/sales/components/PaymentStatusControl.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { PAYMENT_STATUS_CODES, PAYMENT_ALLOWED_TRANSITIONS } from '@/lib/paymentForm';

// Status select for the Payment Edit page. Unlike InvoiceStatusControl (which
// offers Invoice's full flat status list — every status is reachable in
// sequence from the UI), Payment's transitions branch: PEND can go to APPV or
// VOID, APPV to DEPO or VOID, and DEPO/VOID are terminal. This control only
// offers the current status plus its legal next-moves (backend spec §7). The
// backend (payment.Transition) remains the source of truth; an illegal pick
// would be rejected with 409, but this control shouldn't be able to
// construct one.
export function PaymentStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "PEND"
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = PAYMENT_STATUS_CODES.find((s) => s.code === value);
  const nextCodes = PAYMENT_ALLOWED_TRANSITIONS[value] ?? [];
  const options = PAYMENT_STATUS_CODES.filter((s) => s.code === value || nextCodes.includes(s.code));
  const isTerminal = nextCodes.length === 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        onClick={() => !disabled && !isTerminal && setOpen((v) => !v)}
        disabled={disabled || isTerminal}
        className={`${fieldCls} flex items-center gap-2`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        {!isTerminal && <ChevronDown className="size-3 shrink-0 text-stone-400" />}
      </button>

      {open && !disabled && !isTerminal && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {options.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => { onChange(s.code); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-sm transition ${
                s.code === value ? 'bg-brand/10 font-semibold text-stone-900' : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/pages/sales/components/PaymentAuditTab.tsx`**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { paymentService } from '@/services/paymentService';
import type { AuditEntry } from '@/services/crmService';

// Mirrors InvoiceAuditTab, but reads from paymentService.getAudit
// (/api/tenant/payments/{uuid}/audit).
export function PaymentAuditTab({ paymentId }: { paymentId?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['payment-audit', paymentId],
    queryFn: () => paymentService.getAudit(paymentId!),
    enabled: Boolean(paymentId),
  });

  if (!paymentId) {
    return <p className="py-12 text-center text-sm text-stone-400">Audit trail will be available after saving the payment.</p>;
  }
  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading audit trail…" /></div>;
  if (error) return <p className="py-6 text-center text-xs text-destructive/70 italic">Failed to load audit trail.</p>;
  if (entries.length === 0) return <p className="py-6 text-center text-xs text-stone-400 italic">No audit events recorded yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Action', 'Actor', 'IP Address', 'Version', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left font-semibold uppercase tracking-wide text-stone-400 text-2xs whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => <AuditRow key={i} entry={entry} />)}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = Boolean(entry.oldValue || entry.newValue);

  return (
    <>
      <tr
        className={cn('border-b border-stone-50 transition-colors', hasChanges && 'cursor-pointer hover:bg-stone-50')}
        onClick={() => hasChanges && setExpanded((v) => !v)}
      >
        <td className="py-2.5 px-3"><ActionBadge action={entry.action} /></td>
        <td className="py-2.5 px-3 text-stone-900 text-xs">{entry.actorName || <span className="text-stone-300 italic">system</span>}</td>
        <td className="py-2.5 px-3 text-stone-400 font-mono text-2xs">{entry.ipAddress || '—'}</td>
        <td className="py-2.5 px-3 text-stone-400 text-2xs">{entry.appVersion || '—'}</td>
        <td className="py-2.5 px-3 text-stone-400 text-2xs whitespace-nowrap">
          {new Date(entry.at).toLocaleString()}
          {hasChanges && <span className="ml-1.5 text-stone-300">{expanded ? '▲' : '▼'}</span>}
        </td>
      </tr>
      {expanded && hasChanges && (
        <tr className="bg-stone-50">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entry.oldValue && <ChangesBlock label="Before" data={entry.oldValue} />}
              {entry.newValue && <ChangesBlock label="After" data={entry.newValue} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action === 'create' ? 'bg-accent-lime text-accent-foreground' :
    action === 'delete' ? 'bg-destructive/10 text-destructive' :
    action === 'update' ? 'bg-workflow-prospect-bg text-workflow-prospect-text' :
    'bg-stone-100 text-stone-600';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold capitalize', color)}>
      {action}
    </span>
  );
}

function ChangesBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="flex gap-2 text-2xs">
            <span className="text-stone-400 shrink-0 min-w-[80px] font-medium">{key}</span>
            <span className="text-stone-600 break-all">{val === null || val === undefined ? '—' : String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/pages/sales/components/DeletePaymentDialog.tsx`**

```tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { paymentService } from '@/services/paymentService';
import { apiErrorMessage } from '@/api/tenantClient';

// Mirrors DeleteInvoiceDialog. The 409 "has live applications" server
// message (backend AD-11: delete blocked while applications exist) surfaces
// as-is via apiErrorMessage — no special-cased client copy.
export function DeletePaymentDialog({ paymentId, label, onDeleted }: {
  paymentId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => paymentService.deletePayment(paymentId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Trash2 className="size-4 shrink-0" />
        Delete payment
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-payment-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="delete-payment-dialog-title" className="text-sm font-bold text-stone-900">
                  Delete payment?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 text-xs text-destructive">
                {apiErrorMessage(del.error, 'Failed to delete payment.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {del.isPending ? 'Deleting…' : 'Delete payment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in the three new files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sales/components/PaymentStatusControl.tsx src/pages/sales/components/PaymentAuditTab.tsx src/pages/sales/components/DeletePaymentDialog.tsx
git commit -m "feat: add payment status control, audit tab, and delete dialog"
```

---

## Task 8: Payment Detail page

**Files:**
- Create: `src/pages/sales/PaymentDetailPage.tsx`

**Interfaces:**
- Consumes: `paymentService.{getPayment, apply, unapply}` (Task 1); `PAYMENT_STATUS_COLORS, PAYMENT_BLOCKS_APPLY` (Task 2); `InvoicePicker, InvoiceRef` (Task 4); `PaymentAuditTab, DeletePaymentDialog` (Task 7); `useBreadcrumbStore` from `src/store/useBreadcrumbStore.ts`; `PaymentApplication` (Task 1).
- Produces: default export `PaymentDetailPage`, routed at `sales/payment/:id` in Task 10.

- [ ] **Step 1: Write `src/pages/sales/PaymentDetailPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Upload, Pencil, DollarSign, Unlink } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls, fieldCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS_COLORS, PAYMENT_BLOCKS_APPLY } from '@/lib/paymentForm';
import { PaymentAuditTab } from './components/PaymentAuditTab';
import { DeletePaymentDialog } from './components/DeletePaymentDialog';
import { InvoicePicker } from './components/InvoicePicker';
import type { InvoiceRef } from './components/InvoicePicker';
import type { PaymentApplication } from '@/types/payment';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'applications', label: 'Applications' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function PaymentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [applyOpen, setApplyOpen] = useState(false);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('payment', 'update');
  const canDelete = permissionsLoading || hasPermission('payment', 'delete');

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentService.getPayment(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (payment?.paymentNumber) {
      setLabel(id, payment.paymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.paymentNumber, setLabel, clearLabel]);

  const unapply = useMutation({
    mutationFn: (invoiceId: string) => paymentService.unapply(id, invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment', id] }),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading payment…" /></div>;
  if (error || !payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load payment.')}</ErrorNote></div>;

  const color = PAYMENT_STATUS_COLORS[payment.status] ?? '#a8a29e';
  const applyBlocked = PAYMENT_BLOCKS_APPLY.has(payment.statusCode);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Payments"
        onBack={() => navigate('/sales/payment')}
        icon={CreditCard}
        title={payment.paymentNumber || 'Payment'}
        subtitle={payment.customer.name}
        recordNumber={payment.paymentNumber}
        statusBadge={<Badge color={color}>{payment.status}</Badge>}
      />

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        {/* Left column */}
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Payment Method" value={payment.method} />
                  <ReadonlyField label="Reference #" value={payment.referenceNumber} />
                  <ReadonlyField label="Payment Date" value={fmtDate(payment.paymentDate)} />
                  {payment.memo && <ReadonlyField label="Memo" value={payment.memo} full />}
                  {payment.internalNotes && <ReadonlyField label="Internal Notes" value={payment.internalNotes} full />}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Total label="Amount" value={payment.amount} bold />
                  <Total label="Applied" value={payment.appliedTotal} />
                  <Total label="Unapplied" value={payment.unappliedAmount} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setApplyOpen(true)}
                    disabled={applyBlocked || payment.unappliedAmount <= 0}
                    title={applyBlocked ? 'A voided payment cannot be applied.' : payment.unappliedAmount <= 0 ? 'No unapplied balance remaining.' : undefined}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <DollarSign className="size-3.5" />
                    Apply to invoice
                  </button>
                </div>
              )}

              <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="divide-x divide-stone-200">
                      {['Invoice #', 'Amount', 'Applied Date', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {payment.applications.map((app: PaymentApplication) => (
                      <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                        <td className="px-3 py-2.5 font-medium text-stone-800">
                          <button type="button" onClick={() => navigate(`/sales/invoice/${app.invoiceId}`)} className="hover:text-accent-foreground transition-colors">
                            {app.invoiceNumber || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(app.amount)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-400">{fmtDate(app.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => unapply.mutate(app.invoiceId)}
                              disabled={unapply.isPending || applyBlocked}
                              aria-label={`Unapply payment from invoice ${app.invoiceNumber}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                            >
                              <Unlink className="size-3" />
                              Unapply
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payment.applications.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-stone-400">Not applied to any invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {unapply.error && (
                <p className="text-xs text-destructive">{apiErrorMessage(unapply.error, 'Failed to unapply payment.')}</p>
              )}
            </div>
          )}

          {activeTab === 'audit' && <PaymentAuditTab paymentId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/sales/payment/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/payment/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit payment
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{payment.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{payment.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(payment.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(payment.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeletePaymentDialog
                paymentId={id}
                label={`Payment ${payment.paymentNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['payments'] });
                  navigate('/sales/payment');
                }}
              />
            </div>
          )}
        </div>
      </div>

      {applyOpen && (
        <ApplyDialog
          paymentId={id}
          customer={payment.customer}
          unappliedAmount={payment.unappliedAmount}
          excludeIds={payment.applications.map((a) => a.invoiceId)}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: ['payment', id] });
          }}
        />
      )}
    </div>
  );
}

function ApplyDialog({ paymentId, customer, unappliedAmount, excludeIds, onClose, onApplied }: {
  paymentId: string;
  customer: { id: string; name: string };
  unappliedAmount: number;
  excludeIds: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceRef | null>(null);
  const [amount, setAmount] = useState('');

  const apply = useMutation({
    mutationFn: () => paymentService.apply(paymentId, invoice!.id, parseFloat(amount)),
    onSuccess: onApplied,
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-payment-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <div>
            <h3 id="apply-payment-dialog-title" className="text-sm font-bold text-stone-900">
              Apply to invoice
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Unapplied balance: {currency(unappliedAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={fieldLabelCls}>Invoice</label>
            <div className="mt-1.5">
              <InvoicePicker customer={customer} value={invoice} onChange={setInvoice} excludeIds={excludeIds} />
            </div>
          </div>
          <div>
            <label htmlFor="apply-amount" className={fieldLabelCls}>Amount</label>
            <input
              id="apply-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${fieldCls} mt-1.5`}
              aria-label="Application amount"
            />
          </div>
        </div>

        {apply.error && (
          <p className="mt-3 text-xs text-destructive">
            {apiErrorMessage(apply.error, 'Failed to apply payment.')}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={apply.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || !invoice || !validAmount}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {apply.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}

function Total({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={cn('tabular-nums', bold ? 'text-sm font-bold text-stone-900' : 'text-xs font-semibold text-stone-600')}>
        {currency(value)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/PaymentDetailPage.tsx`. (The route is not registered until Task 10, so navigating to it isn't possible yet — that's expected at this point.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/PaymentDetailPage.tsx
git commit -m "feat: add payment detail page with applications, apply/unapply, and audit"
```

---

## Task 9: Edit Payment page

**Files:**
- Create: `src/pages/sales/EditPaymentPage.tsx`

**Interfaces:**
- Consumes: `paymentService.{getPayment, updatePayment, transition}` (Task 1); `EDIT_FIELDS, fromPayment, toUpdatePayload` (Task 2); `PaymentSectionGrid` (Task 3); `PaymentStatusControl` (Task 7); `useBreadcrumbStore`.
- Produces: default export `EditPaymentPage`, routed at `sales/payment/:id/edit` in Task 10.

- [ ] **Step 1: Write `src/pages/sales/EditPaymentPage.tsx`**

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { PaymentSectionGrid } from './components/PaymentFormFields';
import { PaymentStatusControl } from './components/PaymentStatusControl';
import { EDIT_FIELDS, fromPayment, toUpdatePayload } from '@/lib/paymentForm';

export default function EditPaymentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: payment, isLoading, error: loadError } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentService.getPayment(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (payment?.paymentNumber) {
      setLabel(id, payment.paymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.paymentNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (payment ? fromPayment(payment) : null), [payment]);
  const data = localData ?? mapped?.data ?? {};
  const statusCode = localStatusCode ?? payment?.statusCode ?? '';

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => paymentService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  const handleStatusChange = useCallback(
    (toCode: string) => {
      if (toCode !== statusCode) {
        setLocalStatusCode(toCode);
        transition.mutate(toCode);
      }
    },
    // transition.mutate is a stable reference from TanStack Query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusCode, transition.mutate],
  );

  const save = useMutation({
    mutationFn: () => paymentService.updatePayment(id, toUpdatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      navigate(`/sales/payment/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading payment…" /></div>;
  if (loadError || !payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load payment.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;
  const customerName = mapped?.customer.name ?? payment.customer.name;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Payments"
          onBack={() => navigate(`/sales/payment/${id}`)}
          icon={CreditCard}
          title={payment.paymentNumber || 'Payment'}
          subtitle={customerName}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save payment.')}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-3 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Status" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className={fieldLabelCls}>Status</label>
                  <PaymentStatusControl
                    value={statusCode}
                    onChange={handleStatusChange}
                    disabled={transition.isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className={fieldLabelCls}>Customer</label>
                  <div className={readonlyCls}>{customerName}</div>
                </div>
                <div className="space-y-1">
                  <label className={fieldLabelCls}>Amount</label>
                  <div className={readonlyCls}>
                    {payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  </div>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Payment Details" index={1}>
              <PaymentSectionGrid fields={EDIT_FIELDS} data={data} set={set} lookups={lookups} />
            </ModernSection>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate(`/sales/payment/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors in `src/pages/sales/EditPaymentPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/EditPaymentPage.tsx
git commit -m "feat: add payment edit page with status transition control"
```

---

## Task 10: Router wiring and full verification

**Files:**
- Modify: `src/router/index.tsx`

**Interfaces:**
- Consumes: `PaymentDetailPage` (Task 8), `EditPaymentPage` (Task 9) as lazy-loaded default exports; existing `PermissionGuard` from `src/components/PermissionGuard.tsx`.

- [ ] **Step 1: Add lazy imports**

In `src/router/index.tsx`, find:

```tsx
const PaymentListPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentListPage"),
);
const AddPaymentPage = lazyWithRetry(() => import("@/pages/sales/AddPaymentPage"));
```

Replace with:

```tsx
const PaymentListPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentListPage"),
);
const AddPaymentPage = lazyWithRetry(() => import("@/pages/sales/AddPaymentPage"));
const PaymentDetailPage = lazyWithRetry(
  () => import("@/pages/sales/PaymentDetailPage"),
);
const EditPaymentPage = lazyWithRetry(
  () => import("@/pages/sales/EditPaymentPage"),
);
```

- [ ] **Step 2: Add PermissionGuard wraps and the two new routes**

In the same file, find the Payments route block:

```tsx
      // Payments (specific routes must come before the catch-all)
      {
        path: "sales/payment",
        element: lazy_(<PaymentListPage />),
      },
      {
        path: "sales/payment/new",
        element: lazy_(<AddPaymentPage />),
      },
```

Replace with:

```tsx
      // Payments (specific routes must come before the catch-all)
      {
        path: "sales/payment",
        element: lazy_(
          <PermissionGuard resource="payment" action="read">
            <PaymentListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/new",
        element: lazy_(
          <PermissionGuard resource="payment" action="create">
            <AddPaymentPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id",
        element: lazy_(
          <PermissionGuard resource="payment" action="read">
            <PaymentDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/payment/:id/edit",
        element: lazy_(
          <PermissionGuard resource="payment" action="update">
            <EditPaymentPage />
          </PermissionGuard>,
        ),
      },
```

- [ ] **Step 3: Full CI check**

Run: `npm run ci`
Expected: Lint, test, and build all pass (this is exactly what CI runs — see CLAUDE.md).

- [ ] **Step 4: Manual browser verification**

Per CLAUDE.md, UI changes must be exercised in a browser before being reported complete — this requires the StoneSuite backend running (`stonesuite-backend`, per the sibling repo) with a valid tenant login. Start the frontend dev server (`npm run dev` / the project's preview tooling) and, against a real or already-running backend:
1. Navigate to `/sales/payment` — confirm the list loads (or shows the empty state) with no console errors.
2. Click "New Payment" — pick a customer, select a payment method, fill amount/date, optionally add an invoice application, save — confirm it redirects to the list and the new payment appears.
3. Open the new payment's detail page — confirm Overview/Applications/Audit/Files tabs render, and if an application was added at create time it shows in the Applications tab.
4. From the detail page, use "Apply to invoice" to add another application, then "Unapply" it — confirm both round-trip without error.
5. Edit the payment — change the reference number and transition status from Pending to Approved — confirm both save.
6. Attempt to delete a payment that still has a live application — confirm the 409 error message surfaces in the delete dialog rather than silently failing.

If no backend is reachable in the current environment, state that explicitly rather than claiming the manual walkthrough was completed — `npm run ci` passing (Step 3) verifies the code compiles and existing tests pass, but does not verify runtime behavior against the real API.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.tsx
git commit -m "feat: wire up payment detail and edit routes"
```

---

## Self-Review Notes

- **Spec coverage:** §5.1 types/service → Task 1. §5.1 method constant/form lib → Task 2. Field renderer (needed by §5.3/§5.5, implicit in "mirrors invoiceForm.ts") → Task 3. §5.3/§5.4 AD-4/AD-5 `InvoicePicker` → Task 4. §5.2 list → Task 5. §5.3 create → Task 6. §5.6 small components → Task 7. §5.4 detail/applications → Task 8. §5.5 edit/status → Task 9. §5.7 router → Task 10. All spec sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has complete code.
- **Type consistency:** `PaymentFormField`, `PaymentSectionGrid`, `PaymentField`, `InvoiceRef`, `ApplicationInput`, `PaymentApplication`, `PAYMENT_ALLOWED_TRANSITIONS`, `PAYMENT_BLOCKS_APPLY`, `PAYMENT_STATUS_COLORS` are defined once (Tasks 2–4) and referenced with identical names/shapes in every later task.
