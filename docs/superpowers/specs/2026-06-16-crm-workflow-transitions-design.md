# CRM Workflow State Transitions — Design Spec
**Date:** 2026-06-16  
**Branch:** fix/forms-crm  
**Status:** Approved

---

## Problem

The current CRM UI uses separate "Convert to Prospect" and "Convert to Customer" buttons to advance records between stages. Record IDs are displayed as raw UUIDs. Status dropdown options are partially hardcoded in the frontend. The backend already has the full transition engine — the frontend just isn't wired to it correctly.

---

## Goals

1. Status dropdown is the **only** mechanism for stage transitions — no convert buttons.
2. All status lists are **fully dynamic from the backend** — frontend renders what it receives, hardcodes nothing.
3. Doc IDs are **human-readable** (`LEAD-000042`) and **update on transition** (`PROS-000042`, `CUST-000042`).
4. After a cross-stage transition, the frontend **navigates to the correct listing**.
5. Transitions are **forward-only** — no going back to a prior stage.

---

## Status Options Per Stage (backend-driven)

The frontend fetches these from the backend. These lists define what the backend must return; the frontend never hardcodes them.

### Lead

**Create** (`GET /tenant/crm/lead/statuses`):
- Lead-Qualified
- Lead-Unqualified

**Edit transitions** (`GET /tenant/crm/records/{id}/transitions`):
- Prospect-In Discussion
- Prospect-Proposal
- Prospect-Identified Decision Makers
- Prospect-In Negotiation
- Prospect-Purchasing
- Prospect-Closed Lost
- Customer-Closed Lost
- Customer-Closed Won ⚡
- Customer-Renewal

### Prospect

**Create** (`GET /tenant/crm/prospect/statuses`):
- Prospect-In Discussion
- Prospect-Proposal
- Prospect-Identified Decision Makers
- Prospect-In Negotiation
- Prospect-Purchasing
- Prospect-Closed Lost

**Edit transitions** (`GET /tenant/crm/records/{id}/transitions`):
- Customer-Closed Lost
- Customer-Closed Won ⚡
- Customer-Renewal

### Customer

**Create** (`GET /tenant/crm/customer/statuses`):
- Customer-Closed Lost
- Customer-Closed Won ⚡
- Customer-Renewal

**Edit** (same-stage, `GET /tenant/crm/records/{id}/transitions`):
- Customer-Closed Lost
- Customer-Closed Won ⚡
- Customer-Renewal

> ⚡ Closed Won sets `customer_approval_status = 'pending'`. Only configured approvers see the Approve button.

> `Prospect-Identified Decision Makers` (PIDM) is included in all Prospect status lists.

---

## Doc ID — Human-Readable, Updates on Stage Transition

Format: `{TYPE_CODE}-{customer_id zero-padded to 6 digits}`

| Stage | Format | Example |
|-------|--------|---------|
| Lead | `LEAD-NNNNNN` | `LEAD-000042` |
| Prospect | `PROS-NNNNNN` | `PROS-000042` |
| Customer | `CUST-NNNNNN` | `CUST-000042` |

The numeric part is the `customer_id` (SERIAL PK) — same across all stages, preserving lineage. The prefix updates in `customer_doc_num` whenever `TransitionRecord` changes the `record_type`.

Doc num is displayed everywhere a UUID was previously shown: list tables (ID column), detail page headers, breadcrumbs.

---

## Transition Logic

### Forward-only

Records can only advance:
- Lead → Prospect or Customer
- Prospect → Customer
- Customer → Customer (same-stage status changes only)

No backward transitions. The backend enforces this; the frontend just renders what `AvailableTransitions` returns.

### Navigation after transition

The returned record from `POST /tenant/crm/records/{id}/transition` includes `record_type`. The frontend compares it to the current page's stage:

| Transition | Navigate to |
|------------|-------------|
| → Prospect status | `/crm/prospect/{id}` |
| → Customer status | `/crm/customer/{id}` |
| Same-stage status | Stay on current page, reload record |

---

## Approval Flow (Customer-Closed Won)

1. User selects `Customer-Closed Won` in the dropdown.
2. `TransitionRecord` sets `customer_approval_status = 'pending'`, `customer_is_approved = FALSE`.
3. Record shows "Pending Approval" badge in the Customer listing.
4. Configured approvers (from `crm_workflow_approver`) see an **Approve** button on the Customer detail page.
5. Approver clicks Approve → `POST /tenant/crm/records/{id}/approve` → `customer_approval_status = 'approved'`, `customer_is_approved = TRUE`.
6. Customer is now eligible for downstream work.

Non-approvers see the badge but no Approve button.

---

## Backend Changes Required

### 1. `TransitionRecord` in `crmstore/relational_store.go`

After updating `record_type_id`, regenerate `customer_doc_num`:
```go
// After updating record_type, regenerate doc_num prefix
typeCode := recordTypeCodeFor(newTypeID) // "LEAD" | "PROS" | "CUST"
docNum := fmt.Sprintf("%s-%06d", typeCode, customerID)
pool.Exec(ctx, `UPDATE customer SET customer_doc_num = $1 WHERE customer_id = $2`, docNum, customerID)
```

### 2. `Statuses(key)` — verify query filters `is_active = TRUE`

The existing query must filter `WHERE crm_status_is_active = TRUE AND crm_status_record_type = {typeID}`. PIDM is active and will appear in Prospect status lists automatically.

### 3. `AvailableTransitions(id)` — verify forward-only scope

Must return all statuses of higher-ranked stages only (PROSPECT + CUSTOMER for Lead, CUSTOMER only for Prospect, CUSTOMER only for Customer same-stage). Verify the existing implementation covers this.

---

## Frontend Changes Required

### Remove

- "Convert to Prospect" button — `LeadDetailPage.tsx`, `EditLeadPage.tsx`
- "Convert to Customer" button — `ProspectViewPage.tsx`, `EditProspectPage.tsx`
- Any hardcoded status lists or stage-routing logic

### Replace UUID with doc_num

In all tables (`LeadTable`, `ProspectTable`, `CustomerTable`) and detail page headers: display `record.docNum` (mapped from `customer_doc_num`). The `WorkflowRecord` type must expose `docNum: string`.

### Edit pages — wire StatusDropdown to `AvailableTransitions`

Edit pages call `crmService.getAvailableTransitions(id)` to populate the StatusDropdown. On selection:
1. Call `crmService.transitionRecord(id, newStatusId)`.
2. Receive updated record — check `record.recordType` (or `record.coreFields.record_type`).
3. If stage changed → navigate to `/crm/{newType}/{id}`.
4. If same stage → reload record in place.

### Create forms — verify StatusDropdown uses backend statuses

Create forms already call `crmService.getWorkflowStatuses(key)`. Verify the selected status ID is sent as `crmStatusId` in `CreateInput`. No frontend logic about which statuses to show — all from backend.

### StatusDropdown — show current status as selected (edit context)

On edit pages, pre-select the record's current `crm_status` in the dropdown. Forward options are what `AvailableTransitions` returns. Current status is shown as the current value but is not in the transitions list (can't re-select same status).

---

## What the Frontend Must NOT Do

- Hardcode any status name, status code, or record type code.
- Decide which statuses are available based on the current page route.
- Perform any stage-routing logic beyond "if record_type changed, navigate to the new route."
- Call `convertRecord` — that endpoint is no longer used by the UI.

---

## Files Affected

**Backend**
- `backend/database/migrations/tenant/000022_deactivate_pidm.up.sql` *(new)*
- `backend/database/tenant_migrations.go` *(register new migration)*
- `backend/crmstore/relational_store.go` — `TransitionRecord`, verify `Statuses`, `AvailableTransitions`
- `backend/workflow/types.go` or equivalent — ensure `DocNum` is in the Record DTO

**Frontend**
- `frontend/src/types/tenant.ts` — add `docNum` to `WorkflowRecord`
- `frontend/src/pages/crm/LeadDetailPage.tsx` — remove convert button, show docNum
- `frontend/src/pages/crm/EditLeadPage.tsx` — wire transitions dropdown, navigation
- `frontend/src/pages/crm/components/LeadTable.tsx` — show docNum
- `frontend/src/pages/prospect/ProspectViewPage.tsx` — remove convert button, show docNum
- `frontend/src/pages/prospect/EditProspectPage.tsx` — wire transitions dropdown, navigation
- `frontend/src/pages/prospect/components/ProspectTable.tsx` — show docNum
- `frontend/src/pages/crm/customer/CustomerDetailPage.tsx` — show docNum, approval badge
- `frontend/src/pages/crm/customer/EditCustomerPage.tsx` — wire transitions dropdown
- `frontend/src/pages/crm/customer/components/CustomerTable.tsx` — show docNum
- `frontend/src/services/crmService.ts` — remove `convertRecord` (or keep but unused)
- `frontend/src/components/crm/StatusDropdown.tsx` — no changes needed (already generic)
