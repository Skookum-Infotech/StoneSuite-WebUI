# StoneSuite Deployment Checklist & Latest Changes Summary

**Date:** 2026-06-05  
**Branch:** `feat/dynamic-crm-platform`  
**Status:** ✅ Ready for Production Deployment

---

## Latest Code Changes (Merged from Remote)

### Backend Enhancements
- ✅ **Control-plane auto-migrations** (`backend/database/control_plane_migrations.go`)
  - Auto-apply `cp_schema_version` migrations on startup
  - Creates tenants, identities, invites, SSO configs tables
  - Idempotent; safe to run on every deploy

- ✅ **Bootstrap endpoint** (`POST /api/platform/bootstrap`)
  - One-shot endpoint to create first platform owner
  - Guards with 409 Conflict if owner already exists
  - Provisions owner tenant database asynchronously

- ✅ **AddPlatformAdmin function** (`backend/tenancy/registry.go`)
  - Idempotent: `INSERT ... ON CONFLICT DO NOTHING`
  - Grants platform-level powers to an identity

- ✅ **Dynamic RBAC** (fully implemented)
  - Permission catalog (resource × action × scope)
  - Dynamic role creation and assignment
  - Enforcer middleware on all protected routes

- ✅ **Workflow Engine** (fully implemented)
  - State machines with transitions and actions
  - Custom field definitions (≤15 per workflow)
  - Validation against field definitions

- ✅ **CRM Models** (Leads, Prospects, custom fields)
  - Migration 000004 (prospects), 000005 (leads), 000006 (custom_fields)
  - Full CRUD operations
  - JSONB custom_fields column with validation

- ✅ **Fly.io v2 Configuration** (`backend/fly.toml`)
  - http_service (v2 format)
  - Proper health checks
  - Environment variables and secrets

### Frontend Enhancements
- ✅ **Multi-tenant UI**
  - Tenant context in navigation
  - Sidebar refactored to dedicated file for scalability
  - Dynamic navigation groups (CRM, Config, etc.)

- ✅ **CRM Pages**
  - Lead management (AddLeadPage, LeadPage, LeadTable)
  - Prospect management (AddProspectPage, ProspectListPage, ProspectViewPage)
  - Customer onboarding (AddCustomerPage, OnboardingPage)

- ✅ **Onboarding Flow**
  - Public apply page (OnboardingApplyPage)
  - Password setup page (SetPasswordPage)
  - Dynamic form rendering from workflow definitions

- ✅ **RBAC UI**
  - Role creation and management (CreateRolePage)
  - Permission assignment (RolesPage)
  - User role management

- ✅ **Dynamic Forms**
  - DynamicFieldInput component for custom fields
  - Form rendering from workflow field definitions
  - Validation against field definitions

- ✅ **Production Environment**
  - `.env.production` set to `VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api`
  - Ready for Cloudflare Pages deployment

---

## Deployment Steps Summary

### Phase 1: Backend Deployment (Fly.io)

**⏱️ Estimated time: 15 minutes**

1. **Verify Neon Database**
   ```bash
   # Check that stonesuite_cp exists in Neon console
   # Copy pooled and direct connection strings
   ```

2. **Set Fly.io Secrets**
   ```bash
   cd backend
   fly secrets set \
     CONTROL_PLANE_DB_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require" \
     PROVISION_ADMIN_DB_URL="postgres://user:pass@ep-xxx-direct.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require" \
     JWT_SECRET="$(openssl rand -base64 48)" \
     SECRET_ENCRYPTION_KEY="$(openssl rand -base64 32)"
   ```

3. **Deploy**
   ```bash
   fly deploy
   fly logs                    # Monitor deployment
   ```

4. **Verify**
   ```bash
   curl https://stonesuite-backend.fly.dev/api
   # Expected: {"success":true,"message":"...","version":"1.0.0"}
   ```

### Phase 2: Frontend Deployment (Cloudflare Pages)

**⏱️ Estimated time: 5 minutes**

1. **Connect GitHub to Cloudflare Pages**
   - Cloudflare dashboard → Pages → Create project → Connect to Git
   - Select StoneSuite repo
   - Select branch: `feat/dynamic-crm-platform`

2. **Configure Build**
   - Framework: Vite
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `frontend`

3. **Set Environment Variables**
   - Name: `VITE_API_BASE_URL`
   - Value: `https://stonesuite-backend.fly.dev/api`

4. **Deploy**
   - Click "Save and Deploy"
   - Wait for build to complete (~2–5 minutes)

5. **Verify**
   - Visit `https://stonesuite.pages.dev`
   - Test login with platform owner credentials

### Phase 3: Cross-Environment Configuration

**⏱️ Estimated time: 5 minutes**

1. **Update Backend CORS**
   ```toml
   # backend/fly.toml
   [env]
     CORS_ORIGIN  = "https://stonesuite.pages.dev"
     FRONTEND_URL = "https://stonesuite.pages.dev"
   ```

2. **Redeploy Backend**
   ```bash
   cd backend
   fly deploy
   ```

---

## Pre-Flight Checklist

### Code Quality
- [ ] `go build ./...` passes in `backend/`
- [ ] `go test ./...` passes in `backend/`
- [ ] `go vet ./...` passes in `backend/`
- [ ] `npm run build` passes in `frontend/`
- [ ] `npm run lint` passes in `frontend/`
- [ ] No TypeScript errors (`tsc --noEmit`)

### Configuration Files
- [ ] `backend/fly.toml` exists and is correct
- [ ] `backend/Dockerfile` is multi-stage Alpine (CGO_ENABLED=0)
- [ ] `frontend/.env.production` has correct `VITE_API_BASE_URL`
- [ ] `.gitignore` includes `.env`, `.env.*.local`, etc.

### Database
- [ ] Neon project created (`stonesuite`)
- [ ] `stonesuite_cp` database exists
- [ ] Connection strings copied (pooled + direct)
- [ ] Test connection locally: `psql "postgres://user:pass@..."`

### Secrets
- [ ] Fly.io app created (`stonesuite-backend`)
- [ ] `JWT_SECRET` generated and set
- [ ] `SECRET_ENCRYPTION_KEY` generated and set (optional but recommended)
- [ ] `CONTROL_PLANE_DB_URL` and `PROVISION_ADMIN_DB_URL` set

### Infrastructure
- [ ] `flyctl` installed and authenticated
- [ ] Cloudflare account with Pages enabled
- [ ] GitHub repo is public or Cloudflare has access
- [ ] Domain configured (optional, `.pages.dev` works)

---

## Deployment Verification

### Backend Health

```bash
# Health check
curl https://stonesuite-backend.fly.dev/api

# Check status
fly status

# View logs
fly logs --lines 50
```

**Expected logs:**
```
Control-plane migrations: ok
Multi-tenant control plane initialized.
[GET] /api 200 OK
```

### Frontend Health

```bash
# Open in browser
https://stonesuite.pages.dev

# Check console (F12) for errors
# Expected: No CORS errors, no 404s
```

### End-to-End Flow

1. **Sign up / Register**
   - Navigate to login page
   - Attempt login with test credentials

2. **Bootstrap Platform Owner** (if not already done)
   ```bash
   curl -X POST https://stonesuite-backend.fly.dev/api/platform/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"companyName":"...","slug":"...","email":"...","password":"...","fullName":"..."}'
   ```

3. **Login**
   - Use the created email/password
   - Confirm JWT is returned
   - Confirm `isPlatformAdmin: true` is in the token

4. **Access Workspace**
   - Navigate to Workflows
   - Navigate to Roles & Access
   - Confirm no infinite spinners (migrations applied successfully)

---

## Rollback Plan

### Frontend Rollback (Simple)
```bash
# Cloudflare Pages dashboard
# View deployments → Find previous → Click menu → Rollback
```

### Backend Rollback (If health check fails)
```bash
# Fly.io will automatically stop deploying if health checks fail
# To manually rollback:
fly releases              # List releases
fly deploy --image HASH   # Deploy specific image hash
```

---

## Post-Deployment Tasks

### Immediate
- [ ] Test authentication flow end-to-end
- [ ] Verify database migrations applied (check `cp_schema_version` in Neon)
- [ ] Check logs for any errors

### Day 1
- [ ] Monitor app performance (Fly.io metrics)
- [ ] Check error logs for any issues
- [ ] Verify email service works (if SMTP configured)
- [ ] Test onboarding invite flow

### Week 1
- [ ] Set up error tracking (Sentry, Datadog)
- [ ] Enable Cloudflare Analytics
- [ ] Configure Cloudflare cache rules for performance
- [ ] Set up GitHub branch protection

---

## Documentation References

**Read these for detailed guides:**

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Architecture, rules, multi-tenant design, API routes |
| `DEPLOY_BACKEND.md` | Step-by-step Fly.io deployment (detailed) |
| `DEPLOY_FRONTEND.md` | Step-by-step Cloudflare Pages deployment (detailed) |
| `docs/architecture.md` | Deep dive on design decisions |
| `docs/api-contracts.md` | API endpoint reference |

---

## Support & Troubleshooting

### Health Check Failing
→ See `DEPLOY_BACKEND.md` section "Health Check Failing"

### CORS Errors
→ See `DEPLOY_FRONTEND.md` section "CORS Error in Browser Console"

### Build Failures
→ See `DEPLOY_FRONTEND.md` section "Build Failing on Cloudflare"

### Database Connection Issues
→ See `DEPLOY_BACKEND.md` section "Database Connection Timeout"

---

## Next Steps

1. **Deploy Backend**
   - Follow `DEPLOY_BACKEND.md` Step 1–7
   - Verify with curl tests

2. **Deploy Frontend**
   - Follow `DEPLOY_FRONTEND.md` Step 1–8
   - Verify with browser tests

3. **Cross-Environment Configuration**
   - Update CORS_ORIGIN in backend
   - Redeploy backend

4. **Smoke Testing**
   - Run through deployment verification checklist
   - Test login flow, RBAC, CRM workflows

5. **Monitor & Iterate**
   - Check logs daily for first week
   - Gather user feedback
   - Plan Phase 4 (transition actions, webhooks)

---

## Questions?

- **Architecture:** See `CLAUDE.md` → Multi-Tenant Architecture section
- **API Endpoints:** See `CLAUDE.md` → API Routes section  
- **Deployment Steps:** See `DEPLOY_BACKEND.md` or `DEPLOY_FRONTEND.md`
- **Code Rules:** See `CLAUDE.md` → Strict Implementation Rules section
