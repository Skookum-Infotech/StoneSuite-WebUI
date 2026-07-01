# Phase 2 Demo — Dynamic RBAC (backend)

Proves the role-based access control layer: a stable permission **catalog** in Go,
tenant-defined **roles** that bundle `{resource, action, scope}` grants, a seeded
**super_admin**, and an **enforcer** that decides whether a caller may act — and at what
scope.

## Where RBAC lives
- **Catalog** (resources × actions) — `backend/authz/catalog.go`. Code-defined and stable.
- **Tables** (per-tenant DB) — `roles`, `role_permissions`, `user_roles`, `teams`,
  `team_members` from tenant migration `000002_tenant_rbac.up.sql`.
- **Enforcer** — `backend/authz/enforcer.go`. Resolves a caller's effective grants by
  `identity_id` (the JWT `id` claim) through `users → user_roles → role_permissions`,
  then returns the **broadest** matching scope (`all > team > own`).
- **super_admin** — seeded as a single wildcard row `('*','*','all')`; the enforcer expands
  it, so adding catalog entries never requires re-seeding existing tenants.

## Prereqs
Run the full Phase 1 flow first (`docs/phase1-demo.md`) so tenant `acme` exists, is
provisioned, and its owner can log in. Provisioning now also seeds the `super_admin` role
and assigns it to the accepting owner.

## 1. Log in as the tenant super admin
```bash
TOKEN=$(curl -s localhost:8080/api/auth/tenant-login -H 'Content-Type: application/json' \
  -d '{"email":"owner@acme.test","password":"supersecret"}' | jq -r .token)
```

## 2. Inspect the permission catalog
```bash
curl -s localhost:8080/api/tenant/permissions/catalog -H "Authorization: Bearer $TOKEN" | jq
# -> { success, permissions: [ {resource, action}, ... ], scopes: ["all","team","own"] }
```
This succeeds because super_admin's wildcard grant covers `role:read`.

## 3. List roles (super_admin is seeded + system-protected)
```bash
curl -s localhost:8080/api/tenant/roles -H "Authorization: Bearer $TOKEN" | jq
# -> roles: [ { key: "super_admin", isSystem: true, permissions: [ {resource:"*",action:"*",scope:"all"} ] } ]
```

## 4. Create a custom role (least-privilege "Sales Rep")
```bash
curl -s -X POST localhost:8080/api/tenant/roles -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "key": "sales_rep",
    "name": "Sales Rep",
    "description": "Can work their own records.",
    "permissions": [
      {"resource":"record","action":"read","scope":"own"},
      {"resource":"record","action":"create","scope":"own"},
      {"resource":"record","action":"update","scope":"own"},
      {"resource":"record","action":"transition","scope":"own"}
    ]
  }' | jq
# -> { success, id: <ROLE_ID> }
```
Invalid grants are rejected (400):
```bash
curl -s -X POST localhost:8080/api/tenant/roles -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"bad","name":"Bad","permissions":[{"resource":"ghost","action":"read","scope":"own"}]}' | jq
# -> { success: false, message: "unknown permission ghost:read" }
```

## 5. Assign / unassign the role to a user
```bash
# Look up a tenant user id (e.g. via /api/tenant/me userCount, or your user-admin API).
curl -s -X POST localhost:8080/api/tenant/users/<USER_ID>/roles \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"roleId":"<ROLE_ID>"}' | jq
# -> { success: true, message: "Role assigned." }

curl -s -X DELETE localhost:8080/api/tenant/users/<USER_ID>/roles/<ROLE_ID> \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 6. Enforcement & scope
Every RBAC route checks the caller per method:
- `role:read`  → `GET /api/tenant/permissions/catalog`, `GET /api/tenant/roles`, `GET .../{id}`
- `role:configure` → `POST/PUT/DELETE` roles, role assignment.

A caller **without** the required permission gets `403`. Handlers that list/return records
read the granted scope via `authz.ScopeFromContext` (defaults to the most restrictive
`own`) to narrow row visibility — wired into record queries in **Phase 3**.

## System-role protections
- `super_admin` cannot be created via the API (reserved key → 400).
- System roles cannot be updated (`PUT` → 403) or deleted (`DELETE` → 404/forbidden).

## What's NOT in this slice
- Frontend **Role Editor** UI (renders the catalog into a grant matrix) — lands with the
  Phase 3 frontend work.
- Scope-aware **row filtering** on records — meaningful only once the Phase 3 workflow
  engine and `workflow_records` exist; the scope is already resolved and carried in context.
- A **migration fan-out** that re-seeds `super_admin` across *pre-existing* tenants. New
  tenants get it at provisioning time; back-filling old tenants is a runner concern (Phase 4+).
