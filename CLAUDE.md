# StoneSuite-WebUI — Claude Memory

## What This App Does
**StoneSuite** is a **multi-tenant, white-label dynamic CRM platform**. This repository
(`StoneSuite-WebUI`) contains **only the frontend** — a React SPA that talks to the
StoneSuite backend (Go, deployed separately as `stonesuite-backend` on Fly.io) over a
JSON REST API. The backend, database migrations, and infrastructure-as-code live in the
sibling `StoneSuite` repo — this repo has no server code and should not accumulate any.

Product surface: dynamic workflow engine (state machines like Lead → Prospect →
Customer), custom fields, dynamic RBAC (resource + action + scope permissions),
multi-user workspaces, and central authentication (email/password + JWT + OAuth SSO).

## Repo Structure
```
StoneSuite-WebUI/
├── .env.example                  # VITE_API_BASE_URL template
├── src/
│   ├── api/                      # Axios client (client.ts)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── customer/             # Customer onboarding modal & forms
│   │   ├── prospect/             # Prospect forms & details
│   │   └── crm/                  # CRM-specific components
│   ├── hooks/                    # useAuth, useUserPermissions, etc.
│   ├── layouts/                  # AuthLayout, MainLayout
│   ├── pages/
│   │   ├── crm/                  # Lead, Prospect, Customer pages
│   │   ├── config/                # Workflows, Roles, Access control
│   │   ├── customer/              # Customer onboarding pages
│   │   └── onboarding/            # Public apply & set-password pages
│   ├── router/                   # React Router v7 config
│   ├── services/                 # API wrappers (tenantServices, leadService, etc.)
│   ├── store/                    # Zustand stores (useAuthStore)
│   ├── types/                    # Shared TypeScript types (Tenant, Lead, Prospect, etc.)
│   └── config/                   # sidebarNav.ts (navigation groups)
├── public/
└── docs/                          # Frontend-relevant design/product notes
```

**Entry point:** `src/main.tsx`
**Deployment:** Cloudflare Pages, built from this repo's `develop`/`master` branches.
**Backend:** separate `StoneSuite` repo → Fly.io (`stonesuite-backend.fly.dev`) + Neon Postgres.

## Common Commands
```bash
npm run dev        # Vite dev server → http://localhost:5173
npm run build       # tsc + vite build
npm run lint        # ESLint check
npm test            # Vitest (run once)
npm run test:watch  # Vitest watch mode
npm run test:coverage
npm run ci           # lint + test + build (what CI runs)
```

## Deployment (Cloudflare Pages)

**1. Connect GitHub Repository**
- Cloudflare Pages dashboard → "Create a project" → "Connect to Git"
- Select the `StoneSuite-WebUI` repository

**2. Configure Build**
- Framework: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable (Pages settings):
  ```
  VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
  ```

**3. Deploy**
- Every push to the tracked branch auto-builds and deploys.

**4. Custom Domain**
- Cloudflare Pages → Custom domain → point to the Pages project.

### Environment Variables Reference
```
VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
```
(See `.env.example` for Entra ID / Cognito OAuth variables — not yet production-deployed.)

## Talking to the Backend API (what the frontend must respect)
The backend enforces multi-tenancy and RBAC server-side; the frontend must not assume it
can bypass or duplicate that logic client-side:
1. **Every API call carries the Bearer JWT** (tenant_id/user_id/identity_id live server-side
   in the token) — never pass tenant/user identifiers as request params.
2. **List/search endpoints are scope-filtered by the server** (`all|team|own`). The UI
   should treat any list response as already scoped — don't attempt client-side scope logic.
3. **Record search/filter/sort/pagination goes through the Record Filter Engine** —
   `POST /api/tenant/workflows/{id}/records/search` and
   `POST /api/tenant/crm/{workflowKey}/records/search`. Pagination is **keyset** (opaque
   base64 cursor via `nextCursor`), not offset — never construct or mutate a cursor
   client-side, only pass through what the server returned. Sortable fields are currently
   limited to `created_at`, `updated_at`, `record_number`.
4. **A 400 from a search/filter endpoint means an invalid filter key** (`*InvalidFilterError`
   server-side) — surface it as a field-level UI error, not a generic failure.
5. **A 404 on a single-record GET/PATCH/DELETE can mean "exists but out of scope"** (IDOR
   guard) as well as "doesn't exist" — don't leak existence info in the UI copy.
6. **Custom fields (`custom_fields`) are validated server-side** against
   `workflow_field_definitions` (type, required, enum, regex, max 15 per workflow).
   `DynamicFieldInput` renders these at runtime — never hardcode a workflow's fields.

## React Rules (always enforce)
- Component files: PascalCase — `UserProfile.tsx`. One component per file.
- Async data fetching: TanStack React Query only — no bare `useEffect` for fetches.
- Custom hooks: live in `hooks/`, prefixed `use` (e.g., `useAuth.ts`).
- Global state: Zustand only. No prop drilling beyond 2 levels.
- Forms: React Hook Form + Zod.
- Never mutate state directly — always return new objects/arrays.
- Styling: Tailwind classes only. No inline `style={}`, no CSS Modules.
- Exports: named exports everywhere except page-level route components (default export).
- `useEffect` with side effects must return a cleanup function.
- Accessibility: all interactive elements need `aria-label` and keyboard navigation.
- `@typescript-eslint/no-explicit-any` is an error — type everything properly.
- No component receives more than 5 props. If cramped, pass `{...obj}` or use context.
- Custom fields render via `DynamicFieldInput` component. Don't hardcode Lead fields in
  AddLeadPage; fetch `workflow.field_definitions` at runtime.
- All API calls go through `services/*Service.ts`. Never direct `fetch()` or
  `axios.post()` in pages.
- Zustand store is not for form state. Use React Hook Form + local state; Zustand is for
  global auth/user context.
- No inline styles. All styling via Tailwind `className=`.

## Code Quality
1. No magic strings or numbers. All values > 1 are constants.
2. Errors are wrapped with context, never swallowed.
3. Types are never `any`. Explicitly type everything.
4. Table-driven/unit tests for pure functions (Vitest).

## General Rules
- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`. Be
  specific (include affected component/feature).
- **Never commit `.env`, `*.key`, `credentials.json`, or secrets.** Check `.gitignore`
  when new file types appear.
- **New features need tests.** Before merging to `develop`, tests must pass locally and
  in CI (`npm run ci`).
- **Files over 300 lines: split them.** Ask before starting to refactor; it's easier than
  mid-way.
- **This repo has no backend code.** API contract questions, migrations, RBAC
  enforcement details, and infrastructure live in the `StoneSuite` repo — don't add Go
  code, SQL migrations, or backend CI/deploy config here.
