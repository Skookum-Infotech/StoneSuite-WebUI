# ADR-002: `customer` as the single CRM master table (Lead / Prospect / Customer)

**Status:** Proposed
**Date:** 2026-06-15
**Deciders:** Platform owner (itadmin@elevationstone.com)
**Supersedes (in part):** ADR-001 `crm_record` v2 master table
**Scope:** SQL schema + Go backend only. Frontend rewire tracked separately.

---

## Context

The platform owner attached `StonSuite_DBSchema.xlsx` defining the production
CRM data model. It specifies a single, rich **`customer`** table (~75 columns)
that is the master for **Lead, Prospect and Customer** — the three are rows in
one table, distinguished by `record_type` (FK → `lkp_record_type`,
LEAD/PROS/CUST). It also specifies 12 `lkp_*` lookup tables (adds
`lkp_price_level`) and a dedicated `audit_logs` change trail.

This branch (`feat/versioned-crm-schema`) already implemented a **leaner**
`crm_record` master (~10 typed fields + 8 lookup FKs) behind a
`crmstore.Store` interface selected per tenant by `design_version` (v1 = JSONB
`workflow_records`; v2 = relational). The 11 `lkp_*` tables already exist and
**already match** the workbook's richer column sets (currency symbol; country
code2/code3/locale/phone/default-currency; state country_id/code).

`develop` (just merged in) added a **record-attachments** feature backed by
Cloudflare R2, including its own simple `audit_logs` table
(`actor_user_id, action, resource, resource_id, details, created_at`).

### Forces
- The workbook is the source of truth for the production schema; the message
  was explicit: *"use the customer table for CRM module of lead, prospect and
  customer."*
- `crm_record` was built on this feature branch and **never deployed** to live
  tenants (live tenants are on `develop`, schema_version = 11 / attachments).
  So replacing it has **no production data-migration cost**.
- StoneSuite is **database-per-tenant** — the DB connection *is* the tenant
  scope; there are no `WHERE tenant_id` filters anywhere.
- The merge introduced **two migrations numbered `000011`** and **two notions
  of `audit_logs`**, both of which must be reconciled.

---

## Decision

1. **Adopt the workbook's full `customer` table as the v2 CRM master.** Lead /
   Prospect / Customer are views of `customer` filtered by `record_type`. The
   existing `crm_record` table becomes vestigial (kept by its idempotent
   migration; flagged for a later drop once confirmed unused).
2. **Re-point `crmstore`'s v2 `relationalStore` at `customer`** (and its child
   history table), preserving the existing `Store` interface and JSON response
   shape so v1 tenants and the frontend are unaffected.
3. **Tenant-scoping columns:** **exclude `ss_tenant_id`** (redundant under
   database-per-tenant); **keep `ss_customer_id`** as a plain nullable
   `INTEGER` owner stamp (no cross-DB FK — the control plane is a separate
   database). It records which platform-level StoneSuite customer owns the row,
   for backups/exports consolidation.
4. **Add `lkp_price_level`** (12th lookup) + seed; "sync & validate" all 12
   lookups via the existing `GET /api/tenant/crm/lookups` endpoint and a
   startup self-check.
5. **Reconcile `audit_logs`:** enrich develop's existing table additively
   (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) into one unified trail used by
   both attachments and CRM mutations.
6. **Migration collision:** keep develop's `000011_record_attachments`; the six
   versioned-CRM migrations shift to `000012`–`000017` (done). New Phase-3
   migrations are `000018`+.

---

## Options Considered

### Option A: Adopt full `customer` table (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | High (new ~75-col table + store rewrite) |
| Fidelity to workbook | Exact |
| Production data risk | None (crm_record never deployed) |
| Future ERP fit (Sales Order / Invoice) | Strong — shares the same conventions |

**Pros:** matches the production spec exactly; the customer table already
carries billing/AR/credit/tax fields needed by Sales Order & Invoice later;
clean column-prefix conventions consistent with `lkp_*`.
**Cons:** largest table in the system; `relational_store.go` is a substantial
rewrite; leaves `crm_record` temporarily orphaned.

### Option B: Extend `crm_record` in place
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Fidelity to workbook | Table name diverges (`crm_record` ≠ `customer`) |
| Churn | Lower (ALTER ADD ~65 columns) |

**Pros:** less store churn; one master table, no orphan.
**Cons:** contradicts the explicit instruction and the workbook; every future
ERP doc references `customer`; column prefixes (`crm_record_*`) wouldn't match
the spec's `customer_*`.

**Why A:** the instruction and workbook are unambiguous, and there is no
production migration penalty because `crm_record` was never shipped.

---

## Target Schema (Phase-3 migrations)

### `000018_customer.up.sql` — master CRM table
Column prefix `customer_*`, per the workbook. Highlights:

- **Identity:** `customer_id SERIAL PK`, `customer_doc_num VARCHAR(20) UNIQUE`
  (document number), `ss_customer_id INTEGER NULL` (owner stamp; **no FK**),
  `record_type INTEGER NOT NULL → lkp_record_type`.
- **Primary info:** `customer_name`, `customer_dba_name`, `customer_tax_id`
  (PII), `customer_type → lkp_customer_type`, `customer_crm_status →
  lkp_crm_status`, authorized person f/l name, `customer_is_child BOOL`,
  `customer_parent_company → customer(customer_id)` (self-FK),
  `customer_status → lkp_record_status`, `customer_ar_status →
  lkp_customer_ar_status`.
- **Contact:** primary/alt phone, fax, website, contact/accounting/additional
  email.
- **Three address blocks** (primary / billing / shipping), each: line1, line2,
  suite, city, `state → lkp_state`, zip, `country → lkp_country`, plus
  `customer_is_bill_as_primary` / `customer_is_ship_as_primary` flags.
- **CRM/sales-cycle (mandatory for LEAD/PROS):** `customer_crm_owner_user_id →
  employee`, `customer_lead_source → lkp_crm_lead_source`,
  `customer_lead_score`, `customer_expected_close_date`,
  `customer_expected_deal_value DECIMAL(15,2)`, `customer_last_contacted_date`,
  `customer_preferred_contact_method → lkp_contact_method`,
  `customer_do_not_contact BOOL`, `customer_internal_notes TEXT`.
- **Sales fields:** `customer_sales_rep_user_id → employee`,
  `customer_price_level → lkp_price_level`, tax-exempt set (flag, reason,
  cert #, cert file id, expiry), `customer_sales_tax_percent DECIMAL(6,4)`,
  `customer_payment_terms → lkp_payment_terms`, `customer_credit_limit`,
  credit-lock flag + reason.
- **Balances:** total / deposit / overdue (DECIMAL(15,2) default 0),
  `customer_days_overdue`, `customer_currency → lkp_currency`.
- **Dynamic:** `customer_custom_fields JSONB DEFAULT '{}'` (≤15, validated
  against `workflow_field_definitions`).
- **Lineage/approval:** `customer_parent_id → customer` (convert lineage),
  approval set (`is_approved`, `approval_status` none|pending|approved,
  `approved_by → employee`, `approved_at`).
- **Audit/soft-delete/concurrency:** `customer_created_at/by`,
  `customer_updated_at`, `customer_deleted_at/by` (paired CHECK),
  `customer_record_version INTEGER DEFAULT 1`.
- **Indexes (partial, `WHERE customer_deleted_at IS NULL`):** `record_type`
  (listing filter), `customer_crm_status`, `customer_crm_owner_user_id`,
  `customer_parent_id`, GIN on `customer_custom_fields`, UNIQUE on
  `customer_doc_num`.

> Validation rule from the workbook: lead-source / lead-score / expected-close /
> deal-value / last-contacted / preferred-contact / do-not-contact are
> **mandatory when `record_type ∈ {LEAD, PROS}`** — enforced in the Go
> validator (not a DB CHECK, since it's conditional on a FK value).

### `000019_lkp_price_level.up.sql`
`lkp_price_level` (id, name, code, `price_level_discount DECIMAL(5,2)`,
is_active, is_system, audit cols) + seed PL1/PL2/PL3 and register it in the
lookups endpoint payload.

### `000020_audit_logs_enrich.up.sql`
Additive `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS`:
`table_name TEXT`, `old_value JSONB`, `new_value JSONB`, `ip_address INET`,
`session_id TEXT`, `app_version TEXT`. Existing `actor_user_id` = changed-by,
`created_at` = changed-at, `resource_id` = record id. One unified trail.

### `000021_customer_history.up.sql`
`customer_history` (record_id, from_type, to_type, from_status, to_status,
actor_employee_id, at, snapshot JSONB) — mirrors the existing
`crm_record_history` but for `customer`.

---

## Backend changes

- **`crmstore/relational_store.go`** — re-target all SQL from `crm_record` →
  `customer`; map the unified `CoreFields` keys to `customer_*` columns; expand
  scan/insert/update to the new columns; conditional-required validation for
  LEAD/PROS; status/transition rules unchanged (drive off `lkp_crm_status`).
- **`crmstore/store.go`** — unchanged interface; same DTO shape.
- **Audit writer** — a small `audit` helper writing to the unified `audit_logs`
  (old/new JSONB diff, actor, ip from request, session, app version) invoked by
  every CRM create/update/delete/transition/approve.
- **Lookups** — extend `controllers/crm_lookups.go` to include `priceLevels`;
  add a startup self-check that every lookup table has ≥1 active seed row.

---

## CRM CRUD API surface (target)

All under `/api/tenant/crm/*`, auth + tenancy + RBAC enforced; identical JSON
shape across v1/v2. `{type}` ∈ `lead | prospect | customer`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenant/crm/lookups` | All 12 `lkp_*` arrays (incl. price levels; states carry `countryId`) |
| GET | `/api/tenant/crm/{type}/records` | List by record_type, RBAC-scoped, active only |
| POST | `/api/tenant/crm/{type}/records` | Create (own-type statuses; validates required + custom_fields) |
| GET | `/api/tenant/crm/records/{id}` | Read one |
| PATCH | `/api/tenant/crm/records/{id}` | Update (optimistic `record_version`) |
| DELETE | `/api/tenant/crm/records/{id}` | Soft-delete (sets deleted_at/by) |
| GET | `/api/tenant/crm/{type}/statuses` | Own-type statuses (create form) |
| GET | `/api/tenant/crm/records/{id}/transitions` | Forward-type statuses (edit form) |
| POST | `/api/tenant/crm/records/{id}/transition` | Advance stage forward-only; writes history |
| POST | `/api/tenant/crm/records/{id}/convert` | Lead→Prospect→Customer with `parent_id` lineage |
| POST | `/api/tenant/crm/customer/records/{id}/approve` | Approve Closed-Won (approver-gated; v2) |
| GET | `/api/tenant/crm/records/{id}/audit` | Audit trail for a record (from `audit_logs`) |

---

## Trade-off Analysis

The cost is concentrated in one file (`relational_store.go`) and a set of
additive migrations; the interface boundary means controllers, routes, RBAC,
and the frontend are untouched. Keeping `ss_customer_id` but dropping
`ss_tenant_id` preserves a useful platform-level owner stamp without
reintroducing tenant-filtering semantics that the isolation model forbids.
Enriching the single `audit_logs` (vs. a parallel change-log) keeps one query
path and one retention policy. The chief downside — an orphaned `crm_record` —
is cosmetic and scheduled for cleanup.

## Consequences
- **Easier:** Sales Order / Invoice (workbook sheets) can FK straight to
  `customer`; one audit trail; lookups already match the spec.
- **Harder:** `customer` is wide; the store layer carries many nullable
  columns; conditional-required logic lives in Go, not the DB.
- **Revisit:** drop vestigial `crm_record` + `crm_record_history` once v2 is
  proven on `customer`; backfill tool if any tenant ever flipped to the old v2.

**Status update (2026-06-15): implemented.** Note the final numbering differs
from the draft — `lkp_price_level` is `000018` (must precede `customer`, which
FKs it) and `customer` is `000019`.

## Action Items
1. [x] Merge `origin/develop`; resolve `000011` collision (→ 012–017).
2. [x] `000019_customer.up.sql` — master table + indexes.
3. [x] `000018_lkp_price_level.up.sql` — table + seed (ordered before customer).
4. [x] `000020_audit_logs_enrich.up.sql` — additive columns.
5. [x] `000021_customer_history.up.sql`.
6. [x] Re-target `crmstore/relational_store.go` → `customer` (registry-driven);
       `company_name` required; audit-write helper (`auditCRM` + `LogAuditFull`).
7. [x] Extend lookups endpoint with `priceLevels` + startup seed self-check
       (`database.ValidateLookupSeeds`, wired into `migrateAllTenants`).
8. [x] Table-driven tests: forward-only, registry uniqueness, write-arg kinds,
       bool/decimal/date parsing (`go test ./...` green).
9. [x] `go build ./... && go test ./...` green; migrations 001–021 + a live
       customer INSERT/doc-num/read/audit verified against Postgres 16.
10. [ ] Follow-up: frontend fields for the rich `customer` columns; drop the
        vestigial `crm_record` once v2 is proven.
11. [ ] Follow-up: enforce the `leadProspectRequired` set once the Lead/Prospect
        forms collect those fields.
