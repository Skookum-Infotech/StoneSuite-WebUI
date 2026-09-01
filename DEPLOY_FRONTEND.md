# StoneSuite Frontend Deployment Guide — Cloudflare Pages

**Status:** ✅ Production-ready  
**Last updated:** 2026-06-05  
**Target:** Cloudflare Pages (auto-deploy from GitHub, free, global CDN)

---

## Pre-Deployment Checklist

- [ ] `frontend/.env.production` exists with `VITE_API_BASE_URL`
- [ ] `VITE_NOTIFY_BASE_URL` is set **in the build step's own environment** (see below)
- [ ] Backend URL is stable (e.g., `https://stonesuite-backend.fly.dev`)
- [ ] GitHub repository is connected to Cloudflare Pages
- [ ] `npm run build` succeeds locally with no errors
- [ ] `frontend/package.json` has `"build": "vite build"` script
- [ ] Cloudflare account created and domain configured (optional, can use `.pages.dev`)

---

## Step 1: Verify Local Build

Ensure the frontend builds successfully locally.

```bash
cd frontend

# Install dependencies
npm install

# Build
npm run build

# Expected: dist/ directory created, no TypeScript or build errors
ls -la dist/
```

---

## Step 2: Update Environment Variable

Edit or create `frontend/.env.production`:

```
VITE_API_BASE_URL=/api
```

**This must stay a relative path for this (Cloudflare Pages / GitHub Actions) pipeline — do not
point it at the backend URL directly.** See "Exception: the Azure DevOps dev pipeline" below for
the one deployment that intentionally does the opposite.

`/api/*` is proxied to the backend by the Pages Function in `functions/api/[[path]].ts`, which keeps
the API *same-origin* with the app. That is load-bearing for authentication, not a nicety: the
backend issues `auth_token` as a `SameSite=Lax` cookie, and browsers drop a Lax cookie that arrives
from a different site. Pointing `VITE_API_BASE_URL` straight at `https://stonesuite-backend.fly.dev`
makes every API call cross-site, so the session cookie is silently discarded, the JWT survives only
in memory, and **users get logged out on every page refresh**.

Set the backend origin on the Pages project instead (Settings → Environment variables):

```
API_ORIGIN=https://stonesuite-backend.fly.dev
```

**`API_ORIGIN` is required, and must be set in BOTH the Production and Preview variable sets.**
Cloudflare Pages keeps those two sets separate, and which one applies depends on whether the
deploy's branch matches the project's production branch — so a deploy can land in Preview and read
an empty value. When it is missing or malformed, the Function returns a 500 naming the variable.

It used to fall back to the production backend when unset. That was removed deliberately: it meant a
misconfigured DEV or preview deploy silently read and wrote **production** data instead of failing.

### Exception: the Azure DevOps dev pipeline

One deployment deliberately does the opposite of everything above: Azure DevOps pipeline 6
(`StoneSuite - WebUI`) builds this same `master` branch for `dev-stonesuite-webui.pages.dev`, and
calls `dev-stonesuite-api.fly.dev` **directly, cross-origin** — no Pages Function proxy involved.
It sets, as build-step variables:

```
VITE_API_BASE_URL=https://dev-stonesuite-api.fly.dev/api
VITE_CROSS_ORIGIN_API=true
```

`vite.config.ts`'s `assertSameOriginApiBase` guard hard-fails an absolute `VITE_API_BASE_URL` unless
`VITE_CROSS_ORIGIN_API=true` is also set — that's what stops this exception from being copy-pasted
into a GitHub Actions build by accident. This only works because `dev-stonesuite-api`'s
`fly.dev.toml` runs with `COOKIE_SAME_SITE_MODE=none` and `APP_ENV=production` (the latter is what
puts `Secure` on the auth cookies, which browsers require alongside `SameSite=None`), which activates
the CSRF double-submit check in `stonesuite-backend/middleware/csrf.go`. `src/api/client.ts` already
echoes the `csrf_token` cookie back as `X-CSRF-Token` unconditionally, so no per-environment frontend
code path is needed — it's simply a no-op against prod, which never issues that cookie.

`functions/api/[[path]].ts` stays in the repo unchanged either way — GitHub Actions' prod build still
needs it, and this pipeline just doesn't exercise it.

**Do not set `VITE_CROSS_ORIGIN_API=true` on the GitHub Actions / prod pipeline.** Prod's backend
(`stonesuite-backend.fly.dev`) still runs `SameSite=Lax` with no CSRF token issued; forcing a
cross-origin base URL there would silently drop the auth cookie, not merely warn.

### `VITE_NOTIFY_BASE_URL` — required on every pipeline

`stonesuite-notify` is a separate service on its own origin; it is **not** proxied through
`functions/api/[[path]].ts`. Every build must therefore be told where it lives:

```
VITE_NOTIFY_BASE_URL=https://stonesuite-notify.fly.dev        # prod
VITE_NOTIFY_BASE_URL=https://dev-stonesuite-notify.fly.dev    # Azure DevOps dev pipeline
```

**It must be present in the environment of the `npm run build` step itself.** Vite inlines every
`VITE_*` value into the bundle at build time, so setting it as a Cloudflare Pages project variable,
an Azure App Service application setting, or a release/deploy-stage variable has no effect — the
string is already baked in by then. Common ways this goes wrong:

- **Azure DevOps:** a variable marked **"Keep this value secret"** is *not* auto-exported to the
  task environment. It must be mapped explicitly on the build task:
  ```yaml
  - script: npm run build
    env:
      VITE_NOTIFY_BASE_URL: $(VITE_NOTIFY_BASE_URL)
  ```
  Non-secret pipeline variables are exported automatically. Also check the variable's **scope** —
  a variable defined on the deploy stage never reaches the build stage.
- **Re-running only the deploy stage** republishes the *previously built* artifact. After adding
  the variable you must re-run the **build**, not just the deployment.
- **Setting it on the hosting project** (Pages / App Service). Runtime config cannot reach a
  static SPA bundle.

`vite.config.ts`'s `assertNotifyBaseUrl` fails the build when this is missing or same-origin, so a
misconfigured pipeline now stops with an actionable error instead of shipping a bell that silently
404s. Confirm what actually shipped by grepping the deployed bundle:

```bash
curl -s https://<your-pages-host>/ | grep -o '/assets/index-[^"]*\.js' | head -1 \
  | xargs -I{} curl -s https://<your-pages-host>{} | grep -o 'baseURL:`[^`]*`'
```

### Checking the proxy is live

Every response the Function produces carries `X-Proxied-To` naming the upstream it used:

```bash
curl -s -D - -o /dev/null https://<your-pages-host>/api/healthz | grep -i x-proxied-to
```

If that header is **absent**, the Function is not deployed and Pages is serving the SPA's
`index.html` for `/api/*` — which shows up as `text/html` on GET and **405** on POST (login breaks).
That means `functions/` did not make it into the deployed bundle; see the build artifact notes below.

---

## Step 3: Connect GitHub to Cloudflare Pages (One-Time Setup)

### If using Cloudflare Pages for the first time:

1. Log in to **Cloudflare Dashboard** → **Pages** → **Create a project**
2. Click **Connect to Git**
3. Authorize Cloudflare to access your GitHub account
4. Select the **StoneSuite** repository
5. Click **Begin setup**

### Configure Build Settings

When prompted, enter:

| Field | Value |
|-------|-------|
| **Production branch** | `feat/dynamic-crm-platform` (or `main` if you want) |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `frontend` |

**Example:**

```
Build command:    npm run build
Build output dir: dist
Root directory:   frontend
```

---

## Step 4: Set Environment Variables in Cloudflare Pages

After selecting build settings, you'll see **Environment variables** section.

### Add Variables

1. Click **Add environment variable**
2. Set **Variable name:** `VITE_API_BASE_URL`
3. Set **Value:** `https://stonesuite-backend.fly.dev/api` (or your backend URL)
4. Click **Save**

**Note:** This same variable applies to both **Production** and **Preview** environments. If you want different values, click "Add secret" and specify per-environment.

---

## Step 5: Deploy

### Option A: Auto-Deploy from GitHub (Recommended)

Once configured, every push to `feat/dynamic-crm-platform` (or your selected branch) automatically triggers a build and deploy.

**First deploy:**
1. Click **Save and Deploy** in Cloudflare Pages
2. Cloudflare clones the repo, runs `npm run build`, and uploads `dist/` to the CDN
3. Your site is live at `https://stonesuite.pages.dev` (or your custom domain)

**Subsequent deploys:**
- Push code to GitHub → Cloudflare detects → auto-builds and deploys in ~2–5 minutes

### Option B: Manual Redeploy

If you want to redeploy the current code (e.g., after changing env vars):

1. Cloudflare Pages dashboard → Select **stonesuite** project
2. Click **View deployments**
3. Find the latest deployment → Click the **⋮** menu → **Retry deployment**

---

## Step 6: Verify Deployment

### Check Build Status

1. **Cloudflare Pages dashboard** → **stonesuite** → **View deployments**
2. Latest deployment should show **Status: Success** (green checkmark)
3. If **Failed**, click the deployment to see error logs

### Test the Frontend

Navigate to your deployed URL:

```bash
# If using Cloudflare's default domain:
https://stonesuite.pages.dev

# If using a custom domain:
https://dev.stonesuite.app  (example)
```

**Expected:**
- Page loads without errors
- No blank white screen or 404
- Console shows no CORS errors

### Test Authentication

1. Navigate to `/auth/login`
2. Enter email and password
3. Click "Login"
4. **Check browser console (F12)** for any errors:
   - If you see `CORS error` or `Failed to fetch` → backend URL is wrong in env vars
   - If you see `401 Unauthorized` → credentials are wrong or backend is unreachable

---

## Step 7: Set Custom Domain (Optional)

To use a custom domain instead of `stonesuite.pages.dev`:

1. **Cloudflare Pages dashboard** → **stonesuite** → **Settings** → **Domains**
2. Click **Add a domain**
3. Enter your domain (e.g., `dev.stonesuite.app`)
4. Follow DNS setup instructions (Cloudflare will auto-fill CNAME records if your domain is on Cloudflare)

**Note:** Custom domain requires Cloudflare to manage your DNS.

---

## Step 8: Update Backend CORS Settings

Now that the frontend is deployed, update the backend to allow the frontend's origin.

### Update `backend/fly.toml`

```toml
[env]
  CORS_ORIGIN  = "https://stonesuite.pages.dev"    # or your custom domain
  FRONTEND_URL = "https://stonesuite.pages.dev"    # same
```

### Deploy Backend

```bash
cd backend
fly deploy
```

---

## Environment Variables for Different Environments

### Development

**`frontend/.env.local` (local machine)**
```
VITE_API_BASE_URL=http://localhost:8080/api
```

### Staging / Preview

**Cloudflare Pages → Preview environment**
- Set `VITE_API_BASE_URL` to a staging backend URL (e.g., staging-backend.fly.dev)
- Every pull request auto-deploys a preview with these env vars

### Production

**Cloudflare Pages → Production environment**
- Set `VITE_API_BASE_URL` to the production backend URL (e.g., stonesuite-backend.fly.dev)
- Only the main branch (or your selected production branch) deploys here

---

## Troubleshooting

### Issue: Build Failing on Cloudflare

**Symptom:** Deployment shows "Build failed" in Cloudflare Pages.

**Check build logs:**
1. Click the failed deployment
2. Scroll down to see error details
3. Common causes:
   - Missing dependencies (run `npm install` locally first)
   - TypeScript errors (run `npm run build` locally to reproduce)
   - Environment variables not set

**Fix:**
```bash
# Locally, verify build works
cd frontend
npm install
npm run build

# If it fails, fix errors locally, commit, and push
git add . && git commit -m "fix: resolve build errors"
git push origin feat/dynamic-crm-platform

# Cloudflare will auto-retry
```

### Issue: CORS Error in Browser Console

**Symptom:** Login fails with `Access to XMLHttpRequest blocked by CORS policy`.

**Cause:** Frontend's origin is not in the backend's `CORS_ORIGIN` env var.

**Fix:**
1. Note your frontend URL (e.g., `https://stonesuite.pages.dev`)
2. Update `backend/fly.toml`:
   ```toml
   CORS_ORIGIN = "https://stonesuite.pages.dev"
   ```
3. Deploy backend:
   ```bash
   cd backend
   fly deploy
   ```

### Issue: API Base URL Not Recognized

**Symptom:** Frontend shows "Cannot reach API" or 404 on API calls.

**Cause:** `VITE_API_BASE_URL` not set in Cloudflare Pages environment.

**Fix:**
1. Cloudflare Pages dashboard → stonesuite → **Settings** → **Environment variables**
2. Verify `VITE_API_BASE_URL=/api` is set (it must stay relative — see above), and that
   `API_ORIGIN=https://stonesuite-backend.fly.dev` is set in both variable sets
3. **Rerun deployment** (click the latest deployment → Retry)

### Issue: Notification Bell Empty / Notify Calls Hit the App's Own Host

**Symptom:** `/api/notifications/summary` and `/api/notifications` are requested against the Pages
host (e.g. `dev-stonesuite-webui.pages.dev`) instead of the notify service, and return 404 or HTML.

**Cause:** `VITE_NOTIFY_BASE_URL` was missing from the environment of the **build step**, so
`src/api/notifyClient.ts` fell back to `baseURL: undefined` and axios issued relative URLs. Setting
it on the Pages project or an App Service is too late — Vite inlines `VITE_*` at build time.

**Fix:** See "`VITE_NOTIFY_BASE_URL` — required on every pipeline" above. Builds from this commit
onward fail loudly instead of shipping this silently.

### Issue: Build Always Says "No Build Output"

**Symptom:** Deployment passes but frontend shows 404.

**Cause:** Build output directory is wrong, or `dist/` was not created.

**Fix:**
1. Cloudflare Pages → **Settings** → **Builds & deployments**
2. Verify:
   - **Build command:** `npm run build` (exact)
   - **Build output directory:** `dist` (exact)
   - **Root directory:** `frontend` (exact)
3. Click **Retry deployment**

---

## Monitoring & Analytics

### View Deployment History

**Cloudflare Pages dashboard** → **stonesuite** → **View deployments**
- See all past deployments, success/fail status, build time
- Click any deployment to see logs

### View Analytics

**Cloudflare Pages dashboard** → **stonesuite** → **Analytics**
- Request count, cache hit rate, bandwidth, status codes
- Identify slow or failing requests

### Error Reporting

For production errors, enable **Sentry** or **Datadog** in the frontend:
```bash
npm install @sentry/react --save
```

Then configure in `frontend/src/main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
});
```

---

## Caching & Performance

### Cloudflare Cache Rules (Optional)

To cache static assets (JS, CSS, images) for 24 hours:

1. **Cloudflare dashboard** → **your domain** → **Rules** → **Cache Rules**
2. Create a rule:
   - **URL path contains:** `/assets/` OR matches `/\.js$/` OR `/\.css$/`
   - **Cache:** `Cache everything` with TTL 86400 (24h)

### Browser Cache Headers

The Vite build outputs files with content hashes (e.g., `main.abc123.js`). These have infinite cache-busting. `index.html` is never cached (so new deployments are picked up immediately).

---

## Rollback to Previous Version

If you need to revert to a previous deployment:

1. **Cloudflare Pages dashboard** → **stonesuite** → **View deployments**
2. Find the deployment you want to rollback to
3. Click the **⋮** menu → **Rollback to this deployment**

The frontend will immediately serve the old version.

---

## Cost Estimate

- **Cloudflare Pages:** Free (unlimited builds, deployments, bandwidth)
- **Custom domain (optional):** Included with Cloudflare domain or use .pages.dev (free)
- **Total: Free** (unless you add Cloudflare Workers or other paid features)

---

## GitHub Actions (Optional Enhancement)

To run tests before deploy, add `.github/workflows/deploy.yml`:

```yaml
name: Deploy Frontend

on:
  push:
    branches: [feat/dynamic-crm-platform]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm install && npm run build && npm run lint
```

This ensures code quality before Cloudflare builds.

---

## Next Steps

1. **Set up custom domain** (optional, improves branding)
2. **Add error tracking** (Sentry, Datadog)
3. **Enable Cloudflare Analytics** to monitor user activity
4. **Set up GitHub branch protection** to require reviews before merging
5. **Configure preview deployments** for pull requests (built-in to Cloudflare Pages)

---

## Questions?

Refer to:
- `CLAUDE.md` — architecture, development rules
- `DEPLOY_BACKEND.md` — backend deployment guide
- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- Vite docs: https://vitejs.dev/guide/env-and-modes.html
