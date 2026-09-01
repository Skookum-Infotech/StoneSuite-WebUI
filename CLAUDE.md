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
src/
├── api/            # client.ts (Axios base), tenantClient.ts (tenant-scoped calls + apiErrorMessage)
├── components/
│   ├── ui/         # shadcn/ui primitives
│   ├── tenant/     # DynamicFieldInput, RecordsPanel, ApproverPicker — shared record UI
│   ├── crm/        # CRM-specific building blocks (forms, tabs, dialogs)
│   ├── customer/, prospect/, ai/
├── hooks/          # useSessionTimer, useUserPermissions
├── layouts/        # AuthLayout, MainLayout (header, sidebar, breadcrumb)
├── pages/
│   ├── crm/{lead,prospect,customer}/   # workflow-driven CRM record pages
│   ├── sales/                          # Sales Order list/add/edit/detail + components/
│   ├── config/{workflows,roles-access,users,record-numbering}/
│   ├── customer/, onboarding/          # customer portal & public apply/set-password
│   ├── account/, auth/, dashboard/, transactions/, common/
├── router/         # index.tsx — React Router v7 config
├── services/       # one *Service.ts per API surface, all calls go through here
├── store/          # useAuthStore, useBreadcrumbStore (Zustand)
├── lib/            # pure helpers + form mappers (salesOrderForm, crmValidation, customFields, utils)
├── types/          # shared TS types (Tenant, Lead, Prospect, SalesOrder, etc.)
└── config/         # sidebarNav.ts (navigation groups)
```

**Entry point:** `src/main.tsx` · **Backend:** separate `StoneSuite` repo → Fly.io
(`stonesuite-backend.fly.dev`) + Neon Postgres.

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
Built from `develop`/`master`. Framework `Vite`, build command `npm run build`, output
dir `dist`. Every push to a tracked branch auto-builds and deploys. Pages env vars:
```
VITE_API_BASE_URL=/api                                  # build-time (must stay relative)
API_ORIGIN=https://stonesuite-backend.fly.dev           # runtime, read by the Pages Function
```
**`VITE_API_BASE_URL` must stay a relative path.** Traffic routes through the same-origin
Pages Function (`functions/api/[[path]].ts`), which is what keeps the backend's auth
cookies first-party. Point it at an absolute backend URL and the browser scopes the
`csrf_token` cookie to the backend host where JS cannot read it — every mutating request
then fails with `Request rejected: missing or invalid CSRF token.` `vite.config.ts` fails
the build if this is absolute. `API_ORIGIN` must be set in **both** the Production and
Preview variable sets.
(See `.env.example` for Entra ID / Cognito OAuth vars — not yet production-deployed.)

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

## Notifications & Toasts
Two separate, deliberately non-overlapping feedback mechanisms — don't conflate them:
1. **Durable history → `stonesuite-notify`** (separate deployed service/repo, own base URL
   `VITE_NOTIFY_BASE_URL`, authenticated with the same JWT `apiClient` already carries via
   `api/notifyClient.ts`). `services/notificationService.ts` wraps its user-facing API
   (`unreadCount`/`list`/`markRead`/`markAllRead`); `components/NotificationBell.tsx` is the
   only consumer — a 60s-polled unread badge + dropdown, hidden for portal/customer
   sessions (`useAuthStore().kind === 'portal'`) since that API has no notifications for
   them. This is for "what happened while I wasn't looking" — retries can take it up to
   ~30 min to land, so never use it for instant feedback.
2. **Instant "you just did this" → `sonner` toasts.** Every transition/approve/reject
   mutation on a document-module detail or edit page (`quote`, `estimate`, `salesorder`,
   `invoice`, `payment`, `refund`, `creditmemo`, `fabrication`, `purchaseorder`,
   `requisition`, `vendorbill`, `vendorpayment`, `vendorcredit`, `expense`) calls
   `toast.success(...)` from its mutation's `onSuccess` — never from a dedicated
   notify-service call, since the toast only needs to reflect a mutation that already
   succeeded client-side. For a status change, build the message with
   `statusToastLabel(<MODULE>_STATUS_CODES, toStatusCode)` from `lib/statusToast.ts` so the
   wording always matches the status pill instead of drifting from it. New modules /
   new transition actions should follow this same pattern — see `QuoteDetailPage.tsx` and
   `SendToCustomerDialog.tsx` for the reference shape. `<Toaster>` is mounted once in
   `App.tsx`; don't mount a second one.

## React Rules (always enforce)
- Component files: PascalCase — `UserProfile.tsx`. One component per file.
- Async data fetching: TanStack React Query only — no bare `useEffect` for fetches.
- Custom hooks: live in `hooks/`, prefixed `use` (e.g., `useUserPermissions.ts`).
- Global state: Zustand only (`useAuthStore`, `useBreadcrumbStore`) — not for form state,
  which is React Hook Form + local state. No prop drilling beyond 2 levels.
- Forms: React Hook Form + Zod for standalone forms (auth, account, invites, onboarding).
  CRM workflow record forms (Lead/Prospect/Customer/Sales Order add-edit pages) instead use
  local state + validators in `lib/crmValidation.ts` / `lib/salesOrderForm.ts` — match the
  surrounding file's existing pattern rather than mixing the two in one form.
- Never mutate state directly — always return new objects/arrays.
- Styling: Tailwind `className=` only. No inline `style={}`, no CSS Modules.
- Exports: named everywhere except page-level route components (default export).
- `useEffect` with side effects must return a cleanup function.
- Accessibility: all interactive elements need `aria-label` and keyboard navigation.
- `@typescript-eslint/no-explicit-any` is an error — type everything properly.
- No component receives more than 5 props. If cramped, pass `{...obj}` or use context.
- Custom fields render via `DynamicFieldInput`. Don't hardcode a workflow's fields in a
  page — fetch `workflow.field_definitions` at runtime.
- All API calls go through `services/*Service.ts`. Never direct `fetch()`/`axios.*()` in pages.
- **Never show a raw record UUID in the UI breadcrumb.** Detail/edit pages keyed by `:id`
  must call `useBreadcrumbStore().setLabel(id, humanLabel)` in a `useEffect` once the
  record loads (and `clearLabel(id)` on cleanup) — see `LeadDetailPage`/`EditRolePage` for
  the pattern. Use the record's human identifier, never the raw ID; `MainLayout`'s
  fallback also hides any UUID-shaped segment, but that's a safety net, not a substitute.

## PDF Export Convention
Detail-page "Export PDF" button (Quick Actions card, lazy-imported exporter) — one
`lib/*PdfExport.ts` per domain (`salesPdfExport`, `crmPdfExport`, `purchasesPdfExport`),
all built on shared `lib/pdfBranding.ts`. New domain → new sibling file, don't add a
list-page bulk export.

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
