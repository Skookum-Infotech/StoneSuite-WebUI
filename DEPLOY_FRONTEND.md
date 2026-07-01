# StoneSuite Frontend Deployment Guide — Cloudflare Pages

**Status:** ✅ Production-ready  
**Last updated:** 2026-06-05  
**Target:** Cloudflare Pages (auto-deploy from GitHub, free, global CDN)

---

## Pre-Deployment Checklist

- [ ] `frontend/.env.production` exists with `VITE_API_BASE_URL`
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
VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api
```

**Important:** Replace `stonesuite-backend.fly.dev` with your actual deployed backend URL.

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
2. Verify `VITE_API_BASE_URL=https://stonesuite-backend.fly.dev/api` is set
3. **Rerun deployment** (click the latest deployment → Retry)

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
