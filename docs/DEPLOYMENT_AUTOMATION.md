# Automated Deployment Guide

This document explains how to set up fully automated deployments for StoneSuite using GitHub Actions.

## Overview

We have two GitHub Actions workflows:
- **Deploy Frontend** (`deploy-frontend.yml`) — Builds and deploys frontend to Cloudflare Pages
- **Deploy Backend** (`deploy-backend.yml`) — Builds, tests, and deploys backend to Fly.io

Both workflows trigger **automatically on push to `master` branch** and include basic checks (linting, tests) before deployment.

## Setup Instructions

### 1. Frontend — Cloudflare Pages Secrets

You need to provide GitHub with your Cloudflare API credentials:

```bash
# Go to GitHub repo → Settings → Secrets and variables → Actions
# Add the following secrets:

VITE_API_BASE_URL = "https://stonesuite-backend.fly.dev/api"
CLOUDFLARE_API_TOKEN = "<your-cloudflare-api-token>"
CLOUDFLARE_ACCOUNT_ID = "<your-cloudflare-account-id>"
```

#### How to get these values:

**Cloudflare API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a new token with permissions:
   - `Account.Cloudflare Pages` → Edit
   - `Account.Workers Scripts` → Edit
3. Copy the token and save as `CLOUDFLARE_API_TOKEN` in GitHub

**Cloudflare Account ID:**
1. Go to https://dash.cloudflare.com/
2. Copy the Account ID from the sidebar (looks like `a1b2c3d4e5f6g7h8`)
3. Save as `CLOUDFLARE_ACCOUNT_ID` in GitHub

**API Base URL:**
- Use `https://stonesuite-backend.fly.dev/api` (or your custom domain if you set one up)

### 2. Backend — Fly.io Secrets (GitHub Actions)

You need to provide GitHub with your Fly.io API token:

```bash
# Go to GitHub repo → Settings → Secrets and variables → Actions
# Add the following secret:

FLY_API_TOKEN = "<your-fly-api-token>"
```

#### How to get the Fly.io API token:

```bash
# On your local machine, after running `fly auth login`:
fly tokens create deploy -x 87600h  # 10-year token for CI/CD

# Copy the output token and save as FLY_API_TOKEN in GitHub
```

### 3. Backend — Fly.io Secrets (Production)

These secrets are **already set** on your Fly.io app. Make sure they're still there:

```bash
fly secrets list
```

You should see:
- `CONTROL_PLANE_DB_URL` (Neon connection string)
- `PROVISION_ADMIN_DB_URL` (Neon direct connection)
- `JWT_SECRET`
- `SECRET_ENCRYPTION_KEY`
- `SMTP_HOST`, `SENDER_EMAIL`, `SENDER_PASSWORD` (email, optional)

If any are missing, set them:

```bash
fly secrets set CONTROL_PLANE_DB_URL="postgres://..." \
  PROVISION_ADMIN_DB_URL="postgres://..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  SECRET_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

## How Deployments Work

### Frontend Deployment Flow

1. You push code to `master` branch (in `frontend/` folder)
2. GitHub Actions triggers `deploy-frontend.yml`
3. Workflow:
   - Checks out code
   - Installs npm dependencies
   - Runs linter (`npm run lint`)
   - Builds frontend (`npm run build`)
   - Deploys to Cloudflare Pages using API
4. Site is live at `stonesuite.pages.dev` (or custom domain)

### Backend Deployment Flow

1. You push code to `master` branch (in `backend/` folder)
2. GitHub Actions triggers `deploy-backend.yml`
3. Workflow:
   - Checks out code
   - Sets up Go 1.25
   - Runs tests (`go test ./...`)
   - Builds binary (`go build ./...`)
   - Deploys to Fly.io (`fly deploy`)
4. Fly.io health check passes when `/api` returns 200
5. **Migrations auto-run** on startup (via `ApplyControlPlaneMigrations()` in `main.go`)
6. Backend is live at `stonesuite-backend.fly.dev`

## Monitoring Deployments

### View GitHub Actions logs

1. Go to your GitHub repo → **Actions** tab
2. Select the workflow run you want to inspect
3. View logs for each job/step

### View Fly.io logs

```bash
# Stream live logs from your backend
fly logs

# Or view recent logs
fly logs --lines=100
```

### View Cloudflare Pages deployment logs

1. Go to Cloudflare Dashboard → Pages → stonesuite
2. Click **Deployments** to see build/deploy history
3. Click a deployment to see detailed logs

## Skipping Deployments

If you only changed docs or non-code files, you can skip the workflows:

```bash
git commit -m "docs: update README [skip ci]"
```

The workflows check for changes in `frontend/**`, `backend/**`, and their respective workflow files. If only other files changed, deployments are skipped.

## Rollback Procedure

If a deployment breaks production:

### Frontend Rollback (Cloudflare Pages)

1. Go to Cloudflare Dashboard → Pages → stonesuite → **Deployments**
2. Find the last known-good deployment
3. Click **... → Rollback to this deployment**

### Backend Rollback (Fly.io)

```bash
# View recent releases
fly releases

# Rollback to previous release
fly releases rollback <release-id>
```

Alternatively, revert your commit and push:

```bash
git revert HEAD
git push origin master
# GitHub Actions will auto-deploy the reverted code
```

## Environment Variables

### Frontend (.env.production)
- `VITE_API_BASE_URL` — backend API URL (set as GitHub secret, injected at build time)

### Backend (Fly.io secrets)
- `PORT` — server port (default: 8080, optional)
- `CONTROL_PLANE_DB_URL` — Neon pooled connection
- `PROVISION_ADMIN_DB_URL` — Neon direct connection (for CREATE DATABASE)
- `JWT_SECRET` — HS256 signing key
- `SECRET_ENCRYPTION_KEY` — AES-256 for DSN encryption
- `CORS_ORIGIN` — frontend URL
- `FRONTEND_URL` — same as CORS_ORIGIN
- `SMTP_HOST`, `SENDER_EMAIL`, `SENDER_PASSWORD` — email config (optional)

See `CLAUDE.md` for details.

## Troubleshooting

### Frontend build fails in CI but works locally

- Check Node version: `node --version`
- Clear npm cache: `npm cache clean --force`
- Try: `npm ci` instead of `npm install` (more strict lockfile)
- Ensure all TypeScript types are correct (strict mode)

### Backend deployment fails

- Check Go version: `go version` (should be 1.25+)
- Run tests locally: `cd backend && go test ./...`
- Check logs: `fly logs`
- Verify secrets are set: `fly secrets list`

### Cloudflare Pages deployment stuck

- Check GitHub Actions logs for build errors
- Try manual redeploy from Cloudflare dashboard
- Ensure `dist/` directory exists and is not empty

### Fly.io deployment fails

- Check `fly.toml` is correct
- Verify Docker build: `docker build -f backend/Dockerfile -t test .`
- Stream logs: `fly logs`
- Check migrations: look for schema_version errors in logs

## Next Steps

1. **Add GitHub secrets** (see Setup Instructions above)
2. **Verify fly.toml** is committed to repo
3. **Test a merge** to master and watch the Actions run
4. **Monitor first deployment** via Fly logs and Cloudflare dashboard
5. **Set up alerts** (optional) — GitHub, Fly.io, or Sentry for errors

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Pages Action](https://github.com/cloudflare/pages-action)
- [Fly.io CLI Deploy](https://fly.io/docs/flyctl/deploy/)
- [Fly.io GitHub Actions Docs](https://fly.io/docs/app-guides/github-actions/)
