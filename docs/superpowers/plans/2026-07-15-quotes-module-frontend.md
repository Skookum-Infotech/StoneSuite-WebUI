# Quotes Module Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Quotes frontend module — types, service, form library, list/create/detail/edit pages, and shared sub-components — that mirrors the existing Estimate module file-for-file, wired to the dedicated relational backend at `/api/tenant/quotes*`, with the estimate-lineage/approval/conversion differences the ticket calls out.

**Architecture:** New `types/quote.ts` + `services/quoteService.ts` wrap the backend contract exactly. `lib/quoteForm.ts` holds the frontend-only field config, pure calc/payload-mapping logic (unit tested), and status catalog — cloned from `lib/estimateForm.ts` and adjusted for Quote's flatter address shape and catalog-only line items. Page components (`QuoteTable`, `AddQuotePage`, `QuoteDetailPage`, `EditQuotePage`, `QuoteListPage`) and small shared components (`QuoteFormFields`, `QuoteItemsTab`, `QuoteStatusControl`, `QuoteApprovalButton`, `QuoteSummaryCard`, `QuoteFormBody`, `QuoteAuditTab`, `DeleteQuoteDialog`) mirror their exact Estimate-module counterparts. Estimate-specific additions (source-estimate badge, approve button, convert-to-sales-order placeholder) are new, isolated pieces layered on top of the mirrored structure — the estimate module itself is never modified.

**Tech Stack:** React + TypeScript, TanStack React Query, React Router v7, Tailwind, Vitest. No new dependencies.

## Global Constraints

- No `@typescript-eslint/no-explicit-any` — type everything properly.
- Styling: Tailwind `className=` only. No inline `style={}` except the existing hex-color-driven `style={{backgroundColor:...}}` pattern already used for status badges (matches `EstimateTable`/`EstimateDetailPage`).
- Exports: named everywhere except page-level route components (default export).
- All API calls go through `services/*Service.ts`. Never direct `fetch()`/`axios.*()` in pages.
- Async data fetching: TanStack React Query only — no bare `useEffect` for fetches (the one exception, matching Estimate's own convention, is the breadcrumb-label `useEffect` required by the rule below — that's a side effect, not a fetch).
- Never mutate state directly — always return new objects/arrays.
- Never show a raw record UUID in the UI breadcrumb — call `useBreadcrumbStore().setLabel(id, humanLabel)` in a `useEffect` once the record loads, and `clearLabel(id)` on cleanup (`EditQuotePage`, `QuoteDetailPage`).
- No magic strings/numbers beyond 1 — status codes, field keys, the `PAPV` approval-pending code, etc. are named constants.
- Errors are wrapped with context via `apiErrorMessage(err, fallback)`, never swallowed.
- New pure functions (`lib/quoteForm.ts`) get table-driven Vitest tests; page/component-level UI is not unit tested (matches the existing Estimate/Invoice/Sales Order convention in this codebase — the one exception, `lib/paymentForm.test.ts`, is itself a pure-function test file, not a component test).
- `QuoteFormBody` and its siblings take more than 5 props, same as `EstimateFormBody`/`InvoiceFormBody`/`PaymentFormBody`. This is a pre-existing, repo-wide convention across every Sales module form-body component — not something to fix unilaterally as part of this ticket. Do not introduce a one-off prop-bundling pattern that the sibling modules don't share.
- Commits: Conventional Commits (`feat:`, etc.), specific to the affected component.

### Decisions made where the ticket's spec was incomplete or ambiguous (do not re-litigate — apply as written)

1. **Address shape.** The ticket's GET-response JSON for `billing`/`shipping` is `{customerName, addrLine1, addrLine2, city, stateProvince, postalCode, country}` — plain strings, no numeric `stateId`/`countryId`, no `attention`/`suiteUnit`/`phone`/`fax`/`email`. This is a real, deliberate divergence from `EstimateAddressInput` (which uses numeric lookup IDs and more fields) — build `QuoteAddressInput` to that exact shape, and render Bill To / Ship To as plain text inputs, **not** the lookup-driven country/state `<select>` pattern Estimate uses.
2. **Create payload field set.** The ticket's "Create Request Payload" example omits `referenceNumber`, `notes`, `internalNotes`, `termsConditions`, `billing`, `shipping` — but the GET response includes them, and the Update contract is explicitly "same as create minus customerUuid/estimateUuid" (i.e. everything else round-trips). Treat the example as illustrative, not exhaustive: `QuoteCreatePayload` includes the full editable field set derivable from the GET shape, mirroring how `EstimateCreatePayload` was actually built beyond its own illustrative subset. `notes`/`internalNotes`/`termsConditions` are carried in the type for parity but — matching Estimate's own precedent of not surfacing every field in the UI — are not rendered as form fields or detail-page rows in this pass.
3. **Line items are catalog-only.** The ticket's item create example (`{lineNumber, inventoryItemUuid, quantity, unitPrice, discountPercent, taxRateId}`) has no `description` field, unlike `EstimateLineInput`. Estimate's `description` field exists specifically to support a free-text (non-catalog) line — its absence here means a Quote line requires `inventoryItemUuid`. `QuoteItemsTab` enforces this (Save Line is disabled until a catalog item is picked); it does not offer Estimate's free-text-line affordance.
4. **Approval is a real, wired action for Quotes** (unlike Estimate, which defines `approve()` in its service but never calls it from any page). `PAPV` ("Pending Approval") is a real status in the given workflow, so a `QuoteApprovalButton` is shown whenever `statusCode === 'PAPV'`, gated by `hasPermission('quote', 'transition')` since the RBAC action list given (`create, read, update, delete, transition`) has no separate `approve` action.
5. **Convert-to-Sales-Order** is a placeholder: `quoteService.convertToSalesOrder(uuid)` posts to the endpoint and the Detail page shows success/error inline. The response shape isn't specified, so nothing downstream (navigation, cache shape) depends on it.
6. **Source-estimate prefill on create** (`?fromEstimate=<uuid>`) fetches the estimate via the existing `estimateService.getEstimate` and prefills customer, PO number, sales tax %, memo, and only the **catalog-referenced** line items (a free-text estimate line has no `inventoryItemUuid` to carry into a catalog-only quote line — see #3 — so it's dropped, not silently mis-saved). Estimate's billing/shipping address is **not** prefilled: its numeric `stateId`/`countryId` have no direct mapping to Quote's plain-text `stateProvince`/`country` without an extra lookup fetch, which is out of scope here.

---

## Task 1: Quote types & service layer

**Files:**
- Create: `src/types/quote.ts`
- Create: `src/services/quoteService.ts`

**Interfaces:**
- Produces: `QuoteAddressInput`, `QuoteLineInput`, `QuoteCreatePayload`, `QuoteUpdatePayload`, `QuoteCustomerRef`, `QuoteEstimateRef`, `QuoteLine`, `Quote`, `QuoteSummary`, `QuoteSearchRequest`, `QuotePage` (from `src/types/quote.ts`); `quoteService.{searchQuotes, getQuote, createQuote, updateQuote, deleteQuote, transition, approve, getAudit, convertToSalesOrder}` (from `src/services/quoteService.ts`). Every later task imports from these two files.

- [ ] **Step 1: Write `src/types/quote.ts`**

```ts
// Quote module — frontend contract types.
//
// Mirrors the dedicated relational Quote backend module, sibling to Estimate
// (types/estimate.ts) — served from `/api/tenant/quotes*`, distinct from the
// generic WorkflowRecord JSONB CRM router. Unlike Estimate, a Quote's
// billing/shipping address is a flat string shape (no lkp_state/lkp_country
// numeric ids) and a line item always references a catalog item (no
// free-text description line) — see the plan's "Decisions" section for why.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing or shipping snapshot block. All fields optional; the server fills
 *  gaps from the referenced customer at create time. */
export interface QuoteAddressInput {
  customerName?: string;
  addrLine1?: string;
  addrLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

/** One quoted line. Always references a catalog item — the server snapshots
 *  its sku/name/unit/price. Per-line tax comes from `taxRateId` (a named
 *  `lkp_tax_rate`) or defaults to the header `salesTaxPercent`. */
export interface QuoteLineInput {
  lineNumber: number;
  inventoryItemUuid: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface QuoteCreatePayload {
  customerUuid: string;
  /** Set when this quote was converted from an estimate; omit for a
   *  standalone quote. Immutable after create. */
  estimateUuid?: string;
  poNumber?: string;
  referenceNumber?: string;
  quoteDate?: string;          // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  validUntil?: string;         // ISO date "yyyy-mm-dd"
  paymentTermsId?: number | null;
  priceLevelId?: number | null;
  currencyId?: number | null;
  salesRepEmployeeId?: number | null;
  ownerEmployeeId?: number | null;
  salesTaxPercent?: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  shipSameAsBilling?: boolean;
  billing?: QuoteAddressInput;
  shipping?: QuoteAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: QuoteLineInput[];
}

/** Update mirrors create minus the customer and estimate lineage (both fixed
 *  after creation). Rejected by the server with a 400 once the quote has
 *  reached a terminal status (RJCT/EXPR/CANC). */
export type QuoteUpdatePayload = Omit<QuoteCreatePayload, 'customerUuid' | 'estimateUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface QuoteCustomerRef {
  id: string;
  name: string;
}

/** The estimate this quote was converted from, if any — drives the Detail
 *  page's "Source Estimate" link. */
export interface QuoteEstimateRef {
  id: string;
  number: string;
}

export interface QuoteLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  sku: string;
  itemName: string;
  description: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

// Full detail response (GET/Create/Update/Transition/Approve). Every field the
// create/update contract accepts round-trips back here too, so the Edit page
// can reload a quote and re-save it without silently blanking billing/
// shipping or any header field.
export interface Quote {
  id: string;
  quoteNumber: string;
  status: string;              // human label, e.g. "Draft"
  statusCode: string;          // lkp_record_status code, e.g. "DRFT" — drives transitions
  approvalStatus: string;      // none | pending | approved
  customer: QuoteCustomerRef;
  estimate?: QuoteEstimateRef | null;
  quoteDate: string;
  validUntil?: string;
  poNumber?: string;
  referenceNumber?: string;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  paymentTermsId: number | null;
  priceLevelId: number | null;
  currencyId: number | null;
  salesRepEmployeeId: number | null;
  ownerEmployeeId: number | null;
  salesTaxPercent: number;
  shipSameAsBilling: boolean;
  billing: QuoteAddressInput;
  shipping: QuoteAddressInput;
  customFields?: Record<string, unknown>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  createdAt?: string;
  updatedAt?: string;
  items: QuoteLine[];
}

/** List/search rows are full `Quote` records server-side (items omitted) —
 *  this type only names the subset the table actually renders. */
export type QuoteSummary = Pick<
  Quote,
  'id' | 'quoteNumber' | 'status' | 'statusCode' | 'customer' | 'quoteDate' | 'validUntil' | 'grandTotal' | 'createdAt' | 'updatedAt'
>;

export interface QuoteSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface QuotePage {
  records: QuoteSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
```

- [ ] **Step 2: Write `src/services/quoteService.ts`**

```ts
import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Quote,
  QuoteCreatePayload,
  QuoteUpdatePayload,
  QuoteSearchRequest,
  QuotePage,
} from '@/types/quote';

// Quote API wrapper. Talks to the dedicated relational module under
// `/api/tenant/quotes*` (NOT the generic `/api/tenant/crm/*` JSONB router).
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy, RBAC (`quote:*`), scope, and IDOR.
const BASE = '/tenant/quotes';

export const quoteService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchQuotes: (req: QuoteSearchRequest): Promise<QuotePage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: QuotePage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getQuote: (uuid: string): Promise<Quote> =>
    tenantClient
      .get<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}`)
      .then((r) => r.data.quote),

  createQuote: (payload: QuoteCreatePayload): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(BASE, payload)
      .then((r) => r.data.quote),

  updateQuote: (uuid: string, payload: QuoteUpdatePayload): Promise<Quote> =>
    tenantClient
      .patch<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.quote),

  deleteQuote: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.quote),

  // Records this user's approval sign-off on the quote's current status
  // (typically while statusCode === 'PAPV'). Rejected with 409/403 server-side
  // if the status has no approvers configured, or the caller isn't one.
  approve: (uuid: string): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.quote),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Placeholder — the backend endpoint's response shape isn't finalized yet.
  // Callers should only branch on success/failure, not on the resolved value.
  convertToSalesOrder: (uuid: string): Promise<{ salesOrderId?: string }> =>
    tenantClient
      .post<{ success: boolean; salesOrderId?: string }>(`${BASE}/${uuid}/convert-to-sales-order`, {})
      .then((r) => ({ salesOrderId: r.data.salesOrderId })),
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `src/types/quote.ts` or `src/services/quoteService.ts`. (Pre-existing unrelated errors, if any, are not this task's concern.)

- [ ] **Step 4: Commit**

```bash
git add src/types/quote.ts src/services/quoteService.ts
git commit -m "feat: add quote module types and service layer"
```

---

## Task 2: Quote form library (field config, calc, payload mapping) + tests

**Files:**
- Create: `src/lib/quoteForm.ts`
- Create: `src/lib/quoteForm.test.ts`

**Interfaces:**
- Consumes: `Quote`, `QuoteCreatePayload`, `QuoteLineInput` (Task 1); `Estimate` (`@/types/estimate`, read-only, for `fromSourceEstimate`); `CrmLookups` (`@/services/lookupService`).
- Produces: `PAGE_TABS`, `PageTab`, `QuoteFormField`, `PRIMARY_INFO_FIELDS`, `BILL_TO_FIELDS`, `SHIP_TO_FIELDS`, `SALES_INFO_FIELDS`, `QuoteLineItem`, `EMPTY_LINE_ITEM`, `clampPercent`, `calcLineItem`, `QUOTE_STATUS_CODES`, `QUOTE_STATUS_COLORS`, `QUOTE_TERMINAL_STATUSES`, `QUOTE_APPROVAL_PENDING_STATUS`, `quoteDefaults`, `toCreatePayload`, `fromQuote`, `fromSourceEstimate` — every later task in this plan imports from this file.

- [ ] **Step 1: Write the failing test `src/lib/quoteForm.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  clampPercent, calcLineItem, toCreatePayload, fromQuote, fromSourceEstimate,
  QUOTE_TERMINAL_STATUSES, QUOTE_STATUS_CODES,
} from './quoteForm'
import type { Quote } from '@/types/quote'
import type { Estimate } from '@/types/estimate'

describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['150', '100'],
    ['-10', '0'],
    ['abc', 'abc'],
  ])('clampPercent(%p) -> %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected)
  })
})

describe('calcLineItem', () => {
  it('computes amount and total with discount and header tax applied', () => {
    const result = calcLineItem({ quantity: '10', unitPrice: '20', discount: '10' }, 8)
    // amount = 10 * 20 * (1 - 0.10) = 180.00; total = 180 * 1.08 = 194.40
    expect(result).toEqual({ amount: '180.00', total: '194.40' })
  })

  it('returns empty strings when quantity or unit price is missing', () => {
    expect(calcLineItem({ quantity: '', unitPrice: '20', discount: '0' }, 8)).toEqual({ amount: '', total: '' })
    expect(calcLineItem({ quantity: '10', unitPrice: '', discount: '0' }, 8)).toEqual({ amount: '', total: '' })
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    customer_uuid: 'cust-1',
    purchase_doc_num: 'PO-88213',
    reference_number: 'REF-1',
    quote_date: '2026-07-14',
    valid_until: '2026-08-13',
    payment_terms: '3',
    price_level: '2',
    currency_id: '1',
    sales_rep: '12',
    customer_owner: '7',
    sales_tax_pct: '8.25',
    memo: 'Test memo',
    ship_same_as_bill: true,
    bill_address1: '123 Main St',
    bill_city: 'Springfield',
    bill_state_province: 'IL',
    bill_postal_code: '62701',
    bill_country: 'USA',
  }

  it('maps form fields to the create payload', () => {
    const payload = toCreatePayload(baseData, [])
    expect(payload).toMatchObject({
      customerUuid: 'cust-1',
      poNumber: 'PO-88213',
      referenceNumber: 'REF-1',
      quoteDate: '2026-07-14',
      validUntil: '2026-08-13',
      paymentTermsId: 3,
      priceLevelId: 2,
      currencyId: 1,
      salesRepEmployeeId: 12,
      ownerEmployeeId: 7,
      salesTaxPercent: 8.25,
      memo: 'Test memo',
      shipSameAsBilling: true,
      billing: {
        addrLine1: '123 Main St',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62701',
        country: 'USA',
      },
      shipping: undefined,
      items: [],
    })
    expect(payload.estimateUuid).toBeUndefined()
  })

  it('includes estimateUuid when a source estimate id is passed', () => {
    const payload = toCreatePayload(baseData, [], 'est-uuid-1')
    expect(payload.estimateUuid).toBe('est-uuid-1')
  })

  it('sends a distinct shipping block when ship_same_as_bill is false', () => {
    const payload = toCreatePayload({
      ...baseData, ship_same_as_bill: false,
      ship_customer: 'Warehouse Co', ship_address1: '9 Dock Rd', ship_city: 'Metropolis',
      ship_state_province: 'NY', ship_postal_code: '10001', ship_country: 'USA',
    }, [])
    expect(payload.shipping).toEqual({
      customerName: 'Warehouse Co',
      addrLine1: '9 Dock Rd',
      addrLine2: '',
      city: 'Metropolis',
      stateProvince: 'NY',
      postalCode: '10001',
      country: 'USA',
    })
  })

  it('maps line items with a 1-based lineNumber, dropping UI-only display fields', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'a', lineNo: 1, itemName: 'Widget', quantity: '25.5', unitPrice: '42', discount: '5', amount: '1017.79', total: '1101.30', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', quantity: 25.5, unitPrice: 42, discountPercent: 5 },
    ])
  })
})

describe('fromQuote', () => {
  const quote: Quote = {
    id: 'q-1',
    quoteNumber: 'QUOT-000001',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    customer: { id: 'cust-1', name: 'Acme Corp' },
    estimate: null,
    quoteDate: '2026-07-14',
    validUntil: '2026-08-13',
    poNumber: 'PO-88213',
    referenceNumber: 'REF-1',
    memo: 'Memo text',
    paymentTermsId: 3,
    priceLevelId: 2,
    currencyId: 1,
    salesRepEmployeeId: 12,
    ownerEmployeeId: 7,
    salesTaxPercent: 8.25,
    shipSameAsBilling: true,
    billing: { addrLine1: '123 Main St', city: 'Springfield', stateProvince: 'IL', postalCode: '62701', country: 'USA' },
    shipping: {},
    subtotal: 1500,
    discountTotal: 75,
    taxTotal: 118.14,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 1543.14,
    items: [
      {
        id: 'line-1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'SKU-001', itemName: 'Widget',
        description: '', unitCode: 'EA', quantity: 25.5, unitPrice: 42, discountPercent: 5, taxPercent: 8.25,
        lineSubtotal: 1017.79, lineDiscount: 53.55, lineTax: 83.85, lineTotal: 1101.30,
      },
    ],
  }

  it('maps a loaded quote back to editable form state', () => {
    const { data, customer } = fromQuote(quote)
    expect(data).toMatchObject({
      quote_doc_num: 'QUOT-000001',
      purchase_doc_num: 'PO-88213',
      reference_number: 'REF-1',
      quote_date: '2026-07-14',
      valid_until: '2026-08-13',
      sales_tax_pct: '8.25',
      bill_address1: '123 Main St',
      bill_city: 'Springfield',
      bill_state_province: 'IL',
      bill_postal_code: '62701',
      bill_country: 'USA',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Corp' })
  })

  it('maps line items, preferring itemName over description', () => {
    const { lineItems } = fromQuote(quote)
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({
      lineNo: 1, itemName: 'Widget', itemSku: 'SKU-001', units: 'EA',
      quantity: '25.5', unitPrice: '42', discount: '5', inventoryItemUuid: 'inv-1',
    })
  })
})

describe('fromSourceEstimate', () => {
  const estimate: Estimate = {
    id: 'est-1',
    estimateNumber: 'ESTM-000012',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    customer: { id: 'cust-1', name: 'Acme Corp' },
    estimateDate: '2026-07-01',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    salesRepEmployeeId: null,
    ownerEmployeeId: null,
    salesTaxPercent: 8.25,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    subtotal: 1000,
    discountTotal: 0,
    taxTotal: 82.5,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 1082.5,
    poNumber: 'PO-99',
    memo: 'Estimate memo',
    items: [
      {
        id: 'line-1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'SKU-001', itemName: 'Widget',
        description: '', unitCode: 'EA', quantity: 10, unitPrice: 100, discountPercent: 0, taxPercent: 8.25,
        lineSubtotal: 1000, lineDiscount: 0, lineTax: 82.5, lineTotal: 1082.5,
      },
      {
        id: 'line-2', lineNumber: 2, inventoryItemId: null, sku: '', itemName: '', description: 'Custom labor',
        unitCode: '', quantity: 5, unitPrice: 50, discountPercent: 0, taxPercent: 8.25,
        lineSubtotal: 250, lineDiscount: 0, lineTax: 20.63, lineTotal: 270.63,
      },
    ],
  }

  it('prefills header fields and customer from the estimate', () => {
    const { data, customer } = fromSourceEstimate(estimate)
    expect(data).toEqual({
      purchase_doc_num: 'PO-99',
      sales_tax_pct: '8.25',
      memo: 'Estimate memo',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Corp' })
  })

  it('drops free-text estimate lines that have no catalog reference', () => {
    const { lineItems } = fromSourceEstimate(estimate)
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0].inventoryItemUuid).toBe('inv-1')
  })
})

describe('QUOTE_TERMINAL_STATUSES', () => {
  it('treats RJCT, EXPR, and CANC as terminal', () => {
    expect(QUOTE_TERMINAL_STATUSES.has('RJCT')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('EXPR')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('CANC')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('DRFT')).toBe(false)
  })

  it('matches every non-terminal code in QUOTE_STATUS_CODES for reference', () => {
    const nonTerminal = QUOTE_STATUS_CODES.map((s) => s.code).filter((c) => !QUOTE_TERMINAL_STATUSES.has(c))
    expect(nonTerminal).toEqual(['DRFT', 'PAPV', 'APPV', 'SENT'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/quoteForm.test.ts`
Expected: FAIL — `Cannot find module './quoteForm'` (the module doesn't exist yet).

- [ ] **Step 3: Write `src/lib/quoteForm.ts`**

```ts
// Quote form field definitions — mirrors lib/estimateForm.ts's shape,
// adapted to the Quote backend contract (types/quote.ts). Field keys are
// UI-facing (mapped to the create/update payload via toCreatePayload, not
// sent to the backend verbatim).

import type { CrmLookups } from '@/services/lookupService';
import type { Quote, QuoteCreatePayload, QuoteLineInput } from '@/types/quote';
import type { Estimate } from '@/types/estimate';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface QuoteFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'email' | 'tel' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
  /** When set, options are sourced from CrmLookups[lookupKey] (id/name pairs)
   *  instead of the static `options` string list — the field's value becomes
   *  the lookup row's numeric id (as a string), matching the create payload's
   *  *Id fields. */
  lookupKey?: keyof CrmLookups;
  /** For a lookupKey field whose rows carry a `countryId`: only show options
   *  where countryId matches the value of this other field. Unused by
   *  Quote's address fields (plain text, no lookup — see BILL_TO_FIELDS doc)
   *  but kept on the type for parity with any future lookup-backed field. */
  dependsOn?: string;
  placeholder?: string;
  /** Span two grid columns */
  colSpan2?: boolean;
  /** Span all grid columns */
  colSpanFull?: boolean;
  /** Only render when the referenced field is false/unchecked */
  showIfFieldFalse?: string;
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
  /** Small helper line rendered under the field */
  hint?: string;
  /** Native min/max for type: 'number' fields */
  min?: number;
  max?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: QuoteFormField[] = [
  {
    key: 'quote_status',
    label: 'Quote Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'quote_doc_num',
    label: 'Quote #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'purchase_doc_num',
    label: 'Purchase Order #',
    type: 'text',
    placeholder: 'Enter PO number',
  },
  {
    key: 'reference_number',
    label: 'Reference #',
    type: 'text',
    placeholder: 'Enter a reference number',
  },
  {
    key: 'quote_date',
    label: 'Quote Date',
    type: 'date',
    required: true,
  },
  {
    key: 'valid_until',
    label: 'Valid Until',
    type: 'date',
    hint: 'Leave blank if this quote has no expiration date.',
  },
  {
    key: 'sales_tax_pct',
    label: 'Sales Tax %',
    type: 'number',
    placeholder: '0.00',
    min: 0,
    max: 100,
  },
  {
    key: 'currency_id',
    label: 'Currency',
    type: 'select',
    lookupKey: 'currencies',
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this quote…',
    colSpanFull: true,
  },
];

// bill_customer/bill_customer_uuid are handled by a dedicated customer picker
// (CustomerPicker) in AddQuotePage, not the generic QuoteSectionGrid — a
// customer is a searchable record, not a static lookup list.
//
// Unlike Estimate's Bill To (numeric lookupKey country/state selects), a
// Quote's billing block is the flat string shape given by the backend
// contract (QuoteAddressInput: addrLine1/addrLine2/city/stateProvince/
// postalCode/country, no attention/suiteUnit/phone/fax/email) — every
// address field here is plain text.
export const BILL_TO_FIELDS: QuoteFormField[] = [
  {
    key: 'bill_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'bill_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  { key: 'bill_city', label: 'City', type: 'text', placeholder: 'City' },
  { key: 'bill_state_province', label: 'State / Province', type: 'text', placeholder: 'State or province' },
  { key: 'bill_postal_code', label: 'Postal Code', type: 'text', placeholder: '12345' },
  { key: 'bill_country', label: 'Country', type: 'text', placeholder: 'Country' },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    lookupKey: 'paymentTerms',
  },
  {
    key: 'price_level',
    label: 'Price Level',
    type: 'select',
    lookupKey: 'priceLevels',
  },
];

export const SHIP_TO_FIELDS: QuoteFormField[] = [
  {
    key: 'ship_same_as_bill',
    label: 'Is Same as Billing Customer',
    type: 'checkbox',
    colSpanFull: true,
  },
  {
    key: 'ship_customer',
    label: 'Shipping Customer',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'Shipping customer name',
  },
  {
    key: 'ship_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    showIfFieldFalse: 'ship_same_as_bill',
    colSpan2: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'ship_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    showIfFieldFalse: 'ship_same_as_bill',
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  {
    key: 'ship_city',
    label: 'City',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'City',
  },
  {
    key: 'ship_state_province',
    label: 'State / Province',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'State or province',
  },
  {
    key: 'ship_postal_code',
    label: 'Postal Code',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: '12345',
  },
  {
    key: 'ship_country',
    label: 'Country',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'Country',
  },
];

// sales_rep/customer_owner are employee references — sourced from the
// `employees` lookup rather than free text, matching salesRepEmployeeId /
// ownerEmployeeId (employee FKs) on the create payload.
export const SALES_INFO_FIELDS: QuoteFormField[] = [
  {
    key: 'sales_rep',
    label: 'Sales Rep',
    type: 'select',
    lookupKey: 'employees',
  },
  {
    key: 'customer_owner',
    label: 'Customer Owner',
    type: 'select',
    lookupKey: 'employees',
  },
];

// ── Items sub-tab ─────────────────────────────────────────────────────────────

// Unlike Estimate, a Quote line always references a catalog item — there is
// no free-text `description` field on QuoteLineInput (see the plan's
// "Decisions" section, #3). `itemName`/`itemSku`/`units` below are populated
// only by picking a catalog item; typing without picking leaves the line
// incomplete and un-savable (enforced in QuoteItemsTab, not here). Per-line
// tax always follows the header's Sales Tax % (there's no tax-rate picker UI
// yet), so `total` is computed from the header rate, not a per-line one.
export interface QuoteLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  amount: string;   // calculated
  total: string;    // calculated, using the header's Sales Tax %
  /** Catalog reference — required for a line to be committable (see doc
   *  above). Maps to the create payload's `inventoryItemUuid`. */
  inventoryItemUuid?: string;
  itemSku?: string;
  units?: string;
}

export const EMPTY_LINE_ITEM: Omit<QuoteLineItem, 'id' | 'lineNo'> = {
  itemName: '',
  quantity: '',
  unitPrice: '',
  discount: '0',
  amount: '',
  total: '',
};

/** Clamps a percent field (discount) to [0, 100] as the user types, mirroring
 *  the backend's range check. Needed because rows in the items table commit
 *  via a button click, not a native form submit, so an `<input min max>`
 *  alone never blocks an out-of-range value. */
export function clampPercent(raw: string): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  const clamped = Math.min(100, Math.max(0, n));
  return clamped === n ? raw : String(clamped);
}

/** Client-side estimate of a line's amount/total, using the header's Sales
 *  Tax % (the backend defaults every line to that rate unless a taxRateId is
 *  set, which this form doesn't yet expose — see QuoteLineItem doc). */
export function calcLineItem(
  item: Pick<QuoteLineItem, 'quantity' | 'unitPrice' | 'discount'>,
  headerTaxPercent: number,
): { amount: string; total: string } {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  const amount = qty * price * (1 - disc / 100);
  const total = amount * (1 + (headerTaxPercent || 0) / 100);
  return {
    amount: qty && price ? amount.toFixed(2) : '',
    total: qty && price ? total.toFixed(2) : '',
  };
}

// ── Status catalog (matches the given workflow — fixed, forward-only state machine) ─

/** Every `lkp_record_status` row seeded for the QUOT record type. The backend
 *  is the source of truth for which moves are actually legal from a given
 *  status — this list only drives the Edit page's "change status" select; an
 *  illegal pick is rejected server-side with a 409, surfaced as a normal
 *  save error. */
export const QUOTE_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SENT', label: 'Sent' },
  { code: 'RJCT', label: 'Rejected' },
  { code: 'EXPR', label: 'Expired' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Status badge color, keyed by the human label (matches
 *  QUOTE_STATUS_CODES' labels) — shared by the list table, detail page,
 *  and status control. */
export const QUOTE_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  'Pending Approval': '#f59e0b',
  Approved: '#3b82f6',
  Sent: '#6366f1',
  Rejected: '#ef4444',
  Expired: '#78716c',
  Cancelled: '#78716c',
};

/** Statuses `quoteService.updateQuote` rejects edits against — a rejected,
 *  expired, or cancelled quote cannot be edited. */
export const QUOTE_TERMINAL_STATUSES = new Set(['RJCT', 'EXPR', 'CANC']);

/** Status code at which a Quote is awaiting sign-off — QuoteApprovalButton is
 *  shown only when the current status matches this (see plan Decision #4). */
export const QUOTE_APPROVAL_PENDING_STATUS = 'PAPV';

// ── Form defaults ─────────────────────────────────────────────────────────────

export function quoteDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    quote_date: today,
    quote_status: 'Draft',
    ship_same_as_bill: false,
    sales_tax_pct: '0',
  };
}

// ── Payload mapping (UI form state -> backend create contract) ───────────────

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

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Maps one editable line row to the create/update contract's line shape. A
 *  Quote line always carries `inventoryItemUuid` (QuoteItemsTab won't let a
 *  row commit without one — see QuoteLineItem doc). */
function toLineInput(item: QuoteLineItem, lineNo: number): QuoteLineInput {
  return {
    lineNumber: lineNo,
    inventoryItemUuid: item.inventoryItemUuid ?? '',
    quantity: toNum(item.quantity),
    unitPrice: toNum(item.unitPrice),
    discountPercent: toNum(item.discount),
  };
}

/** Maps the Add/Edit Quote form state + line items to the backend's
 *  `QuoteCreatePayload`. `customerUuid` comes from the CustomerPicker's
 *  selection (stored under `customer_uuid` in form state) — the free-text
 *  billing display name is never sent, only the id. Status is intentionally
 *  omitted: every new quote starts at DRFT server-side; status changes go
 *  through the `/transition` endpoint. `estimateUuid` is passed separately
 *  (not stored in `data`) since it only applies on create, from a source
 *  estimate the create form was navigated from — see plan Decision #6. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: QuoteLineItem[],
  estimateUuid?: string,
): QuoteCreatePayload {
  const shipSameAsBilling = Boolean(data.ship_same_as_bill);

  return {
    customerUuid: toStr(data.customer_uuid),
    estimateUuid: estimateUuid || undefined,
    poNumber: toStr(data.purchase_doc_num),
    referenceNumber: toStr(data.reference_number),
    quoteDate: toStr(data.quote_date),
    validUntil: toStr(data.valid_until) || undefined,
    paymentTermsId: toIntOrNull(data.payment_terms),
    priceLevelId: toIntOrNull(data.price_level),
    currencyId: toIntOrNull(data.currency_id),
    salesRepEmployeeId: toIntOrNull(data.sales_rep),
    ownerEmployeeId: toIntOrNull(data.customer_owner),
    salesTaxPercent: toNum(data.sales_tax_pct),
    memo: toStr(data.memo),
    shipSameAsBilling,
    billing: {
      addrLine1: toStr(data.bill_address1),
      addrLine2: toStr(data.bill_address2),
      city: toStr(data.bill_city),
      stateProvince: toStr(data.bill_state_province),
      postalCode: toStr(data.bill_postal_code),
      country: toStr(data.bill_country),
    },
    shipping: shipSameAsBilling ? undefined : {
      customerName: toStr(data.ship_customer),
      addrLine1: toStr(data.ship_address1),
      addrLine2: toStr(data.ship_address2),
      city: toStr(data.ship_city),
      stateProvince: toStr(data.ship_state_province),
      postalCode: toStr(data.ship_postal_code),
      country: toStr(data.ship_country),
    },
    customFields: {},
    items: lineItems.map((item, i) => toLineInput(item, i + 1)),
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded Quote (GET response) back to the Edit form's state — the
 *  inverse of toCreatePayload. Customer is returned separately since it's
 *  driven by CustomerPicker's own state, not a plain form field. */
export function fromQuote(quote: Quote): {
  data: Record<string, unknown>;
  lineItems: QuoteLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    quote_status: quote.status,
    quote_doc_num: quote.quoteNumber,
    purchase_doc_num: quote.poNumber ?? '',
    reference_number: quote.referenceNumber ?? '',
    quote_date: quote.quoteDate,
    valid_until: quote.validUntil ?? '',
    sales_tax_pct: String(quote.salesTaxPercent ?? 0),
    currency_id: idOrEmpty(quote.currencyId),
    memo: quote.memo ?? '',
    bill_address1: quote.billing.addrLine1 ?? '',
    bill_address2: quote.billing.addrLine2 ?? '',
    bill_city: quote.billing.city ?? '',
    bill_state_province: quote.billing.stateProvince ?? '',
    bill_postal_code: quote.billing.postalCode ?? '',
    bill_country: quote.billing.country ?? '',
    payment_terms: idOrEmpty(quote.paymentTermsId),
    price_level: idOrEmpty(quote.priceLevelId),
    ship_same_as_bill: quote.shipSameAsBilling,
    ship_customer: quote.shipping.customerName ?? '',
    ship_address1: quote.shipping.addrLine1 ?? '',
    ship_address2: quote.shipping.addrLine2 ?? '',
    ship_city: quote.shipping.city ?? '',
    ship_state_province: quote.shipping.stateProvince ?? '',
    ship_postal_code: quote.shipping.postalCode ?? '',
    ship_country: quote.shipping.country ?? '',
    sales_rep: idOrEmpty(quote.salesRepEmployeeId),
    customer_owner: idOrEmpty(quote.ownerEmployeeId),
  };

  const lineItems: QuoteLineItem[] = quote.items.map((line, i) => ({
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    itemName: line.itemName || line.description,
    itemSku: line.sku,
    units: line.unitCode,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    discount: String(line.discountPercent),
    amount: line.lineSubtotal.toFixed(2),
    total: line.lineTotal.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
  }));

  return { data, lineItems, customer: { id: quote.customer.id, name: quote.customer.name } };
}

/** Prefills the Add Quote form from a source estimate (`?fromEstimate=<uuid>`
 *  — see plan Decision #6). Only header fields with a direct, unambiguous
 *  mapping are carried over (PO number, sales tax %, memo); billing/shipping
 *  is intentionally left blank since Estimate's numeric stateId/countryId
 *  have no direct mapping to Quote's plain-text stateProvince/country. Only
 *  catalog-referenced estimate lines carry over — a Quote line requires
 *  inventoryItemUuid (see QuoteLineItem doc), so a free-text estimate line
 *  is dropped rather than silently saved as an incomplete line. */
export function fromSourceEstimate(estimate: Estimate): {
  data: Record<string, unknown>;
  lineItems: QuoteLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    purchase_doc_num: estimate.poNumber ?? '',
    sales_tax_pct: String(estimate.salesTaxPercent ?? 0),
    memo: estimate.memo ?? '',
  };

  const lineItems: QuoteLineItem[] = estimate.items
    .filter((line) => Boolean(line.inventoryItemId))
    .map((line, i) => ({
      id: `from-estimate-${i}`,
      lineNo: i + 1,
      itemName: line.itemName || line.description,
      itemSku: line.sku,
      units: line.unitCode,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice),
      discount: String(line.discountPercent),
      amount: line.lineSubtotal.toFixed(2),
      total: line.lineTotal.toFixed(2),
      inventoryItemUuid: line.inventoryItemId ?? undefined,
    }));

  return { data, lineItems, customer: { id: estimate.customer.id, name: estimate.customer.name } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/quoteForm.test.ts`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `src/lib/quoteForm.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quoteForm.ts src/lib/quoteForm.test.ts
git commit -m "feat: add quote form field config, calc, and payload mapping"
```

---

## Task 3: Shared field renderer — `QuoteFormFields.tsx`

**Files:**
- Create: `src/pages/sales/components/QuoteFormFields.tsx`

**Interfaces:**
- Consumes: `QuoteFormField` (Task 2); `ModernFieldShell` (`@/components/crm/FormPrimitives`); `fieldCls, textareaCls, readonlyCls, checkboxLabelCls` (`@/components/crm/formUtils`); `CrmLookups` (`@/services/lookupService`).
- Produces: `QuoteField`, `QuoteSectionGrid` — consumed by Task 6 (`QuoteFormBody`).

- [ ] **Step 1: Write `src/pages/sales/components/QuoteFormFields.tsx`**

```tsx
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls, checkboxLabelCls,
} from '@/components/crm/formUtils';
import type { CrmLookups } from '@/services/lookupService';
import type { QuoteFormField } from '@/lib/quoteForm';

// Renders one QuoteFormField — shared by the Add and Edit Quote forms.
// Mirrors EstimateFormFields' EstimateField/EstimateSectionGrid.
export function QuoteField({ field, value, set, lookups, dependsOnValue }: {
  field: QuoteFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  /** Current value of the field named by `field.dependsOn`, when set. Kept
   *  for parity with EstimateField's signature — no current Quote field uses
   *  dependsOn (Quote's address fields are plain text, not lookup-driven). */
  dependsOnValue?: unknown;
}) {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const checked = value === true;

  if (field.type === 'checkbox') {
    return (
      <div className="col-span-full flex items-center gap-3 py-1.5">
        <input
          type="checkbox"
          id={field.key}
          checked={checked}
          onChange={(e) => set(field.key, e.target.checked)}
          className="h-4 w-4 rounded border border-stone-300 accent-brand cursor-pointer shrink-0 bg-white [color-scheme:light]"
          aria-label={field.label}
        />
        <label htmlFor={field.key} className={`${checkboxLabelCls} cursor-pointer select-none`}>
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      </div>
    );
  }

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
    // lookupKey fields (payment terms/price level/currency/employee) source
    // their options from CrmLookups by numeric id, so the stored value is
    // the id (string) — matching the create payload's *Id fields — rather
    // than a display label.
    const lookupRows = field.lookupKey && lookups
      ? (lookups[field.lookupKey] as Array<{ id: number; name: string; countryId?: number }>)
      : null;
    const dependsOnUnset = Boolean(field.dependsOn) && !dependsOnValue;
    const filteredRows = lookupRows && field.dependsOn
      ? lookupRows.filter((row) => String(row.countryId ?? '') === String(dependsOnValue ?? ''))
      : lookupRows;

    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
            disabled={dependsOnUnset}
          >
            <option value="">{dependsOnUnset ? '— Select a country first —' : '— Select —'}</option>
            {filteredRows
              ? filteredRows.map((row) => (
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
          min={field.min}
          max={field.max}
          aria-label={field.label}
        />
        {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
      </ModernFieldShell>
    </div>
  );
}

export function QuoteSectionGrid({ fields, data, set, lookups, maxCols = 3 }: {
  fields: QuoteFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lookups?: CrmLookups;
  maxCols?: 2 | 3;
}) {
  const visible = fields.filter((f) =>
    f.showIfFieldFalse ? !data[f.showIfFieldFalse] : true,
  );
  return (
    <div className={`grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 ${maxCols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {visible.map((f) => (
        <QuoteField
          key={f.key}
          field={f}
          value={data[f.key]}
          set={set}
          lookups={lookups}
          dependsOnValue={f.dependsOn ? data[f.dependsOn] : undefined}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteFormFields.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/components/QuoteFormFields.tsx
git commit -m "feat: add quote form field renderer"
```

---

## Task 4: Line items editor — `QuoteItemsTab.tsx`

**Files:**
- Create: `src/pages/sales/components/QuoteItemsTab.tsx`

**Interfaces:**
- Consumes: `EMPTY_LINE_ITEM, calcLineItem, clampPercent, QuoteLineItem` (Task 2); `InventoryItemPicker` (`./InventoryItemPicker`, existing shared component — do not modify); `InventoryItem` (`@/services/inventoryService`).
- Produces: `QuoteItemsTab({items, onUpdate, headerTaxPercent})` — consumed by Task 6 (`QuoteFormBody`).

- [ ] **Step 1: Write `src/pages/sales/components/QuoteItemsTab.tsx`**

```tsx
import { useState } from 'react';
import { Plus, Trash2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InventoryItemPicker } from './InventoryItemPicker';
import type { InventoryItem } from '@/services/inventoryService';
import {
  EMPTY_LINE_ITEM, calcLineItem, clampPercent, type QuoteLineItem,
} from '@/lib/quoteForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

let rowCounter = 0;
function genId() { rowCounter += 1; return `li-${rowCounter}`; }

// `right: true` marks columns whose body cells render right-aligned
// (tabular-nums quantities/currency) — the header must match or the label
// reads misaligned against the numbers underneath it.
const ITEM_COLS = [
  { label: '#', w: 'w-8' },
  { label: 'Item Name *', w: 'min-w-[160px]' },
  { label: 'SKU', w: 'min-w-[90px]' },
  { label: 'Units', w: 'w-16' },
  { label: 'Qty', w: 'w-16', right: true },
  { label: 'Unit Price', w: 'w-20', right: true },
  { label: 'Disc %', w: 'w-16', right: true },
  { label: 'Amount', w: 'w-20', right: true },
  { label: 'Tax %', w: 'w-16', right: true },
  { label: 'Total', w: 'w-20', right: true },
  { label: '', w: 'w-8' },
];

// Mirrors EstimateItemsTab, with one behavioral difference: a Quote line
// always requires a catalog reference (QuoteLineInput has no free-text
// `description` field — see quoteForm.ts's QuoteLineItem doc), so Save Line
// is disabled until the user picks a catalog suggestion, not just types a
// name.
export function QuoteItemsTab({ items, onUpdate, headerTaxPercent }: {
  items: QuoteLineItem[];
  onUpdate: (v: QuoteLineItem[]) => void;
  headerTaxPercent: number;
}) {
  const [draft, setDraft] = useState<Omit<QuoteLineItem, 'id' | 'lineNo'>>(EMPTY_LINE_ITEM);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const recalc = (next: Omit<QuoteLineItem, 'id' | 'lineNo'>) => {
    const { amount, total } = calcLineItem(next, headerTaxPercent);
    return { ...next, amount, total };
  };

  const updateDraft = (key: 'quantity' | 'unitPrice' | 'discount', val: string) => {
    const nextVal = key === 'discount' ? clampPercent(val) : val;
    setDraft((prev) => recalc({ ...prev, [key]: nextVal }));
  };

  // Typing the item name detaches the line from any previously picked
  // catalog item — a fresh pick is required before the line can be saved.
  const onItemNameText = (text: string) => {
    setDraft((prev) => recalc({ ...prev, itemName: text, inventoryItemUuid: undefined, itemSku: '', units: '' }));
  };

  // Picking a catalog suggestion snapshots its display fields into the draft;
  // the server re-snapshots authoritatively from inventoryItemUuid at save time.
  const pickCatalogItem = (item: InventoryItem) => {
    setDraft((prev) => recalc({
      ...prev,
      itemName: item.name,
      itemSku: item.sku,
      unitPrice: String(item.unitPrice),
      inventoryItemUuid: item.id,
    }));
  };

  const canCommit = Boolean(draft.itemName) && Boolean(draft.inventoryItemUuid);

  const commitAdd = () => {
    if (!canCommit) return;
    onUpdate([...items, { ...draft, id: genId(), lineNo: items.length + 1 }]);
    setDraft(EMPTY_LINE_ITEM);
    setIsAdding(false);
  };

  const commitEdit = () => {
    if (!editId || !canCommit) return;
    onUpdate(items.map((r) => r.id === editId ? { ...draft, id: editId, lineNo: r.lineNo } : r));
    setEditId(null);
    setDraft(EMPTY_LINE_ITEM);
  };

  const startEdit = (row: QuoteLineItem) => {
    setEditId(row.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, lineNo, ...rest } = row;
    setDraft(rest);
    setIsAdding(false);
  };

  const remove = (id: string) => {
    const next = items.filter((r) => r.id !== id).map((r, i) => ({ ...r, lineNo: i + 1 }));
    onUpdate(next);
    if (editId === id) { setEditId(null); setDraft(EMPTY_LINE_ITEM); }
  };

  const copyPrev = () => {
    if (!items.length) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, lineNo, ...rest } = items[items.length - 1];
    setDraft(rest);
    setIsAdding(true);
    setEditId(null);
  };

  const activeDraft = isAdding || editId !== null;
  const needsCatalogPick = activeDraft && Boolean(draft.itemName) && !draft.inventoryItemUuid;

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="divide-x divide-stone-200">
              {ITEM_COLS.map((c) => (
                <th key={c.label} className={cn('px-2.5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', c.w, c.right && 'text-right')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((row) =>
              editId === row.id ? (
                <tr key={row.id} className="bg-brand/5 divide-x divide-stone-100">
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} onItemNameText={onItemNameText} onPickItem={pickCatalogItem} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors cursor-pointer group divide-x divide-stone-100" onClick={() => startEdit(row)}>
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{row.lineNo}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.itemName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 font-mono text-2xs">{row.itemSku || '—'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500">{row.units || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.quantity}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.unitPrice ? `$${parseFloat(row.unitPrice).toFixed(2)}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.discount ? `${row.discount}%` : '0%'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-700 font-medium">{row.amount ? `$${row.amount}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-400">{headerTaxPercent}%</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{row.total ? `$${row.total}` : '—'}</td>
                  <td className="px-2 py-2.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={(e) => { e.stopPropagation(); remove(row.id); }} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5 divide-x divide-stone-100">
                <InlineItemRow lineNo={items.length + 1} draft={draft} onChange={updateDraft} onItemNameText={onItemNameText} onPickItem={pickCatalogItem} />
                <td className="px-2 py-1.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No line items yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Line</strong> to add an item.</p>
        </div>
      )}

      {needsCatalogPick && (
        <p className="px-4 pt-2 text-2xs text-amber-600">
          Select a catalog item from the suggestions to add this line — quotes don't support free-text lines.
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
        <button
          type="button"
          disabled={activeDraft && !canCommit}
          onClick={() => {
            if (isAdding) commitAdd();
            else if (editId) commitEdit();
            else { setIsAdding(true); setEditId(null); setDraft(EMPTY_LINE_ITEM); }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="size-3" />
          {isAdding || editId ? 'Save Line' : 'Add Line'}
        </button>
        {activeDraft && (
          <button type="button" onClick={() => { setIsAdding(false); setEditId(null); setDraft(EMPTY_LINE_ITEM); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <X className="size-3" /> Cancel
          </button>
        )}
        <button type="button" onClick={copyPrev} disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors">
          <Copy className="size-3" /> Copy Previous
        </button>
        <button type="button" onClick={() => { if (items.length) remove(items[items.length - 1].id); }}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors">
          <Trash2 className="size-3" /> Remove Last
        </button>
      </div>
    </div>
  );
}

function InlineItemRow({ lineNo, draft, onChange, onItemNameText, onPickItem }: {
  lineNo: number;
  draft: Omit<QuoteLineItem, 'id' | 'lineNo'>;
  onChange: (key: 'quantity' | 'unitPrice' | 'discount', val: string) => void;
  onItemNameText: (text: string) => void;
  onPickItem: (item: InventoryItem) => void;
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5">
        <InventoryItemPicker value={draft.itemName} onTextChange={onItemNameText} onPick={onPickItem} className="min-w-[150px]" />
      </td>
      <td className="px-2 py-1.5 text-stone-400 font-mono text-2xs">{draft.itemSku || '—'}</td>
      <td className="px-2 py-1.5 text-stone-400 text-2xs">{draft.units || '—'}</td>
      <td className="px-2 py-1.5"><input type="number" min="0" value={draft.quantity} onChange={(e) => onChange('quantity', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Quantity" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => onChange('unitPrice', e.target.value)} placeholder="0.00" className={cn(inlineCls, 'w-20 text-right')} aria-label="Unit Price" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" max="100" value={draft.discount} onChange={(e) => onChange('discount', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Discount %" /></td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.amount ? `$${draft.amount}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-500 cursor-default text-right')} aria-label="Amount" /></td>
      <td className="px-2 py-1.5 text-stone-400 text-2xs text-right">—</td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.total ? `$${draft.total}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-800 font-semibold cursor-default text-right')} aria-label="Total" /></td>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteItemsTab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/components/QuoteItemsTab.tsx
git commit -m "feat: add quote line items editor"
```

---

## Task 5: Small quote components — status control, approval button, audit tab, delete dialog

**Files:**
- Create: `src/pages/sales/components/QuoteStatusControl.tsx`
- Create: `src/pages/sales/components/QuoteApprovalButton.tsx`
- Create: `src/pages/sales/components/QuoteAuditTab.tsx`
- Create: `src/pages/sales/components/DeleteQuoteDialog.tsx`

**Interfaces:**
- Consumes: `QUOTE_STATUS_CODES` (Task 2); `quoteService` (Task 1); `Quote` type (Task 1); `fieldCls` (`@/components/crm/formUtils`); `Spinner` (`@/components/tenant/ui`); `AuditEntry` (`@/services/crmService`); `apiErrorMessage` (`@/api/tenantClient`).
- Produces: `QuoteStatusControl({value, onChange, disabled})`, `QuoteApprovalButton({quoteId, onApproved})`, `QuoteAuditTab({quoteId})`, `DeleteQuoteDialog({quoteId, label, onDeleted})` — consumed by Tasks 6 (form body), 9 (edit page), 10 (detail page).

- [ ] **Step 1: Write `src/pages/sales/components/QuoteStatusControl.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { QUOTE_STATUS_CODES } from '@/lib/quoteForm';

// Status select for the Quote Edit page, mirroring EstimateStatusControl.
// Quote has a small, fixed state machine with no admin-configurable states,
// so this is a static list rather than a fetched one. The backend is the
// source of truth for which moves are legal from the current status — an
// illegal pick is rejected with 409, surfaced as a normal save error.
export function QuoteStatusControl({ value, onChange, disabled }: {
  value: string; // current status code, e.g. "DRFT"
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

  const selected = QUOTE_STATUS_CODES.find((s) => s.code === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-label="Select status"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`${fieldCls} flex items-center gap-2`}
      >
        <span className="flex-1 text-left">{selected?.label ?? value}</span>
        <ChevronDown className="size-3 shrink-0 text-stone-400" />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-md">
          {QUOTE_STATUS_CODES.map((s) => (
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

- [ ] **Step 2: Write `src/pages/sales/components/QuoteApprovalButton.tsx`**

```tsx
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { Quote } from '@/types/quote';

// Records this user's approval sign-off (POST /quotes/{id}/approve). Shown
// by the Edit and Detail pages only while statusCode === QUOTE_APPROVAL_
// PENDING_STATUS — see quoteForm.ts's doc and plan Decision #4. Unlike a
// normal status transition, approval has no "toStatusCode" to pick; it's a
// single action.
export function QuoteApprovalButton({ quoteId, onApproved }: {
  quoteId: string;
  onApproved: (updated: Quote) => void;
}) {
  const approve = useMutation({
    mutationFn: () => quoteService.approve(quoteId),
    onSuccess: onApproved,
  });

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => approve.mutate()}
        disabled={approve.isPending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
      >
        {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        {approve.isPending ? 'Approving…' : 'Approve Quote'}
      </button>
      {approve.error && (
        <p className="text-2xs text-destructive">{apiErrorMessage(approve.error, 'Failed to approve quote.')}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/pages/sales/components/QuoteAuditTab.tsx`**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { quoteService } from '@/services/quoteService';
import type { AuditEntry } from '@/services/crmService';

// Mirrors EstimateAuditTab, but reads from quoteService.getAudit
// (/api/tenant/quotes/{uuid}/audit).
export function QuoteAuditTab({ quoteId }: { quoteId?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['quote-audit', quoteId],
    queryFn: () => quoteService.getAudit(quoteId!),
    enabled: Boolean(quoteId),
  });

  if (!quoteId) {
    return <p className="py-12 text-center text-sm text-stone-400">Audit trail will be available after saving the quote.</p>;
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

- [ ] **Step 4: Write `src/pages/sales/components/DeleteQuoteDialog.tsx`**

```tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { quoteService } from '@/services/quoteService';
import { apiErrorMessage } from '@/api/tenantClient';

// Mirrors DeleteEstimateDialog's look, but calls quoteService.deleteQuote
// directly (no reason field — the quote DELETE endpoint doesn't accept one).
export function DeleteQuoteDialog({ quoteId, label, onDeleted }: {
  quoteId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => quoteService.deleteQuote(quoteId),
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
        Delete quote
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-quote-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="delete-quote-dialog-title" className="text-sm font-bold text-stone-900">
                  Delete quote?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 text-xs text-destructive">
                {apiErrorMessage(del.error, 'Failed to delete quote.')}
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
                {del.isPending ? 'Deleting…' : 'Delete quote'}
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

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing any of the four new files.

- [ ] **Step 6: Commit**

```bash
git add src/pages/sales/components/QuoteStatusControl.tsx src/pages/sales/components/QuoteApprovalButton.tsx src/pages/sales/components/QuoteAuditTab.tsx src/pages/sales/components/DeleteQuoteDialog.tsx
git commit -m "feat: add quote status control, approval button, audit tab, and delete dialog"
```

---

## Task 6: Summary card + form body — `QuoteSummaryCard.tsx`, `QuoteFormBody.tsx`

**Files:**
- Create: `src/pages/sales/components/QuoteSummaryCard.tsx`
- Create: `src/pages/sales/components/QuoteFormBody.tsx`

**Interfaces:**
- Consumes: `QuoteSectionGrid` (Task 3); `QuoteItemsTab` (Task 4); `QuoteAuditTab` (Task 5); `PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS, PAGE_TABS, PageTab, QuoteLineItem` (Task 2); `CustomerPicker, CustomerRef` (`./CustomerPicker`, existing); `ModernSection, ModernFieldShell` (`@/components/crm/FormPrimitives`); `EditableFilesPanel, EditableFilesPanelHandle` (`@/components/crm/CrmSubTabsPanel`); `readonlyCls` (`@/components/crm/formUtils`).
- Produces: `QuoteSummaryCard({subtotal, discountAmt, taxTotal, total})`, `QuoteFormBody(props)` — consumed by Tasks 8 (Add page) and 9 (Edit page).

- [ ] **Step 1: Write `src/pages/sales/components/QuoteSummaryCard.tsx`**

```tsx
import { cn } from '@/lib/utils';

// Mirrors EstimateSummaryCard — no amountPaid/balanceDue (Quote has no
// payment tracking, same as Estimate).
export function QuoteSummaryCard({ subtotal, discountAmt, taxTotal, total }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
}) {
  const fmt = (n: number) =>
    '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const rows = [
    { label: 'Sub Total', value: fmt(subtotal), muted: true },
    { label: 'Discount', value: fmt(discountAmt), muted: true },
    { label: 'Tax Total', value: fmt(taxTotal), muted: true },
    { label: 'Total', value: fmt(total), muted: false },
  ];

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden sticky top-4">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Summary</p>
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(({ label, value, muted }) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between px-4 py-2.5',
              !muted && 'bg-stone-50 border-t border-stone-200',
            )}
          >
            <span className={cn('text-xs', muted ? 'text-stone-500' : 'text-stone-700 font-medium')}>
              {label}
            </span>
            <span className={cn(
              'tabular-nums',
              muted ? 'text-xs font-semibold text-stone-600' : 'text-sm font-bold text-stone-900',
            )}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/pages/sales/components/QuoteFormBody.tsx`**

```tsx
import type { Ref, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { CustomerPicker, type CustomerRef } from './CustomerPicker';
import { QuoteSectionGrid } from './QuoteFormFields';
import { QuoteSummaryCard } from './QuoteSummaryCard';
import { QuoteItemsTab } from './QuoteItemsTab';
import { QuoteAuditTab } from './QuoteAuditTab';
import type { CrmLookups } from '@/services/lookupService';
import {
  PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS,
  PAGE_TABS, type PageTab, type QuoteLineItem,
} from '@/lib/quoteForm';

// Shared tab bar + tab content for both the Add and Edit Quote pages —
// mirrors EstimateFormBody. Takes more props than CLAUDE.md's 5-prop
// guideline — see the plan's Global Constraints on why that's an accepted,
// pre-existing convention across this whole Sales form-body family.
export function QuoteFormBody({
  activeTab, setActiveTab, quoteId,
  data, set, lineItems, setLineItems,
  customer, setCustomer, customerLocked = false,
  lookups, subtotal, discountAmt, taxTotal, total, filesPanelRef, statusControl,
  approvalControl, sourceEstimate,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the quote is persisted (edit mode) — gates the
   *  Audit tab and switches Files to immediate-upload mode. */
  quoteId?: string;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  lineItems: QuoteLineItem[];
  setLineItems: (v: QuoteLineItem[]) => void;
  customer: CustomerRef | null;
  setCustomer: (c: CustomerRef | null) => void;
  /** The customer is fixed after creation — edit mode shows it read-only
   *  instead of the picker. */
  customerLocked?: boolean;
  lookups?: CrmLookups;
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
  /** Interactive status control (edit mode only) — a new quote always starts
   *  at Draft, so create mode omits this and shows a plain "Draft" display. */
  statusControl?: ReactNode;
  /** Approve-sign-off action (edit mode only, shown by the page when
   *  statusCode === QUOTE_APPROVAL_PENDING_STATUS). */
  approvalControl?: ReactNode;
  /** The estimate this quote was converted from, if any — renders a
   *  read-only link (plan Decision #1/§ ticket item). */
  sourceEstimate?: { id: string; number: string } | null;
}) {
  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  return (
    <>
      {/* Page-level tab bar */}
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

          {activeTab === 'details' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <ModernFieldShell label="Quote Status">
                        {statusControl ?? (
                          <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>Draft</div>
                        )}
                      </ModernFieldShell>
                      {sourceEstimate && (
                        <ModernFieldShell label="Source Estimate">
                          <Link
                            to={`/sales/estimate/${sourceEstimate.id}`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                          >
                            <FileSpreadsheet className="size-3.5" />
                            {sourceEstimate.number}
                          </Link>
                        </ModernFieldShell>
                      )}
                    </div>
                    {approvalControl && <div className="pt-1">{approvalControl}</div>}
                    <QuoteSectionGrid
                      fields={PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'quote_status')}
                      data={data} set={set} lookups={lookups} maxCols={2}
                    />
                  </div>
                  <div className="w-full lg:w-56 shrink-0">
                    <QuoteSummaryCard subtotal={subtotal} discountAmt={discountAmt} taxTotal={taxTotal} total={total} />
                  </div>
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <div className="space-y-4">
                  <ModernFieldShell label="Billing Customer" required={!customerLocked}>
                    {customerLocked ? (
                      <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>
                        {customer?.name || <span className="text-stone-400">—</span>}
                      </div>
                    ) : (
                      <CustomerPicker value={customer} onChange={setCustomer} required />
                    )}
                  </ModernFieldShell>
                  <QuoteSectionGrid fields={BILL_TO_FIELDS} data={data} set={set} lookups={lookups} />
                </div>
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                <QuoteSectionGrid fields={SHIP_TO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Sales Fields" index={3}>
                <QuoteSectionGrid fields={SALES_INFO_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Items" index={4}>
                <QuoteItemsTab items={lineItems} onUpdate={setLineItems} headerTaxPercent={headerTaxPercent} />
              </ModernSection>
            </>
          )}

          {activeTab === 'audit' && <QuoteAuditTab quoteId={quoteId} />}

          {/* Always mounted so staged files / edits survive tab switches */}
          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={quoteId} />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteSummaryCard.tsx` or `QuoteFormBody.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/sales/components/QuoteSummaryCard.tsx src/pages/sales/components/QuoteFormBody.tsx
git commit -m "feat: add quote summary card and shared form body"
```

---

## Task 7: Quote list table — `QuoteTable.tsx`

**Files:**
- Create: `src/pages/sales/components/QuoteTable.tsx`

**Interfaces:**
- Consumes: `quoteService` (Task 1); `QUOTE_STATUS_COLORS` (Task 2); `QuoteSearchRequest` (Task 1); `useUserPermissions` (`@/hooks/useUserPermissions`, existing).
- Produces: `QuoteTable()` — consumed by Task 11 (`QuoteListPage`).

- [ ] **Step 1: Write `src/pages/sales/components/QuoteTable.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteService } from '@/services/quoteService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { QUOTE_STATUS_COLORS } from '@/lib/quoteForm';
import type { QuoteSearchRequest } from '@/types/quote';

// Quotes are a dedicated relational module, not a generic CRM/JSONB workflow
// record, so — unlike Lead/Prospect/Customer — this table talks to
// quoteService (/api/tenant/quotes*) directly rather than reusing
// CrmRecordTable/crmService. Mirrors EstimateTable's search/sort/
// cursor-pagination UX for visual consistency.

type SortField = 'quoteDate' | 'grandTotal';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  quoteDate: 'Quote Date',
  grandTotal: 'Amount',
};

const SORT_KEY: Record<SortField, string> = {
  quoteDate: 'quote_date',
  grandTotal: 'grand_total',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

export function QuoteTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('quote', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('quoteDate');
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

  const req: QuoteSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quotes', req],
    queryFn: () => quoteService.searchQuotes(req),
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
            placeholder="Search quote #, customer, PO…"
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
        <p className="text-xs text-red-500">Failed to load quotes. Please try again.</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Quote #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Quote Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Valid Until</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Amount</th>
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
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    {canEdit && <td className="px-4 py-3" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((q) => {
                  const color = QUOTE_STATUS_COLORS[q.status] ?? '#a8a29e';
                  return (
                    <tr key={q.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/quote/${q.id}`)}
                          className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {q.quoteNumber || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[200px]">
                        {q.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {fmtDate(q.quoteDate)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {fmtDate(q.validUntil)}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 tabular-nums text-right whitespace-nowrap">
                        {currency(q.grandTotal)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/quote/${q.id}/edit`)}
                            aria-label={`Edit quote ${q.quoteNumber}`}
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
                        <p className="text-sm font-semibold text-stone-700">No quotes added yet.</p>
                        <p className="text-xs text-stone-400">Create your first quote to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No quotes match the current search.</p>
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteTable.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/components/QuoteTable.tsx
git commit -m "feat: add quote list table"
```

---

## Task 8: Add Quote page

**Files:**
- Create: `src/pages/sales/AddQuotePage.tsx`

**Interfaces:**
- Consumes: `QuoteFormBody` (Task 6); `quoteDefaults, toCreatePayload, fromSourceEstimate, PAGE_TABS, PageTab, QuoteLineItem` (Task 2); `quoteService` (Task 1); `estimateService` (`@/services/estimateService`, existing — read-only use for the source-estimate prefill); `CustomerRef` (`./components/CustomerPicker`).
- Produces: `AddQuotePage` (default export) — consumed by Task 12 (router).

- [ ] **Step 1: Write `src/pages/sales/AddQuotePage.tsx`**

```tsx
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2, Save } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { estimateService } from '@/services/estimateService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { QuoteFormBody } from './components/QuoteFormBody';
import {
  quoteDefaults, toCreatePayload, fromSourceEstimate, PAGE_TABS, type PageTab,
  type QuoteLineItem,
} from '@/lib/quoteForm';

export default function AddQuotePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const [searchParams] = useSearchParams();
  const fromEstimateId = searchParams.get('fromEstimate') ?? '';

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(quoteDefaults);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { data: sourceEstimate } = useQuery({
    queryKey: ['estimate', fromEstimateId],
    queryFn: () => estimateService.getEstimate(fromEstimateId),
    enabled: Boolean(fromEstimateId),
  });

  // Prefill exactly once when the source estimate finishes loading — a plain
  // effect (not derived state) because customer/line items must stay
  // independently editable afterward, and re-running on every render would
  // clobber in-progress edits.
  useEffect(() => {
    if (sourceEstimate && !prefilled) {
      const mapped = fromSourceEstimate(sourceEstimate);
      setData((d) => ({ ...d, ...mapped.data }));
      setLineItems(mapped.lineItems);
      setCustomer(mapped.customer);
      setPrefilled(true);
    }
  }, [sourceEstimate, prefilled]);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = subtotal * (headerTaxPercent / 100);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems, headerTaxPercent]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A billing customer is required.');
      const payload = toCreatePayload({ ...data, customer_uuid: customer.id }, lineItems, sourceEstimate?.id);
      return quoteService.createQuote(payload);
    },
    onSuccess: async (quote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(quote.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/quote');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Quotes"
          onBack={() => navigate('/sales/quote')}
          icon={FileText}
          title="New Quote"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Quote'}
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
              {apiErrorMessage(saveError, 'Failed to save quote.')}
            </p>
          </div>
        )}

        <QuoteFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLineItems}
          customer={customer}
          setCustomer={setCustomer}
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          filesPanelRef={panelRef}
          sourceEstimate={sourceEstimate ? { id: sourceEstimate.id, number: sourceEstimate.estimateNumber } : null}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/quote')}
          isPending={isPending}
          submitLabel="Save Quote"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `AddQuotePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/AddQuotePage.tsx
git commit -m "feat: add create-quote page"
```

---

## Task 9: Edit Quote page

**Files:**
- Create: `src/pages/sales/EditQuotePage.tsx`

**Interfaces:**
- Consumes: `QuoteFormBody` (Task 6); `QuoteStatusControl, QuoteApprovalButton` (Task 5); `fromQuote, toCreatePayload, PAGE_TABS, PageTab, QuoteLineItem, QUOTE_TERMINAL_STATUSES, QUOTE_APPROVAL_PENDING_STATUS` (Task 2); `quoteService` (Task 1); `useBreadcrumbStore` (`@/store/useBreadcrumbStore`, existing).
- Produces: `EditQuotePage` (default export) — consumed by Task 12 (router).

- [ ] **Step 1: Write `src/pages/sales/EditQuotePage.tsx`**

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { QuoteFormBody } from './components/QuoteFormBody';
import { QuoteStatusControl } from './components/QuoteStatusControl';
import { QuoteApprovalButton } from './components/QuoteApprovalButton';
import type { CustomerRef } from './components/CustomerPicker';
import {
  fromQuote, toCreatePayload, PAGE_TABS, type PageTab,
  type QuoteLineItem, QUOTE_TERMINAL_STATUSES, QUOTE_APPROVAL_PENDING_STATUS,
} from '@/lib/quoteForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: QuoteLineItem[] = [];

export default function EditQuotePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<QuoteLineItem[] | null>(null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: quote, isLoading, error: loadError } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuote(id),
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
    if (quote?.quoteNumber) {
      setLabel(id, quote.quoteNumber);
      return () => clearLabel(id);
    }
  }, [id, quote?.quoteNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (quote ? fromQuote(quote) : null), [quote]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer = localCustomer ?? mapped?.customer ?? null;
  const statusCode = localStatusCode ?? quote?.statusCode ?? '';
  const isTerminal = QUOTE_TERMINAL_STATUSES.has(statusCode);

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = subtotal * (headerTaxPercent / 100);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems, headerTaxPercent]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => quoteService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
    mutationFn: () => quoteService.updateQuote(id, toCreatePayload(data, lineItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/sales/quote/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading quote…" /></div>;
  if (loadError || !quote)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load quote.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  if (isTerminal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Quotes"
          onBack={() => navigate(`/sales/quote/${id}`)}
          icon={FileText}
          title={quote.quoteNumber || 'Quote'}
          subtitle={quote.customer.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This quote is {quote.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">{quote.status} quotes are locked server-side.</p>
          <button
            type="button"
            onClick={() => navigate(`/sales/quote/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Quotes"
          onBack={() => navigate('/sales/quote')}
          icon={FileText}
          title={quote.quoteNumber || 'Quote'}
          subtitle={customer?.name ?? 'Edit quote'}
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
              {apiErrorMessage(saveError, 'Failed to save quote.')}
            </p>
          </div>
        )}

        <QuoteFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          quoteId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          customer={customer}
          setCustomer={setLocalCustomer}
          customerLocked
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          statusControl={(
            <QuoteStatusControl
              value={statusCode}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
          )}
          approvalControl={statusCode === QUOTE_APPROVAL_PENDING_STATUS ? (
            <QuoteApprovalButton
              quoteId={id}
              onApproved={(updated) => {
                setLocalStatusCode(updated.statusCode);
                queryClient.invalidateQueries({ queryKey: ['quote', id] });
                queryClient.invalidateQueries({ queryKey: ['quotes'] });
              }}
            />
          ) : undefined}
          sourceEstimate={quote.estimate ? { id: quote.estimate.id, number: quote.estimate.number } : null}
        />

        <FormActionBar
          onCancel={() => navigate(`/sales/quote/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `EditQuotePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/EditQuotePage.tsx
git commit -m "feat: add edit-quote page with status transition and approval"
```

---

## Task 10: Quote Detail page

**Files:**
- Create: `src/pages/sales/QuoteDetailPage.tsx`

**Interfaces:**
- Consumes: `QuoteAuditTab, DeleteQuoteDialog, QuoteApprovalButton` (Tasks 5); `QUOTE_STATUS_COLORS, QUOTE_APPROVAL_PENDING_STATUS` (Task 2); `quoteService` (Task 1); `useUserPermissions` (existing); `useBreadcrumbStore` (existing).
- Produces: `QuoteDetailPage` (default export) — consumed by Task 12 (router).

- [ ] **Step 1: Write `src/pages/sales/QuoteDetailPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FileText, Upload, Pencil, FileSpreadsheet, ArrowRightLeft, Loader2 } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { QUOTE_STATUS_COLORS, QUOTE_APPROVAL_PENDING_STATUS } from '@/lib/quoteForm';
import { QuoteAuditTab } from './components/QuoteAuditTab';
import { DeleteQuoteDialog } from './components/DeleteQuoteDialog';
import { QuoteApprovalButton } from './components/QuoteApprovalButton';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
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

export default function QuoteDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('quote', 'update');
  const canDelete = permissionsLoading || hasPermission('quote', 'delete');
  const canTransition = permissionsLoading || hasPermission('quote', 'transition');

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuote(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (quote?.quoteNumber) {
      setLabel(id, quote.quoteNumber);
      return () => clearLabel(id);
    }
  }, [id, quote?.quoteNumber, setLabel, clearLabel]);

  // Placeholder — the backend conversion endpoint's response shape isn't
  // finalized yet, so this only reports success/failure rather than
  // navigating to a new Sales Order (plan Decision #5).
  const convert = useMutation({
    mutationFn: () => quoteService.convertToSalesOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote', id] }),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading quote…" /></div>;
  if (error || !quote)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load quote.')}</ErrorNote></div>;

  const color = QUOTE_STATUS_COLORS[quote.status] ?? '#a8a29e';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Quotes"
        onBack={() => navigate('/sales/quote')}
        icon={FileText}
        title={quote.quoteNumber || 'Quote'}
        subtitle={quote.customer.name}
        recordNumber={quote.quoteNumber}
        statusBadge={<Badge color={color}>{quote.status}</Badge>}
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
                  <ReadonlyField label="Quote Date" value={fmtDate(quote.quoteDate)} />
                  <ReadonlyField label="Valid Until" value={quote.validUntil ? fmtDate(quote.validUntil) : undefined} />
                  <ReadonlyField label="PO Number" value={quote.poNumber} />
                  <ReadonlyField label="Reference #" value={quote.referenceNumber} />
                  <ReadonlyField label="Sales Tax %" value={`${quote.salesTaxPercent}%`} />
                  {quote.estimate && (
                    <div className="space-y-1">
                      <label className={fieldLabelCls}>Source Estimate</label>
                      <Link
                        to={`/sales/estimate/${quote.estimate.id}`}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                      >
                        <FileSpreadsheet className="size-3.5" />
                        {quote.estimate.number}
                      </Link>
                    </div>
                  )}
                  {quote.memo && <ReadonlyField label="Memo" value={quote.memo} full />}
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <AddressBlock addr={quote.billing} />
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                {quote.shipSameAsBilling ? (
                  <p className="text-xs text-stone-400 italic">Same as billing customer.</p>
                ) : (
                  <AddressBlock addr={quote.shipping} />
                )}
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Total label="Subtotal" value={quote.subtotal} />
                  <Total label="Discount" value={quote.discountTotal} />
                  <Total label="Tax" value={quote.taxTotal} />
                  <Total label="Grand Total" value={quote.grandTotal} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'items' && (
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="divide-x divide-stone-200">
                    {[
                      { label: '#' },
                      { label: 'Item' },
                      { label: 'SKU' },
                      { label: 'Qty', right: true },
                      { label: 'Unit Price', right: true },
                      { label: 'Disc %', right: true },
                      { label: 'Tax %', right: true },
                      { label: 'Total', right: true },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {quote.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.discountPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.taxPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {quote.items.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <QuoteAuditTab quoteId={id} />}
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
                onClick={() => navigate(`/sales/quote/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/quote/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit quote
                </button>
              )}
              {canTransition && (
                <button
                  type="button"
                  onClick={() => convert.mutate()}
                  disabled={convert.isPending}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-50"
                >
                  {convert.isPending ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <ArrowRightLeft className="size-4 text-stone-400 shrink-0" />}
                  Convert to Sales Order
                </button>
              )}
            </div>
            {convert.isError && (
              <p className="text-2xs text-destructive">{apiErrorMessage(convert.error, 'Failed to convert quote.')}</p>
            )}
            {convert.isSuccess && (
              <p className="text-2xs text-emerald-600">Conversion request submitted.</p>
            )}
          </div>

          {canTransition && quote.statusCode === QUOTE_APPROVAL_PENDING_STATUS && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-400">Approval</p>
              <QuoteApprovalButton
                quoteId={id}
                onApproved={() => queryClient.invalidateQueries({ queryKey: ['quote', id] })}
              />
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{quote.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{quote.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(quote.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(quote.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteQuoteDialog
                quoteId={id}
                label={`Quote ${quote.quoteNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['quotes'] });
                  navigate('/sales/quote');
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
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

function AddressBlock({ addr }: { addr: { customerName?: string; addrLine1?: string; addrLine2?: string; city?: string; stateProvince?: string; postalCode?: string; country?: string } }) {
  const lines = [
    [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', '),
    [addr.city, addr.stateProvince, addr.postalCode].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean);

  if (lines.length === 0) {
    return <p className="text-xs text-stone-400 italic">No address on file.</p>;
  }
  return (
    <div className="space-y-1 text-xs text-stone-700">
      {addr.customerName && <p className="font-semibold text-stone-900">{addr.customerName}</p>}
      {lines.map((line, i) => <p key={i} className="text-stone-600">{line}</p>)}
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteDetailPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/QuoteDetailPage.tsx
git commit -m "feat: add quote detail page with source estimate link, approval, and conversion placeholder"
```

---

## Task 11: Quote List page

**Files:**
- Create: `src/pages/sales/QuoteListPage.tsx`

**Interfaces:**
- Consumes: `QuoteTable` (Task 7).
- Produces: `QuoteListPage` (default export) — consumed by Task 12 (router).

- [ ] **Step 1: Write `src/pages/sales/QuoteListPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { QuoteTable } from './components/QuoteTable';

export default function QuoteListPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <FileText className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Quotes</h1>
              <p className="text-sm text-stone-500">Create and manage price quotes for customers.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales/quote/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" />
            New Quote
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <QuoteTable />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors referencing `QuoteListPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sales/QuoteListPage.tsx
git commit -m "feat: add quote list page"
```

---

## Task 12: Router wiring, sidebar nav verification, and full verification

**Files:**
- Modify: `src/router/index.tsx`
- Verify (no change expected): `src/config/sidebarNav.ts`

**Interfaces:**
- Consumes: `QuoteListPage` (Task 11), `AddQuotePage` (Task 8), `QuoteDetailPage` (Task 10), `EditQuotePage` (Task 9) as lazy-loaded default exports; existing `PermissionGuard` from `src/components/PermissionGuard.tsx`.

- [ ] **Step 1: Add lazy imports**

In `src/router/index.tsx`, find (around line 94–103):

```tsx
const EstimateListPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateListPage"),
);
const AddEstimatePage = lazyWithRetry(() => import("@/pages/sales/AddEstimatePage"));
const EstimateDetailPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateDetailPage"),
);
const EditEstimatePage = lazyWithRetry(
  () => import("@/pages/sales/EditEstimatePage"),
);
const SalesOrderListPage = lazyWithRetry(
```

Replace with (inserting the four Quote imports between Estimate and Sales Order):

```tsx
const EstimateListPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateListPage"),
);
const AddEstimatePage = lazyWithRetry(() => import("@/pages/sales/AddEstimatePage"));
const EstimateDetailPage = lazyWithRetry(
  () => import("@/pages/sales/EstimateDetailPage"),
);
const EditEstimatePage = lazyWithRetry(
  () => import("@/pages/sales/EditEstimatePage"),
);
const QuoteListPage = lazyWithRetry(
  () => import("@/pages/sales/QuoteListPage"),
);
const AddQuotePage = lazyWithRetry(() => import("@/pages/sales/AddQuotePage"));
const QuoteDetailPage = lazyWithRetry(
  () => import("@/pages/sales/QuoteDetailPage"),
);
const EditQuotePage = lazyWithRetry(
  () => import("@/pages/sales/EditQuotePage"),
);
const SalesOrderListPage = lazyWithRetry(
```

- [ ] **Step 2: Add the four Quote routes**

In the same file, find the end of the Estimates route block and the start of the Sales Orders comment (around line 308–317):

```tsx
      {
        path: "sales/estimate/:id/edit",
        element: lazy_(
          <PermissionGuard resource="estimate" action="update">
            <EditEstimatePage />
          </PermissionGuard>,
        ),
      },

      // Sales Orders (specific routes must come before the catch-all)
```

Replace with (inserting the Quotes block — this must come before the `sales/:moduleKey` catch-all further down, same as every other Sales module; placing it here, right after Estimates, keeps related modules adjacent):

```tsx
      {
        path: "sales/estimate/:id/edit",
        element: lazy_(
          <PermissionGuard resource="estimate" action="update">
            <EditEstimatePage />
          </PermissionGuard>,
        ),
      },

      // Quotes (specific routes must come before the catch-all)
      {
        path: "sales/quote",
        element: lazy_(
          <PermissionGuard resource="quote" action="read">
            <QuoteListPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/new",
        element: lazy_(
          <PermissionGuard resource="quote" action="create">
            <AddQuotePage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id",
        element: lazy_(
          <PermissionGuard resource="quote" action="read">
            <QuoteDetailPage />
          </PermissionGuard>,
        ),
      },
      {
        path: "sales/quote/:id/edit",
        element: lazy_(
          <PermissionGuard resource="quote" action="update">
            <EditQuotePage />
          </PermissionGuard>,
        ),
      },

      // Sales Orders (specific routes must come before the catch-all)
```

- [ ] **Step 3: Verify the sidebar nav entry needs no change**

Run:
```bash
grep -n -A4 "id: 'quotes'" src/config/sidebarNav.ts
```
Expected output confirms the entry already exists and matches the new route exactly:
```ts
{
  type: 'link', id: 'quotes', label: 'Quotes', path: '/sales/quote',
  icon: FileText,
},
```
No edit needed — this entry was dead-linking to the `sales/:moduleKey` placeholder catch-all before Step 2; it now resolves to `QuoteListPage`.

- [ ] **Step 4: Full CI check**

Run: `npm run ci`
Expected: Lint, test, and build all pass (this is exactly what CI runs — see CLAUDE.md).

- [ ] **Step 5: Manual browser verification**

Per CLAUDE.md, UI changes must be exercised in a browser before being reported complete — this requires the StoneSuite backend running (`stonesuite-backend`, per the sibling repo) with a valid tenant login and an `estimate`/`quote`-permitted role. Start the frontend dev server and, against a real or already-running backend:
1. Navigate to `/sales/quote` — confirm the list loads (or shows the empty state) with no console errors, and the sidebar "Quotes" nav item highlights correctly.
2. Click "New Quote" — pick a customer, fill quote date, add a line item by picking a catalog suggestion (confirm typing without picking leaves Save Line disabled, per plan Decision #3), save — confirm it redirects to the list and the new quote appears with a `QUOT-` prefixed number.
3. From an existing Estimate's detail page URL, manually navigate to `/sales/quote/new?fromEstimate=<that estimate's id>` — confirm the customer, PO number, sales tax %, memo, and any catalog-referenced line items prefill, and a "Source Estimate" badge linking back to that estimate appears in the form.
4. Open the new quote's detail page — confirm Overview/Items/Audit/Files tabs render, the Source Estimate link navigates to the correct Estimate detail page, and "Convert to Sales Order" is visible (click it and confirm either a success or a clear error message renders inline, since the backend endpoint may not be implemented yet).
5. Edit the quote — change the reference number, transition status from Draft to Pending Approval, save — confirm the status updates and an "Approve Quote" button appears (on both the Edit page and the Detail page's sidebar). Click it and confirm the status moves to Approved.
6. Attempt to edit a quote that has been transitioned to Rejected/Expired/Cancelled — confirm the Edit page shows the locked "cannot be edited" screen instead of the form.
7. Delete a quote from the Detail page's Danger Zone — confirm the confirmation dialog appears and deleting redirects back to the list.

If no backend is reachable in the current environment, state that explicitly rather than claiming the manual walkthrough was completed — `npm run ci` passing (Step 4) verifies the code compiles and existing tests pass, but does not verify runtime behavior against the real API.

- [ ] **Step 6: Commit**

```bash
git add src/router/index.tsx
git commit -m "feat: wire up quote list, create, detail, and edit routes"
```

---

## Self-Review Notes

- **Spec coverage:** API endpoints table → Tasks 1 (types/service, 7 of 9 endpoints) + 5/10 (approve, wired to `QuoteApprovalButton`) + 1/10 (convertToSalesOrder placeholder). GET single JSON shape → Task 1 (`Quote`/`QuoteLine`). List envelope → Task 1 (`QuotePage`). Create payload → Task 2 (`toCreatePayload`). Update payload → Task 1 (`QuoteUpdatePayload`) + Task 9 (Edit page's save call). Status workflow → Task 2 (`QUOTE_STATUS_CODES`/`QUOTE_TERMINAL_STATUSES`). RBAC → every page/table task (`hasPermission('quote', ...)`, `PermissionGuard resource="quote"` in Task 12). Ticket difference #1 (source estimate badge/link) → Tasks 6, 9, 10. Ticket difference #2 (`?fromEstimate=` prefill) → Task 8. Ticket difference #3 (QUOT prefix) → server-generated, no client code needed (confirmed no `ESTM`-prefix logic exists client-side to mirror). Ticket difference #4 (`quoteDate` not `estimateDate`) → Task 2 field naming throughout. Ticket difference #5 (convert placeholder) → Task 1 (service method) + Task 10 (button). Router/nav → Task 12. All ticket sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has complete code. The one deliberately incomplete piece (`convertToSalesOrder`'s response handling) is documented as an intentional placeholder per the ticket's own instruction ("just wire a placeholder button"), not a plan gap.
- **Type consistency:** `QuoteFormField`, `QuoteSectionGrid`, `QuoteField`, `QuoteLineItem`, `QuoteAddressInput`, `QuoteLineInput`, `QUOTE_STATUS_CODES`, `QUOTE_STATUS_COLORS`, `QUOTE_TERMINAL_STATUSES`, `QUOTE_APPROVAL_PENDING_STATUS` are defined once (Task 2) and referenced with identical names/shapes in every later task. `QuoteFormBody`'s prop names (`quoteId`, `approvalControl`, `sourceEstimate`) match exactly between its definition (Task 6) and both call sites (Tasks 8, 9).
