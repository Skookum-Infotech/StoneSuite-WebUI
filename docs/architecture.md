# Architecture — StoneSuite

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React 19 / Vite)                               │
│  localhost:5173                                          │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ React Router │  │  Zustand   │  │ TanStack Query  │  │
│  │ v7 (SPA)     │  │ Auth Store │  │ Data Fetching   │  │
│  └──────┬───────┘  └────────────┘  └────────┬────────┘  │
│         │                                   │           │
└─────────┼───────────────────────────────────┼───────────┘
          │ HTTP / Axios (Bearer JWT)          │
┌─────────▼───────────────────────────────────▼───────────┐
│  Go Backend  localhost:8080                              │
│                                                          │
│  main.go → net/http.ServeMux                             │
│  ┌─────────────┐                                         │
│  │  Middleware  │  JWT validation (RequireAuth)           │
│  │  CORS + Log  │  Bearer token → context.Context        │
│  └──────┬──────┘                                         │
│         │                                                │
│  ┌──────▼────────┐                                       │
│  │  Controllers  │  HTTP handlers (auth.go, oauth.go)    │
│  └──────┬────────┘                                       │
│         │                                                │
│  ┌──────▼────────┐                                       │
│  │   Services    │  Email dispatch (services/email.go)   │
│  └──────┬────────┘                                       │
│         │                                                │
│  ┌──────▼────────┐                                       │
│  │   Database    │  pgx/v5 pool, query helpers           │
│  └──────┬────────┘                                       │
└─────────┼────────────────────────────────────────────────┘
          │ postgres://  (pgx/v5 pool, max 10 conns)
┌─────────▼──────────────────────────────────────────────┐
│  PostgreSQL 16   localhost:5432   db: stonesuite        │
│  (Docker volume: postgres_data)                         │
└────────────────────────────────────────────────────────┘

External OAuth Providers:
  - Microsoft Entra ID (Azure AD)  →  /api/auth/entra/callback
  - AWS Cognito                    →  /api/auth/cognito/callback
```

## Frontend Architecture

### Component Hierarchy
```
App (RouterProvider)
├── AuthLayout           ← unauthenticated shell (login/forgot-password screens)
│   ├── LoginPage
│   ├── ForgotPasswordPage
│   └── VerifyEmailPage
└── MainLayout           ← authenticated shell (nav, sidebar, etc.)
    └── DashboardPlaceholder  ← TODO: replace with real dashboard
```

### State Management
- **Zustand** (`store/useAuthStore.ts`): holds `user`, `token`, `isAuthenticated`, `isLoading`.
  - Token is persisted to `localStorage` key `"auth-token"`.
  - On app boot, `isLoading: true` until token is verified against `GET /api/auth/me`.
- **TanStack React Query**: server state (user profile, future data fetching). Not yet wired for the me endpoint — `authService.getCurrentUser` is called directly today.

### Routing
React Router v7 `createBrowserRouter`. Route layout:
- `/` → redirect to `/dashboard`
- `/auth/login` — unauthenticated
- `/dashboard` — authenticated (no guard implemented yet — TODO)
- `*` → inline 404

**TODO:** Add a `ProtectedRoute` wrapper that checks `useAuthStore.isAuthenticated` and redirects to `/auth/login` if false.

### API Communication
- Base client: `src/api/client.ts` — Axios instance.
- Base URL: `VITE_API_BASE_URL` env var (default `http://localhost:8080/api`).
- JWT attached via request interceptor: `Authorization: Bearer <token>`.
- Service layer: `src/services/authService.ts` wraps all auth API calls.

## Backend Architecture

### Layer Diagram
```
HTTP Request
    ↓
net/http.ServeMux  (main.go)
    ↓
middleware.RequireAuth  (protected routes only)
    ↓
controllers/  (auth.go, oauth.go)   ← validates input, calls DB/services, writes response
    ↓
services/     (email.go)            ← side-effectful operations (SMTP)
    ↓
database/     (postgres.go, db.go)  ← pgx pool, named query helpers (GetUserByEmail, etc.)
    ↓
PostgreSQL
```

**Note:** The project does not yet use the full Repository pattern — `controllers/` call `database/` directly. If the project grows, extract a `repository/` layer between controllers and database.

### Config
All config loaded from env vars (or `.env` via `godotenv`) into `config.AppConfig` at startup. See `backend/config/config.go` for the full field list.

## Auth Strategy

### JWT (primary)
- Algorithm: **HS256**, signed with `JWT_SECRET`.
- Standard expiry: `JWT_EXPIRES_IN` (default 24h).
- Remember-me expiry: `JWT_REMEMBER_ME_EXPIRES_IN` (default 720h / 30 days).
- Payload claims: `id` (user UUID), `email`.
- Transmitted as `Authorization: Bearer <token>` header.
- Validated by `middleware.RequireAuth`, user context injected via `context.WithValue`.

### Email/Password
- Passwords hashed with `bcrypt`.
- Account lockout after repeated failed attempts (`failedLoginAttempts`, `isLocked`, `lockedUntil`).
- Email verification required on registration (`emailVerificationCode` stored in DB).
- Password reset via time-limited token (`passwordResetToken`, `passwordResetExpiry`).

### OAuth SSO
- **Microsoft Entra ID**: authorization code flow → `GET /api/auth/entra/callback` exchanges code for tokens, fetches user from Microsoft Graph API.
- **AWS Cognito**: authorization code flow → `GET /api/auth/cognito/callback` exchanges code for tokens, fetches user from Cognito `/oauth2/userInfo`.
- Both providers upsert users into the local DB and return a StoneSuite JWT.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP listen port | `8080` |
| `JWT_SECRET` | HS256 signing key | ⚠ change in prod |
| `JWT_EXPIRES_IN` | Token lifetime | `24h` |
| `JWT_REMEMBER_ME_EXPIRES_IN` | Extended token | `720h` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `FRONTEND_URL` | For redirect URLs | `http://localhost:5173` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL | see `.env.example` |
| `ENTRA_ID_CLIENT_ID` / `ENTRA_ID_CLIENT_SECRET` / `ENTRA_ID_REDIRECT_URI` | Azure AD OAuth | — |
| `COGNITO_CLIENT_ID` / `COGNITO_CLIENT_SECRET` / `COGNITO_DOMAIN` / `COGNITO_REDIRECT_URI` | Cognito OAuth | — |
| `SMTP_HOST` / `SMTP_PORT` / `SENDER_EMAIL` / `SENDER_PASSWORD` | Email dispatch | — |

### Frontend (`frontend/.env`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Backend base URL | `http://localhost:8080/api` |
| `VITE_ENTRA_CLIENT_ID` | Azure AD client ID | — |
| `VITE_COGNITO_CLIENT_ID` | Cognito client ID | — |
| `VITE_COGNITO_DOMAIN` | Cognito domain | — |

## Deployment Topology

### Local Dev
- Frontend: `vite dev` on `:5173`
- Backend: `go run .` on `:8080`
- PostgreSQL: Docker (`docker compose up postgres`)
- Adminer DB UI: `http://localhost:8081`

### Docker (full stack)
```bash
docker compose up -d
```
Spins up: `postgres` → `stonesuite-backend` (waits for DB healthcheck) + `adminer`.
Frontend is **not** containerized yet.

### Production
- Frontend: Cloudflare Pages. Backend: Fly.io (single app, `iad` region). Database: Neon Postgres (one project, ~30 tenant DBs + control-plane DB).
- **TODO:** Document CI/CD pipeline (GitHub Actions? Vercel for frontend?).
- **TODO:** TLS termination and production `JWT_SECRET` rotation strategy.

### Connection Pooling & Neon Ceiling (ADR-2)

Each backend process keeps **one pool per database**:

| Pool | Source | `MaxConns` | Notes |
|---|---|---|---|
| Control plane | `tenancy/controlplane.go:31` | 10 | One pool for the whole process lifetime. |
| Per-tenant | `tenancy/router.go:43` | 5 | Lazily created, cached per tenant ID in `Router.pools` (`sync.RWMutex` map). Only tenants with recent activity have a live pool. |

**Worst case per Fly machine:** `10 (control plane) + 5 × (cached tenants)`. With all ~30 tenants warm, that's `10 + 150 = 160` connections from a single machine. Running `N` machines (`fly scale count N`) multiplies the tenant-pool side: up to `150 × N` connections against Neon.

**Why this matters:** Neon's connection ceiling is per-compute (project/branch), shared across **all** databases on that compute — including every `tenant_<slug>` DB provisioned so far (see Neon Topology below). `150 × N` real backend connections will exhaust a typical Neon compute's `max_connections` quickly once `N > 1`.

**Mitigations, in order of cost:**
1. Put `CONTROL_PLANE_DB_URL` and every tenant `db_connection_ref` behind Neon's **pooled (PgBouncer transaction-mode) endpoint**. PgBouncer multiplexes the `160 × N` logical pgx connections onto a small number of real Postgres backend connections — this is the highest-leverage, config-only fix and should be done before scaling machine count. `PROVISION_ADMIN_DB_URL` stays on the **direct** (unpooled) endpoint — `CREATE DATABASE` cannot run through a transaction-mode pooler.
2. Before raising any pool's `MaxConns` (e.g. for a hot tenant), confirm headroom against the Neon compute's connection limit — raising one tenant's pool reduces the shared budget for the other ~29.
3. `fly scale count N` is safe for HTTP traffic at any time (stateless handlers, JWT carries `tenant_id`/`user_id`), but **only scale workers/jobs after the durable job queue (ADR-1, `async_jobs` + `jobqueue` package) is in place** — otherwise N machines double-claim provisioning/transition-action jobs. As of this writing the queue uses `SELECT ... FOR UPDATE SKIP LOCKED`, which is safe across machines.

### Neon Topology & Hot-Tenant Runbook (ADR-3)

- A Neon **project/branch = one compute endpoint** (CPU + RAM + connection limit). By default, all `tenant_<slug>` databases provisioned so far live on the **same compute** as the control-plane DB — they share that compute's CPU, memory, and connection budget.
- **Noisy-neighbor risk:** a burst of load against one or two tenants can starve the other ~28 sharing the same compute, independent of connection counts.

**Mitigation A — autoscaling (near-term, no code change):** enable/raise Neon autoscaling (max CU) on the shared compute so it absorbs bursts automatically.

**Mitigation B — move a hot tenant to its own compute (runbook):**
1. In Neon, create a new project (or branch) with its own compute endpoint.
2. Migrate that tenant's `tenant_<slug>` database to the new project (Neon branch/copy or `pg_dump`/`pg_restore`).
3. Update that tenant's `db_connection_ref` in the control-plane `tenants` table to point at the new compute's connection string (encrypted, same as any other `db_connection_ref` — no code change needed, since each tenant's connection string is already resolved independently by `tenancy.Router`).
4. Verify via `GET /api/tenant/me` against the moved tenant, then retire the old database.

**Mitigation C — read replicas (future):** for GET-heavy endpoints (lists, dashboards), point a separate read-only pool at a Neon read replica of the shared compute, keeping writes on the primary. Not yet implemented — revisit if read load becomes the bottleneck before tenant-level hot spots do.

### In-Process Caching for Hot, Rarely-Changing Reads (ADR-3)

`backend/cache` provides a generic `TTLCache[K,V]` (lazy expiry on `Get`, explicit invalidation on writes). Two caches use it, both keyed by tenant pool pointer + a secondary key, TTL 30s:

- **Workflow definitions** (`workflow.LoadDefinition` in `workflow/store.go`) — caches the full definition (workflow + states + transitions + field defs), keyed by `(pool, workflowID)`. Invalidated by `SetWorkflowEnabled`, `CreateField`, `DeleteField`.
- **Effective RBAC grants** (`authz.EffectiveGrants` in `authz/store.go`) — caches a user's resolved `role_permissions`, keyed by `(pool, identityID)`. Invalidated tenant-wide (all identities for that pool) by `CreateRole`, `UpdateRole`, `DeleteRole`, `AssignRole`, `UnassignRole`.

Caching only activates when the caller passes the tenant's `*pgxpool.Pool` directly (the normal request path via `tenancy.PoolFromContext`); calls made inside a `pgx.Tx` always read through, so in-transaction logic never sees stale data from this cache.
