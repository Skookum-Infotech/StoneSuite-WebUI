# StoneSuite Backend Deployment Guide — Fly.io

**Status:** ✅ Production-ready  
**Last updated:** 2026-06-05  
**Target:** Fly.io v2 (`fly.toml`) + Neon Postgres + Single Always-On VM (256MB, 1 CPU, iad region)

---

## Pre-Deployment Checklist

- [ ] `backend/fly.toml` exists and is configured
- [ ] `backend/Dockerfile` exists (multi-stage Alpine, CGO_ENABLED=0)
- [ ] Neon project created with `stonesuite_cp` control-plane database
- [ ] Neon connection strings copied:
  - [ ] Pooled: `CONTROL_PLANE_DB_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require`
  - [ ] Direct: `PROVISION_ADMIN_DB_URL=postgres://user:pass@ep-xxx-direct.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require`
- [ ] `flyctl` installed and authenticated (`fly auth login` → `fly auth whoami`)
- [ ] Frontend URL known (e.g., `https://dev.stonesuite.app` or `https://stonesuite.pages.dev`)

---

## Step 1: Verify Local Build

Ensure the app compiles locally before pushing to Fly.io.

```bash
cd backend
go build ./...
go test ./...
go vet ./...
```

**Expected:** No errors or warnings.

---

## Step 2: Push Latest Code to GitHub

If not already done, push the latest commit to the feature branch.

```bash
git status
git add backend/fly.toml backend/database/control_plane_migrations.go backend/main.go # (only if changed)
git commit -m "feat: deploy backend v1.0 to Fly.io with control-plane migrations"
git push origin feat/dynamic-crm-platform
```

---

## Step 3: Set Backend Environment Variables in fly.toml

Open `backend/fly.toml` and confirm these settings:

```toml
app = "stonesuite-backend"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT                = "8080"
  CORS_ORIGIN         = "https://dev.stonesuite.app"     # ← Update to your frontend URL
  FRONTEND_URL        = "https://dev.stonesuite.app"     # ← Same as CORS_ORIGIN
  SMTP_PORT           = "587"
  INVITE_EXPIRY_HOURS = "24"

[http_service]
  internal_port = 8080
  force_https = true

  [[http_service.checks]]
    type = "http"
    interval = "15s"
    timeout = "5s"
    grace_period = "10s"
    method = "get"
    path = "/api"

[vm]
  memory   = "256mb"
  cpu_kind = "shared"
  cpus     = 1
```

**Key points:**
- `PORT` always 8080 (internal); Fly.io maps 443 → 8080
- `CORS_ORIGIN` and `FRONTEND_URL` must match your deployed frontend URL
- `INVITE_EXPIRY_HOURS` controls how long onboarding links last (default: 24 hours)
- Health check hits `GET /api` every 15s; must return 200 within 5s

---

## Step 4: Set Secrets via Fly.io CLI

These values are stored in Fly's encrypted secret manager and injected at runtime.

```bash
cd backend

# Database (REQUIRED)
fly secrets set \
  CONTROL_PLANE_DB_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require" \
  PROVISION_ADMIN_DB_URL="postgres://user:pass@ep-xxx-direct.us-east-2.aws.neon.tech/stonesuite_cp?sslmode=require"

# JWT signing key (REQUIRED)
fly secrets set \
  JWT_SECRET="$(openssl rand -base64 48)"

# DSN encryption (RECOMMENDED for production)
fly secrets set \
  SECRET_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Email service (OPTIONAL — app degrades gracefully without)
fly secrets set \
  SMTP_HOST="smtp.gmail.com" \
  SENDER_EMAIL="itadmin@elevationstone.com" \
  SENDER_PASSWORD="your-gmail-app-password"
```

**To update a secret later:**
```bash
fly secrets set KEY=new_value
```

**To view all secrets (values hidden):**
```bash
fly secrets list
```

---

## Step 5: Deploy to Fly.io

```bash
cd backend
fly deploy
```

**What happens:**
1. Docker image built (multi-stage Alpine)
2. Pushed to Fly.io registry
3. VM created/updated in `iad` region
4. Secrets injected into environment
5. App starts, migrations auto-apply, server listens on :8080
6. Health check runs; if 200 returned, VM is healthy

**Watch logs:**
```bash
fly logs                          # Stream logs in real-time
fly logs --follow                 # Keep tail open
fly logs --lines 100              # Last 100 lines
```

**Expected log output on clean startup:**
```
[app] Control-plane migrations: ok
[app] Multi-tenant control plane initialized.
[app] Note: PROVISION_ADMIN_DB_URL not set — tenant provisioning disabled.
[app] ===============================================
[app]   StoneSuite Go Login Backend is Running!
[app]   Local Endpoint: http://localhost:8080
[app]   Allowed CORS Origin: https://dev.stonesuite.app
[app] ===============================================
```

---

## Step 6: Verify Deployment

### Health Check
```bash
curl https://stonesuite-backend.fly.dev/api
```

**Expected response:**
```json
{
  "success": true,
  "message": "Welcome to the StoneSuite Go Authentication Backend API.",
  "version": "1.0.0"
}
```

### App Status
```bash
fly status
fly scale count             # Show replica count
fly metrics cpu             # Show CPU usage
fly metrics memory          # Show memory usage
```

**Expected:** `Deployed` status, health checks passing.

### SSH Diagnostics (if needed)
```bash
fly ssh console             # SSH into the VM
# Inside VM:
ps aux                      # Check if app is running
curl localhost:8080/api     # Test internal endpoint
env | grep -i db            # Check DB URL is set
```

---

## Step 7: Test Authentication Flow

### Get a JWT (once platform owner is seeded)

```bash
curl -X POST https://stonesuite-backend.fly.dev/api/auth/tenant-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "itadmin@elevationstone.com",
    "password": "Admin@1234"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "itadmin@elevationstone.com",
    "tenantId": "...",
    "isPlatformAdmin": true
  }
}
```

### Bootstrap Platform Owner (first time only)

```bash
curl -X POST https://stonesuite-backend.fly.dev/api/platform/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Elevation Stone",
    "slug": "elevationstone",
    "email": "itadmin@elevationstone.com",
    "password": "Admin@1234",
    "fullName": "Admin User"
  }'
```

**Expected response (201 Created):**
```json
{
  "success": true,
  "tenantId": "...",
  "message": "Platform owner created. Email sent with password-setup link."
}
```

**Subsequent attempts return 409 Conflict** (idempotency guard).

---

## Step 8: Connect Frontend

Once the backend is running, configure the frontend to point to it:

### Option A: Cloudflare Pages (Recommended)

1. Go to Cloudflare Pages dashboard
2. Select your StoneSuite project
3. Settings → Environment variables
4. Add:
   ```
   VITE_API_BASE_URL = https://stonesuite-backend.fly.dev/api
   ```
5. Redeploy (or push a commit to trigger auto-deploy)

### Option B: Local Development

Create `frontend/.env.local`:
```
VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
```

Then:
```bash
cd frontend
npm run dev
```

---

## Step 9: Ongoing Deploys

Every time you push code changes to the backend:

```bash
cd backend
fly deploy                   # Rolling deploy, zero downtime
```

**Zero-downtime deploys** work because:
- App is stateless (no in-memory session storage)
- New VM is ready before old one shuts down
- Health check ensures only healthy VMs get traffic

### Scale to 2 instances (optional, for rolling deploys)

```bash
fly scale count 2           # 2 replicas of the app
fly deploy                  # Will restart one at a time
```

---

## Troubleshooting

### Issue: Health Check Failing

**Symptom:** Logs show `HTTP GET /api failed` repeatedly, app never deploys.

**Causes:**
1. `CONTROL_PLANE_DB_URL` not set or invalid
2. Port mismatch (fly.toml says 8080, app listens elsewhere)
3. Migrations failing at startup

**Fix:**
```bash
fly logs --lines 50        # Look for error messages
fly ssh console            # SSH in to inspect
fly secrets list           # Verify secrets are set
```

### Issue: Database Connection Timeout

**Symptom:** Logs show `CRITICAL ERROR: Failed to initialize control plane: connection timeout`.

**Cause:** Neon connection string is wrong or Neon is down.

**Fix:**
1. Verify connection string in Neon console
2. Test locally: `psql "postgres://user:pass@..."`
3. Update secret: `fly secrets set CONTROL_PLANE_DB_URL="..."`
4. Redeploy: `fly deploy`

### Issue: Permission Denied / Authentication Failed

**Symptom:** Login returns 401, auth middleware rejecting tokens.

**Cause:** `JWT_SECRET` doesn't match between deploys or was not set.

**Fix:**
```bash
# Generate a NEW secret and set it
fly secrets set JWT_SECRET="$(openssl rand -base64 48)"
fly deploy

# Existing tokens (signed with old secret) will no longer work.
# Users must log in again.
```

---

## Monitoring & Maintenance

### View CPU / Memory Usage

```bash
fly metrics cpu
fly metrics memory
fly metrics request_rate
fly metrics response_time
```

### Check App Logs for Errors

```bash
fly logs --lines 200 | grep -i error
fly logs --lines 200 | grep -i critical
```

### Update Secrets Without Downtime

```bash
fly secrets set KEY=new_value  # No redeploy needed for secret changes
```

### Rollback to Previous Version

```bash
fly releases           # List all releases
fly releases show      # Show current release
fly scale count 2      # Scale to 2 instances first
fly deploy             # Deploy new version (rolls back on health check fail)
```

---

## Monitoring Dashboard (Fly.io)

Visit `https://fly.io` → select `stonesuite-backend` app:
- **Monitors:** CPU, memory, request rate, response time
- **Logs:** Real-time application logs
- **Settings:** Scale, restart, destroy app
- **Secrets:** List all secrets (values hidden)
- **Releases:** Deploy history, rollback options

---

## Cost Estimate

- **Always-on VM** (256MB, 1 shared CPU, iad): ~$3/month
- **Data transfer** (very small): ~$0/month
- **Neon DB** (free tier up to 3 branches, then ~$7/month for pro): ~$0 for dev
- **Cloudflare Pages** (frontend): Free
- **Total: ~$3–10/month** for small-scale deployment

---

## Next Steps (Optional Enhancements)

1. **Scale to 2 instances** for zero-downtime deploys
2. **Add Sentry/DataDog** for error tracking and APM
3. **Set up GitHub Actions** for automated tests before deploy
4. **Add backup strategy** (Neon snapshots, `pg_dump` exports)
5. **Implement rate limiting** on public endpoints
6. **Add CDN caching** (Cloudflare Cache Rules for static assets)

---

## Questions?

Refer to:
- `CLAUDE.md` — architecture, rules, multi-tenant design
- `docs/architecture.md` — detailed design decisions
- `docs/api-contracts.md` — API endpoint reference
- Fly.io docs: https://fly.io/docs/
- Neon docs: https://neon.tech/docs/
