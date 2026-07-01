# Phase 0 Demo — Tenant Routing & Isolation

Goal: prove that one Go server, given a JWT, resolves the request to the correct tenant and
queries **that tenant's isolated database** — with two tenants side by side.

## 1. Start local Postgres
```bash
docker compose up -d postgres
```

## 2. Create the control-plane DB + two tenant DBs
```bash
PGPASSWORD=stonesuite_secret createdb -h localhost -p 5433 -U stonesuite stonesuite_cp
PGPASSWORD=stonesuite_secret createdb -h localhost -p 5433 -U stonesuite tenant_acme
PGPASSWORD=stonesuite_secret createdb -h localhost -p 5433 -U stonesuite tenant_globex
```

## 3. Run migrations
```bash
# Control-plane schema
make migrate-cp-up

# Tenant template onto each tenant DB
make migrate-tenant-up db="postgres://stonesuite:stonesuite_secret@localhost:5433/tenant_acme?sslmode=disable"
make migrate-tenant-up db="postgres://stonesuite:stonesuite_secret@localhost:5433/tenant_globex?sslmode=disable"
```

## 4. Seed two tenants + an identity + one user each
Connect to the control-plane DB and insert two tenants. `db_connection_ref` holds the DSN
directly for now (PlainDSNResolver; encryption arrives in Phase 1).
```sql
-- in stonesuite_cp
INSERT INTO tenants (slug, display_name, status, migration_status, db_name, db_connection_ref)
VALUES
 ('acme','Acme Corp','active','ok','tenant_acme',
  'postgres://stonesuite:stonesuite_secret@localhost:5433/tenant_acme?sslmode=disable'),
 ('globex','Globex Inc','active','ok','tenant_globex',
  'postgres://stonesuite:stonesuite_secret@localhost:5433/tenant_globex?sslmode=disable');

-- an identity in Acme (note its id + tenant id for the JWT below)
INSERT INTO identities (tenant_id, email, full_name, email_verified)
SELECT id, 'admin@acme.test', 'Acme Admin', true FROM tenants WHERE slug='acme'
RETURNING id, tenant_id;
```
Then add users into each tenant DB so the counts differ:
```sql
-- in tenant_acme
INSERT INTO users (identity_id, email, full_name) VALUES (gen_random_uuid(),'admin@acme.test','Acme Admin');
-- in tenant_globex
INSERT INTO users (identity_id, email, full_name) VALUES (gen_random_uuid(),'a@globex.test','A'), (gen_random_uuid(),'b@globex.test','B');
```

## 5. Run the server pointed at the control plane
```bash
cd backend
CONTROL_PLANE_DB_URL="postgres://stonesuite:stonesuite_secret@localhost:5433/stonesuite_cp?sslmode=disable" \
JWT_SECRET="dev_secret" go run .
```
Look for: `Multi-tenant control plane initialized.`

## 6. Mint a JWT and call the tenant route
Create an HS256 token (e.g. on jwt.io) signed with `dev_secret`, payload:
```json
{ "id": "<identity-id>", "email": "admin@acme.test",
  "tenant_id": "<acme-tenant-id>", "user_id": "<acme-user-id>",
  "exp": 9999999999 }
```
```bash
curl -s http://localhost:8080/api/tenant/me -H "Authorization: Bearer <TOKEN>" | jq
```
Expect Acme's data with `"userCount": 1`. Swap `tenant_id` to Globex's id in a new token and
the same endpoint returns `"userCount": 2` from a **different database** — proving isolation.

## What this validates
- JWT → tenant resolution (control plane) → per-tenant pool (router) → query on the correct
  isolated DB.
- A suspended/provisioning/deleted tenant, or one with `migration_status != ok`, is refused
  by the resolver (try setting `status='suspended'` and re-calling).
