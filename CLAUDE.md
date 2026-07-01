# StoneSuite — Claude Memory

## What This App Does
**StoneSuite** is a **multi-tenant, white-label dynamic CRM platform** built on database-per-tenant architecture. Each customer organization gets a fully isolated database with:
- **Dynamic workflow engine** (state machines like Lead → Prospect → Customer)
- **Custom fields** (≤15 per workflow, stored as JSONB)
- **Dynamic RBAC** (resource + action + scope permissions)
- **Multi-user workspaces** with team-level access control
- **Central authentication** (email/password + JWT + OAuth SSO via Entra ID/Cognito/Okta)

The **platform owner** (your company) sits above all tenants, managing onboarding and platform-level operations.

## Monorepo Structure
```
StoneSuite/
├── frontend/                          # React 19 + TypeScript + Vite 8 + TailwindCSS 4
│   ├── .env.production               # VITE_API_BASE_URL (for Cloudflare Pages prod)
│   ├── .env.example                  # Environment template
│   └── src/
│       ├── api/                      # Axios client (client.ts)
│       ├── components/
│       │   ├── ui/                   # shadcn/ui primitives
│       │   ├── customer/             # Customer onboarding modal & forms
│       │   ├── prospect/             # Prospect forms & details
│       │   └── crm/                  # CRM-specific components
│       ├── hooks/                    # useAuth, useUserPermissions, etc.
│       ├── layouts/                  # AuthLayout, MainLayout
│       ├── pages/
│       │   ├── crm/                  # Lead, Prospect, Customer pages
│       │   ├── config/               # Workflows, Roles, Access control
│       │   ├── customer/             # Customer onboarding pages
│       │   └── onboarding/           # Public apply & set-password pages
│       ├── router/                   # React Router v7 config
│       ├── services/                 # API wrappers (tenantServices, leadService, etc.)
│       ├── store/                    # Zustand stores (useAuthStore)
│       ├── types/                    # Shared TypeScript types (Tenant, Lead, Prospect, etc.)
│       └── config/                   # sidebarNav.ts (navigation groups)
├── backend/                           # Go 1.25 + net/http + PostgreSQL (pgx)
│   ├── fly.toml                      # Fly.io deployment config (v2 format)
│   ├── Dockerfile                    # Multi-stage Alpine build (CGO_ENABLED=0)
│   ├── main.go                       # Entry point: init CP, apply migrations, start server
│   ├── config/                       # Env-based AppConfig struct
│   ├── tenancy/                      # Control-plane registry, resolver, router, middleware
│   ├── authz/                        # RBAC: permission catalog, enforcer
│   ├── workflow/                     # Workflow engine: state machines, custom fields, seed data
│   ├── controllers/                  # HTTP handlers (tenant, lead, prospect, customer, RBAC, onboarding)
│   ├── middleware/                   # JWT auth, tenancy resolver
│   ├── database/                     # Pool init, migrations (control-plane + tenant)
│   ├── services/                     # Email service, provisioning
│   ├── lead/                         # Lead store & types (JSONB custom_fields)
│   ├── prospect/                     # Prospect store & types (JSONB custom_fields)
│   ├── provisioning/                 # Provisioner: queue, worker, async job runner
│   └── database/migrations/
│       ├── control_plane/            # CP schema: tenants, identities, invites, sso_configs, audit_logs
│       └── tenant/                   # Tenant template: workflows, states, transitions, records, audit_logs
├── docs/                              # Architecture, API contracts, dev workflow
└── docker-compose.yml                 # Dev: Postgres + Adminer + backend
```

**Entry points:** `frontend/src/main.tsx` | `backend/main.go`
**Deployment:** Cloudflare Pages (frontend) + Fly.io (backend Go) + Neon Postgres (data)

## Common Commands
```bash
# Frontend
cd frontend && npm run dev        # Vite dev server → http://localhost:5173
cd frontend && npm run build      # tsc + vite build
cd frontend && npm run lint       # ESLint check
# cd frontend && npm test         # TODO: no test runner configured yet

# Backend
cd backend && go run .            # start server → http://localhost:8080
cd backend && go test ./...       # run all tests
cd backend && go build ./...      # verify build compiles
cd backend && golangci-lint run   # lint (requires golangci-lint installed)

# Infrastructure
docker compose up -d postgres     # start DB only
docker compose up -d              # start full stack
docker compose down -v            # tear down + remove volumes
```

## Deployment Architecture

### Production Stack
- **Frontend:** Cloudflare Pages (React SPA, deployed from GitHub)
- **Backend:** Fly.io (single Go app, iad region, **scale-to-zero** — the Machine stops when idle and auto-starts on the next request, ~1-2s cold start; costs nothing at idle)
- **Database:** Neon Postgres (single project, ~30 tenant databases + control-plane DB)

### Backend Deployment (Fly.io)

**1. Prerequisites** (one-time setup)
```bash
# Install flyctl
brew install flyctl

# Authenticate
fly auth login
fly auth whoami   # verify
```

**2. Create/Update `backend/fly.toml`** (already exists)
- App name: `stonesuite-backend`
- Region: `iad` (US East, close to Neon us-east-2)
- Scale-to-zero: `auto_stop_machines="stop"`, `min_machines_running=0`, **no periodic health check** (a recurring check would keep the Machine awake and defeat idle-stop). In-app `GET /api/healthz` (liveness) + `/api/readyz` (DB) exist for an external uptime monitor instead.
- VM: 256MB RAM, 1 shared CPU
- All non-secret env vars defined in `[env]` section

**3. Set Fly.io Secrets** (required on first deploy)
```bash
fly secrets set \
  CONTROL_PLANE_DB_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require" \
  PROVISION_ADMIN_DB_URL="postgres://user:pass@ep-xxx-direct.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require" \
  JWT_SECRET="$(openssl rand -base64 48)" \
  SECRET_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Optional: email (app degrades gracefully if not set)
fly secrets set \
  SMTP_HOST="smtp.gmail.com" \
  SENDER_EMAIL="itadmin@elevationstone.com" \
  SENDER_PASSWORD="your-gmail-app-password"

# Verify
fly secrets list
```

**4. Deploy**
```bash
cd backend
fly deploy                   # builds + pushes to Fly.io
fly logs                     # watch deployment logs
fly status                   # check app status
```

**5. Verify Deployment**
```bash
# Health check
curl https://stonesuite-backend.fly.dev/api

# Test login endpoint
curl -X POST https://stonesuite-backend.fly.dev/api/auth/tenant-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

**6. What Happens on First Boot**
- Control-plane migrations auto-apply (`cp_schema_version` table created, schema initialized)
- Platform-owner tenant database provisioned automatically (if configured)
- Tenant migration runner starts in background (fan-out to all tenant DBs)
- Health check passes when `/api` returns `{"success":true}`

### Frontend Deployment (Cloudflare Pages)

**1. Connect GitHub Repository**
- Go to Cloudflare Pages dashboard
- Click "Create a project" → "Connect to Git"
- Select the StoneSuite repository

**2. Configure Build**
- Framework: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables (in Pages settings):
  ```
  VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
  ```

**3. Deploy**
- Every push to `feat/dynamic-crm-platform` auto-builds and deploys to `stonesuite.pages.dev`
- Or manually redeploy from Pages dashboard

**4. Custom Domain**
- Cloudflare Pages → Custom domain → point to `stonesuite.pages.dev`

### Environment Variables Reference

**Backend (`fly.toml` + secrets)**

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| PORT | No | `[env]` in fly.toml | Default: 8080 |
| CONTROL_PLANE_DB_URL | **Yes** | `fly secrets set` | Neon pooled connection string |
| PROVISION_ADMIN_DB_URL | **Yes** | `fly secrets set` | Neon direct (unpooled) — for `CREATE DATABASE` |
| JWT_SECRET | **Yes** | `fly secrets set` | HS256 key (openssl rand -base64 48) |
| SECRET_ENCRYPTION_KEY | No | `fly secrets set` | AES-256 for encrypting DSN refs; dev omits |
| CORS_ORIGIN | No | `[env]` in fly.toml | Frontend URL (e.g. https://dev.stonesuite.app) |
| FRONTEND_URL | No | `[env]` in fly.toml | Same as CORS_ORIGIN, used in email links |
| SMTP_HOST | No | `fly secrets set` | Email service (e.g. smtp.gmail.com) |
| SENDER_EMAIL | No | `fly secrets set` | From address for emails |
| SENDER_PASSWORD | No | `fly secrets set` | SMTP password or Gmail app password |
| INVITE_EXPIRY_HOURS | No | `[env]` in fly.toml | Default: 24 |
| SMTP_PORT | No | `[env]` in fly.toml | Default: 587 |

**Frontend (.env.production)**
```
VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
```

(See `.env.example` for Entra ID / Cognito OAuth variables — not yet production-deployed)

## Multi-Tenant Architecture (Locked Design)

### Core Topology
- **One Fly.io app** (stateless Go service) routes to **one Neon project** with **~30 tenant databases**.
- **Control-plane DB** (`stonesuite_cp`): shared across all tenants. Holds tenants registry, identities, invites, SSO configs, platform audit logs.
- **Tenant DBs** (`tenant_<slug>`): one per customer. Fully isolated. Contains workflows, records, users, roles, audit logs.
- **Request flow:** JWT → TenantResolver (load from control plane) → DB router (get tenant pool) → handler queries tenant DB.

### Control-Plane Database Schema
- `tenants` — id, slug, display_name, status (invited|provisioning|active|suspended|deleted), db_name, db_connection_ref (encrypted), is_platform_owner, schema_version, created_at
- `identities` — id, email (unique), password_hash, tenant_id, full_name, email_verified, sso_provider, sso_subject, password_reset_token, password_reset_expiry, created_at, updated_at
- `tenant_invites` — id, tenant_id, contact_email, token, status (pending|accepted), expires_at, accepted_at, created_at
- `tenant_sso_configs` — tenant_id, provider (entra|cognito|okta), client_id, client_secret (encrypted), enabled, created_at
- `platform_admins` — identity_id (grants platform-level powers)
- `platform_audit_logs` — actor_identity_id, actor_email, tenant_id, action, details (JSONB), at
- `cp_schema_version` — version, applied_at (tracks control-plane migrations)

### Tenant Database Schema (Provisioned from Template)
**People & access:**
- `users` — id, identity_id (ref to CP), full_name, status (active|suspended), created_at
- `roles` — id, key, name, is_system (super_admin seeded), description
- `role_permissions` — role_id, resource, action, scope (all|team|own)
- `user_roles` — user_id, role_id
- `teams` — id, name, created_at (optional, enables team-scope RBAC)

**Workflows & records:**
- `workflows` — id, key (lead|prospect|customer|custom), name, enabled, created_at
- `workflow_states` — id, workflow_id, key, name, is_initial, is_terminal, sort_order
- `workflow_transitions` — id, workflow_id, from_state_id, to_state_id, name, required_permission (resource:action), guard (JSONB)
- `workflow_transition_actions` — id, transition_id, type (send_email|assign_owner|set_field|webhook|create_record), config (JSONB), sort_order
- `workflow_field_definitions` — id, workflow_id, key, label, data_type (string|number|date|bool|enum|email), required, options (JSONB), validation (JSONB), sort_order. **Max 15 custom fields per workflow.**
- `workflow_records` — id, workflow_id, current_state_id, owner_user_id, team_id, core_fields (JSONB), custom_fields (JSONB), created_at, updated_at
- `workflow_record_history` — record_id, from_state, to_state, actor_user_id, transition_id, at, snapshot (JSONB)

**Legacy/CRM tables (from migrations):**
- `leads` — id, type, company_name, lead_status, email, phone, custom_fields (JSONB), created_at, updated_at
- `prospects` — id, company_name, status, custom_fields (JSONB), created_at, updated_at
- `customers` — account_email, custom_fields (JSONB)

**Audit:**
- `audit_logs` — actor_user_id, action, resource, resource_id, details (JSONB), at
- `schema_version` — version, applied_at (tracks tenant migrations)

### API Routes (Multi-Tenant)

**Public (no auth):**
- `GET /api` — health check
- `POST /api/auth/tenant-login` — login as customer
- `POST /api/platform/bootstrap` — one-shot: create first platform-owner + tenant (guards with 409 if owner exists)
- `GET /api/onboarding/form-schema` — Customer workflow field definitions (for dynamic form rendering)
- `GET /api/onboarding/apply/{token}` — validate invite, return form schema
- `POST /api/onboarding/apply` — submit onboarding form (sets tenant status = submitted)
- `GET /api/onboarding/set-password/{token}` — validate setup token
- `POST /api/onboarding/set-password` — set password, activate identity

**Platform admin (auth required, `isPlatformAdmin` checked):**
- `GET /api/platform/tenants` — list all tenants
- `POST /api/platform/tenants` — create tenant + immediately provision (skip approval)
- `GET /api/platform/tenants/{id}` — get tenant details
- `POST /api/platform/tenants/{id}/approve` — approve pending onboarding
- `POST /api/platform/tenants/{id}/reject` — reject pending onboarding
- `POST /api/platform/invites` — send invite link (async email)

**Tenant-scoped (auth required, tenancy middleware, RBAC enforced):**
- `GET /api/tenant/me` — current tenant + user info (proves DB isolation)
- `GET /api/tenant/workflows` — list workflows
- `GET /api/tenant/workflows/{id}` — get workflow + field definitions
- `POST /api/tenant/workflows/{id}/enabled` — toggle workflow enabled
- `POST /api/tenant/workflows/{id}/fields` — add custom field (max 15)
- `DELETE /api/tenant/workflows/{id}/fields/{fieldId}` — remove custom field
- `GET /api/tenant/roles` — list roles
- `POST /api/tenant/roles` — create custom role
- `PATCH /api/tenant/roles/{id}` — update role
- `DELETE /api/tenant/roles/{id}` — delete role (not system roles)
- `GET /api/tenant/users/{id}/roles` — user's assigned roles
- `PATCH /api/tenant/users/{id}/roles` — assign/revoke roles
- `POST /api/tenant/permissions/catalog` — RBAC permission catalog (for UI)
- `GET /api/tenant/workflows/{id}/records` — list records in workflow (filtered by RBAC scope)
- `POST /api/tenant/workflows/{id}/records/search` — scope-safe server-side filter + sort + keyset pagination (see Record Filter Engine)
- `POST /api/tenant/crm/{workflowKey}/records/search` — same engine for CRM records (dual-store: v1 JSONB + v2 relational)
- `POST /api/tenant/workflows/{id}/records` — create record
- `GET /api/tenant/records/{id}` — get record
- `PATCH /api/tenant/records/{id}` — update record (custom_fields validated against definitions)
- `POST /api/tenant/records/{id}/transition` — move record to new state (validate transition, run guards, execute actions)
- `GET /api/tenant/leads` — list leads (filtered by RBAC)
- `POST /api/tenant/leads` — create lead
- `GET /api/tenant/leads/{id}` — get lead
- `PATCH /api/tenant/leads/{id}` — update lead (custom_fields)
- `DELETE /api/tenant/leads/{id}` — delete lead
- (Same for `/api/tenant/prospects` and `/api/tenant/customers`)

### Migrations & Auto-Apply

**Control-plane migrations** (in `backend/database/migrations/control_plane/*.up.sql`):
- Applied automatically on startup via `ApplyControlPlaneMigrations()` in `main.go`
- Tracked in `cp_schema_version` table (idempotent)
- Example: `001_initial_schema.up.sql`, `002_sso_configs.up.sql`

**Tenant migrations** (in `backend/database/migrations/tenant/*.up.sql`):
- Applied at provisioning time to new tenants (via `ApplyTenantMigrations()`)
- Fan-out to existing tenants on startup via `migrateAllTenants()` goroutine
- Tracked per-tenant in `schema_version` table
- Examples: `000001_initial_schema.up.sql`, `000004_prospects.up.sql`, `000005_leads.up.sql`, `000006_crm_custom_fields.up.sql`

**Never use down-migrations** — recovery is via Neon point-in-time restore or branching.

## React Rules (always enforce)
- Component files: PascalCase — `UserProfile.tsx`. One component per file.
- Async data fetching: TanStack React Query only — no bare `useEffect` for fetches.
- Custom hooks: live in `hooks/`, prefixed `use` (e.g., `useAuth.ts`).
- Global state: Zustand only. No prop drilling beyond 2 levels.
- Forms: React Hook Form + Zod. (Neither is installed yet — add before building forms.)
- Never mutate state directly — always return new objects/arrays.
- Styling: Tailwind classes only. No inline `style={}`, no CSS Modules.
- Exports: named exports everywhere except page-level route components (default export).
- `useEffect` with side effects must return a cleanup function.
- Accessibility: all interactive elements need `aria-label` and keyboard navigation.
- `@typescript-eslint/no-explicit-any` is an error — type everything properly.

## Go Rules (always enforce)
- Package names: lowercase, single word, no underscores.
- Errors: always check and wrap — `fmt.Errorf("context: %w", err)`. Never swallow.
- No `panic()` in production paths — return errors up the call stack.
- Struct fields: PascalCase (exported) for JSON marshaling; lowercase for internal.
- Interfaces: define at point of use (consumer side), not at implementation.
- HTTP handlers: `func (h *Handler) Name(w http.ResponseWriter, r *http.Request)`.
- Service/DB functions: `context.Context` as first parameter.
- All config via env vars — never hardcode values; use `config.AppConfig`.
- No global mutable state — inject dependencies via constructor.
- Tests: `testify`, table-driven for all pure functions.
- Goroutines: must have explicit exit strategy (WaitGroup or channel).

## Strict Implementation Rules (CRITICAL)

### Multi-Tenancy (Inviolable)
1. **Every query is tenant-scoped by construction.** No `WHERE tenant_id` filters. Instead:
   - Use separate databases (`tenant_<slug>`) — the DB connection itself is the scope.
   - OR, in control-plane queries, always explicitly filter by `identity.tenant_id` or `tenant.id`.
2. **Never select/join across tenant databases.** Tenants are fully isolated.
3. **TenantResolver middleware is MANDATORY** on all tenant-scoped routes. Missing it = security bug.
4. **JWT carries `tenant_id` + `user_id` + `identity_id`.** Every handler gets these from context via `TenantFromContext()`, `UserFromContext()`, etc.

### RBAC (Permission Enforcement)
1. **Every mutation (POST/PATCH/DELETE) must check `Require(resource, action)`** before executing.
2. **Every list/read (GET) must apply scope filtering** (`all|team|own`) from the caller's roles.
3. **Single-record access must enforce ownership scope, not just the permission (IDOR guard).** Holding `lead:read` scoped to `own` permits reading ONLY your own records — never any id you can guess. Use `recordInScope(ctx, pool, scope, identityID, ownerUserID, teamID)` (controllers/scope.go) on every single-record GET/PATCH/DELETE/transition. CRM record handlers get this for free via `authCRMByRecordID`; `WorkflowOps` uses `enforceRecordScope`. On scope denial return **404** (not 403) so ids can't be enumerated. Both store designs put the owning `users.id` in `Record.OwnerUserID`.
4. **No permission bypass.** If a handler ever skips the enforcer, it's a bug.
5. **System roles (super_admin, guest) are immutable** — cannot be deleted or modified by users.
6. **Log security events.** Failed logins, permission denials, IDOR attempts, and rate-limit hits go through `logSecurityEvent(r, "<event>", kv...)` (controllers) or `slog.Warn("security event", ...)` with a stable `security_event` key. Never log passwords or raw tokens.

### Record Filter Engine (`backend/query/`)
The `query` package is the **single, store-agnostic** way to do server-side filtering, sorting, and keyset pagination on records. Both record-list designs (v1 JSONB `workflow.ListRecordsFiltered`, v2 relational `relationalStore.SearchRecords`) and both search endpoints route through it. Do not hand-roll record filtering elsewhere.
1. **Filter ⨯ scope is ANDed, never OR.** The RBAC scope clause (`all|team|own`) and the user filter are composed with `AND`, so a filter can only **narrow** the caller's permitted set — never widen it. This is the inviolable security property; preserve it and keep the scope-composition unit tests green (`workflow/filter_test.go`).
2. **Field keys are a whitelist via `query.FieldResolver`.** A key that doesn't resolve is a `400` (`*query.InvalidFilterError`), never raw SQL. Namespaces: bare system keys (`id`, `created_at`, `updated_at`, `status`, `record_number`, `owner_user_id`); `cf:<key>` (custom, must pass `workflow.validFieldKey` / `crmstore.validCustomKey` regex); `core:<key>` (v1 JSONB core, re-validated regex; v2 mapped via the `customerFields` registry). Frontend sends design-agnostic keys (e.g. `core:customer_name`, `status`) and each store's resolver maps them to its own schema.
3. **All values are parameterized** (`$n`); `Build(req, resolver, startIdx)` returns SQL fragments the store ANDs onto its scope clause. Never interpolate client values; custom/core keys are only interpolated after passing the identifier regex.
4. **Pagination is keyset (opaque base64 cursor), not offset.** No total-count query (expensive at scale). Stores fetch `EffLimit+1`; the extra row sets `hasMore` and mints `query.NextCursor`. Page size caps at `MaxLimit` (100), default 25. A forged/stale cursor stays within scope (safe).
5. **Sortable fields are restricted** to stable non-null columns (`created_at`, `updated_at`, `record_number`) so keyset comparison is NULL-safe. Sorting by custom fields / name / id is deliberately deferred — don't add it without solving NULL ordering.
6. **Map errors correctly.** `*query.InvalidFilterError` → 400 (in `crmFail` and the workflow `SearchRecords` handler). Maps to a field-level message; never a 500.
7. **`query` imports nothing app-specific** (it defines its own `query.DataType` mirroring `workflow.DataType`) — keep it dependency-free so the `workflow` store can import it without a cycle.

**Known gaps (don't assume these work):** v2 relational `team` scope behaves like `own` (no team column on `customer`); v2 custom fields are text-typed only; spec #2 cross-entity `POST /api/tenant/search` is not built.

### Custom Fields & JSONB (Data Integrity)
1. **custom_fields JSONB must validate against `workflow_field_definitions` before save.** 
   - Type check (string/number/date/bool/enum).
   - Require check for required=true fields.
   - Enum check for options-bounded fields.
   - Regex validation if provided.
2. **Max 15 custom fields per workflow** — enforce in validator before INSERT/UPDATE.
3. **Never manually craft JSONB.** Use helpers to build `map[string]any`, validate, then marshal.

### Database & Migrations
1. **Control-plane migrations are idempotent.** Use `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` for writes.
2. **Tenant migrations never use `ALTER TABLE` to add columns.** Use migrations (000007, etc.) instead.
3. **Tenant schema_version table tracks all applied versions.** Queries that fail to update it = data corruption risk.
4. **Never run raw SQL in handlers.** Always use prepared statements (pgx named params).
5. **All queries accept `context.Context` as first parameter.** Enables cancellation + tracing.

### API & HTTP
1. **Routes are prefixed by scope:**
   - `/api/` — general (health, etc.)
   - `/api/auth/` — authentication
   - `/api/platform/` — platform admin (control-plane level, auth required)
   - `/api/onboarding/` — public (no auth)
   - `/api/tenant/` — tenant-scoped (auth + TenantResolver required)
2. **All responses are JSON.** Status codes: 200 (success), 400 (bad input), 401 (no auth), 403 (forbidden/RBAC), 404 (not found), 409 (conflict, e.g., resource exists), 500 (server error).
3. **Error responses always include `success: false, message: "..."`.** Structure: `{success: bool, message: string, data?: any}`.
4. **Handlers must validate input.** Use `json.Unmarshal` + struct tags + custom validation.

### Goroutines & Async (Reliability)
1. **Every goroutine must have an explicit exit strategy** (WaitGroup, channel, context cancellation).
2. **Long-running jobs (provisioning, migration fan-out) must be resumable.** If a worker crashes, the next boot picks up incomplete jobs.
3. **Provisioning jobs are enqueued atomically.** All-or-nothing: INSERT into job queue inside the same transaction as the state change.
4. **No `defer` without checking error.** `defer tx.Rollback(ctx)` is correct; `defer tx.Close(ctx)` depends on context.

### Frontend (React + TypeScript)
1. **No component receives more than 5 props.** If cramped, pass `{...obj}` or use context.
2. **Custom fields render via `DynamicFieldInput` component.** Don't hardcode Lead fields in AddLeadPage; fetch `workflow.field_definitions` at runtime.
3. **All API calls go through `services/*Service.ts`.** Never direct `fetch()` or `axios.post()` in pages.
4. **Zustand store is not for form state.** Use React Hook Form + local state; Zustand is for global auth/user context.
5. **No inline styles.** All styling via Tailwind `className=`.

### Deployment
1. **Fly.io secrets are immutable after set.** To change a secret: `fly secrets set KEY=newvalue`.
2. **fly.toml is source-controlled.** Never manually edit via Fly dashboard; all changes via fly.toml.
3. **CORS_ORIGIN and FRONTEND_URL must match the deployed frontend.** If frontend moves, redeploy backend with updated env.
4. **Health check must pass before any traffic is routed.** Ensure `GET /api` returns 200 on startup.

### Observability & Middleware (Backend)
1. **Structured logging only.** Use `log/slog` (JSON handler, set as default in `main.go`). Do not add new `log.Printf` calls in request paths — prefer `slog.Info/Warn/Error` with key/value attrs. Legacy `log.*` calls in startup code are being migrated.
2. **Every request is correlated.** `middleware.RequestLogger` assigns a request id (context + `X-Request-ID` header) and logs one line per response (method, path, status, latency_ms, ip, tenant_id, identity_id). Read it with `middleware.RequestIDFromContext(ctx)` and include it in error logs.
3. **Panics never crash the VM.** `middleware.Recover` wraps all routes — it returns a clean 500 and logs the stack. Never let a handler panic propagate; never return panic detail to the client.
4. **The global chain is `RequestLogger(Recover(corsHandler))`.** Recover is inside RequestLogger so panics are still logged as 500 request lines. Don't reorder without reason.
5. **Unauthenticated credential endpoints are per-IP rate-limited.** Login, refresh, forgot/reset-password, and activate go through `authRateLimiter.PerIPFunc(...)`. Authenticated tenant routes use the per-tenant limiter. Use `middleware.ClientIP(r)` (trusts `Fly-Client-IP` → XFF → RemoteAddr) for any IP keying.
6. **Health/metrics endpoints.** `GET /api/healthz` = liveness (no DB, Fly health check points here), `GET /api/readyz` = readiness (pings control-plane pool, 503 if down), `GET /api/metrics` = Prometheus (optionally `METRICS_TOKEN`-gated). HTTP metrics are recorded once inside `RequestLogger` via `metrics.Observe`; routes are normalized (`metrics.NormalizeRoute` collapses ids) to bound label cardinality — never label by raw path.
7. **Error tracking + log shipping are optional + graceful.** `SENTRY_DSN` enables Sentry (panics via `middleware.Recover`); `AXIOM_TOKEN`+`AXIOM_DATASET` ship slog JSON to Axiom via `logship.Shipper` (an `io.Writer` alongside stdout — no shipper VM, scale-to-zero safe). All observability env (`SENTRY_DSN`, `METRICS_TOKEN`, `AXIOM_*`) is optional and no-ops when unset, like the email service. The log shipper must never call `slog` (infinite loop) — it reports its own errors to stderr. See `docs/observability.md`.

### Code Quality
1. **No magic strings or numbers.** All values > 1 are constants (`const MaxCustomFields = 15`).
2. **Errors are wrapped with context.** `fmt.Errorf("context: %w", err)` — never swallow errors.
3. **All public functions are documented.** Single-line comments above function declarations.
4. **Types are never `any`.** Explicitly type everything (`interface{}` is not a cop-out).
5. **Table-driven tests for all pure functions.** Use `testify/assert`.

## General Rules
- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`. Be specific (include affected component/feature).
- **Never commit `.env`, `*.key`, `credentials.json`, or secrets.** Check `.gitignore` when new file types appear.
- **New features need tests.** Before merging to `feat/dynamic-crm-platform`, tests must pass locally and in CI.
- **Files over 300 lines: split them.** Ask Claude before starting to refactor; it's easier than mid-way.
- **Reference docs:** `@docs/architecture.md` | `@docs/api-contracts.md` | `@docs/dev-workflow.md` for deep dives on design decisions and workflows.
