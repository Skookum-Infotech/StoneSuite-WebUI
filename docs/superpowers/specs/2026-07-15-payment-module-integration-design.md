# Payment Module — Frontend Integration Design

**Date:** 2026-07-15
**Status:** Approved by user in brainstorming session, proceeding to implementation plan.
**Scope:** Wire the existing frontend Payments UI (currently a scaffold posting through the generic JSONB CRM router) to the real dedicated backend Payment module (`StoneSuite-Backend/payment/*.go`, `docs/superpowers/specs/2026-07-13-payments-module-design.md`, routes at `/api/tenant/payments*`).

---

## 1. Background & Problem

The backend ships a full relational Payment module — header + invoice-application ledger + status workflow (`PEND → APPV → DEPO`, or `VOID`) — as a sibling of Invoice/Sales Order, per `docs/superpowers/specs/2026-07-13-payments-module-design.md` (StoneSuite-Backend repo).

The frontend has an existing `AddPaymentPage`/`PaymentListPage`/`PaymentTable` scaffold, but it talks to the **wrong API**: `crmService.createRecord('payment', …)` (the generic `/tenant/crm/*` JSONB router) via `CrmRecordTable`, with free-text fields (`customer_name`, `invoice_doc_num`, a string `payment_method`, a free-choosable `payment_status` on create) that don't match the real backend contract (`customerUuid`, `methodId` FK, structured `applications[]`, server-assigned initial status). There is no detail page, edit page, apply/unapply UI, or audit tab for payments — only list + create exist, and both are non-functional against the real backend.

Note: the **invoice-side** QuickPay integration (`RecordPaymentDialog` → `invoiceService.recordPayment` → `POST /invoices/{uuid}/payment`) is already correctly wired and is out of scope for this change.

## 2. Goals

Rebuild the Payments frontend as a dedicated relational-module UI, mirroring the Invoice module's frontend pattern (`invoiceService`/`InvoiceTable`/`InvoiceDetailPage`/`InvoiceStatusControl`/etc.) exactly, targeting `/api/tenant/payments*`:

- List (server search/sort/keyset pagination)
- Create (customer picker, method, amount, date, reference, memo, optional inline invoice applications)
- Detail (header, live applications, apply/unapply, audit trail, files)
- Edit (non-monetary fields only — amount is immutable per backend AD-10)
- Status transition (`PEND→APPV→DEPO`, or `VOID`, cascading unapply)
- Delete (blocked server-side with 409 while live applications exist — surfaced, not re-implemented)

## 3. Non-Goals

- Credit Memo / Refund pages (explicitly out of scope on the backend too).
- The Invoice-side AR reconciliation view (`GET /tenant/invoices/{uuid}/payments` — "payments applied to this invoice"). The endpoint exists but adding it to `InvoiceDetailPage` is a separate, later enhancement.
- Any change to `RecordPaymentDialog` / QuickPay — already correct.
- A backend endpoint for payment methods. Deferred (see AD-1 below); frontend uses a constant instead.

---

## 4. Architecture Decisions

**AD-1 — Payment methods are a frontend constant, not a fetched lookup.** The backend has no endpoint exposing `lkp_payment_method` rows (`/tenant/crm/lookups` doesn't include them, and there's no dedicated route). Rather than add a backend endpoint, the frontend hardcodes the 6 system-seeded methods (`Check, Cash, Credit Card, ACH, Wire, Other`) with their known seed IDs. This is coupled to seed order in `database/migrations/tenant/schema.sql` (`lkp_payment_method` INSERT block) — flagged with a code comment at the constant's definition so a future seed-order change is easy to trace back here. If a tenant ever needs custom/reordered methods, this becomes a real backend lookup at that point (not needed today).

**AD-2 — Mirror Invoice's frontend pattern file-for-file.** Payment is architecturally identical to Invoice on the backend (dedicated relational module, hybrid PK, status transitions, keyset search) and the Invoice frontend module is the freshest, most complete precedent in this codebase. New Payment files follow the same names/shapes as their Invoice counterparts wherever a mapping exists, to minimize cognitive overhead and review risk.

**AD-3 — Status control lives on the Edit page, not the Detail page.** Matches `EditInvoicePage`/`InvoiceStatusControl` exactly (Invoice does not put a status control on `InvoiceDetailPage`). Apply/Unapply actions, however, live on the **Detail** page's Applications tab (there is no Invoice precedent for this since Invoice has no equivalent ledger UI — this is new surface).

**AD-4 — Inline applications on create reuse a new `InvoicePicker`, filtered by the selected customer.** The backend's `POST /tenant/payments` accepts optional `applications[]` in the same transaction as create (§9 of the backend spec). The picker mirrors `CustomerPicker`'s debounced-search UX, but searches `invoiceService.searchInvoices` filtered to `customer_id eq <selected customer>`. Disabled until a customer is chosen (an application must belong to the same customer as the payment — enforced server-side with a 400, but gating client-side avoids a round-trip for the common case).

**AD-5 — Apply/Unapply on the Detail page reuse the same `InvoicePicker`.** One shared component serves both the create-time inline-applications flow and the detail-page "Apply to another invoice" action — same filtering rule (customer-scoped), same list shape.

**AD-6 — No client-side re-implementation of business rules already enforced server-side.** The apply-amount cap (`min(unapplied, balance_due)`), the VOID-blocks-apply rule, the delete-blocked-while-applied rule, and the transition map are all enforced server-side; the frontend surfaces the resulting 400/409 via `apiErrorMessage` rather than duplicating the checks (matching how `RecordPaymentDialog` already handles the QuickPay 409). The **transition map** is the one exception — like `InvoiceStatusControl`, the frontend keeps a static copy of the legal-moves map purely to drive which options the status `<select>` offers; the backend remains the source of truth and rejects illegal picks with 409.

---

## 5. Components & Data Flow

### 5.1 Types & Service Layer

**`src/types/payment.ts`** (new) — mirrors `types/invoice.ts`:
```ts
export interface ApplicationInput { invoiceUuid: string; amount: number; }

export interface PaymentCreatePayload {
  customerUuid: string;
  methodId: number;
  referenceNumber?: string;
  paymentDate?: string;         // ISO "yyyy-mm-dd"
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  amount: number;
  memo?: string;
  internalNotes?: string;
  customFields?: Record<string, unknown>;
  applications?: ApplicationInput[];
}

// No `amount` — immutable post-creation (backend AD-10).
export type PaymentUpdatePayload = Omit<PaymentCreatePayload, 'customerUuid' | 'amount' | 'applications'>;

export interface PaymentCustomerRef { id: string; name: string; }

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
  status: string;       // human label
  statusCode: string;   // PEND/APPV/DEPO/VOID
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

export type PaymentSummary = Pick<
  Payment,
  'id' | 'paymentNumber' | 'status' | 'statusCode' | 'customer' | 'paymentDate' | 'amount' | 'unappliedAmount' | 'createdAt' | 'updatedAt'
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

**`src/services/paymentService.ts`** (new) — mirrors `invoiceService.ts` against `/tenant/payments`:
- `searchPayments(req)` → `POST /tenant/payments/search`
- `getPayment(uuid)` → `GET /tenant/payments/{uuid}`
- `createPayment(payload)` → `POST /tenant/payments`
- `updatePayment(uuid, payload)` → `PATCH /tenant/payments/{uuid}`
- `deletePayment(uuid)` → `DELETE /tenant/payments/{uuid}`
- `transition(uuid, toStatusCode)` → `POST /tenant/payments/{uuid}/transition`
- `apply(uuid, invoiceUuid, amount)` → `POST /tenant/payments/{uuid}/apply`
- `unapply(uuid, invoiceUuid)` → `POST /tenant/payments/{uuid}/unapply`
- `getAudit(uuid)` → `GET /tenant/payments/{uuid}/audit`

**`src/lib/paymentMethods.ts`** (new):
```ts
// Coupled to the seed order in database/migrations/tenant/schema.sql's
// lkp_payment_method INSERT block (StoneSuite-Backend). No lookup endpoint
// exists yet — see docs/superpowers/specs/2026-07-15-payment-module-integration-design.md AD-1.
export const PAYMENT_METHODS: { id: number; code: string; name: string }[] = [
  { id: 1, code: 'CHK_', name: 'Check' },
  { id: 2, code: 'CASH', name: 'Cash' },
  { id: 3, code: 'CC__', name: 'Credit Card' },
  { id: 4, code: 'ACH_', name: 'ACH' },
  { id: 5, code: 'WIRE', name: 'Wire' },
  { id: 6, code: 'OTHR', name: 'Other' },
];
```

**`src/lib/paymentForm.ts`** (rewritten) — mirrors `invoiceForm.ts`:
- Field defs for create/edit (method select sourced from `PAYMENT_METHODS`, not a `CrmLookups` key; currency select still sourced from `lookups.currencies`).
- `toCreatePayload(data: Record<string,unknown>, customer: PaymentCustomerRef | null): Omit<PaymentCreatePayload,'applications'>` — the caller (`AddPaymentPage`) spreads this and adds its own locally-tracked `applications` array. `fromPayment(payment): { data, customer }` is the inverse, used by `EditPaymentPage`.
- `PAYMENT_STATUS_CODES: {code,label}[]` = `PEND/Pending, APPV/Approved, DEPO/Deposited, VOID/Void`.
- `PAYMENT_STATUS_COLORS: Record<string,string>` keyed by label, same pattern as `INVOICE_STATUS_COLORS`.
- `PAYMENT_ALLOWED_TRANSITIONS: Record<string, string[]>` = `{PEND:['APPV','VOID'], APPV:['DEPO','VOID'], DEPO:[], VOID:[]}` — drives which options `PaymentStatusControl` offers from the current status; server is authoritative (409 on an illegal pick).
- `PAYMENT_BLOCKS_APPLY = new Set(['VOID'])` — drives whether Apply/Unapply actions are enabled on Detail (AD-7 in the backend spec: application allowed at PEND/APPV/DEPO, blocked only at VOID).
- `paymentDefaults()` — `{ payment_date: today }` (no default status — server always starts at `PEND`).

### 5.2 List Page

**`PaymentTable.tsx`** (rewritten, drops `CrmRecordTable`) — mirrors `InvoiceTable.tsx`: debounced search box, sort chips (Date / Amount / Unapplied), keyset pagination (`prevCursors` stack + `nextCursor`), columns: Payment #, Customer, Status badge (color via `PAYMENT_STATUS_COLORS`), Date, Amount, Unapplied, Edit action (gated on `hasPermission('payment','update')`). Uses `paymentService.searchPayments`.

### 5.3 Create Page

**`AddPaymentPage.tsx`** (rewritten):
- Replaces free-text `customer_name`/`customer_contact_email`/`customer_phone` fields with `CustomerPicker` (reused unmodified) bound to `customerUuid`.
- Replaces the free-text `payment_method` select with one sourced from `PAYMENT_METHODS`.
- Drops the `payment_status` field entirely (server always starts `PEND`).
- Drops the free-text `invoice_doc_num` field; adds an **Applications** section: `InvoicePicker` (new) + amount input, "Add" button appends to a local `applications: ApplicationInput[]` list rendered as removable rows, disabled until a customer is selected.
- Submits via `paymentService.createPayment({ ...toCreatePayload(data), applications })`.

**`InvoicePicker.tsx`** (new component, `src/pages/sales/components/`) — mirrors `CustomerPicker.tsx`'s debounced-search dropdown pattern:
```ts
export function InvoicePicker({ customerId, value, onChange, excludeIds }: {
  customerId: string | null;   // disabled when null
  value: InvoiceRef | null;
  onChange: (invoice: InvoiceRef | null) => void;
  excludeIds?: string[];       // invoices already added to the applications list
}): JSX.Element
```
Queries `invoiceService.searchInvoices({ filters: [{ field: 'customer_id', op: 'eq', value: customerId }], sort: [{field:'invoice_date',dir:'desc'}], limit: 8 })`, renders invoice # + balance due, excludes fully-paid (`balanceDue <= 0`) and already-added invoices from the list.

### 5.4 Detail Page (new)

**`PaymentDetailPage.tsx`** (new, mirrors `InvoiceDetailPage.tsx`):
- Tabs: **Overview** (header fields: method, reference, date, currency, memo, internal notes + a totals card: Amount / Applied / Unapplied), **Applications** (table of live `payment.applications[]`: Invoice #, Amount, Applied Date, an "Unapply" button per row → `paymentService.unapply(id, invoiceId)`; an "Apply to invoice" button opens a small dialog with `InvoicePicker` (customer-scoped) + amount → `paymentService.apply(id, invoiceUuid, amount)`; both gated on `hasPermission('payment','update')` and disabled when `PAYMENT_BLOCKS_APPLY.has(statusCode)`), **Audit** (new `PaymentAuditTab.tsx`, mirrors `InvoiceAuditTab.tsx` against `paymentService.getAudit`), **Files** (reuse `FilesContent`).
- Sidebar: Quick Actions (Upload file, Edit payment), Status card (read-only display — status changes happen on Edit, per AD-3), Danger Zone with `DeletePaymentDialog` (gated on `payment:delete`).
- Breadcrumb: `setLabel(id, payment.paymentNumber)` / `clearLabel(id)` on load per CLAUDE.md's no-raw-UUID rule.

### 5.5 Edit Page (new)

**`EditPaymentPage.tsx`** (new, mirrors `EditInvoicePage.tsx`, no line items):
- Editable: method, reference number, date, currency, memo, internal notes. Customer and amount are read-only display fields (locked after creation — AD-10 backend, and matches Invoice's "customer fixed after creation" precedent).
- Hosts `PaymentStatusControl.tsx` (new, mirrors `InvoiceStatusControl.tsx`) driven by `PAYMENT_ALLOWED_TRANSITIONS[currentCode]`, calling `paymentService.transition`.
- No terminal-status lock screen like Invoice's (`DEPO`/`VOID` still allow editing non-monetary fields server-side — only `payment_amount` is immutable, not the whole record). If the backend later restricts edits post-`DEPO`, this would need revisiting, but nothing in the backend spec (§9, §11) says PATCH is blocked by status.

### 5.6 Small New Components

- **`PaymentStatusControl.tsx`** — mirrors `InvoiceStatusControl.tsx`, sourced from `PAYMENT_ALLOWED_TRANSITIONS` instead of a flat list (Invoice's is a flat ordered list since almost every status is reachable in sequence from the UI; Payment's branches at `PEND`/`APPV` to `VOID`, so the control only offers the current status's legal next-moves, not the full catalog).
- **`PaymentAuditTab.tsx`** — mirrors `InvoiceAuditTab.tsx` verbatim, swapping `invoiceService.getAudit` for `paymentService.getAudit`.
- **`DeletePaymentDialog.tsx`** — mirrors `DeleteInvoiceDialog.tsx` verbatim, swapping the service call and copy ("Delete payment?"). The 409 "has live applications" server message surfaces as-is via `apiErrorMessage` — no special-cased client copy.

### 5.7 Router & Sidebar

Add to `src/router/index.tsx`, alongside the existing Payments block, matching the Invoice block's `PermissionGuard` wrapping exactly:
```
sales/payment           → PermissionGuard(payment, read)   → PaymentListPage   [already exists, add guard]
sales/payment/new       → PermissionGuard(payment, create)  → AddPaymentPage    [already exists, add guard]
sales/payment/:id       → PermissionGuard(payment, read)    → PaymentDetailPage [new]
sales/payment/:id/edit  → PermissionGuard(payment, update)  → EditPaymentPage   [new]
```
`src/config/sidebarNav.ts`'s Payments entry already exists and needs no change (it has no `permission` field today, unlike Leads/Prospects/Customers — out of scope to change here since the existing routes don't either; noting as a pre-existing inconsistency, not something this change introduces).

---

## 6. Error Handling

All mutations surface backend errors via the existing `apiErrorMessage(error, fallback)` helper, matching the Invoice/Sales Order pattern:
- `400` from create/apply (bad filter key, amount exceeds available balance, customer mismatch) → inline field-level or dialog-level message.
- `404` from any single-record op → generic "Payment not found" (IDOR-safe, no existence leakage — matches CLAUDE.md rule).
- `409` from transition (illegal move) or delete (live applications exist) → surfaced as the save/delete error, not a generic failure.

## 7. Testing

Per CLAUDE.md, new features need tests. Table-driven Vitest coverage for the pure functions in `src/lib/paymentForm.ts` (`toCreatePayload`/`fromPayment` mappers, transition-map lookups) — mirrors the existing `invoiceForm.test.ts` pattern. Component-level testing is out of scope (matches the existing convention in this codebase — Invoice/Sales Order pages have no component tests either, only their `lib/*.ts` mappers do).

---

## 8. Implementation Map

| Concern | Action | Reference to mirror |
|---|---|---|
| Types | New `src/types/payment.ts` | `types/invoice.ts` |
| Service | New `src/services/paymentService.ts` | `services/invoiceService.ts` |
| Method constant | New `src/lib/paymentMethods.ts` | — |
| Form lib | Rewrite `src/lib/paymentForm.ts` | `lib/invoiceForm.ts` |
| List | Rewrite `PaymentTable.tsx` | `components/InvoiceTable.tsx` |
| Create | Rewrite `AddPaymentPage.tsx` | `AddInvoicePage.tsx` (structure), new `InvoicePicker` |
| Picker | New `components/InvoicePicker.tsx` | `components/CustomerPicker.tsx` |
| Detail | New `PaymentDetailPage.tsx` | `InvoiceDetailPage.tsx` |
| Edit | New `EditPaymentPage.tsx` | `EditInvoicePage.tsx` |
| Status control | New `components/PaymentStatusControl.tsx` | `components/InvoiceStatusControl.tsx` |
| Audit tab | New `components/PaymentAuditTab.tsx` | `components/InvoiceAuditTab.tsx` |
| Delete dialog | New `components/DeletePaymentDialog.tsx` | `components/DeleteInvoiceDialog.tsx` |
| Router | Add 2 routes + guards to `router/index.tsx` | Invoice block |
| Tests | New `src/lib/paymentForm.test.ts` | `lib/invoiceForm.test.ts` |

---

## 9. Open Decisions — Resolved During Brainstorming

1. **Scope: full Invoice-parity vs. create+list MVP.** Confirmed full parity (list, create, detail, edit, transition, apply/unapply, audit, delete) — the backend ships the whole surface already, and a partial frontend would leave real backend capability (apply/unapply, void-cascade, audit) invisible to users.
2. **Payment method source.** Confirmed frontend constant over adding a backend lookup endpoint — backend is "done" and out of scope to modify for this pass; the coupling to seed order is flagged (AD-1) rather than silently accepted.
