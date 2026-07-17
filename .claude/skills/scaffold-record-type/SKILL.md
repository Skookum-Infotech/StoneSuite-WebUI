---
name: scaffold-record-type
description: This skill should be used when the user asks to "add a new record type", "scaffold Purchase Orders", "build out Item Receipts/Vendor Bills/Vendor Payments/Vendor Credits/Requisitions/Expenses/Refunds", "add the next Purchases module", or wants a new Sales/Purchases record type built following the existing Quote/Invoice/Vendor pattern. Not for CRM workflow records (Lead/Prospect/Customer) — those use the dynamic custom-fields system instead.
disable-model-invocation: true
---

Scaffold a new Sales or Purchases record type (e.g. Purchase Order, Item Receipt,
Vendor Bill, Vendor Payment, Vendor Credit, Requisition, Expense, Refund) by mirroring
the file-for-file template every existing record type already follows. Seven record
types (SalesOrder, Quote, Invoice, Payment, CreditMemo, Estimate, Vendor) exist today;
nine more are listed in `src/config/sidebarNav.ts` under "Sales" and "Purchases" but
not yet built. This is a template-fill task, not a design task — the shape is settled,
only field names and business rules differ per record type.

**Scope note:** this applies to Sales/Purchases records only. These are fixed-schema
relational modules (`/api/tenant/<resource>s*`), distinct from the CRM Lead/Prospect/
Customer workflow system, which uses dynamic `custom_fields` + `DynamicFieldInput`
instead of typed fields. Do not reach for `DynamicFieldInput` or `workflow.field_definitions`
here — that's the other system.

## Step 1: Establish the shape before writing anything

Ask (or infer from the sidebar label and product context) whether the new record type is:

- **Transactional / line-item-bearing** (like Quote, Invoice, SalesOrder, Estimate,
  CreditMemo) — has header fields + a line-items table + a computed summary
  (subtotal/tax/total). Mirror **Quote** (`src/{types,services,lib,pages/sales}/quote*`,
  `src/pages/sales/components/Quote*`) — it's a complete, mid-complexity example
  including an approval step.
- **Master data / no line items** (like Vendor) — header fields only, no items tab, no
  summary card. Mirror **Vendor**
  (`src/{types,services,lib,pages/purchases/vendor}/*`).

Read the reference record type's files fully before writing the new one — don't guess
field names or shapes from memory of this skill.

## Step 2: The file checklist

For a record type named e.g. "Vendor Bill" → PascalCase `VendorBill`, resource string
`vendor_bill` (snake_case, **must exactly match** the route segment — see Step 3):

| # | File | Mirrors |
|---|------|---------|
| 1 | `src/types/<record>.ts` | Create/update input types, the full record type, list/search request+page types. Header comment naming the backend module and any sibling record type it resembles. |
| 2 | `src/services/<record>Service.ts` | `search<Record>s`, `get<Record>`, `create<Record>`, `update<Record>`, `delete<Record>`, plus any record-specific actions (approve, void, convert). All calls through `tenantClient`. |
| 3 | `src/lib/<record>Form.ts` (+ `.test.ts`) | Local-state form validator/mapper (not React Hook Form — match `salesOrderForm.ts`/`quoteForm.ts`). Status color map and any status-transition constants live here too (see `QUOTE_STATUS_COLORS` in `quoteForm.ts`). Table-driven tests via `it.each`. |
| 4 | `src/pages/sales|purchases/<Record>ListPage.tsx` | Uses `RecordsPanel`/search+filter+keyset pagination — mirror `QuoteListPage.tsx`. |
| 5 | `src/pages/.../Add<Record>Page.tsx` | Create form page. |
| 6 | `src/pages/.../Edit<Record>Page.tsx` | Edit form page. |
| 7 | `src/pages/.../<Record>DetailPage.tsx` | Tabs (`Overview`/`Items`/`Audit`/`Files` or similar), breadcrumb wiring (Step 4), permission-gated action buttons. |
| 8 | `.../components/<Record>Table.tsx` | Row rendering for the list page. |
| 9 | `.../components/<Record>FormBody.tsx` + `<Record>FormFields.tsx` | Shared between Add/Edit pages. |
| 10 | `.../components/<Record>ItemsTab.tsx` (line-item types only) or `<Record>OverviewTab.tsx` (master-data types) | |
| 11 | `.../components/<Record>AuditTab.tsx` | Audit-log tab, same shape every record type uses. |
| 12 | `.../components/<Record>StatusControl.tsx` | Status transition UI, gated on `hasPermission('<resource>', 'transition')`. |
| 13 | `.../components/<Record>SummaryCard.tsx` (line-item types only) | Subtotal/tax/total display. |
| 14 | `.../components/Delete<Record>Dialog.tsx` | Confirmation dialog, gated on `hasPermission('<resource>', 'delete')`. |

Optional, only if the record type needs it: an approval button (`QuoteApprovalButton.tsx`
pattern) or a conversion action (`quoteService.convertToSalesOrder`-style).

## Step 3: Wire it in

**Router (`src/router/index.tsx`)** — add lazy imports (`lazyWithRetry`) and four routes
(list/new/detail/edit) under `PermissionGuard resource="<resource>" action="read|create|read|update"`.
The resource string, the route path segment, and the snake_case record name must all
be identical — e.g. `resource="vendor_bill"` ↔ `path: "purchases/vendor_bill"`.

**Route order matters.** `src/router/index.tsx` has catch-all routes
(`path: "sales/:moduleKey"` and `path: "purchases/:moduleKey"`) for modules not yet
built. React Router matches top-down — the new record type's specific routes **must be
inserted before** the relevant catch-all or they'll never be reached (see the existing
`// Quotes (specific routes must come before the catch-all)` comment for the pattern).

**Sidebar (`src/config/sidebarNav.ts`)** — the nav entry likely already exists (that's
how the 9 remaining record types were discovered); if so, just confirm its `path`
matches the new route exactly. If not, add one following the sibling entries' shape.

## Step 4: Non-obvious conventions to carry over exactly

- **Breadcrumb.** Detail/edit pages keyed by `:id` must call
  `useBreadcrumbStore().setLabel(id, humanNumber)` in a `useEffect` once the record
  loads, returning `() => clearLabel(id)` as cleanup — copy the pattern verbatim from
  `QuoteDetailPage.tsx` (`quote.quoteNumber` → the new record's number field). Never a
  raw UUID.
- **Permissions.** Gate actions with `useUserPermissions().hasPermission('<resource>', '<action>')`,
  falling back to permissive (`permissionsLoading ||`) while permissions are still
  loading — not restrictive — matching every existing detail page.
- **Data fetching.** TanStack Query only: `useQuery({ queryKey: ['<resource>', id], queryFn: () => service.get<Record>(id), enabled: Boolean(id) })`. No bare `useEffect` fetches.
- **Pagination.** `nextCursor` from `search<Record>s` is opaque — pass it straight back
  on the next page request, never parse or construct one client-side.
- **Forms.** Local state + the `lib/<record>Form.ts` validator, *not* React Hook Form —
  this whole record family intentionally uses the non-RHF pattern (see CLAUDE.md React
  Rules).

## Step 5: Verify before calling it done

1. `npm run lint && npm test && npm run build` (== `npm run ci`) must pass.
2. Manually confirm: list page loads and paginates, add/edit forms validate and save,
   detail page's breadcrumb shows the record number (not a UUID), delete/status-transition
   buttons are hidden/disabled per permission.
3. Run the **tenant-scope-reviewer** and **a11y-reviewer** subagents against the new
   files before merging — this scaffold bakes in the right patterns, but both agents
   catch drift a template can't prevent.
