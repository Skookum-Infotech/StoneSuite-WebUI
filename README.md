# StoneSuite — Web UI

Frontend for **StoneSuite**, a multi-tenant, white-label CRM platform. This is a
React single-page app that talks to the StoneSuite backend over a JSON REST API.

Product surface: a dynamic workflow engine (Lead → Prospect → Customer state
machines), custom fields, role-based access control, multi-user workspaces, and
sales / purchasing / inventory / accounting modules.

> **This repo is frontend only.** The Go backend, database migrations, and
> infrastructure live in the sibling `StoneSuite` repo. No server code here.

## Quick start

Requires **Node 20+**.

```bash
npm install
```

```bash
cp .env.example .env
```

Set this one line in your `.env` — it's all you need to get running:

```bash
VITE_API_BASE_URL=/api
```

```bash
npm run dev
```

Open **http://localhost:5173**. You're now running against the deployed backend
(`stonesuite-backend.fly.dev`) — no local backend required.

### Why `/api` and not a full URL

The dev server proxies `/api/*` to the backend so the API is **same-origin** with
the app. This matters: the backend's `auth_token` cookie is `SameSite=Lax`, and
browsers drop a Lax cookie that arrives from a different site. Point
`VITE_API_BASE_URL` straight at `https://stonesuite-backend.fly.dev` instead and
you'll appear to log in, then get logged out on every refresh.

Production works the same way, via a Cloudflare Pages Function
([`functions/api/[[path]].ts`](functions/api/%5B%5Bpath%5D%5D.ts)).

To point dev at a **local** backend instead:

```bash
VITE_DEV_API_ORIGIN=http://localhost:8080 npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173 (override with `PORT`) |
| `npm run build` | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run ci` | lint + test + build — what CI runs |

Run `npm run ci` before opening a PR.

> Note: `tsc --noEmit` on its own checks nothing here (this repo uses a solution
> `tsconfig`). Use `npm run build` to type-check.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + TypeScript, built with Vite |
| Routing | React Router v7 |
| Server state | TanStack React Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| HTTP | Axios |
| Testing | Vitest + React Testing Library |

## Project structure

```
src/
├── api/          # Axios clients — client.ts (base), tenantClient.ts (tenant-scoped)
├── components/
│   ├── ui/       # shadcn/ui primitives
│   ├── tenant/   # shared record UI (DynamicFieldInput, RecordsPanel, …)
│   └── crm/      # CRM building blocks
├── config/       # sidebarNav.ts, widget catalogs, static config
├── hooks/        # useUserPermissions, useSessionTimer, …
├── layouts/      # AuthLayout, MainLayout
├── lib/          # pure helpers, form mappers, PDF/CSV export
├── pages/        # one folder per module: crm/ sales/ purchases/ inventory/
│                 # finance/ config/ dashboard/ auth/ account/ …
├── router/       # index.tsx — route config + permission guards
├── services/     # one *Service.ts per API surface — all API calls go here
├── store/        # Zustand stores (useAuthStore, useBreadcrumbStore)
└── types/        # shared TypeScript types
```

Path alias: `@/` → `src/`.

## Conventions

The full set of rules lives in [CLAUDE.md](CLAUDE.md). The ones that bite most often:

- **All API calls go through `services/*Service.ts`** — never `fetch()` or `axios.*()` in a page.
- **Data fetching is React Query**, not `useEffect`.
- **The backend enforces tenancy and RBAC.** Never pass tenant/user IDs as request params (they're in the JWT), and don't re-implement scope filtering client-side.
- **Custom fields render at runtime** via `DynamicFieldInput` from `workflow.field_definitions` — never hardcode a workflow's fields.
- **No `any`.** `@typescript-eslint/no-explicit-any` is an error.
- **Tailwind only** — no inline `style={}`, no CSS modules.
- **Files over 300 lines get split.**
- New features need tests.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).

`develop` and `master` reject direct pushes — open a PR from a topic branch.

## Deployment

Cloudflare Pages, auto-deploying from `develop` / `master`. Build command
`npm run build`, output `dist`.

Full runbook, including the required Pages environment variables:
[DEPLOY_FRONTEND.md](DEPLOY_FRONTEND.md).

## More docs

| Doc | Covers |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Full coding conventions and API contract rules |
| [DEPLOY_FRONTEND.md](DEPLOY_FRONTEND.md) | Cloudflare Pages deployment runbook |
| [DESIGN.md](DESIGN.md) | Design system — colors, typography, tone |
| [SAML_SETUP.md](SAML_SETUP.md) | SAML / SSO configuration, and what isn't built yet |
| [OAUTH_SETUP.md](OAUTH_SETUP.md) | Entra ID and Cognito OAuth setup |
| [PRODUCT.md](PRODUCT.md) | Product notes |
