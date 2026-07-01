# StoneSuite Multi-Tenant Rebuild — 1-Month Build Strategy

> Companion to the architecture plan. Goal: ship the multi-tenant dynamic-CRM platform
> (database-per-tenant on Neon, Go on Fly.io, React on Cloudflare Pages) in ~4 weeks.
> Scale target: ~25–30 tenants over 2 years, so infra stays simple.

---

## Guiding principles

1. **Vertical slices, not horizontal layers.** Each week ends with something runnable and
   demoable, not a pile of half-wired code.
2. **Tests alongside code, not after.** Per Go rules: `testify`, table-driven for pure logic
   (tenancy router, RBAC matrix, workflow transitions, field validation).
3. **Commit per milestone** with Conventional Commits (`feat:`, `refactor:`…). Branch off
   `main`; never commit `.env` or secrets.
4. **Keep the provider-specific bits behind one interface** (Neon DB creation) so we stay
   portable — see plan's "migrate off Neon" note.
5. **Update `CLAUDE.md` + `docs/` as architecture lands** so context stays fresh for Claude.

---

## Week-by-week timeline

### Week 1 — Foundations (Phase 0) + start onboarding (Phase 1)
**Outcome:** a request can be authenticated, resolved to a tenant, and routed to that
tenant's database. Local two-tenant demo works.

- Control-plane schema migration: `tenants`, `identities`, `tenant_invites`,
  `tenant_sso_configs`, `platform_admins`, `platform_audit_logs`.
- `config`: add `CONTROL_PLANE_DB_URL`, `NEON_API_KEY`, `NEON_PROJECT_ID`, secret-encryption key.
- New `tenancy/` package: control-plane pool + per-tenant pool **map/router** (simple, no LRU)
  + `TenantResolver` middleware. Refactor `database/postgres.go` to a control-plane pool.
- JWT now carries `tenant_id` + `user_id`; extend `middleware/auth.go`.
- Tenant-template migration set (empty tables to start) + migration runner skeleton.
- **Demo:** seed 2 tenants by hand, log in to each, confirm queries hit separate DBs.

### Week 2 — Provisioning + RBAC (Phase 1 + Phase 2)
**Outcome:** invite → accept → workspace auto-provisions; roles & permissions enforced.

- Provisioning job (async): create Neon DB via API → run tenant migrations → seed defaults
  → mark `active`. "Setting up your workspace" screen on the frontend.
- Generalize existing invite/email code (`onboarding.go`, `services/email.go`) into
  tenant invites.
- Platform-admin UI: list tenants, create + invite, view status; deletion lifecycle
  (suspend → grace → hard delete) controls.
- RBAC: permission catalog (Go), `roles`/`role_permissions`/`user_roles`, `authz/` enforcer
  + `Require(resource, action)` helper, scope filtering. Seed `super_admin`.
- Role editor UI.
- **Demo:** onboard a fresh tenant end-to-end; a member is blocked by missing permission.

### Week 3 — Workflow engine + dynamic fields (Phase 3) ← biggest, most risk
**Outcome:** super admin builds a workflow with states, transitions, and custom fields;
records move through states.

- Tables: `workflows`, `workflow_states`, `workflow_transitions`, `workflow_field_definitions`,
  `workflow_records`, `workflow_record_history`.
- `workflow/` engine: `LoadWorkflow`, `ValidateTransition`, `Apply` (+ history write).
- Custom-field validation from `workflow_field_definitions` (type/required/enum/regex, ≤15 cap).
- Seed Lead/Prospect/Customer as default workflows.
- Frontend: Workflow Builder (states/transitions), Custom Field editor, **dynamic record
  forms/tables** rendered from field definitions. Add **React Hook Form + Zod**.
- **Demo:** create a workflow, add a custom field, create a record, transition it, see history.

### Week 4 — Actions + SSO + audit, then integrate & deploy (Phase 4 + 5 + hardening)
**Outcome:** transitions fire actions; per-tenant SSO works; everything deployed.

- Transition actions: `Action` interface + `send_email`, `assign_owner`, `set_field`,
  `webhook`; lightweight job runner (worker pool + shutdown channel).
- Per-tenant SSO: generalize `oauth.go` to read `tenant_sso_configs`; login tenant resolution.
- Per-tenant `audit_logs` + activity feed.
- End-to-end pass, fix integration gaps, write missing tests.
- **Deploy:** Neon project + control-plane DB; Go image to **Fly.io**; React to
  **Cloudflare Pages**; smoke-test full onboarding on real infra.

> **Reality check:** Week 3 is the hard one. If something slips, push Phase 5 (SSO + audit
> feed) to a Week-5 tail rather than compressing the workflow engine — it's the product's core.

---

## How to use Claude effectively on this build

- **Plan mode per phase.** Start each phase by asking Claude to plan it (it already has the
  architecture). Review the plan, then let it implement. Avoids wrong-direction code.
- **Let Claude keep tests green.** Ask for table-driven `testify` tests with each unit;
  run `go test ./...` and `go build ./...` after each chunk.
- **Use the right tool for the job:**
  - Exploring unfamiliar code → `Explore` / `code-explorer`.
  - Designing a phase → `feature-dev` skill / `code-architect`.
  - Before merging → `/code-review` or `/security-review` (auth + multi-tenant isolation
    are exactly where review pays off).
  - Verifying a slice works → `/verify` or `/run`.
- **Guard the isolation boundary.** After any DB-routing or auth change, explicitly ask
  Claude to prove tenant A can't read tenant B (it's the #1 risk in this design).
- **Keep memory fresh.** As decisions land, have Claude update `CLAUDE.md` and `docs/` so
  every new session starts with correct context.
- **Commit in small, reviewable slices** so Claude (and you) can reason about diffs.
- **One Neon-specific seam.** Keep the "create tenant database" call behind a single
  interface; ask Claude to write it that way so swapping providers later is one file.

---

## Definition of done (per phase)

- `go build ./...` and `go test ./...` pass; `golangci-lint run` clean.
- Frontend `npm run build` + `npm run lint` pass.
- New feature has tests; multi-tenant code has an isolation test.
- Demo scenario for that week runs locally via `docker compose`.
