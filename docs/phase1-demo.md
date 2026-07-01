# Phase 1 Demo — Onboarding & Async Provisioning (backend)

Proves the full server flow: platform admin invites a customer → customer accepts → the
server **automatically creates, migrates, and seeds a new tenant database** → the new super
admin logs in and reaches their isolated workspace.

## Prereqs
Local Postgres running (`docker compose up -d postgres`) and the control-plane DB created +
migrated (see `phase0-demo.md` steps 1–3 for `stonesuite_cp`).

## 1. Run the server with provisioning enabled
```bash
cd backend
CONTROL_PLANE_DB_URL="postgres://stonesuite:stonesuite_secret@localhost:5433/stonesuite_cp?sslmode=disable" \
PROVISION_ADMIN_DB_URL="postgres://stonesuite:stonesuite_secret@localhost:5433/postgres?sslmode=disable" \
JWT_SECRET="dev_secret" \
FRONTEND_URL="http://localhost:5173" \
go run .
```
Expect logs: `Multi-tenant control plane initialized.` and `Tenant provisioner started (2 workers).`
(Optionally set `SECRET_ENCRYPTION_KEY` to a base64 32-byte key to store tenant DSNs encrypted.)

## 2. Seed a platform owner + admin (control-plane DB)
```sql
-- in stonesuite_cp
INSERT INTO tenants (slug, display_name, status, migration_status, is_platform_owner)
VALUES ('stoneco','StoneSuite (Platform)','active','ok',true) RETURNING id;       -- note <owner_tenant_id>

INSERT INTO identities (tenant_id, email, password_hash, full_name, email_verified)
VALUES ('<owner_tenant_id>', 'admin@stone.co',
        crypt_placeholder, 'Platform Admin', true) RETURNING id;                   -- note <admin_identity_id>

INSERT INTO platform_admins (identity_id) VALUES ('<admin_identity_id>');
```
For the password hash, either register through the existing flow or generate a bcrypt hash
of a known password and paste it into `password_hash`.

## 3. Log in as the platform admin
```bash
curl -s localhost:8080/api/auth/tenant-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@stone.co","password":"<the password>"}' | jq
# -> { success, token: <ADMIN_JWT>, user: {...} }
```

## 4. Create a customer tenant + invite
```bash
curl -s -X POST localhost:8080/api/platform/tenants \
  -H "Authorization: Bearer <ADMIN_JWT>" -H 'Content-Type: application/json' \
  -d '{"slug":"acme","displayName":"Acme Corp","contactEmail":"owner@acme.test"}' | jq
# -> { success, tenantId, slug, inviteLink: ".../onboarding/accept?token=<TOKEN>" }
```

## 5. Accept the invite (creates identity + triggers provisioning)
```bash
curl -s localhost:8080/api/onboarding/tenant-invite/<TOKEN> | jq          # invite details
curl -s -X POST localhost:8080/api/onboarding/tenant-accept \
  -H 'Content-Type: application/json' \
  -d '{"token":"<TOKEN>","fullName":"Acme Owner","password":"supersecret"}' | jq
# -> 202 { success, status: "provisioning" }
```
Watch the server logs: `provisioning tenant acme (...) complete`. A new `tenant_acme`
database now exists, migrated and seeded with the owner as its first user.

## 6. List tenants (see it go active)
```bash
curl -s localhost:8080/api/platform/tenants -H "Authorization: Bearer <ADMIN_JWT>" | jq
# acme -> status: "active", migrationStatus: "ok", dbName: "tenant_acme"
```

## 7. New super admin logs in and reaches their isolated DB
```bash
TOKEN=$(curl -s localhost:8080/api/auth/tenant-login -H 'Content-Type: application/json' \
  -d '{"email":"owner@acme.test","password":"supersecret"}' | jq -r .token)
curl -s localhost:8080/api/tenant/me -H "Authorization: Bearer $TOKEN" | jq
# -> { tenantSlug: "acme", tenantDbName: "tenant_acme", userCount: 1 }
```

## Lifecycle (platform admin)
```bash
curl -s -X POST localhost:8080/api/platform/tenants/<TENANT_ID>/suspend      -H "Authorization: Bearer <ADMIN_JWT>"
curl -s -X POST localhost:8080/api/platform/tenants/<TENANT_ID>/restore      -H "Authorization: Bearer <ADMIN_JWT>"
curl -s -X POST localhost:8080/api/platform/tenants/<TENANT_ID>/delete       -H "Authorization: Bearer <ADMIN_JWT>"  # soft-delete + 30d grace
```
A suspended/deleted/provisioning tenant is refused by `/api/tenant/me` (resolver gate).

## What's NOT in this slice
- Frontend "setting up your workspace" screen + platform-admin UI (React) — to be built
  alongside the Phase 3 frontend work.
- A background reaper that runs `DROP DATABASE` after the grace window (Phase 4+).
- Neon-API provider for dedicated-project tenants (current `SQLProvider` uses portable
  `CREATE DATABASE`, which also works on Neon's shared project).
